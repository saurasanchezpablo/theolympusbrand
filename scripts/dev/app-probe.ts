// Ad-hoc screenshots of the built app: node scripts/dev/app-probe.ts <out-dir>
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright-core';
const out = process.argv[2] ?? '.';
const server = spawn('node_modules/.bin/vite', ['preview', '--config', 'app/vite.config.ts', '--host', '127.0.0.1', '--port', '4180', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const errors: string[] = [];
const shot = async (page: Page, name: string) => {
  await page.waitForFunction(() => !document.querySelector('.modelview__busy'), null, { timeout: 30000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `${name}.png`) });
};
try {
  const page = await browser.newPage({ viewport: { width: 1520, height: 940 } });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:4180/');
  await page.getByRole('button', { name: /^Jellyfin/ }).click();
  await page.getByRole('radio', { name: '3D print' }).click();
  await shot(page, 'm1-medallion');
  await page.getByRole('radio', { name: 'Two-colour medallion' }).click();
  await shot(page, 'm2-two-colour');
  await page.getByRole('radio', { name: 'Token' }).click();
  await shot(page, 'm3-token');
  console.log('errors:', errors);
} finally {
  await browser.close();
  server.kill();
}
