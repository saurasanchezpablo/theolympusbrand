// End-to-end check of the web app in a real browser: build output served
// locally, driven through its main workflows.
//
//   npm run app:build && npm run app:check [-- --shots <dir>]
//   npm run app:check -- --url http://olympus.lan:8080   (a deployed copy)
//
// Uses an installed Chrome/Chromium (CHROME_PATH, or the usual locations).

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
import { island } from '../src/map/island.ts';
import { standOn } from '../src/map/placement.ts';
import { extentOf } from '../src/map/buildings/index.ts';
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

// The house's own server (the site and the map's edit API, one port) on the built app/dist as it is, with a data folder of its own.
const EDITOR_DATA = mkdtempSync(join(tmpdir(), 'olympus-check-data-'));
const EDITOR_PASSWORD = 'olympus-check-password';
const serverEnv = { ...process.env, OLYMPUS_DATA: EDITOR_DATA, OLYMPUS_SITE: join(ROOT, 'app', 'dist'), PORT: String(PORT), HOST: '127.0.0.1' };
if (!REMOTE) execFileSync('node', ['-e', `import('./scripts/lib/editor/auth.ts').then((m) => m.setPassword(${JSON.stringify(EDITOR_PASSWORD)}))`], { cwd: ROOT, env: serverEnv });
const server = REMOTE ? null : spawn('node', ['scripts/serve.ts'], { cwd: ROOT, env: serverEnv, stdio: 'ignore' });
const stop = () => {
  server?.kill();
};
process.on('exit', stop);

