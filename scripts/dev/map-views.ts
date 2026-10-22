// Dev only: the map seen from chosen poses — overview, middle heights, close
// to the ground — one screenshot each, for comparing passes of the city.
// node scripts/dev/map-views.ts <url> <out-dir> <tag> [width] [height]
import { chromium } from 'playwright-core';

const [url = 'http://127.0.0.1:5173/', out = '.', tag = 'v', w = '1440', h = '900'] = process.argv.slice(2);
const VIEWS: [string, { x: number; z: number; distance: number; polar: number; azimuth: number }][] = [
  ['high', { x: 0, z: 30, distance: 420, polar: 0.55, azimuth: 0 }],
  ['town', { x: 0, z: 60, distance: 200, polar: 0.85, azimuth: 0.3 }],
  ['quarter', { x: -20, z: 50, distance: 110, polar: 0.95, azimuth: -0.5 }],
  ['street', { x: 10, z: 40, distance: 45, polar: 1.1, azimuth: 0.8 }],
  ['summit', { x: 6, z: -8, distance: 150, polar: 0.9, azimuth: 2.6 }],
  ['agora', { x: 4, z: 104, distance: 34, polar: 1.05, azimuth: 0.6 }],
  ['lane', { x: -33, z: 64, distance: 18, polar: 1.18, azimuth: -0.9 }],
  ['sanctuary', { x: 0, z: -8, distance: 60, polar: 0.95, azimuth: 0.35 }],
  ['field', { x: 110, z: 90, distance: 45, polar: 0.8, azimuth: -0.4 }],
  ['harbour', { x: 0, z: 165, distance: 70, polar: 1.0, azimuth: 0.5 }],
];
// VIEWS="name:x,z,distance,polar,azimuth;…" replaces the list.
if (process.env.VIEWS)
  VIEWS.splice(
    0,
    VIEWS.length,
    ...process.env.VIEWS.split(';').map((v): (typeof VIEWS)[number] => {
      const [name, nums] = v.split(':');
      const [x, z, distance, polar, azimuth] = nums.split(',').map(Number);
      return [name, { x, z, distance, polar, azimuth }];
    }),
  );
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: Number(w), height: Number(h) } })).newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${url}#/`);
await page.evaluate(() => sessionStorage.setItem('olympus-map-seen', '1'));
await page.goto(`${url}#/map`);
await page.waitForSelector('[data-phase="overview"]', { timeout: 180_000 });
await page.addStyleTag({ content: '.map-lesson, .hotspots { display: none !important; }' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/${tag}-0-overview.png` });
for (const [i, [name, pose]] of VIEWS.entries()) {
  await page.evaluate((p) => (window as unknown as { olympusMapLook: (p: unknown) => void }).olympusMapLook(p), pose);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${tag}-${i + 1}-${name}.png` });
}
console.log(JSON.stringify({ stats: await page.evaluate(() => (window as unknown as { olympusMapStats?: () => unknown }).olympusMapStats?.()), errors: errors.slice(0, 5) }));
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
process.exit(0);
