// Dev only: a contact sheet of the map's buildings, from the map lab page on a
// running dev server (npm run app). node scripts/dev/map-sheet.ts <family|all> [near|far] [out.png] [port]
import { chromium } from 'playwright-core';

const [family = 'temples', detail = 'near', out = `map-sheet-${family}.png`, port = '5173'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1100 } })).newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/map-lab.html?family=${family}&detail=${detail}`);
await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 120000 });
await page.waitForTimeout(500);
await page.screenshot({ path: out });
console.log(await page.evaluate(() => document.body.dataset.ready), errors.join('\n'));
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
process.exit(0);
