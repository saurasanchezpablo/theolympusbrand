// Screenshots of the built site in dark mode: node scripts/dev/dark-probe.ts <out-dir>
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
const out = process.argv[2] ?? '.';
const server = spawn('node_modules/.bin/vite', ['preview', '--config', 'app/vite.config.ts', '--host', '127.0.0.1', '--port', '4181', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  for (const [hash, name] of [['#/atelier', 'd-atelier'], ['#/catalogue', 'd-catalogue']] as const) {
    await page.goto(`http://127.0.0.1:4181/${hash}`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(out, `${name}.png`) });
  }
  const m = await page.goto('http://127.0.0.1:4181/site.webmanifest');
  console.log('manifest', m?.status(), (await m?.text())?.slice(0, 60).replace(/\s+/g, ' '));
} finally {
  await browser.close();
  server.kill();
}
