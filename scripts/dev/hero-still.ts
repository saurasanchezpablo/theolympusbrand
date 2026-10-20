// The home page's still of the medallion: the WebGL scene itself, captured at
// rest (reduced motion: the light settled, no sway) with a transparent ground,
// then encoded as WebP at 1440 and 720 px. Run after `npm run site`; writes
// app/public/hero/. Needs ffmpeg with libwebp.

import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { ROOT } from '../lib/build-service.ts';

const PORT = 4182;
const OUT = join(ROOT, 'app', 'public', 'hero');
const server = spawn(join(ROOT, 'node_modules/.bin/vite'), ['preview', '--config', 'app/vite.config.ts', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => server.kill());
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
await page.goto(`http://127.0.0.1:${PORT}/#/`);
await page.locator('.hero__stage[data-state="live"][data-stone="ready"]').waitFor({ timeout: 60000 });
await page.waitForTimeout(300);
await page.addStyleTag({ content: 'html,body,#root,.app,.site,.home,.hero{background:transparent!important}.hero__still{display:none!important}' });
await page.waitForTimeout(200);
mkdirSync(OUT, { recursive: true });
const png = join(OUT, 'still.png');
await page.locator('.hero__frame').screenshot({ path: png, omitBackground: true });
await browser.close();
for (const size of [1440, 720]) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', `scale=${size}:${size}:flags=lanczos,hue=s=0`, '-c:v', 'libwebp', '-pix_fmt', 'yuva420p', '-quality', '86', '-compression_level', '6', join(OUT, `medallion-${size}.webp`)]);
rmSync(png);
console.log(`✔ ${OUT}/medallion-{1440,720}.webp`);
process.exit(0);