async function waitForServer() {
  for (let i = 0; i < 200; i++) {
    try {
      if ((await fetch(URL_)).ok && (await fetch(new URL('api/session', URL_))).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('The server did not start.');
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
// SwiftShader gives headless Chrome WebGL, for the home page's medallion.
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 1520, height: 940 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(`${m.text()} (${m.location().url})`));
  page.on('requestfailed', (r) => /^(blob|file):/.test(r.url()) && errors.push(`${r.failure()?.errorText} ${r.url().slice(0, 60)}`));
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

  // History: restore version 1 (before the description), undo it by button, redo, undo by keyboard.
  const desc = () => page.getByLabel('Description', { exact: true }).inputValue();
  await page.getByRole('button', { name: 'Restore version 1' }).click();
  assert.equal(await desc(), '');
  await page.getByText('Unsaved changes', { exact: true }).waitFor();
  await shot(page, '3b-history');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await desc(), 'Password manager');
  await page.getByText('Saved · version 2').waitFor();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await desc(), '');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+z');
  assert.equal(await desc(), 'Password manager');
  // Typing is one step to undo, not one per key.
  await page.getByLabel('Description', { exact: true }).fill('Password manager and vault');
  await page.getByLabel('Description', { exact: true }).press('End');
  await page.keyboard.type(' too');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await desc(), 'Password manager');
  step('history: restore a version; undo and redo by button and keyboard');

  // A design in a link opens, unsaved, in a fresh tab; a damaged link says so.
  await page.getByRole('radio', { name: 'Crest' }).click();
  await page.getByRole('button', { name: 'Link to this design' }).click();
  const link = await page.getByLabel('Link to this design').inputValue();
  await shot(page, '3c-share');
  assert.match(link, /#\/atelier\/share\/1\.[A-Za-z0-9_-]+$/);
  const other = await browser.newContext({ viewport: { width: 1520, height: 940 } });
  const tab = await other.newPage();
  await tab.goto(link);
  await tab.getByText('Opened “Vaultwarden” from a link').waitFor();
  assert.equal(await tab.getByLabel('Caption', { exact: true }).inputValue(), 'The Olympus · Vault');
  assert.equal(await tab.getByLabel('Description', { exact: true }).inputValue(), 'Password manager');
  await tab.getByText('Unsaved changes', { exact: true }).waitFor();
  assert.ok(tab.url().endsWith('#/atelier'), tab.url());
  await tab.goto(link.replace(/share\/1\..*/, 'share/1.AAAA'));
  await tab.getByText(/This link could not be opened/).waitFor();
  await other.close();
  step('share: a link opens the design in another browser; a damaged link is refused');

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

  // The same logo as the patron: in the bay, on the seal; the print editions say whether it is cut or the initial stands in.
  const patrons = page.getByRole('radiogroup', { name: 'Patron in the central bay' });
  const before = await patrons.getByRole('radio', { checked: true }).getAttribute('title');
  const sealBefore = await page.locator('.slot__preview img, .patron.is-on img').first().getAttribute('src');
  await patrons.getByRole('radio', { name: 'Your logo' }).click();
  assert.equal(await patrons.getByRole('radio', { name: 'Your logo' }).getAttribute('aria-checked'), 'true');
  await page.getByText(/Your logo stands in the bay, on the seal and in the logo slot\. Print editions cut it too, thickened just enough for a 0\.4 mm nozzle\./).waitFor();
  assert.notEqual(await page.locator('.patron.is-on img').getAttribute('src'), sealBefore, 'the seal is the logo now');
  assert.equal(await page.getByRole('alert').filter({ hasText: /logo/ }).count(), 0, 'no problem reported');
  await patrons.locator(`[title="${before}"]`).click();
  step('your logo as the patron: in the bay and on the seal, and in print thickened for the nozzle');

  // The application it runs: its theme kit comes in the asset pack.
  await page.getByLabel('Application').selectOption('vaultwarden');

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
  assert.deepEqual(spec, { id: 'vaultwarden', name: 'Vaultwarden', category: 'security', god: 'hades', logo: 'logos/vaultwarden.svg', caption: 'The Olympus · Vault', app: 'vaultwarden', description: 'Password manager' });
  // The theme kit, made from this design: its stylesheet names the service, its script is the command line's.
  assert.match(strFromU8(zip['the-olympus-vaultwarden/theme/vaultwarden/user.vaultwarden.scss.hbs']), /Vaultwarden web vault \(Vaultwarden\)/);
  assert.equal(strFromU8(zip['the-olympus-vaultwarden/theme/vaultwarden/apply.sh']), readFileSync(join(ROOT, 'assets/integrations/themes/vaultwarden/apply.sh'), 'utf8'));
  const png = zip['the-olympus-vaultwarden/assets/services/vaultwarden/png/the-olympus-vaultwarden-seal-512.png'];
  assert.deepEqual([...png.slice(1, 4)], [80, 78, 71]); // "PNG"
  // Dashboard icons: the coin is the command line's, byte for byte.
  assert.equal(strFromU8(zip['the-olympus-vaultwarden/dashboard/olympus-vaultwarden.svg']), coinSvg(baseMarks({ god: 'hades' }).seal, 'dark', 'The Olympus — Vaultwarden'));
  assert.ok(strFromU8(zip['the-olympus-vaultwarden/dashboard/README.md']).includes('https://vaultwarden.theolympus.cloud'));
  for (const p of ['dashboard/olympus-vaultwarden.png', 'dashboard/olympus-vaultwarden-light.png']) assert.ok(inPack(p), p);
  assert.ok(strFromU8(zip['the-olympus-vaultwarden/terminal/issue.net']).includes('V A U L T W A R D E N'));
  for (const p of ['terminal/20-the-olympus', 'terminal/motd-braille.txt', 'terminal/install.sh']) assert.ok(inPack(p), p);
  step(`asset pack: ${names.length} files — SVGs, PNGs, favicon, manifest, catalogue entry, logo, dashboard icons, theme kit, terminal crest`);

  // A wallpaper drawn in the browser: the marble from the worker, the crest on it, at the size chosen.
  await page.getByLabel('Wallpaper style').selectOption('marble');
  await page.getByLabel('Wallpaper size').selectOption('phone');
  const wall = await downloadOf(page, () => page.getByRole('button', { name: 'Wallpaper (PNG)' }).click());
  assert.equal(wall.name, 'the-olympus-vaultwarden-wallpaper-marble-phone.png');
  assert.deepEqual([wall.data.readUInt32BE(16), wall.data.readUInt32BE(20)], [1179, 2556]);
  await page.getByLabel('Wallpaper style').selectOption('blueprint');
  const bp = await downloadOf(page, () => page.getByRole('button', { name: 'Wallpaper (PNG)' }).click());
  assert.equal(bp.name, 'the-olympus-vaultwarden-wallpaper-blueprint-phone.png');
  step('wallpapers: marble (drawn in a worker) and blueprint, at the size chosen');

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

  // A house design removed from the house (the service with it), after signing in; Undo brings it back.
  const houseCount = async () => Number((await page.getByRole('radio', { name: /^House · \d+$/ }).textContent())?.match(/\d+/)?.[0]);
  const houseBefore = await houseCount();
  await page.getByRole('button', { name: /^Backup / }).hover();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Remove Backup from the house' }).click();
  await page.getByLabel('The house’s password').fill(EDITOR_PASSWORD);
  await page.getByRole('button', { name: 'Sign in and remove' }).click();
  await page.getByText('Removed “Backup” from the house.').waitFor({ timeout: 20_000 });
  assert.deepEqual(JSON.parse(readFileSync(join(EDITOR_DATA, 'removed.json'), 'utf8')), ['backup']);
  await page.waitForFunction((n) => /House · (\d+)/.exec(document.body.innerText)?.[1] === String(n - 1), houseBefore);
  await page.locator('.toast--action').getByRole('button', { name: 'Undo' }).click();
  await page.getByText('“Backup” is back in the house.').waitFor({ timeout: 20_000 });
  assert.ok(!existsSync(join(EDITOR_DATA, 'removed.json')), 'no longer removed');
  assert.equal(await houseCount(), houseBefore);
  step('a house design removed from the house (signed in), and brought back');

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
  // The stamp (die and turned handle) and the rack panel build in the browser too.
  await page.getByRole('radio', { name: 'Wax-seal stamp' }).click();
  await page.getByText(/Valid · [\d,]+ triangles · 2 parts/).waitFor({ timeout: 60000 });
  await page.getByRole('radio', { name: 'Layers' }).click();
  await page.getByText(/Layer \d+ of \d+/).waitFor();
  await page.getByRole('radio', { name: '3D', exact: true }).click();
  await shot(page, '10b-stamp');
  await page.getByRole('radio', { name: 'Rack panel' }).click();
  await page.getByText(/Valid · [\d,]+ triangles/).waitFor({ timeout: 60000 });
  const rackStl = await downloadOf(page, () => page.getByRole('button', { name: 'STL', exact: true }).click());
  const rackNode = modelFiles({ id: 'jellyfin', title: 'The Olympus — Jellyfin', name: jellyfin.name, caption: jellyfin.caption, url: jellyfin.url }, 'rack', suggestedParams('rack', mark.minDiameterMM), mark).files.find((f) => f.path.endsWith('.stl'))!;
  assert.ok(rackStl.data.equals(Buffer.from(rackNode.data as Uint8Array)), 'browser rack STL differs from the Node build');
  await shot(page, '10c-rack');
  // The layered medallion: depth styles, custom heights shown only for Custom, a part per tier.
  await page.getByRole('radio', { name: 'Layered medallion' }).click();
  await page.getByText(/Valid · [\d,]+ triangles/).waitFor({ timeout: 60000 });
  assert.equal(await page.getByLabel('Temple slider').count(), 0, 'custom heights hidden for a preset');
  await page.getByRole('radiogroup', { name: 'Depth' }).getByRole('radio', { name: 'Custom' }).click();
  await page.getByLabel('Temple slider').waitFor();
  await page.getByRole('radiogroup', { name: 'Parts' }).getByRole('radio', { name: 'A part per tier' }).click();
  await page.getByText(/Valid · [\d,]+ triangles · [3-9] parts/).waitFor({ timeout: 60000 });
  await shot(page, '10d-layered');
  step('back features, layer inspector, backlit lithophane, vertical nameplate, stamp, rack panel, layered medallion');

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

  // An application's chapter: its kit's files shown, copied (also where the clipboard is refused), zipped.
  await page.goto(`${URL_}#/guide/integrations/vaultwarden`);
  const kit = page.locator('.kit-files');
  await kit.waitFor();
  const kitFile = (f: string) => readFileSync(join(ROOT, 'assets/integrations/themes/vaultwarden', f), 'utf8');
  const scss = kit.locator('.kit-files__item', { hasText: 'user.vaultwarden.scss.hbs' });
  await scss.getByRole('button', { name: 'Show' }).click();
  assert.equal((await scss.locator('.kit-files__text').textContent())?.trim(), kitFile('user.vaultwarden.scss.hbs').trim(), 'shown as the kit has it');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(URL_).origin });
  await scss.getByRole('button', { name: 'Copy' }).click();
  await scss.getByRole('button', { name: 'Copied' }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), kitFile('user.vaultwarden.scss.hbs'));
  // As on a plain-HTTP page, where the browser keeps the clipboard to itself: the page copies a selection instead.
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('not on this page'));
  });
  const script = kit.locator('.kit-files__item', { hasText: 'apply.sh' });
  await script.getByRole('button', { name: 'Copy' }).click();
  await script.getByRole('button', { name: 'Copied' }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), kitFile('apply.sh'));
  const kitZip = await downloadOf(page, () => kit.getByRole('button', { name: /Download the folder/ }).click());
  assert.ok(Object.keys(unzipSync(new Uint8Array(kitZip.data))).includes('vaultwarden/apply.sh'));
  assert.match((await kit.locator('.dl__command code').textContent()) ?? '', /install\.sh \| OLYMPUS_SITE=\S+ sh -s -- --only kit:vaultwarden$/);
  step('guide: a kit’s files shown, copied (with and without the clipboard), zipped; its one command');

  if (!REMOTE) {
    // The map, in a browser of its own: the edit service answers here, so a refused password would be expected noise elsewhere.
    const mapCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const mp = await mapCtx.newPage();
    const mapErrors: string[] = [];
    mp.on('console', (m) => m.type() === 'error' && mapErrors.push(m.text()));
    mp.on('pageerror', (e) => mapErrors.push(e.message));
    mp.on('response', (r) => r.status() >= 400 && mapErrors.push(`${r.status()} ${r.url()}`));
    mp.on('dialog', (d) => void d.accept());
    await mp.goto(`${URL_}#/map`);
    await mp.locator('[data-phase="intro"]').waitFor({ timeout: 180_000 });
    await mp.getByRole('button', { name: 'Explore the map' }).click();
    await mp.locator('[data-phase="overview"]').waitFor({ timeout: 60_000 });
    assert.equal(await mp.locator('.hotspot').count(), loadCatalog().length, 'every service has a building');
    await mp.locator('.mapbar__select').click();
    assert.equal(await mp.locator('.directory li').count(), loadCatalog().length, 'every service is in the directory');
    await mp.getByLabel('Search the places').fill('jelly');
    assert.equal(await mp.locator('.directory li').count(), 1, 'the search narrows the directory');
    await mp.locator('.directory li button', { hasText: 'Jellyfin' }).click();
    await mp.locator('[data-phase="place"]').waitFor({ timeout: 60_000 });
    assert.equal(await mp.evaluate(() => location.hash), '#/map/jellyfin');
    await mp.locator('.place h2', { hasText: 'Jellyfin' }).waitFor();
    assert.match((await mp.locator('.place').textContent()) ?? '', /https:\/\/jellyfin\.theolympus\.cloud/);
    assert.equal(await mp.locator('.hotspot.is-selected').getAttribute('data-id'), 'jellyfin', 'the ring follows the place');
    const stats = await mp.evaluate(() => (window as unknown as { olympusMapStats: () => { triangles: number; calls: number } }).olympusMapStats());
    assert.ok(stats.triangles < 2_500_000 && stats.calls < 250, `budget: ${JSON.stringify(stats)}`);
    await shot(mp, '17-map');
    await mp.getByRole('button', { name: 'Next place' }).click();
    await mp.waitForFunction(() => location.hash !== '#/map/jellyfin');
    await mp.goBack();
    await mp.locator('.place h2', { hasText: 'Jellyfin' }).waitFor();
    await mp.getByRole('button', { name: 'Back to the island' }).first().click();
    await mp.locator('[data-phase="overview"]').waitFor({ timeout: 60_000 });
    assert.equal(await mp.locator('.map__place').count(), 0);
    // A ring is a button: the keyboard opens its place.
    const ring = mp.locator('.hotspot:not([data-off="true"])').first();
    await ring.focus();
    await mp.keyboard.press('Enter');
    await mp.locator('[data-phase="place"]').waitFor({ timeout: 60_000 });
    assert.equal(await mp.locator('.place h2').textContent(), (await ring.getAttribute('aria-label'))!.split(',')[0]);
    await mp.keyboard.press('Escape');
    await mp.locator('[data-phase="overview"]').waitFor({ timeout: 60_000 });
    // A link opens a place straight away.
    await mp.goto(`${URL_}#/map/nextcloud`);
    await mp.reload();
    await mp.locator('.place h2', { hasText: 'Nextcloud' }).waitFor({ timeout: 180_000 });
    step(`map: the island draws (${Math.round(stats.triangles / 1000)}k triangles, ${stats.calls} draw calls); intro, a ring per service, the directory searched, a place with its address, next, back, the keyboard (Enter, Escape), a link to a place`);

    // Text from the data folder is shown as text.
    const api = new URL('api', URL_).href;
    const signIn = await fetch(`${api}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: EDITOR_PASSWORD }) });
    const cookie = (signIn.headers.get('set-cookie') ?? '').split(';')[0];
    const { csrf } = (await signIn.json()) as { csrf: string };
    const put = await fetch(`${api}/services/odd`, { method: 'PUT', headers: { 'content-type': 'application/json', cookie, 'x-olympus-csrf': csrf }, body: JSON.stringify({ spec: { id: 'odd', name: '<b>x</b>', category: 'other' } }) });
    assert.equal(put.status, 200);
    await mp.goto(`${URL_}#/map/odd`);
    await mp.reload();
    await mp.locator('.place h2').waitFor({ timeout: 180_000 });
    assert.equal(await mp.locator('.place h2').textContent(), '<b>x</b>');
    assert.equal(await mp.locator('.place h2 b').count(), 0, 'no markup from the data');
    assert.equal(await mp.locator('.place', { hasText: /Online|Offline|Not checked/ }).count(), 0, 'nothing is pinged');
    step('map: names from the server are shown as text; nothing is pinged');

    // Editing: sign in, add a lighthouse, a refused spot says why, save, turn, delete. From the whole island's view.
    await mp.goto(`${URL_}#/map`);
    await mp.locator('[data-phase="overview"]').waitFor({ timeout: 180_000 });
    await mp.getByRole('button', { name: 'Edit' }).click();
    await mp.getByLabel('The house’s password').fill(EDITOR_PASSWORD);
    await mp.getByRole('button', { name: 'Sign in' }).click();
    await mp.getByRole('button', { name: 'Add' }).click();
    await mp.getByRole('button', { name: 'Lighthouse' }).click();
    const box = (await mp.locator('.map__canvas').boundingBox())!;
    await mp.mouse.move(box.x + box.width * 0.985, box.y + box.height * 0.45, { steps: 3 });
    await mp.locator('.map-placing__why', { hasText: /Choose a plot|Off the island/ }).waitFor();
    let placed = false;
    for (const [fx, fy] of [[0.35, 0.75], [0.3, 0.6], [0.6, 0.75], [0.25, 0.5], [0.7, 0.6], [0.45, 0.8]]) {
      await mp.mouse.move(box.x + box.width * fx, box.y + box.height * fy, { steps: 3 });
      await mp.waitForTimeout(400);
      if (await mp.locator('.map-placing__why').count()) continue;
      await mp.mouse.down();
      await mp.mouse.up();
      placed = true;
      break;
    }
    assert.ok(placed, 'somewhere on the island takes a lighthouse');
    await mp.getByLabel('Name').fill('Uptime watch');
    await mp.getByLabel('Kind of service').selectOption('monitoring');
    await mp.getByRole('button', { name: 'Save' }).click();
    await mp.locator('.place h2', { hasText: 'Uptime watch' }).waitFor({ timeout: 60_000 });
    assert.ok(existsSync(join(EDITOR_DATA, 'services/uptime-watch.json')), 'saved in the data folder');
    // This server serves a fixed folder: the change is saved, and never said to be published.
    await mp.locator('.map-notice', { hasText: 'Uptime watch is on the map.' }).waitFor({ timeout: 20_000 });
    const saved = JSON.parse(readFileSync(join(EDITOR_DATA, 'places.json'), 'utf8'))['uptime-watch'];
    assert.equal(saved.building, 'lighthouse');
    assert.ok(
      island().plan.lots.some((l) => {
        const at = standOn(l, extentOf('lighthouse'), saved.rotation);
        return at && Math.abs(at.x - saved.x) < 0.05 && Math.abs(at.z - saved.z) < 0.05;
      }),
      'set down on a plot, centred and turned to its street',
    );
    assert.ok(!existsSync(join(ROOT, 'catalog/services/uptime-watch.json')), 'not in the repository');
    const before = JSON.parse(readFileSync(join(EDITOR_DATA, 'places.json'), 'utf8'))['uptime-watch'].rotation;
    await mp.getByRole('button', { name: 'Turn it left' }).click();
    await mp.waitForFunction(() => !document.querySelector('.map-card__actions button:disabled'));
    assert.notEqual(JSON.parse(readFileSync(join(EDITOR_DATA, 'places.json'), 'utf8'))['uptime-watch'].rotation, before, 'turned');
    await mp.getByRole('button', { name: 'Delete' }).click();
    await mp.locator('.place h2', { hasText: 'Uptime watch' }).waitFor({ state: 'detached' });
    assert.ok(!existsSync(join(EDITOR_DATA, 'services/uptime-watch.json')), 'deleted');
    await mp.getByRole('button', { name: 'Undo' }).click();
    await mp.waitForFunction(() => !document.querySelector('.map-edit button:disabled'));
    assert.ok(existsSync(join(EDITOR_DATA, 'services/uptime-watch.json')), 'undo brings it back');
    await shot(mp, '18-map-editing');
    step('map: editing — sign in, add a lighthouse on a plot (the sea refused, with the reason), save to the data folder, turn, delete, undo');

    // A design saved in this browser's Atelier becomes a service's identity; a newer version of it is offered as an update.
    const libraryWith = (version: number) =>
      JSON.stringify({ designs: { 'check-design': { spec: { id: 'my-cloud', name: 'My cloud', category: 'storage', god: 'hermes', caption: 'Kept in the clouds' }, version, created: '2026-10-23T10:00:00.000Z', updated: `2026-10-23T10:0${version}:00.000Z` } } });
    await mp.evaluate((v) => localStorage.setItem('the-olympus/library/v1', v), libraryWith(2));
    await mp.goto(`${URL_}#/map/nextcloud`);
    await mp.reload();
    await mp.locator('.place h2', { hasText: 'Nextcloud' }).waitFor({ timeout: 180_000 });
    await mp.getByRole('button', { name: 'Link a design' }).click();
    await mp.getByRole('button', { name: /My cloud/ }).click();
    await mp.locator('.map-notice', { hasText: 'My cloud wears its design (version 2).' }).waitFor({ timeout: 20_000 });
    const linked = JSON.parse(readFileSync(join(EDITOR_DATA, 'services/nextcloud.json'), 'utf8'));
    assert.deepEqual(
      { name: linked.name, category: linked.category, god: linked.god, caption: linked.caption, design: linked.design },
      { name: 'My cloud', category: 'storage', god: 'hermes', caption: 'Kept in the clouds', design: 'check-design@2' },
    );
    assert.ok(linked.url, 'the address the design lacks is kept');
    await mp.locator('.place h2', { hasText: 'My cloud' }).waitFor();
    await mp.getByText('Its design: My cloud, version 2.').waitFor();
    await mp.evaluate((v) => localStorage.setItem('the-olympus/library/v1', v), libraryWith(3));
    await mp.reload();
    await mp.locator('.place h2', { hasText: 'My cloud' }).waitFor({ timeout: 180_000 });
    await mp.getByRole('button', { name: 'Update from the design' }).click();
    await mp.locator('.map-notice', { hasText: 'version 3' }).waitFor({ timeout: 20_000 });
    assert.equal(JSON.parse(readFileSync(join(EDITOR_DATA, 'services/nextcloud.json'), 'utf8')).design, 'check-design@3');
    await shot(mp, '18b-map-design');
    step('map: a design from the Atelier linked to a building becomes its service; a newer version is offered and applied');
    await mp.goto(`${URL_}#/map`);
    await mp.locator('[data-phase="overview"]').waitFor({ timeout: 180_000 });

    // A copy of the site on a plain web server (no edit API: /api/ answers {"editor":false}): the map still shows, and saving says why.
    await mapCtx.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"editor":false}' }));
    await mp.reload();
    await mp.locator('[data-phase="overview"]').waitFor({ timeout: 180_000 });
    assert.ok(await mp.getByRole('button', { name: 'Edit' }).isDisabled());
    await mp.getByText('Saving needs the house’s own server').waitFor();
    step('map: on a plain web server without the edit API, the map shows read-only and says why');
    assert.deepEqual(mapErrors, [], `map console errors:\n${mapErrors.join('\n')}`);
    await mapCtx.close();

    // Phones get the island too, a place as a sheet; reduced motion holds the clouds still.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pp = await phone.newPage();
    await pp.goto(`${URL_}#/map`);
    await pp.locator('[data-phase="intro"]').waitFor({ timeout: 180_000 });
    await pp.getByRole('button', { name: 'All places' }).click();
    await pp.locator('.directory li button', { hasText: 'Jellyfin' }).click();
    await pp.locator('[data-phase="place"] .place h2', { hasText: 'Jellyfin' }).waitFor({ timeout: 60_000 });
    assert.ok(!(await pp.locator('.mapbar').isVisible()), 'the sheet carries the navigation');
    await phone.close();
    const calm = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const cp = await calm.newPage();
    await cp.goto(`${URL_}#/map`);
    await cp.locator('[data-phase="intro"]').waitFor({ timeout: 180_000 });
    await cp.getByRole('button', { name: 'Explore the map' }).click();
    await cp.locator('[data-phase="overview"]').waitFor({ timeout: 60_000 });
    await cp.waitForTimeout(1500);
    const a = await cp.locator('.map__canvas').screenshot();
    await cp.waitForTimeout(1200);
    assert.ok(a.equals(await cp.locator('.map__canvas').screenshot()), 'nothing drifts under reduced motion');
    await calm.close();
    step('map: phones get the island and a place as a sheet; under reduced motion nothing moves');
  }

  // The medallion: drawn live from its STL; it moves, unless the visitor asks for reduced motion.
  const frames = async (p: Page) => {
    // The clouds drift in front of the medallion's foot: compare the medallion alone.
    await p.addStyleTag({ content: '.ascent__clouds{visibility:hidden!important}' });
    const stage = p.locator('.hero__frame');
    const a = await stage.screenshot();
    await p.waitForTimeout(1200);
    return [a, await stage.screenshot()];
  };
  await page.goto(`${URL_}#/`);
  await page.locator('.hero__stage[data-state="live"][data-stone="ready"]').waitFor({ timeout: 60000 });
  await page.getByText('Drag to turn it').waitFor();
  const [m1, m2] = await frames(page);
  assert.ok(!m1.equals(m2), 'the medallion moves');
  const still = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  const sp = await still.newPage();
  await sp.goto(`${URL_}#/`);
  await sp.locator('.hero__stage[data-state="live"][data-stone="ready"]').waitFor({ timeout: 60000 });
  await sp.waitForTimeout(300);
  // Held still, it may still redraw once as the page settles; motion would differ on every look.
  let held = false;
  for (let i = 0; i < 5 && !held; i++) {
    const [r1, r2] = await frames(sp);
    held = r1.equals(r2);
  }
  assert.ok(held, 'under reduced motion the medallion holds still');
  await still.close();
  step('home: the medallion is drawn from its STL, moves, and holds still under reduced motion');

  // The home page's story: the ascent is held while it plays, the crest assembles step by step,
  // the pantheon passes sideways (and follows the keyboard), and without motion all of it simply lies in the page.
  const scrollTo = (p: Page, y: number) => p.evaluate((y) => document.getElementById('site-main')!.scrollTo(0, y), y);
  const topOf = (p: Page, sel: string) => p.evaluate((sel) => document.querySelector(sel)!.getBoundingClientRect().top + document.getElementById('site-main')!.scrollTop - 60, sel);
  await page.locator('.home.is-held').waitFor();
  await scrollTo(page, 400);
  await page.waitForTimeout(900);
  assert.ok(await page.locator('.ascent').evaluate((el) => Math.abs(el.getBoundingClientRect().top - 60) < 2), 'the ascent holds in place');
  assert.notEqual(await page.locator('.ascent__word--the').evaluate((el) => getComputedStyle(el).transform), 'none', 'the words part');
  const steps = page.locator('.anatomy__step');
  await scrollTo(page, (await topOf(page, '.anatomy__step:nth-child(4)')) - 860 / 2 + 100);
  await page.locator('.anatomy__step:nth-child(4)[aria-current="step"]').waitFor();
  assert.equal(await page.locator('.anatomy__part').nth(3).getAttribute('data-state'), 'now', 'the temple is drawn as it is told');
  assert.equal(await page.locator('.anatomy__part').nth(0).getAttribute('data-state'), 'set');
  assert.equal(await steps.count(), 6);
  const panStart = await topOf(page, '.pantheon-run');
  await scrollTo(page, panStart + 1500);
  await page.waitForTimeout(1200);
  const shifted = await page.locator('.pantheon__track').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
  assert.ok(shifted < -1000, `the gods pass sideways (${shifted})`);
  await scrollTo(page, panStart);
  await page.waitForTimeout(600);
  await page.locator('.deity a').nth(12).focus();
  await page.waitForTimeout(1200);
  const box = await page.locator('.deity a').nth(12).boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= 1520, `a god reached by keyboard is brought into view (${box?.x})`);
  await page.locator('.deity a').nth(12).click();
  await page.locator('.card').first().waitFor();
  await page.goto(`${URL_}#/`);
  const calm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const cp = await calm.newPage();
  const scripts: string[] = [];
  cp.on('request', (r) => scripts.push(r.url()));
  await cp.goto(`${URL_}#/`);
  await cp.locator('.deity').nth(15).waitFor();
  await cp.waitForTimeout(1500);
  assert.equal(await cp.locator('.home.is-held').count(), 0, 'nothing is held without motion');
  assert.ok(!scripts.some((u) => /choreography/.test(u)), 'the choreography is not even loaded');
  assert.ok(await cp.locator('.pantheon__viewport').evaluate((el) => el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX === 'auto'), 'the pantheon scrolls sideways by hand');
  await calm.close();
  step('home: the ascent holds while it plays, the crest assembles as it is told, the pantheon passes sideways and follows the keyboard; none of it without motion');

  // A phone: the menu, the still medallion with its button, the Atelier one pane at a time.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload(); // the hero decides on 3D when it loads
  await page.getByRole('button', { name: 'Turn it in 3D' }).waitFor();
  assert.equal(await page.locator('.hero__canvas').count(), 0, 'phones do not load the 3D scene until asked');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Atelier' }).click();
  await page.locator('.stage__mark').waitFor();
  assert.ok(!(await page.locator('#atelier-library').isVisible()), 'the preview pane hides the designs');
  await page.getByRole('navigation', { name: 'Atelier' }).getByRole('button', { name: 'Designs' }).click();
  await page.getByRole('button', { name: /^Jellyfin Apollo · media/ }).click();
  await page.locator('.stage__mark').waitFor();
  assert.equal(await page.getByRole('navigation', { name: 'Atelier' }).getByRole('button', { name: 'Preview' }).getAttribute('aria-pressed'), 'true', 'choosing a design shows it');
  await page.getByRole('navigation', { name: 'Atelier' }).getByRole('button', { name: 'Settings' }).click();
  assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Jellyfin');
  await shot(page, '6-phone-settings');
  // A laptop: the designs open in a drawer and close with Escape.
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('button', { name: 'Designs', exact: true }).click();
  await page.getByRole('button', { name: /^Backup Kronos · backup/ }).waitFor();
  await page.keyboard.press('Escape');
  // The drawer slides away (0.28 s); a slow machine takes longer to finish it.
  await page.locator('#atelier-library').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  assert.ok(!(await page.locator('#atelier-library').isVisible()), 'Escape closes the drawer');
  await shot(page, '6-laptop');
  step('phones and laptops: menu, Atelier panes, designs drawer');

  assert.deepEqual(errors, [], `console errors:\n${errors.join('\n')}`);
  step('no console errors');
} finally {
  // A page that drew WebGL can keep the browser from closing promptly: do not wait on it.
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  stop();
}
console.log(`\n${steps.length} checks passed.`);
process.exit(0);
