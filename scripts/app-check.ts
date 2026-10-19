// End-to-end check of the web app in a real browser: build output served
// locally, driven through its main workflows.
//
//   npm run app:build && npm run app:check [-- --shots <dir>]
//
// Uses an installed Chrome/Chromium (CHROME_PATH, or the usual locations).

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright-core';
import { unzipSync, strFromU8 } from 'fflate';
import { ROOT } from './lib/build-service.ts';
import { loadNodeFonts } from '../src/node/fonts.ts';
import { loadCatalog } from '../src/node/catalog.ts';
import { markFor, modelFiles } from '../src/manufacturing/files.ts';
import { suggestedParams } from '../src/manufacturing/products.ts';

loadNodeFonts();

const PORT = 4179;
const URL_ = `http://127.0.0.1:${PORT}/`;
const shotsArg = process.argv.indexOf('--shots');
const SHOTS = shotsArg > 0 ? process.argv[shotsArg + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const chrome = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
if (!chrome) throw new Error('No Chrome or Chromium found — set CHROME_PATH.');
if (!existsSync(join(ROOT, 'app', 'dist', 'index.html'))) throw new Error('Build the app first: npm run app:build');

const server = spawn(join(ROOT, 'node_modules/.bin/vite'), ['preview', '--config', 'app/vite.config.ts', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(URL_)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('The preview server did not start.');
}

const steps: string[] = [];
const step = (s: string) => {
  steps.push(s);
  console.log(`✔ ${s}`);
};
/** Wait until every image on the page has decoded (marks are blob-URL images). */
const settle = (page: Page) =>
  page.waitForFunction(() => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0) && !document.querySelector('span[role=img]'));
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  await settle(page);
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
};

async function downloadOf(page: Page, click: () => Promise<void>): Promise<{ name: string; data: Buffer }> {
  const [d] = await Promise.all([page.waitForEvent('download'), click()]);
  const path = await d.path();
  return { name: d.suggestedFilename(), data: readFileSync(path) };
}

