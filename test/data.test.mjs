import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData } from '../schema.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('sample data.json is schema-valid', () => {
  const d = JSON.parse(readFileSync(join(ROOT, 'data.json'), 'utf8'));
  assert.deepEqual(validateData(d), []);
  assert.ok(d.teams.length >= 5, 'sample should look lively');
});

test('all fixtures are schema-valid', () => {
  const dir = join(ROOT, 'test', 'fixtures');
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  assert.ok(files.length >= 6);
  for (const f of files) {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    assert.deepEqual(validateData(d), [], `${f} invalid`);
  }
});
