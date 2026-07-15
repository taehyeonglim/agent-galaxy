import { test } from 'node:test';
import assert from 'node:assert';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createGalaxyServer } from '../galaxy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CASES = ['sample', 'minimal', 'large', 'cores0', 'cores1', 'cores2', 'cores5'];
mkdirSync(join(ROOT, 'test', 'screens'), { recursive: true });

test('viewer renders every fixture: zero console errors + non-blank canvas', { timeout: 180_000 }, async () => {
  const browser = await chromium.launch();
  try {
    for (const name of CASES) {
      const dataFile = name === 'sample' ? join(ROOT, 'data.json') : join(ROOT, 'test', 'fixtures', `${name}.json`);
      const server = createGalaxyServer(ROOT, { dataFile });
      await new Promise(r => server.listen(0, r));
      const errors = [];
      let page, painted;
      try {
        page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
        page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
        await page.goto(`http://localhost:${server.address().port}/`);
        await page.waitForTimeout(4500); // boot 3.2s + settle
        painted = await page.evaluate(() => {
          const c = document.getElementById('gx');
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let n = 0; for (let i = 3; i < d.length; i += 400) if (d[i] > 0) n++;
          return n;
        });
        await page.screenshot({ path: join(ROOT, 'test', 'screens', `${name}.png`) });
      } finally {
        if (page) await page.close();
        await new Promise(r => server.close(r));
      }
      assert.deepEqual(errors, [], errors.join('\n'));
      assert.ok(painted > 10, `${name}: canvas appears blank (painted=${painted})`);
    }
  } finally { await browser.close(); }
});
