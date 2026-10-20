// Ad-hoc screenshots of the built app: node scripts/dev/app-probe.ts <out-dir>
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
const out = process.argv[2] ?? '.';
const server = spawn('node_modules/.bin/vite', ['preview', '--config', 'app/vite.config.ts', '--host', '127.0.0.1', '--port', '4180', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1520, height: 940 } });
  await page.goto('http://127.0.0.1:4180/');
  await page.getByRole('button', { name: /^VPN/ }).click();
  await page.getByRole('radio', { name: '3D print' }).click();
  await page.getByRole('radio', { name: 'Nameplate' }).click();
  await page.getByText(/Valid · [\d,]+ triangles/).waitFor({ timeout: 60000 });
  await page.locator('.side__scroll').evaluate((e) => e.scrollTo(0, 480));
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(out, 'p-nameplate-panel.png') });
} finally {
  await browser.close();
  server.kill();
}
