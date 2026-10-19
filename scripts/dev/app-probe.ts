// Ad-hoc screenshots of the built app: node scripts/dev/app-probe.ts <out-dir>
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, type Page } from 'playwright-core';
const out = process.argv[2] ?? '.';
const server = spawn('node_modules/.bin/vite', ['preview', '--config', 'app/vite.config.ts', '--host', '127.0.0.1', '--port', '4180', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const shot = async (page: Page, name: string) => {
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(out, `${name}.png`) });
};
try {
  const page = await browser.newPage({ viewport: { width: 1520, height: 940 } });
  await page.goto('http://127.0.0.1:4180/');
  await page.getByRole('button', { name: /^Home Assistant/ }).click();
  await page.getByRole('radio', { name: 'White marble' }).click();
  await shot(page, 'p1-white-marble');
  await page.getByRole('radio', { name: 'Engraved' }).click();
  await shot(page, 'p2-engraved');
  await page.getByRole('radio', { name: 'Flat vector' }).click();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await page.getByRole('radio', { name: 'Vertical' }).click();
  await shot(page, 'p3-vertical-dark');
  await page.getByRole('button', { name: 'New design' }).first().click();
  await page.getByLabel('Name', { exact: true }).fill('Gitea');
  await page.getByLabel('Category', { exact: true }).selectOption('other');
  await page.getByRole('radio', { name: 'Crest' }).click();
  await page.getByRole('radio', { name: 'Light' }).click();
  const logo = join(tmpdir(), 'probe-logo.svg');
  writeFileSync(logo, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28"/><path d="M20 22h24v6H20zM20 34h24v6H20z" fill="#fff"/></svg>');
  await page.locator('input[type=file][accept^=".svg"]').setInputFiles(logo);
  await shot(page, 'p4-monogram-logo');
  await page.locator('.side__scroll').evaluate((e) => e.scrollTo(0, 400));
  await shot(page, 'p5-config-scrolled');
} finally {
  await browser.close();
  server.kill();
}
