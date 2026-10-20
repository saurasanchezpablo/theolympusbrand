// The Olympus — printable models.
//
//   npm run model -- master                       every product for the master crest
//   npm run model -- jellyfin                     every product for a service
//   npm run model -- jellyfin --product token     one product
//   npm run model -- master --product medallion --diameter 120 --relief 1.6 --magnets 2
//   npm run model -- vpn --product nameplate --layout vertical --keyhole on
//   npm run model -- master --layer 0.16 --infill 20    print settings (layers, estimates)
//   npm run model -- products                     the products and their parameters
//
// Writes manufacturing/3d/<id>/<product>/: STL, 3MF, OpenSCAD source with its
// SVG, a preview rendered from the mesh, and a sheet with dimensions,
// validation and printing notes.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadNodeFonts } from '../src/node/fonts.ts';
import { loadCatalog } from '../src/node/catalog.ts';
import { DEFAULT_SETTINGS, PRODUCTS, suggestedParams, type ParamKey, type Params, type PrintSettings, type ProductId } from '../src/manufacturing/products.ts';
import { markFor, modelFiles, type Subject } from '../src/manufacturing/files.ts';
import { DOMAIN } from '../src/brand/identity.ts';
import type { Patron } from '../src/geometry/pantheon.ts';
import { png } from '../src/export/png.ts';
import { ROOT } from './lib/build-service.ts';

loadNodeFonts();

const args = process.argv.slice(2);
const target = args[0];
const flag = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i > 0 ? args[i + 1] : undefined;
};

if (!target || target === 'help' || target === 'products') {
  if (target !== 'products') console.log(readHelp());
  for (const p of Object.values(PRODUCTS)) {
    console.log(`\n${p.id} — ${p.summary}`);
    for (const s of p.params) {
      const range = s.kind === 'toggle' ? 'on | off' : s.kind === 'choice' ? s.options!.join(' | ').toLowerCase() : `${s.min}–${s.max}`;
      const value = s.kind === 'toggle' ? (s.value ? 'on' : 'off') : s.kind === 'choice' ? s.options![s.value].toLowerCase() : String(s.value);
      console.log(`  --${s.key.padEnd(15)} ${value.padStart(10)} ${s.unit.padEnd(3)} ${range.padEnd(22)} ${s.label}`);
    }
  }
  process.exit(0);
}

function readHelp() {
  return `npm run model -- <master|service-id> [--product ${Object.keys(PRODUCTS).join('|')}] [--<parameter> value …]`;
}

let id = target;
let title = 'The Olympus';
let patron: Patron | undefined;
let subject: Subject = { id, title, name: 'The Olympus', caption: DOMAIN, url: `https://${DOMAIN}` };
if (target !== 'master') {
  const s = loadCatalog().find((x) => x.id === target);
  if (!s) {
    console.error(`✖ no service "${target}" in catalog/services/ (or use "master")`);
    process.exit(1);
  }
  id = s.id;
  title = `The Olympus — ${s.name}`;
  patron = s.patron;
  subject = { id, title, name: s.name, caption: s.caption, url: s.url };
}

const only = flag('product') as ProductId | undefined;
if (only && !PRODUCTS[only]) {
  console.error(`✖ unknown product "${only}" — ${Object.keys(PRODUCTS).join(', ')}`);
  process.exit(1);
}
const params: Params = {};
for (const p of Object.values(PRODUCTS).flatMap((x) => x.params)) {
  const v = flag(p.key);
  if (v === undefined) continue;
  // Toggles take on/off, choices their name; numbers are numbers.
  const word = v.toLowerCase();
  const value = p.kind === 'toggle' && ['on', 'off', 'yes', 'no'].includes(word) ? Number(word === 'on' || word === 'yes') : p.kind === 'choice' && p.options!.some((o) => o.toLowerCase() === word) ? p.options!.findIndex((o) => o.toLowerCase() === word) : Number(v);
  if (!Number.isFinite(value)) {
    console.error(`✖ --${p.key} ${v}: expected ${p.kind === 'toggle' ? 'on or off' : p.kind === 'choice' ? p.options!.join(', ').toLowerCase() : 'a number'}`);
    process.exit(1);
  }
  params[p.key as ParamKey] = value;
}
const settings: PrintSettings = { ...DEFAULT_SETTINGS };
for (const k of ['layer', 'infill', 'filament', 'density'] as const) if (flag(k) !== undefined) settings[k] = Number(flag(k));

const marks = { crest: markFor('crest', patron, id), seal: markFor('seal', patron, id) };
let failed = false;
for (const product of only ? [only] : (Object.keys(PRODUCTS) as ProductId[])) {
  const t0 = Date.now();
  const kind = PRODUCTS[product].mark;
  const mark = kind ? marks[kind] : null;
  const { model, files, images } = modelFiles(subject, product, { ...suggestedParams(product, mark?.minDiameterMM), ...params }, mark, settings);
  const dir = join(ROOT, 'manufacturing', '3d', id, product);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const f of files) writeFileSync(join(dir, f.path), f.data);
  for (const img of images()) writeFileSync(join(dir, img.path), png(img.rgba, img.width, img.height));
  const ok = model.parts.every((p) => p.report.ok);
  failed ||= !ok;
  const tris = model.parts.reduce((s, p) => s + p.report.triangles, 0);
  console.log(`${ok ? '✔' : '✖'} ${product.padEnd(11)} ${model.size.join(' × ')} mm · ${tris.toLocaleString('en')} triangles · ${ok ? 'valid' : 'INVALID'} · ${Date.now() - t0} ms`);
  for (const w of model.warnings) console.log(`    ⚠ ${w}`);
}
console.log(`→ manufacturing/3d/${id}/`);
if (failed) process.exit(1);
