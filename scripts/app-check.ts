// End-to-end check of the web app in a real browser: build output served
// locally, driven through its main workflows.
//
//   npm run app:build && npm run app:check [-- --shots <dir>]
//   npm run app:check -- --url http://olympus.lan:8080   (a deployed copy)
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
import { coinSvg } from '../src/integrations/kit.ts';
import { baseMarks } from '../src/catalog/fileset.ts';
import { buildSticker, stickerPdf, STICKER_DEFAULTS } from '../src/manufacturing/stickers.ts';
import { Resvg } from '@resvg/resvg-js';
import jsQRModule from 'jsqr';

const jsQR = ((jsQRModule as unknown as { default?: unknown }).default ?? jsQRModule) as (d: Uint8ClampedArray, w: number, h: number) => { data: string } | null;

loadNodeFonts();

const PORT = 4179;
// --url checks a deployed copy instead of serving the local build.
const urlArg = process.argv.indexOf('--url');
const REMOTE = urlArg > 0 ? process.argv[urlArg + 1].replace(/\/?$/, '/') : null;
const URL_ = REMOTE ?? `http://127.0.0.1:${PORT}/`;
const shotsArg = process.argv.indexOf('--shots');
const SHOTS = shotsArg > 0 ? process.argv[shotsArg + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const chrome = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
if (!chrome) throw new Error('No Chrome or Chromium found — set CHROME_PATH.');
if (!REMOTE && !existsSync(join(ROOT, 'app', 'dist', 'index.html'))) throw new Error('Build the app first: npm run app:build');

const server = REMOTE ? null : spawn(join(ROOT, 'node_modules/.bin/vite'), ['preview', '--config', 'app/vite.config.ts', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
const stop = () => server?.kill();
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
  page.waitForFunction(() => Array.from(document.images).every((i) => i.loading === 'lazy' || (i.complete && i.naturalWidth > 0)) && !document.querySelector('span[role=img]'));
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

  await page.goto(`${URL_}#/atelier`);
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
  // Dashboard icons: the coin is the command line's, byte for byte.
  assert.equal(strFromU8(zip['the-olympus-vaultwarden/dashboard/olympus-vaultwarden.svg']), coinSvg(baseMarks({ god: 'hades' }).seal, 'dark', 'The Olympus — Vaultwarden'));
  assert.ok(strFromU8(zip['the-olympus-vaultwarden/dashboard/README.md']).includes('https://vaultwarden.theolympus.cloud'));
  for (const p of ['dashboard/olympus-vaultwarden.png', 'dashboard/olympus-vaultwarden-light.png']) assert.ok(inPack(p), p);
  step(`asset pack: ${names.length} files — SVGs, PNGs, favicon, manifest, catalogue entry, logo, dashboard icons`);

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
  const expected = modelFiles({ id: 'jellyfin', title: 'The Olympus — Jellyfin', name: jellyfin.name, caption: jellyfin.caption }, 'token', suggestedParams('token', mark.minDiameterMM), mark).files.find((f) => f.path.endsWith('.stl'))!;
  assert.ok(stlFile.data.equals(Buffer.from(expected.data as Uint8Array)), 'browser STL differs from the Node build');
  await page.getByRole('radio', { name: 'Two-colour medallion' }).click();
  await page.getByText(/Valid · [\d,]+ triangles · 2 parts/).waitFor({ timeout: 30000 });
  await shot(page, '7-model');
  const modelPack = await downloadOf(page, () => page.getByRole('button', { name: 'Model pack (.zip)' }).click());
  const modelZip = Object.keys(unzipSync(new Uint8Array(modelPack.data))).map((n) => n.split('/').pop());
  for (const f of ['the-olympus-jellyfin-two-colour-plate.stl', 'the-olympus-jellyfin-two-colour-relief.stl', 'the-olympus-jellyfin-two-colour.3mf', 'the-olympus-jellyfin-two-colour.scad', 'the-olympus-jellyfin-crest-print.svg', 'the-olympus-jellyfin-two-colour-preview.png', 'the-olympus-jellyfin-two-colour-back.png', 'the-olympus-jellyfin-two-colour.md']) assert.ok(modelZip.includes(f), f);
  step('3D print: valid models, STL byte-identical to the Node build, full model pack');

  // Back features, the layer inspector, the lithophane held to the light, a vertical nameplate.
  await page.getByLabel('Magnet pockets slider').fill('2');
  await page.getByText(/Back\s*2 magnets · inscription/).waitFor({ timeout: 30000 });
  await page.getByRole('radio', { name: 'Layers' }).click();
  await page.getByText(/Layer \d+ of \d+/).waitFor();
  await shot(page, '8-layers');
  await page.getByRole('radio', { name: 'Marble lithophane' }).click();
  await page.getByText(/Valid · [\d,]+ triangles/).waitFor({ timeout: 60000 });
  await page.getByRole('radio', { name: 'Backlit' }).click();
  await page.locator('.backlit canvas').waitFor();
  await shot(page, '9-backlit');
  await page.getByRole('radio', { name: 'Nameplate' }).click();
  await page.getByRole('radiogroup', { name: 'Layout' }).getByRole('radio', { name: 'Vertical' }).click();
  await page.getByText(/Valid · [\d,]+ triangles/).waitFor({ timeout: 60000 });
  await page.getByRole('radio', { name: '3D', exact: true }).click();
  await shot(page, '10-nameplate');
  step('back features, layer inspector, backlit lithophane, vertical nameplate');

  // Stickers: the website's PDF is the Node build's PDF, byte for byte — marble ground included.
  await page.getByRole('button', { name: /^Jellyfin Apollo · media/ }).click();
  await page.getByRole('radio', { name: 'Sticker', exact: true }).click();
  await page.getByRole('radio', { name: 'Black marble' }).click();
  await page.getByText(/\d+ on A4/).waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('.modelview__busy'), null, { timeout: 60000 });
  const stickerFile = await downloadOf(page, () => page.getByRole('button', { name: 'PDF', exact: true }).click());
  assert.equal(stickerFile.name, 'the-olympus-jellyfin-sticker-crest-marble-dark.pdf');
  const jm = baseMarks(jellyfin.patron);
  const nodeSticker = buildSticker({ marks: { crestFine: jm['crest-fine'].d, crestPrint: jm['crest-print'].d, emblemFine: jm['emblem-fine'].d, emblemPrint: jm['emblem-print'].d, seal: jm.seal.d }, name: jellyfin.name, caption: jellyfin.caption }, { ...STICKER_DEFAULTS, style: 'marble-dark' });
  assert.ok(stickerFile.data.equals(Buffer.from(stickerPdf(nodeSticker, 'The Olympus — Jellyfin — sticker, crest, black marble'))), 'browser sticker PDF differs from the Node build');
  await page.getByRole('radio', { name: 'On a laptop' }).click();
  await shot(page, '11-sticker-laptop');
  // A QR label made by the website scans.
  await page.getByLabel('Design', { exact: true }).selectOption('qr-label');
  await page.waitForFunction(() => !document.querySelector('.modelview__busy'), null, { timeout: 60000 });
  await page.getByText(`opens ${jellyfin.url}`).waitFor({ timeout: 60000 });
  const label = await downloadOf(page, () => page.getByRole('button', { name: 'SVG', exact: true }).click());
  const scanned = new Resvg(label.data.toString('utf8'), { fitTo: { mode: 'width', value: 900 }, background: '#FFFFFF' }).render();
  // The production file has a black-marble ground under a light panel: the code reads dark on light.
  assert.equal(jsQR(new Uint8ClampedArray(scanned.pixels), scanned.width, scanned.height)?.data, jellyfin.url);
  await page.getByLabel('Design', { exact: true }).selectOption('crest');
  await page.getByRole('radio', { name: 'Sheet' }).click();
  await shot(page, '12-sticker-sheet');
  step('stickers: PDF byte-identical to the Node build, mockups, sheet, a QR label that scans');

  // The site around the Atelier: home, catalogue, guide, downloads.
  await page.getByRole('link', { name: 'The Olympus — home' }).click();
  await page.getByRole('heading', { name: 'The Olympus' }).waitFor();
  await shot(page, '13-home');
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Catalogue' }).click();
  await page.locator('.card').nth(15).waitFor();
  const vpnCard = page.locator('.card', { hasText: 'VPN' });
  await vpnCard.getByRole('button', { name: 'Open in Atelier' }).click();
  assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'VPN');
  step('home and catalogue; a card opens its service in the Atelier');
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Guide' }).click();
  await page.locator('.doc h1').waitFor();
  // Every picture in the document resolves on the server (they load lazily as you scroll).
  const sources = await page.$$eval('.doc img', (imgs) => imgs.map((i) => (i as HTMLImageElement).src));
  assert.ok(sources.length > 3, `${sources.length} images`);
  for (const src of sources) assert.equal((await page.request.get(src)).status(), 200, src);
  await shot(page, '14-guide');
  await page.locator('.guide__nav').getByRole('link', { name: /Stickers/ }).click();
  await page.locator('.doc h1', { hasText: 'Stickers' }).waitFor();
  step('guide: documents render, their pictures load, links between them work');
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Downloads' }).click();
  const catalogue = page.locator('.dl', { hasText: 'Catalogue definitions' });
  await catalogue.waitFor();
  const zipped = await downloadOf(page, () => catalogue.locator('.dl__head').getByRole('button').click());
  const entries = Object.keys(unzipSync(new Uint8Array(zipped.data)));
  assert.ok(entries.includes('catalog/services/jellyfin.json'), entries.slice(0, 5).join(', '));
  await shot(page, '15-downloads');
  step('downloads: folders zip in the browser with the repository’s files');

  await page.goto(`${URL_}#/atelier`);
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
