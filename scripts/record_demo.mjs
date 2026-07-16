/* Records ~12s of the sample galaxy (auto-orbit) to demo.webm for GIF conversion. */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createGalaxyServer } from '../galaxy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const server = createGalaxyServer(ROOT, {});
await new Promise(r => server.listen(0, r));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: ROOT, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForTimeout(12_000);
await ctx.close(); await browser.close(); server.close();
console.log('video saved as <random>.webm in repo root — rename to demo.webm');