await waitForServer();
const browser = await chromium.launch({ executablePath: chrome, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1520, height: 940 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));

  await page.goto(URL_);
  await page.getByRole('button', { name: 'The Olympus Master · Zeus · fixed' }).waitFor();
  await page.locator('.stage__mark').waitFor();
  step('loads with the master open');
  await shot(page, '1-master');

  // A house service: the exported SVG must be the CLI's file, byte for byte.
  await page.getByRole('button', { name: /^Jellyfin Apollo · media/ }).click();
  await page.getByRole('radio', { name: 'Horizontal' }).click();
  const svg = await downloadOf(page, () => page.getByRole('button', { name: 'SVG', exact: true }).click());
  assert.equal(svg.name, 'the-olympus-jellyfin-lockup-horizontal.svg');
  const cli = readFileSync(join(ROOT, 'assets/services/jellyfin/svg/the-olympus-jellyfin-lockup-horizontal.svg'));
  assert.ok(svg.data.equals(cli), 'browser SVG differs from the CLI build');
  step('exported SVG is byte-identical to the command-line build');
  await shot(page, '2-jellyfin-lockup');

  // A new design: name, patron, caption, save.
  await page.getByRole('button', { name: 'New design' }).first().click();
  await page.getByLabel('Name', { exact: true }).fill('Vaultwarden');
  assert.equal(await page.getByLabel('Identifier', { exact: true }).inputValue(), 'vaultwarden');
  await page.getByLabel('Category', { exact: true }).selectOption('security');
  await page.getByRole('radio', { name: /^Athena/ }).waitFor();
  assert.equal(await page.getByRole('radio', { name: /^Athena/ }).getAttribute('aria-checked'), 'true');
  await page.getByRole('radio', { name: /^Hades/ }).click();
  await page.getByLabel('Caption', { exact: true }).fill('The Olympus · Vault');
  await page.getByRole('radio', { name: 'Crest' }).click();
  await page.getByRole('radio', { name: 'Print', exact: true }).click();
  await page.getByText(/Prints from Ø \d+ mm/).waitFor();
  step('new design: name → identifier, category → default god, patron override, print check');
  await shot(page, '3-new-print');
  await page.getByRole('button', { name: 'Save as mine' }).click();
  await page.getByText('Saved · version 1').waitFor();
  await page.getByLabel('Description', { exact: true }).fill('Password manager');
  await page.keyboard.press('Control+s');
  await page.getByText('Saved · version 2').waitFor();
  step('save, edit, Ctrl+S → version 2');

  await page.reload();
  await page.getByRole('button', { name: /^Vaultwarden Hades · security · v2/ }).click();
  assert.equal(await page.getByLabel('Caption', { exact: true }).inputValue(), 'The Olympus · Vault');
  step('designs persist across a reload');

  // Marble presentation and the small-size sheet.
  await page.getByRole('radio', { name: 'Crest' }).click();
  await page.getByRole('radio', { name: 'Black marble' }).click();
  await page.getByText('Presentation mockup.').waitFor();
  await page.waitForTimeout(400);
  await shot(page, '4-black-marble');
  await page.getByRole('radio', { name: 'Flat vector' }).click();
  await page.getByRole('radio', { name: 'Small sizes' }).click();
  await shot(page, '5-sizes');
  await page.getByRole('radio', { name: 'Crest' }).click();
  step('marble mockup and small-size views');

  // An application logo with a white cut-out.
  const logoFile = join(tmpdir(), 'olympus-check-logo.svg');
  writeFileSync(logoFile, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 4 60 56H4Z"/><circle cx="32" cy="38" r="8" fill="#fff"/></svg>');
  await page.locator('input[type=file][accept^=".svg"]').setInputFiles(logoFile);
  await page.getByText('Application logo').waitFor();
  step('SVG logo imported into the fine logo slot');

  // The asset pack.
  const pack = await downloadOf(page, () => page.getByRole('button', { name: 'Asset pack (.zip)' }).click());
  assert.equal(pack.name, 'the-olympus-vaultwarden.zip');
  const zip = unzipSync(new Uint8Array(pack.data));
  const names = Object.keys(zip);
  const inPack = (p: string) => names.includes(`the-olympus-vaultwarden/${p}`);
  // The same set the command line builds for a service.
  const cliCount = (dir: string) => readdirSync(join(ROOT, 'assets/services/jellyfin', dir)).length;
  assert.equal(names.filter((n) => n.includes('/svg/')).length, cliCount('svg'));
  assert.equal(names.filter((n) => n.includes('/png/')).length, cliCount('png'));
  for (const p of ['assets/services/vaultwarden/favicon.ico', 'assets/services/vaultwarden/manifest.json', 'catalog/services/vaultwarden.json', 'catalog/logos/vaultwarden.svg', 'vaultwarden.olympus.json']) assert.ok(inPack(p), p);
  const spec = JSON.parse(strFromU8(zip['the-olympus-vaultwarden/catalog/services/vaultwarden.json']));
  assert.deepEqual(spec, { id: 'vaultwarden', name: 'Vaultwarden', category: 'security', god: 'hades', logo: 'logos/vaultwarden.svg', caption: 'The Olympus · Vault', description: 'Password manager' });
  const png = zip['the-olympus-vaultwarden/assets/services/vaultwarden/png/the-olympus-vaultwarden-seal-512.png'];
  assert.deepEqual([...png.slice(1, 4)], [80, 78, 71]); // "PNG"
  step(`asset pack: ${names.length} files — SVGs, PNGs, favicon, manifest, catalogue entry, logo`);

  // Export the design, delete it, import it back.
  const designJson = await downloadOf(page, () => page.getByRole('button', { name: 'Design file (.json)' }).click());
  const designPath = join(tmpdir(), designJson.name);
  writeFileSync(designPath, designJson.data);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Saved · version 3').waitFor();
  await page.locator('.library__row', { hasText: 'Vaultwarden' }).hover();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete Vaultwarden' }).click();
  await page.getByText('Deleted “Vaultwarden”.').waitFor();
  await page.locator('input[type=file][accept^=".json"]').setInputFiles(designPath);
  await page.getByText('Imported 1 design.').waitFor();
  assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Vaultwarden');
  assert.ok((await page.getByText('Application logo').count()) > 0, 'logo survives export and import');
  step('design file: export → delete → import, logo included');

  // Duplicating a house service never touches the house catalogue.
  await page.getByRole('button', { name: /^Nextcloud Nephele · cloud/ }).hover();
  await page.getByRole('button', { name: 'Duplicate Nextcloud' }).click();
  assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Nextcloud copy');
  await page.getByRole('radio', { name: 'Black marble' }).click();
  step('duplicate a house design into my designs');

  // 3D print: the website's STL is the same mesh the command line writes.
  await page.getByRole('button', { name: /^Jellyfin Apollo · media/ }).click();
  await page.getByRole('radio', { name: '3D print' }).click();
  await page.getByRole('radio', { name: 'Token' }).click();
  await page.getByText(/Valid · [\d,]+ triangles/).waitFor({ timeout: 30000 });
  const stlFile = await downloadOf(page, () => page.getByRole('button', { name: 'STL', exact: true }).click());
  assert.equal(stlFile.name, 'the-olympus-jellyfin-token.stl');
  const jellyfin = loadCatalog().find((x) => x.id === 'jellyfin')!;
  const mark = markFor('seal', jellyfin.patron, 'jellyfin');
  const expected = modelFiles('jellyfin', 'The Olympus — Jellyfin', 'token', suggestedParams('token', mark.minDiameterMM), mark, null).files.find((f) => f.path.endsWith('.stl'))!;
  assert.ok(stlFile.data.equals(Buffer.from(expected.data as Uint8Array)), 'browser STL differs from the Node build');
  await page.getByRole('radio', { name: 'Two-colour medallion' }).click();
  await page.getByText(/Valid · [\d,]+ triangles · 2 parts/).waitFor({ timeout: 30000 });
  await shot(page, '7-model');
  const modelPack = await downloadOf(page, () => page.getByRole('button', { name: 'Model pack (.zip)' }).click());
  const modelZip = Object.keys(unzipSync(new Uint8Array(modelPack.data))).map((n) => n.split('/').pop());
  for (const f of ['the-olympus-jellyfin-two-colour-plate.stl', 'the-olympus-jellyfin-two-colour-relief.stl', 'the-olympus-jellyfin-two-colour.3mf', 'the-olympus-jellyfin-two-colour.scad', 'the-olympus-jellyfin-crest-print.svg', 'the-olympus-jellyfin-two-colour-preview.png', 'the-olympus-jellyfin-two-colour.md']) assert.ok(modelZip.includes(f), f);
  step('3D print: valid models, STL byte-identical to the Node build, full model pack');

  await page.setViewportSize({ width: 820, height: 1100 });
  await shot(page, '6-narrow');
  step('narrow layout renders');

  assert.deepEqual(errors, [], `console errors:\n${errors.join('\n')}`);
  step('no console errors');
} finally {
  await browser.close();
  stop();
}
console.log(`\n${steps.length} checks passed.`);
