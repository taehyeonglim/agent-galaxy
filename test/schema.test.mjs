import { test } from 'node:test';
import assert from 'node:assert';
import { validateData, applyDefaults, DEFAULT_LINK_TYPES } from '../schema.mjs';

const VALID = {
  meta: { title: 'X LAB' },
  teams: [
    { key: 'a', name: 'Alpha', color: '#9370DB', agents: [{ name: 'bot-1' }] },
    { key: 'b', name: 'Beta', color: '#3ef0a0', agents: [{ name: 'bot-2', running: true }] },
  ],
  links: [['a', 'b', 'pipeline']],
  outposts: [{ key: 'obs', name: 'Observer', placement: 'below' }],
};

test('valid data → no errors', () => assert.deepEqual(validateData(VALID), []));
test('missing meta.title', () => assert.ok(validateData({ ...VALID, meta: {} }).some(e => e.includes('meta.title'))));
test('empty teams', () => assert.ok(validateData({ ...VALID, teams: [] }).some(e => e.includes('teams'))));
test('duplicate team key', () => {
  const d = { ...VALID, teams: [VALID.teams[0], { ...VALID.teams[1], key: 'a' }] };
  assert.ok(validateData(d).some(e => e.includes('duplicate')));
});
test('bad color', () => {
  const d = { ...VALID, teams: [{ ...VALID.teams[0], color: 'purple' }, VALID.teams[1]] };
  assert.ok(validateData(d).some(e => e.includes('color')));
});
test('link to unknown key', () => {
  const d = { ...VALID, links: [['a', 'nope', 'pipeline']] };
  assert.ok(validateData(d).some(e => e.includes('unknown to')));
});
test('link to outpost key is valid', () => {
  const d = { ...VALID, links: [['a', 'obs', 'cross']] };
  assert.deepEqual(validateData(d), []);
});
test('bad outpost placement', () => {
  const d = { ...VALID, outposts: [{ key: 'o', name: 'O', placement: 'left' }] };
  assert.ok(validateData(d).some(e => e.includes('placement')));
});
test('outpost key colliding with team key is rejected', () => {
  const d = { ...VALID, outposts: [{ key: 'a', name: 'Clash', placement: 'outer' }] };
  assert.ok(validateData(d).some(e => e.includes('outposts[0].key: duplicate')));
});
test('duplicate outpost keys are rejected', () => {
  const d = { ...VALID, outposts: [
    { key: 'o1', name: 'One', placement: 'outer' },
    { key: 'o1', name: 'Two', placement: 'below' },
  ] };
  assert.ok(validateData(d).some(e => e.includes('outposts[1].key: duplicate')));
});
test('applyDefaults fills linkTypes + arrays + meta', () => {
  const out = applyDefaults({ meta: { title: 'X' }, teams: VALID.teams });
  assert.equal(out.meta.subtitle, 'AGENT GALAXY');
  assert.deepEqual(out.links, []);
  assert.deepEqual(out.cores, []);
  assert.deepEqual(out.outposts, []);
  assert.equal(out.linkTypes.pipeline.color, DEFAULT_LINK_TYPES.pipeline.color);
});
test('applyDefaults merges user linkType override onto default', () => {
  const out = applyDefaults({ meta: { title: 'X' }, teams: VALID.teams, linkTypes: { pipeline: { color: '#ffffff' } } });
  assert.equal(out.linkTypes.pipeline.color, '#ffffff');
  assert.equal(out.linkTypes.pipeline.emphasis, true); // 기본값 보존
});
