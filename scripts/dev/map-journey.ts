// Dev only: the map's whole journey in a browser — intro, overview, a place,
// the next place, back to the island, the directory — with a screenshot of
// each state. node scripts/dev/map-journey.ts <url> <out-dir> [width] [height]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const [url = 'http://127.0.0.1:5173/', out = '.', w = '1440', h = '900'] = process.argv.slice(2);
const mobile = Number(w) < 720;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: Number(w), height: Number(h) }, isMobile: mobile, hasTouch: mobile })).newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const axe: string[] = [];
// Each state is photographed and audited (axe-core).
const shot = async (name: string) => {
  await page.screenshot({ path: `${out}/${w}-${name}.png` });
  await page.addScriptTag({ content: AXE });
  const found = await page.evaluate(async () => (await (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => `${v.id}×${v.nodes.length}`));
  for (const v of found) axe.push(`${name}: ${v}`);
};
await page.goto(`${url}#/map`);
await page.waitForSelector('[data-phase="intro"], [data-phase="overview"], [data-phase="still"]', { timeout: 180_000 });
await page.waitForTimeout(2500);
await shot('1-intro');
if (await page.locator('[data-phase="intro"]').count()) {
  await page.getByRole('button', { name: 'Explore the map' }).click();
  await page.waitForSelector('[data-phase="overview"]', { timeout: 60_000 });
}
await page.waitForTimeout(1500);
await shot('2-overview');
// A place, chosen on the map.
const ring = page.locator('.hotspot:not([data-off="true"])').first();
const name = await ring.getAttribute('aria-label');
await ring.click();
await page.waitForSelector('[data-phase="place"]', { timeout: 60_000 });
await page.waitForTimeout(1200);
await shot('3-place');
const before = await page.evaluate(() => location.hash);
await page.getByRole('button', { name: 'Next place' }).click();
await page.waitForFunction((h) => location.hash !== h && document.querySelector('[data-phase="place"]'), before, { timeout: 60_000 });
await page.waitForTimeout(1200);
await shot('4-next');
await page.getByRole('button', { name: 'Back to the island' }).first().click();
await page.waitForSelector('[data-phase="overview"]', { timeout: 60_000 });
await page.locator('.mapbar__select').click();
await page.waitForTimeout(500);
await shot('5-directory');
console.log(JSON.stringify({ first: name, hash: await page.evaluate(() => location.hash), stats: await page.evaluate(() => (window as unknown as { olympusMapStats?: () => unknown }).olympusMapStats?.()), errors: errors.slice(0, 5), axe }));
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
process.exit(0);
