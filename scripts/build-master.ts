// Builds the master identity files into assets/master/.
//   npm run build:master
//
// Production SVGs (one path, one fill) for every tier, edition and ground;
// PNGs at the sizes each tier is meant for; a multi-size favicon.ico; a few
// presentation renders; and a manifest with checksums and print limits.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { loadNodeFonts } from '../src/node/fonts.ts';
import { crest, emblem, seal, type Detail, type Mark } from '../src/geometry/crest.ts';
import { productionSvg, treatmentSvg, type Ground } from '../src/render/svg.ts';
import { geometryOf, minFeature, minDiameterMM } from '../src/print/printcheck.ts';
import { ringsPath } from '../src/geometry/poly.ts';
import { PALETTE } from '../src/brand/palette.ts';
import { ico } from '../src/export/ico.ts';
import { webIcons } from '../src/catalog/webicons.ts';

loadNodeFonts();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'master');
rmSync(OUT, { recursive: true, force: true });

const files: { path: string; bytes: number; sha256: string }[] = [];
function write(rel: string, data: string | Uint8Array) {
  const path = join(OUT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  files.push({ path: relative(OUT, path), bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') });
}
const png = (svg: string, size: number) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

/* ---------------------------------------------------------------- */
/* Marks                                                             */
/* ---------------------------------------------------------------- */
// Print editions are exported as the exact polygon geometry that passed the
// print check; fine editions keep their curves.
const printed = (m: Mark): Mark => ({ ...m, d: ringsPath(geometryOf(m.d)) });

const MARKS: { name: string; mark: Mark; tier: 'crest' | 'emblem' | 'seal'; detail?: Detail }[] = [
  { name: 'crest-fine', mark: crest({ detail: 'fine' }), tier: 'crest', detail: 'fine' },
  { name: 'crest-fine-slot', mark: crest({ detail: 'fine', medal: 'slot' }), tier: 'crest', detail: 'fine' },
  { name: 'crest-print', mark: printed(crest({ detail: 'print' })), tier: 'crest', detail: 'print' },
  { name: 'crest-print-slot', mark: printed(crest({ detail: 'print', medal: 'slot' })), tier: 'crest', detail: 'print' },
  { name: 'emblem-fine', mark: emblem({ detail: 'fine' }), tier: 'emblem', detail: 'fine' },
  { name: 'emblem-print', mark: printed(emblem({ detail: 'print' })), tier: 'emblem', detail: 'print' },
  { name: 'seal', mark: seal(), tier: 'seal' },
];

const GROUNDS: { suffix: string; ground: Ground; ink?: string }[] = [
  { suffix: '', ground: 'transparent' }, // charcoal ink, transparent — the default file
  { suffix: '-white', ground: 'transparent', ink: PALETTE.marble }, // for dark interfaces
  { suffix: '-on-light', ground: 'light' },
  { suffix: '-on-dark', ground: 'dark' },
];

const PNG_SIZES = { crest: [256, 512, 1024, 2048], emblem: [64, 128, 256], seal: [16, 32, 48, 64, 180, 192, 512] };

for (const { name, mark, tier } of MARKS) {
  for (const { suffix, ground, ink } of GROUNDS) {
    const svg = productionSvg(mark, { ground, ink, title: `The Olympus — ${name.replace(/-/g, ' ')}` });
    write(`svg/the-olympus-${name}${suffix}.svg`, svg);
    if (name.endsWith('-slot')) continue; // the slot is a template: SVG only
    if (suffix === '' || suffix === '-white') {
      for (const size of PNG_SIZES[tier]) write(`png/${tier}/the-olympus-${name}${suffix}-${size}.png`, png(svg, size));
    }
  }
}

/* ---------------------------------------------------------------- */
/* favicon.ico — PNG-compressed entries at 16, 32 and 48 px          */
/* ---------------------------------------------------------------- */
{
  const sizes = [16, 32, 48];
  const images = sizes.map((s) => png(productionSvg(seal(), { ground: 'transparent' }), s));
  const favicon = ico(sizes.map((size, i) => ({ size, png: images[i] })));
  write('favicon.ico', favicon);
  // The web icon set, for the house's own pages.
  const web = webIcons(seal(), { name: 'The Olympus', short: 'Olympus' });
  for (const f of web.files) write(`web/${f.path}`, f.data);
  for (const r of web.rasters) write(`web/${r.path}`, png(r.svg, r.width));
  write('web/favicon.ico', favicon);
}

/* ---------------------------------------------------------------- */
/* Presentation renders (documentation and previews, not production) */
/* ---------------------------------------------------------------- */
for (const t of ['relief-black', 'relief-white', 'engraved', 'flat-light', 'graphite', 'blueprint'] as const) {
  write(`presentation/the-olympus-crest-${t}.png`, png(treatmentSvg(crest({ detail: 'fine' }), t), 1024));
}

/* ---------------------------------------------------------------- */
/* Manifest                                                          */
/* ---------------------------------------------------------------- */
const print: Record<string, unknown> = {};
for (const name of ['crest-print', 'emblem-print']) {
  const m = MARKS.find((x) => x.name === name)!.mark;
  const { w } = minFeature(geometryOf(m.d));
  print[name] = {
    minFeatureUnits: Math.round(w * 100) / 100,
    minDiameterMM: Object.fromEntries([0.3, 0.4, 0.5].map((f) => [`at${f}mm`, Math.ceil(minDiameterMM(w, f))])),
  };
}
write(
  'manifest.json',
  JSON.stringify({ name: 'The Olympus — master identity', artboard: '512 × 512, rim Ø 504', print, files: [...files] }, null, 2) + '\n',
);

console.log(`${files.length} files → ${relative(ROOT, OUT)}/`);
