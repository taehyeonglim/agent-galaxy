/* schema.mjs — data.json contract: validation + defaults.
   Shared by the viewer (browser ESM) and the adapter (Node). Zero deps. */

export const DEFAULT_LINK_TYPES = {
  pipeline: { color: '#3ef0a0', label: 'Core Flow', emphasis: true },
  cross:    { color: '#aab4d8', label: 'Secondary' },
  revision: { color: '#ff69b4', label: 'Revision' },
  expert:   { color: '#2fd0ff', label: 'Expert' },
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const PLACEMENTS = ['above', 'below', 'outer'];

export function validateData(d) {
  const errs = [];
  if (!d || typeof d !== 'object') return ['data.json: root must be an object'];
  if (!d.meta || typeof d.meta.title !== 'string' || !d.meta.title.trim())
    errs.push('meta.title: required non-empty string');
  if (!Array.isArray(d.teams) || d.teams.length === 0) {
    errs.push('teams: required non-empty array');
    return errs;
  }
  const keys = new Set();
  d.teams.forEach((t, i) => {
    const at = `teams[${i}]`;
    if (!t.key || typeof t.key !== 'string') errs.push(`${at}.key: required string`);
    else if (keys.has(t.key)) errs.push(`${at}.key: duplicate "${t.key}"`);
    else keys.add(t.key);
    if (!t.name) errs.push(`${at}.name: required`);
    if (!HEX.test(t.color || '')) errs.push(`${at}.color: required hex color like #9370DB`);
    if (!Array.isArray(t.agents)) errs.push(`${at}.agents: required array`);
    else t.agents.forEach((a, j) => { if (!a || !a.name) errs.push(`${at}.agents[${j}].name: required`); });
  });
  (d.outposts || []).forEach((o, i) => {
    const at = `outposts[${i}]`;
    if (!o.key) errs.push(`${at}.key: required`); else keys.add(o.key);
    if (!o.name) errs.push(`${at}.name: required`);
    if (!PLACEMENTS.includes(o.placement)) errs.push(`${at}.placement: must be one of ${PLACEMENTS.join('|')}`);
  });
  (d.links || []).forEach((l, i) => {
    if (!Array.isArray(l) || l.length < 3) { errs.push(`links[${i}]: must be [from, to, type]`); return; }
    if (!keys.has(l[0])) errs.push(`links[${i}]: unknown from "${l[0]}"`);
    if (!keys.has(l[1])) errs.push(`links[${i}]: unknown to "${l[1]}"`);
  });
  (d.cores || []).forEach((c, i) => { if (!c.id) errs.push(`cores[${i}].id: required`); });
  return errs;
}

export function applyDefaults(d) {
  const meta = { subtitle: 'AGENT GALAXY', version: '', accent: '#d94a9a', coreLabel: 'CORE', ...d.meta };
  const linkTypes = {};
  for (const [k, v] of Object.entries(DEFAULT_LINK_TYPES)) linkTypes[k] = { ...v };
  for (const [k, v] of Object.entries(d.linkTypes || {})) linkTypes[k] = { ...linkTypes[k], ...v };
  return { ...d, meta, linkTypes, links: d.links || [], cores: d.cores || [], outposts: d.outposts || [] };
}
