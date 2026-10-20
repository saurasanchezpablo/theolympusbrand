// The Olympus — stickers.
//
//   npm run sticker -- master                         every colourway of the crest sticker
//   npm run sticker -- jellyfin --art seal --style dark --size 50
//   npm run sticker -- vpn --art lockup-horizontal --size 120 --shape rounded
//   npm run sticker -- sheet                          every service's seal on A4 sheets
//   npm run sticker -- sheet --art crest --size 60 --style marble-dark --paper a3
//
// Options: --art crest|emblem|seal|lockup-horizontal|lockup-vertical
//          --style white|dark|clear-dark|clear-light|marble-light|marble-dark
//          --size <mm> --border <mm> --bleed <mm> --shape contour|rounded --finest <mm>
//
// Writes manufacturing/stickers/<id>/: the production SVG and PDF (layers:
// Bleed, Artwork, White, CutContour), the cut path alone, a preview, a sheet.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { loadNodeFonts } from '../src/node/fonts.ts';
import { loadCatalog } from '../src/node/catalog.ts';
import { baseMarks } from '../src/catalog/fileset.ts';
import { DOMAIN } from '../src/brand/identity.ts';
import type { Patron } from '../src/geometry/pantheon.ts';
import { buildSticker, stickerReadme, cutlineSvg, layoutSheet, sheetPdf, sheetPreviewSvg, stickerPdf, stickerSvg, PAPERS, STICKER_ARTS, STICKER_DEFAULTS, STICKER_STYLES, type Paper, type StickerArt, type StickerInput, type StickerSpec, type StickerStyle } from '../src/manufacturing/stickers.ts';
import { ROOT } from './lib/build-service.ts';

loadNodeFonts();
const args = process.argv.slice(2);
const target = args[0];
const flag = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i > 0 ? args[i + 1] : undefined;
};
const fail = (m: string): never => {
  console.error(`✖ ${m}`);
  process.exit(1);
};
if (!target || target === 'help') {
  console.log(`npm run sticker -- <master|service-id|sheet> [--art ${Object.keys(STICKER_ARTS).join('|')}] [--style ${Object.keys(STICKER_STYLES).join('|')}] [--size mm] [--border mm] [--bleed mm] [--shape contour|rounded] [--finest mm] [--paper ${Object.keys(PAPERS).join('|')}]`);
  process.exit(0);
}

const spec: StickerSpec = { ...STICKER_DEFAULTS };
if (flag('art')) spec.art = (flag('art') as StickerArt) in STICKER_ARTS ? (flag('art') as StickerArt) : fail(`--art: ${Object.keys(STICKER_ARTS).join(', ')}`);
if (flag('style')) spec.style = (flag('style') as StickerStyle) in STICKER_STYLES ? (flag('style') as StickerStyle) : fail(`--style: ${Object.keys(STICKER_STYLES).join(', ')}`);
for (const k of ['size', 'border', 'bleed', 'finest'] as const) if (flag(k) !== undefined) spec[k] = Number(flag(k));
if (flag('shape')) spec.shape = flag('shape') === 'rounded' ? 'rounded' : 'contour';

const inputFor = (patron: Patron | undefined, name: string, caption: string, url?: string): StickerInput => {
  const m = baseMarks(patron ?? { god: 'zeus' });
  return { marks: { crestFine: m['crest-fine'].d, crestPrint: m['crest-print'].d, emblemFine: m['emblem-fine'].d, emblemPrint: m['emblem-print'].d, seal: m.seal.d }, name, caption, url };
};
const preview = (svg: string, width: number) => new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: '#EFEFEF' }).render().asPng();

if (target === 'sheet') {
  // Every service (and the master), one sticker each.
  if (!flag('art')) spec.art = 'seal';
  if (!flag('size')) spec.size = 40;
  const paper = (flag('paper') ?? 'a4') as Paper;
  if (!(paper in PAPERS)) fail(`--paper: ${Object.keys(PAPERS).join(', ')}`);
  const stickers = [buildSticker(inputFor(undefined, 'The Olympus', DOMAIN, `https://${DOMAIN}`), spec), ...loadCatalog().map((s) => buildSticker(inputFor(s.patron, s.name, s.caption, s.url), spec))];
  const layout = layoutSheet(stickers, paper);
  const dir = join(ROOT, 'manufacturing', 'stickers', 'sheets');
  mkdirSync(dir, { recursive: true });
  const base = `the-olympus-sheet-${spec.art}-${spec.style}-${spec.size}mm-${paper}`;
  writeFileSync(join(dir, `${base}.pdf`), sheetPdf(layout, `The Olympus — sticker sheet`));
  layout.pages.forEach((_, i) => writeFileSync(join(dir, `${base}-${i + 1}.png`), preview(sheetPreviewSvg(layout, i), 1240)));
  console.log(`✔ ${stickers.length} stickers on ${layout.pages.length} ${paper.toUpperCase()} page${layout.pages.length > 1 ? 's' : ''}${layout.overflow ? ` (${layout.overflow} too large for the paper)` : ''} → manufacturing/stickers/sheets/${base}.pdf`);
  process.exit(0);
}

let id = target;
let input: StickerInput;
let title = 'The Olympus';
if (target === 'master') input = inputFor(undefined, 'The Olympus', DOMAIN, `https://${DOMAIN}`);
else {
  const s = loadCatalog().find((x) => x.id === target) ?? fail(`no service "${target}" in catalog/services/ (or "master", or "sheet")`);
  id = s.id;
  title = `The Olympus — ${s.name}`;
  input = inputFor(s.patron, s.name, s.caption, s.url);
}

const styles = flag('style') ? [spec.style] : (Object.keys(STICKER_STYLES) as StickerStyle[]);
const dir = join(ROOT, 'manufacturing', 'stickers', id);
for (const style of styles) {
  const st = buildSticker(input, { ...spec, style });
  const base = `the-olympus-${id}-sticker-${spec.art}-${style}`;
  const sub = join(dir, `${spec.art}-${style}`);
  rmSync(sub, { recursive: true, force: true });
  mkdirSync(sub, { recursive: true });
  const label = `${title} — sticker, ${STICKER_ARTS[spec.art].toLowerCase()}, ${STICKER_STYLES[style].label.toLowerCase()}`;
  writeFileSync(join(sub, `${base}.svg`), stickerSvg(st, label));
  writeFileSync(join(sub, `${base}.pdf`), stickerPdf(st, label));
  writeFileSync(join(sub, `${base}-cutline.svg`), cutlineSvg(st, label));
  writeFileSync(join(sub, `${base}-preview.png`), preview(stickerSvg(st, label, { preview: true }), 800));
  const sheet = layoutSheet(Array.from({ length: 60 }, () => st), 'a4');
  const onSheet = sheet.pages[0]?.length ?? 0;
  writeFileSync(join(sub, `${base}-a4-sheet.pdf`), sheetPdf({ ...sheet, pages: sheet.pages.slice(0, 1) }, `${label} — A4 sheet`));
  writeFileSync(join(sub, `${base}.md`), stickerReadme(st, base, label, onSheet, 'a4'));
  console.log(`${st.warnings.length ? '⚠' : '✔'} ${style.padEnd(13)} ${st.width.toFixed(1)} × ${st.height.toFixed(1)} mm · ${st.spec.art === 'seal' ? 'seal' : `${st.edition} edition`} · ${onSheet} per A4`);
  for (const w of st.warnings) console.log(`    ⚠ ${w}`);
}
console.log(`→ manufacturing/stickers/${id}/`);
