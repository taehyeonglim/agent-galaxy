#!/usr/bin/env node
/* galaxy.mjs — agent-galaxy adapter.
   Scans Claude Code agent definitions (.claude/agents/*.md) into data.json,
   and serves the viewer. Node >= 18, zero dependencies. */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createServer as httpServer } from 'node:http';
import { join, extname, resolve, relative, basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateData } from './schema.mjs';

export const PALETTE = ['#FF4060', '#FF8C42', '#FFD700', '#3ef0a0', '#5ad6ff', '#9370DB', '#FF69B4', '#4682B4'];

export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

export function scanAgents(dir) {
  const agents = [];
  (function walk(d) {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (extname(e) === '.md') {
        const fm = parseFrontmatter(readFileSync(p, 'utf8'));
        if (!fm || !fm.name) continue;
        agents.push({ name: fm.name, model: fm.model || 'inherit', dir: relative(dir, dirname(p)) || '.' });
      }
    }
  })(dir);
  return agents;
}

export function groupAgents(agents, mode = 'model') {
  const groups = new Map();
  for (const a of agents) {
    const key = mode === 'dir' ? (a.dir === '.' ? 'agents' : a.dir) : a.model;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  return groups;
}

export function buildData(groups, opts = {}) {
  const teams = [...groups.entries()].map(([key, agents], i) => ({
    key: key.replace(/[^\w-]/g, '-'),
    name: key.charAt(0).toUpperCase() + key.slice(1),
    role: `${agents.length} AGENTS`,
    color: PALETTE[i % PALETTE.length],
    agents: agents.map(a => ({ name: a.name, running: false })),
  }));
  let data = {
    meta: { title: String(opts.title || 'MY AGENTS').toUpperCase(), subtitle: 'AGENT GALAXY', version: 'v1' },
    teams,
    links: [],
    cores: [{ id: 'CLAUDE CODE', label: 'orchestrator', color: '#ff9a5a' }],
  };
  if (opts.config) data = mergeConfig(data, opts.config);
  const errs = validateData(data);
  if (errs.length) throw new Error('generated data invalid:\n' + errs.join('\n'));
  return data;
}

export function mergeConfig(data, cfg) {
  const out = { ...data };
  if (cfg.title) out.meta = { ...out.meta, title: cfg.title };
  if (cfg.meta) out.meta = { ...out.meta, ...cfg.meta };
  if (cfg.teams) out.teams = out.teams.map(t => (cfg.teams[t.key] ? { ...t, ...cfg.teams[t.key], key: t.key } : t));
  for (const k of ['links', 'cores', 'outposts', 'linkTypes']) if (cfg[k]) out[k] = cfg[k];
  return out;
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif',
};

export function createGalaxyServer(root, { dataFile } = {}) {
  const absRoot = resolve(root);
  return httpServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
    if (p === '/') p = '/index.html';
    const isData = p === '/data.json' && dataFile;
    const file = isData ? resolve(dataFile) : resolve(join(absRoot, p));
    if (!isData && !file.startsWith(absRoot + '/') && file !== absRoot) { res.writeHead(403); return res.end(); }
    if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(file));
  });
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i === -1 ? null : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
  const root = dirname(fileURLToPath(import.meta.url));
  const scan = flag('--scan'), serve = flag('--serve'), port = Number(flag('--port')) || 8420;
  const groupBy = flag('--group-by') || 'model';
  const out = typeof flag('--out') === 'string' ? flag('--out') : join(root, 'data.json');
  const dataFile = typeof flag('--data') === 'string' ? flag('--data') : null;
  if (!scan && !serve) {
    console.log('usage: node galaxy.mjs [--scan <agents-dir>] [--group-by model|dir] [--out data.json] [--serve] [--port 8420] [--data <file>]');
    process.exit(1);
  }
  if (scan) {
    const dir = typeof scan === 'string' ? resolve(scan) : join(process.cwd(), '.claude', 'agents');
    if (!existsSync(dir)) { console.error(`✖ no agents dir: ${dir}`); process.exit(1); }
    const agents = scanAgents(dir);
    if (!agents.length) { console.error(`✖ no agent .md files with frontmatter in ${dir}`); process.exit(1); }
    const cfgPath = join(process.cwd(), 'galaxy.config.json');
    const config = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : null;
    const title = basename(resolve(dir, '..', '..'));
    writeFileSync(out, JSON.stringify(buildData(groupAgents(agents, groupBy), { title, config }), null, 2));
    console.log(`✔ ${agents.length} agents → ${out}`);
  }
  if (serve) {
    createGalaxyServer(root, { dataFile }).listen(port, () => console.log(`✦ agent-galaxy → http://localhost:${port}`));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
