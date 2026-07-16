/* Records ~16s of the sample galaxy WITH interactions (hover popup, drag orbit,
   wheel zoom) to a .webm for GIF conversion. Run: node scripts/record_demo.mjs */
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

// boot sequence plays itself (~3.2s), then let the galaxy settle
await page.waitForTimeout(4000);

const CX = 640, CY = 720 * 0.47;

// 1) hover sweep along the planet ring until a popup actually shows (feedback
//    loop on #pop.show), then dwell so the agent roster is readable (~4s)
const popShown = () => page.evaluate(() => document.getElementById('pop').classList.contains('show'));
let found = false;
outer: for (const ry of [150, 110, 190]) {
  for (let i = 0; i <= 40; i++) {
    const a = -Math.PI / 2 + (i / 40) * Math.PI * 2;
    await page.mouse.move(CX + Math.cos(a) * 285, CY + Math.sin(a) * ry);
    await page.waitForTimeout(55);
    if (await popShown()) { found = true; break outer; }
  }
}
if (found) await page.waitForTimeout(2500); // dwell on the roster popup

// 2) drag to orbit the camera (~2s)
await page.mouse.move(CX, CY);
await page.mouse.down();
for (let i = 1; i <= 20; i++) {
  await page.mouse.move(CX + i * 14, CY - i * 3);
  await page.waitForTimeout(45);
}
await page.mouse.up();
await page.waitForTimeout(600);

// 3) wheel zoom in, then back out (~2.5s)
for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -240); await page.waitForTimeout(280); }
await page.waitForTimeout(500);
for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 240); await page.waitForTimeout(260); }

// 4) let auto-orbit breathe for the loop point (~3s)
await page.mouse.move(30, 700);
await page.waitForTimeout(3000);

await ctx.close(); await browser.close(); server.close();
console.log('video saved as <random>.webm in repo root — rename to demo.webm');
