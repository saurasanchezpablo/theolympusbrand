// Dev only: open the map on a running site, screenshot it, pan for 3 s and
// report what it draws. node scripts/dev/map-probe.ts <url> <out.png> [width]
import { chromium } from 'playwright-core';

const [url = 'http://127.0.0.1:5173/', out = 'map-probe.png', width = '1440'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: Number(width), height: 900 } })).newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${url}#/map`);
await page.waitForSelector('[data-map="ready"], [data-map="still"], [data-map="unavailable"]', { timeout: 180_000 });
const state = await page.getAttribute('.map', 'data-map');
await page.waitForTimeout(4000);
await page.screenshot({ path: out });
let stats = null;
if (state === 'ready') {
  const box = (await page.locator('.map__canvas').boundingBox())!;
  const t0 = Date.now();
  let frames = 0;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  while (Date.now() - t0 < 3000) {
    await page.mouse.move(box.x + box.width / 2 + Math.sin(frames / 10) * 200, box.y + box.height / 2 + Math.cos(frames / 10) * 80);
    frames++;
  }
  await page.mouse.up();
  stats = await page.evaluate(() => (window as unknown as { olympusMapStats: () => unknown }).olympusMapStats());
}
console.log(JSON.stringify({ state, stats, errors: errors.slice(0, 5) }));
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
process.exit(0);
