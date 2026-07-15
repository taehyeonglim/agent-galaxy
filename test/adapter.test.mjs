import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, scanAgents, groupAgents, buildData, mergeConfig, createGalaxyServer } from '../galaxy.mjs';
import { validateData } from '../schema.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FM = (body) => `---\n${body}\n---\n\nSystem prompt here.`;

test('parseFrontmatter extracts flat keys', () => {
  const fm = parseFrontmatter(FM('name: paper-finder\nmodel: sonnet\ndescription: finds papers'));
  assert.equal(fm.name, 'paper-finder');
  assert.equal(fm.model, 'sonnet');
});
test('parseFrontmatter: no frontmatter → null', () => assert.equal(parseFrontmatter('# just markdown'), null));
test('parseFrontmatter strips quotes', () => {
  assert.equal(parseFrontmatter(FM(`name: "quoted-bot"`)).name, 'quoted-bot');
});

function makeAgentsDir() {
  const dir = mkdtempSync(join(tmpdir(), 'ag-'));
  writeFileSync(join(dir, 'a.md'), FM('name: alpha-bot\nmodel: opus'));
  writeFileSync(join(dir, 'b.md'), FM('name: beta-bot\nmodel: sonnet'));
  mkdirSync(join(dir, 'sub'));
  writeFileSync(join(dir, 'sub', 'c.md'), FM('name: gamma-bot'));
  writeFileSync(join(dir, 'notes.txt'), 'not an agent');
  writeFileSync(join(dir, 'no-fm.md'), '# no frontmatter');
  return dir;
}

test('scanAgents: recursive, md+frontmatter only', () => {
  const agents = scanAgents(makeAgentsDir());
  assert.deepEqual(agents.map(a => a.name).sort(), ['alpha-bot', 'beta-bot', 'gamma-bot']);
  assert.equal(agents.find(a => a.name === 'gamma-bot').model, 'inherit');
});
test('groupAgents by model', () => {
  const g = groupAgents(scanAgents(makeAgentsDir()), 'model');
  assert.deepEqual([...g.keys()].sort(), ['inherit', 'opus', 'sonnet']);
});
test('groupAgents by dir', () => {
  const g = groupAgents(scanAgents(makeAgentsDir()), 'dir');
  assert.deepEqual([...g.keys()].sort(), ['agents', 'sub']);
});
test('buildData → schema-valid with default core', () => {
  const data = buildData(groupAgents(scanAgents(makeAgentsDir()), 'model'), { title: 'proj' });
  assert.deepEqual(validateData(data), []);
  assert.equal(data.meta.title, 'PROJ');
  assert.equal(data.cores.length, 1);
});
test('mergeConfig overrides team + adds links', () => {
  const base = buildData(groupAgents(scanAgents(makeAgentsDir()), 'model'), { title: 'proj' });
  const out = mergeConfig(base, { title: 'CUSTOM', teams: { opus: { color: '#FF4060', emoji: '🧠' } }, links: [['opus', 'sonnet', 'pipeline']] });
  assert.equal(out.meta.title, 'CUSTOM');
  assert.equal(out.teams.find(t => t.key === 'opus').emoji, '🧠');
  assert.equal(out.links.length, 1);
  assert.deepEqual(validateData(out), []);
});
test('server: serves index.html + maps /data.json to dataFile', async () => {
  const alt = join(tmpdir(), 'alt-data.json');
  writeFileSync(alt, JSON.stringify({ meta: { title: 'ALT' }, teams: [{ key: 'x', name: 'X', color: '#3ef0a0', agents: [{ name: 'y' }] }] }));
  const server = createGalaxyServer(ROOT, { dataFile: alt });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const html = await fetch(`http://localhost:${port}/`).then(r => r.text());
  assert.ok(html.includes('<canvas'));
  const d = await fetch(`http://localhost:${port}/data.json`).then(r => r.json());
  assert.equal(d.meta.title, 'ALT');
  const traversal = await fetch(`http://localhost:${port}/..%2f..%2fetc%2fpasswd`);
  assert.ok(traversal.status === 403 || traversal.status === 404);
  server.close();
});
