// The brand book: one PDF, A4 landscape, that presents the identity — the
// mark, its construction, tiers, palette, type, the pantheon, the catalogue,
// lockups, sizes, and the printed and made objects. Every word is outlined
// type and every mark is the real geometry, so it needs no fonts to open.
//
//   npm run brandbook        → docs/the-olympus-brand-book.pdf

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { loadNodeFonts } from '../src/node/fonts.ts';
import { loadCatalog } from '../src/node/catalog.ts';
import { crest, emblem, seal, borderLayout, PROFILES, type Mark } from '../src/geometry/crest.ts';
import { lockup } from '../src/geometry/lockup.ts';
import { flatten } from '../src/geometry/poly.ts';
import { lineText, missingGlyphs, type FontRole } from '../src/geometry/fonts.ts';
import { GODS, CATEGORIES } from '../src/geometry/pantheon.ts';
import { PALETTE } from '../src/brand/palette.ts';
import { DOMAIN } from '../src/brand/identity.ts';
import { RIM, C, type Ring } from '../src/geometry/math.ts';
import { treatmentSvg } from '../src/render/svg.ts';
import { pdf, type PdfItem, type PdfPage } from '../src/export/pdf.ts';
import { buildModel, suggestedParams } from '../src/manufacturing/products.ts';
import { markFor } from '../src/manufacturing/files.ts';
import { renderMeshes } from '../src/render/mesh-render.ts';
import { buildSticker, STICKER_DEFAULTS } from '../src/manufacturing/stickers.ts';
import { mockupSvg } from '../src/render/mockups.ts';
import { baseMarks } from '../src/catalog/fileset.ts';
import { ROOT } from './lib/build-service.ts';

loadNodeFonts();

const W = 297;
const H = 210;
const M = 18; // page margin
const gray = (hex: string) => parseInt(hex.slice(1, 3), 16) / 255;
const INK = gray(PALETTE.charcoal);
const SOFT = gray(PALETTE.slate);
const LINE = gray(PALETTE.ash);

class Page {
  items: PdfItem[] = [];
  constructor(background?: number) {
    if (background !== undefined) this.items.push({ kind: 'fill', layer: 'Page', rings: [[[0, 0], [W, 0], [W, H], [0, H]]], paint: { gray: background } });
  }

  /** One line of outlined type; `top` is the cap line, measured from the page's top. */
  text(str: string, x: number, top: number, cap: number, { role = 'body' as FontRole, ink = INK, tracking = 0.02, align = 'left' as 'left' | 'centre' | 'right' } = {}): number {
    const missing = missingGlyphs(str, role);
    if (missing.length) throw new Error(`"${str}": ${role} has no glyph for ${missing.join(' ')}`);
    const probe = lineText(str, { cx: 0, baseline: 0, size: 100, tracking, role });
    const k = cap / probe.capHeight;
    const width = probe.width * k;
    const left = align === 'left' ? x : align === 'centre' ? x - width / 2 : x - width;
    const baseline = H - (top + cap);
    const rings = flatten(probe.d).map((r) => r.map(([px, py]): [number, number] => [left + (px + probe.width / 2) * k, baseline - py * k]));
    if (rings.length) this.items.push({ kind: 'fill', layer: 'Text', rings, paint: { gray: ink } });
    return width;
  }

  /** Running text wrapped to a width; returns the top of the next line. */
  para(str: string, x: number, top: number, width: number, cap = 2.3, { ink = INK, leading = 2.15, role = 'body' as FontRole } = {}): number {
    const words = str.split(/\s+/);
    let line = '';
    const measure = (s: string) => {
      const p = lineText(s, { cx: 0, baseline: 0, size: 100, tracking: 0.02, role });
      return (p.width * cap) / p.capHeight;
    };
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (measure(next) > width && line) {
        this.text(line, x, top, cap, { ink, role });
        top += cap * leading;
        line = w;
      } else line = next;
    }
    if (line) {
      this.text(line, x, top, cap, { ink, role });
      top += cap * leading;
    }
    return top + cap * 0.6;
  }

  /** A mark (artboard path data) placed so its `box` (artboard units) spans `size` mm wide at (x, top). */
  mark(d: string, x: number, top: number, size: number, { ink = INK, box = [0, 0, 512, 512] as [number, number, number, number] } = {}) {
    const k = size / (box[2] - box[0]);
    const rings: Ring[] = flatten(d).map((r) => r.map(([px, py]): [number, number] => [x + (px - box[0]) * k, H - top - (py - box[1]) * k]));
    this.items.push({ kind: 'fill', layer: 'Marks', rings, paint: { gray: ink } });
  }

  rect(x: number, top: number, w: number, h: number, g: number) {
    this.items.push({ kind: 'fill', layer: 'Page', rings: [[[x, H - top - h], [x + w, H - top - h], [x + w, H - top], [x, H - top]]], paint: { gray: g } });
  }

  rule(x1: number, top1: number, x2: number, top2: number, g = LINE, width = 0.4) {
    this.items.push({ kind: 'stroke', layer: 'Page', rings: [[[x1, H - top1], [x2, H - top2]]], paint: { gray: g }, width });
  }

  circle(cx: number, cyTop: number, r: number, g = SOFT, width = 0.3) {
    const ring: Ring = Array.from({ length: 180 }, (_, i): [number, number] => [cx + r * Math.cos((i / 180) * 2 * Math.PI), H - cyTop + r * Math.sin((i / 180) * 2 * Math.PI)]);
    this.items.push({ kind: 'stroke', layer: 'Page', rings: [ring], paint: { gray: g }, width });
  }

  /** A raster (RGBA, R = G = B) placed at (x, top), w × h mm. */
  image(rgba: Uint8Array | Uint8ClampedArray, px: [number, number], x: number, top: number, w: number, h: number) {
    const g = new Uint8Array(px[0] * px[1]);
    for (let i = 0; i < g.length; i++) g[i] = rgba[i * 4];
    this.items.push({ kind: 'image', layer: 'Images', gray: g, px, at: [x, H - top - h, w, h] });
  }

  /** Section heading and folio. */
  head(n: number, title: string, kicker: string) {
    this.text(String(n).padStart(2, '0'), M, M, 3, { role: 'companion', ink: SOFT, tracking: 0.2 });
    this.text(title.toUpperCase(), M + 12, M - 1, 6.4, { role: 'inscription', tracking: 0.12 });
    this.text(kicker.toUpperCase(), M + 12, M + 8.6, 2.1, { role: 'companion', ink: SOFT, tracking: 0.24 });
    this.rule(M, M + 15, W - M, M + 15);
    this.text('THE OLYMPUS · BRAND BOOK', M, H - M + 4, 1.8, { role: 'companion', ink: SOFT, tracking: 0.24 });
    this.text(`${n + 1}`, W - M, H - M + 4, 1.8, { role: 'companion', ink: SOFT, align: 'right' });
  }

  page(): PdfPage {
    return { width: W, height: H, items: this.items };
  }
}

const raster = (svg: string, width: number) => {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render();
  return { rgba: r.pixels, px: [r.width, r.height] as [number, number] };
};

const pages: PdfPage[] = [];
const master = { crest: crest(), print: crest({ detail: 'print' }), emblem: emblem(), seal: seal() };
const services = loadCatalog();

/* 1 · Cover */
{
  const p = new Page(gray(PALETTE.obsidian));
  p.mark(master.crest.d, W / 2 - 62, 24, 124, { ink: gray(PALETTE.marble) });
  p.text('THE OLYMPUS', W - M, H - 44, 9, { role: 'inscription', ink: gray(PALETTE.marble), tracking: 0.14, align: 'right' });
  p.text('BRAND BOOK', W - M, H - 30, 2.6, { role: 'companion', ink: gray(PALETTE.silver), tracking: 0.3, align: 'right' });
  p.text(DOMAIN, M, H - 30, 2.6, { role: 'companion', ink: gray(PALETTE.silver), tracking: 0.08 });
  pages.push(p.page());
}

/* 2 · The mark */
{
  const p = new Page(gray(PALETTE.paper));
  p.head(1, 'The mark', 'A heraldic coin with a temple-server at its heart');
  p.mark(master.crest.d, M, 42, 130);
  let y = 46;
  const x = 170;
  y = p.para('The Olympus is a private server presented as the house of the gods. Its mark is an ancient coin: a temple stands on Mount Olympus, and the temple is the server.', x, y, 108, 2.6);
  for (const [part, what] of [
    ['Pediment', 'Zeus’ thunderbolt — the authority of the master host.'],
    ['Frieze', 'Triglyphs that are ventilation slots.'],
    ['Columns', 'Fluted shafts that read as drive bays; rack units with status lights between them.'],
    ['Central bay', 'The god of the service. On the master, more servers.'],
    ['Plinth', 'Mount Olympus, with THE OLYMPUS cut into it, rising from engraved clouds — theolympus.cloud.'],
    ['Medallion', 'The logo slot, resting on the clouds.'],
    ['Border', 'A Greek key and a bead-and-reel in the house’s own rhythm.'],
  ]) {
    p.text(part.toUpperCase(), x, y, 2, { role: 'companion', tracking: 0.18 });
    y = p.para(what, x + 26, y, 82, 2.2, { ink: gray(PALETTE.graphite) });
  }
  pages.push(p.page());
}

/* 3 · Construction */
{
  const p = new Page(gray('#F3F3F3'));
  p.head(2, 'Construction', 'Measured in units of the 512 artboard; rim Ø 504');
  const size = 150;
  const x0 = M + 4;
  const t0 = 34;
  // Grid.
  for (let i = 0; i <= 8; i++) {
    p.rule(x0 + (i * size) / 8, t0, x0 + (i * size) / 8, t0 + size, gray('#DCDCDC'), 0.2);
    p.rule(x0, t0 + (i * size) / 8, x0 + size, t0 + (i * size) / 8, gray('#DCDCDC'), 0.2);
  }
  p.mark(master.crest.d, x0, t0, size, { ink: gray('#C4C4C4') });
  const k = size / 512;
  const cx = x0 + C * k;
  const cy = t0 + C * k;
  const b = borderLayout(PROFILES.fine);
  const radii: [string, number][] = [['Rim', RIM], ['Greek key', b.keyOut], ['Inner rule', b.ruleIn], ['Bead-and-reel', b.beadR], ['Field', b.fieldR]];
  radii.forEach(([name, r], i) => {
    p.circle(cx, cy, r * k, INK, 0.25);
    const a = ((-60 + i * 13) * Math.PI) / 180;
    const px = cx + r * k * Math.cos(a);
    const py = cy + r * k * Math.sin(a);
    const ly = 40 + i * 13;
    p.rule(px, py, 190, ly + 1.2, INK, 0.2);
    p.text(`R ${Math.round(r * 10) / 10}`, 192, ly, 2.4, { role: 'companion' });
    p.text(name.toUpperCase(), 210, ly + 0.4, 1.8, { role: 'companion', ink: SOFT, tracking: 0.18 });
  });
  p.para('Everything is constructed on a 512-unit square with its centre at (256, 256). The rim is a circle of radius 252; the bands of the border step inwards from it, and the field holds the temple. The geometry is generated from code, so the same configuration always gives the same mark.', 192, 112, 86, 2.3);
  pages.push(p.page());
}

/* 4 · Tiers and editions */
{
  const p = new Page(gray(PALETTE.paper));
  p.head(3, 'Tiers and editions', 'One mark, three sizes; fine for screens, print for making');
  const items: [Mark, string, string][] = [
    [master.crest, 'Crest · fine', 'From 64 px on screen; large print'],
    [master.print, 'Crest · print', 'Engraving, embossing, 3D printing — from Ø 67 mm on a 0.4 mm nozzle'],
    [master.emblem, 'Emblem', '64–256 px: app icons, headers'],
    [master.seal, 'Seal', '48 px and below: favicons, tabs'],
  ];
  items.forEach(([m, name, use], i) => {
    const x = M + i * 66;
    p.mark(m.d, x, 40, 58);
    p.text(name.toUpperCase(), x, 106, 2.2, { role: 'companion', tracking: 0.16 });
    p.para(use, x, 112, 56, 2.1, { ink: SOFT });
  });
  // The seal at small sizes, actual mm.
  p.text('THE SEAL, SMALL', M, 150, 2, { role: 'companion', ink: SOFT, tracking: 0.2 });
  [4, 6, 8, 12, 16].forEach((s, i) => p.mark(master.seal.d, M + i * 22, 158, s));
  pages.push(p.page());
}

/* 5 · Palette */
{
  const p = new Page(gray(PALETTE.paper));
  p.head(4, 'Palette', 'Grayscale only — every value is a neutral gray');
  const tones = Object.entries(PALETTE);
  tones.forEach(([name, hex], i) => {
    const x = M + i * 32.6;
    p.rect(x, 40, 30, 70, gray(hex));
    if (name === 'paper' || name === 'marble') p.items.push({ kind: 'stroke', layer: 'Page', rings: [[[x, H - 110], [x + 30, H - 110], [x + 30, H - 40], [x, H - 40]]], paint: { gray: LINE }, width: 0.3 });
    p.text(name.toUpperCase(), x, 116, 2.2, { role: 'companion', tracking: 0.16 });
    p.text(hex, x, 121, 2, { role: 'body', ink: SOFT });
  });
  p.para('No hue anywhere: no gold, no blue, no accent colour. Charcoal on paper and marble on obsidian are the two main pairings; the grays between are for secondary ink, hairlines and captions. Marble is never a colour — it is a material, rendered or printed.', M, 140, 170, 2.4);
  pages.push(p.page());
}

/* 6 · Typography */
{
  const p = new Page(gray(PALETTE.paper));
  p.head(5, 'Typography', 'Cinzel for the house; Jost for the work');
  p.text('CINZEL', M, 38, 2, { role: 'companion', ink: SOFT, tracking: 0.24 });
  p.text('THE OLYMPUS', M, 46, 10.5, { role: 'inscription', tracking: 0.08 });
  p.text('ABCDEFGHIJKLM NOPQRSTUVWXYZ', M, 63, 4.2, { role: 'inscription', tracking: 0.06 });
  p.text('0123456789', M, 70.5, 4.2, { role: 'inscription', tracking: 0.06 });
  p.para('Cinzel Bold sets the name in the plinth and the service names in lockups; Cinzel Black, emboldened, carries the print editions. Inscriptions are set in capitals with generous tracking, as if cut in stone.', M, 84, 120, 2.3);
  p.text('JOST', 170, 38, 2, { role: 'companion', ink: SOFT, tracking: 0.24 });
  p.text('THE OLYMPUS · APOLLO', 170, 46, 4.6, { role: 'companion', tracking: 0.24 });
  p.text('Abcdefghijklmnopqrstuvwxyz', 170, 58, 4.6, { role: 'body' });
  p.para('Jost is the companion: lockup captions in tracked capitals, and running text like this. Both are open fonts (SIL OFL); every file outlines them, so nothing depends on an installed font.', 170, 84, 108, 2.3);
  pages.push(p.page());
}

/* 7 · The pantheon */
{
  const p = new Page(gray(PALETTE.paper));
  p.head(6, 'The pantheon', 'Every kind of service has a god in the central bay');
  const gods = Object.values(GODS).filter((g) => g.id !== 'zeus');
  gods.forEach((g, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = M + col * 66;
    const t = 36 + row * 38;
    p.mark(seal({ patron: { god: g.id } }).d, x, t, 22);
    p.text(g.name, x + 26, t + 3, 2.6, { role: 'inscription', tracking: 0.1 });
    p.para(`${g.attribute}. ${CATEGORIES[g.categories[0]]}.`, x + 26, t + 9, 36, 1.9, { ink: SOFT, leading: 2.1 });
  });
  pages.push(p.page());
}

/* 8 · The catalogue */
{
  const p = new Page(gray(PALETTE.paper));
  p.head(7, 'The catalogue', `${services.length} services, one temple`);
  services.forEach((s, i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);
    const x = M + col * 33;
    const t = 34 + row * 80;
    p.mark(crest({ patron: s.patron }).d, x, t, 30);
    p.text(s.name.toUpperCase(), x + 15, t + 34, 1.9, { role: 'companion', tracking: 0.12, align: 'centre' });
    p.text('god' in s.patron ? GODS[s.patron.god].name : 'MONOGRAM', x + 15, t + 38.4, 1.6, { role: 'companion', ink: SOFT, tracking: 0.12, align: 'centre' });
  });
  pages.push(p.page());
}

/* 9 · Lockups */
{
  const p = new Page(gray(PALETTE.paper));
  p.head(8, 'Lockups', 'The crest never carries a service’s name — the lockup does');
  const s = services.find((x) => x.id === 'jellyfin') ?? services[0];
  const c = crest({ patron: s.patron });
  const h = lockup(c, { name: s.name, caption: s.caption, layout: 'horizontal' });
  const v = lockup(c, { name: s.name, caption: s.caption, layout: 'vertical' });
  p.mark(h.d, M, 40, 160, { box: [0, 0, h.width!, h.height!] });
  p.rect(200, 34, W - M - 200, 140, gray(PALETTE.obsidian));
  p.mark(v.d, 207, 44, W - M - 214, { ink: gray(PALETTE.marble), box: [0, 0, v.width!, v.height!] });
  p.para('Horizontal for headers and nameplates, vertical for squares and posters. The name is Cinzel Bold; the caption, in tracked Jost, names the house and the patron.', M, 120, 170, 2.4);
  pages.push(p.page());
}

/* 10 · Sizes and clear space */
{
  const p = new Page(gray(PALETTE.paper));
  p.head(9, 'Clear space and sizes', 'Room to breathe; never smaller than it can be read');
  p.rect(M + 6, 40, 96, 96, gray(PALETTE.marble));
  p.rect(M + 18, 52, 72, 72, gray(PALETTE.paper));
  p.mark(master.crest.d, M + 18, 52, 72);
  p.text('CLEAR SPACE: 1/6 OF THE DIAMETER ON EVERY SIDE', M + 6, 142, 2, { role: 'companion', ink: SOFT, tracking: 0.16 });
  let y = 44;
  for (const [what, size] of [
    ['Crest, fine — screen', '64 px'],
    ['Crest, print — FDM, 0.4 mm nozzle', 'Ø 67 mm'],
    ['Crest — sticker, fine lines', 'Ø 201 mm'],
    ['Crest — sticker, print edition', 'Ø 20 mm'],
    ['Emblem — screen', '64 px'],
    ['Seal — screen', '16 px'],
    ['Seal — sticker', 'Ø 17 mm'],
    ['God’s seal — FDM token', 'Ø 32 mm'],
  ]) {
    p.text(what, 140, y, 2.4);
    p.text(size, W - M, y, 2.4, { role: 'companion', align: 'right' });
    p.rule(140, y + 5, W - M, y + 5);
    y += 10;
  }
  pages.push(p.page());
}

/* 11 · Objects */
{
  const p = new Page(gray(PALETTE.paper));
  p.head(10, 'Made objects', 'Stickers, medallions and a marble lithophane — files, not mockups');
  const masterMark = markFor('crest', undefined, 'master');
  const med = buildModel('two-colour', suggestedParams('two-colour', masterMark.minDiameterMM), { mark: masterMark });
  const img = renderMeshes(med.parts, { azimuth: -24, elevation: 52, width: 900, height: 700, background: 250 });
  p.image(img, [900, 700], M, 34, 84, 65.3);
  p.text('TWO-COLOUR MEDALLION', M, 104, 2, { role: 'companion', tracking: 0.16 });
  p.para('Plate and relief as two parts; validated STL and 3MF.', M, 109, 84, 2, { ink: SOFT });
  const marks = baseMarks({ god: 'zeus' });
  const st = buildSticker({ marks: { crestFine: marks['crest-fine'].d, crestPrint: marks['crest-print'].d, emblemFine: marks['emblem-fine'].d, emblemPrint: marks['emblem-print'].d, seal: marks.seal.d }, name: 'The Olympus', caption: DOMAIN }, { ...STICKER_DEFAULTS, style: 'clear-light', size: 70 });
  const lap = raster(mockupSvg('laptop', st), 1100);
  p.image(lap.rgba, lap.px, M + 96, 34, 84, (84 * lap.px[1]) / lap.px[0]);
  p.text('STICKER ON A LAPTOP', M + 96, 104, 2, { role: 'companion', tracking: 0.16 });
  p.para('Die-cut, clear vinyl with a white underbase; the scene is a mockup.', M + 96, 109, 84, 2, { ink: SOFT });
  const lit = raster(treatmentSvg(master.crest, 'relief-white', { size: 800 }), 800);
  p.image(lit.rgba, lit.px, M + 192, 34, 65.3, 65.3);
  p.text('WHITE MARBLE', M + 192, 104, 2, { role: 'companion', tracking: 0.16 });
  p.para('A presentation render: the veining is seeded, identical every time.', M + 192, 109, 70, 2, { ink: SOFT });
  p.para('Every object is generated from the same geometry as the logos, by the Atelier or the command line, and checked before it is written: meshes are closed and manifold, stickers carry their cut path on its own layer.', M, 140, 240, 2.3);
  pages.push(p.page());
}

/* 12 · Back cover */
{
  const p = new Page(gray(PALETTE.obsidian));
  p.mark(master.seal.d, W / 2 - 16, H / 2 - 22, 32, { ink: gray(PALETTE.marble) });
  p.text(DOMAIN, W / 2, H / 2 + 18, 2.6, { role: 'companion', ink: gray(PALETTE.silver), tracking: 0.12, align: 'centre' });
  pages.push(p.page());
}

const out = join(ROOT, 'docs', 'the-olympus-brand-book.pdf');
const bytes = pdf('The Olympus — Brand book', pages);
writeFileSync(out, bytes);
console.log(`✔ ${pages.length} pages · ${(bytes.length / 1024 / 1024).toFixed(1)} MB → docs/the-olympus-brand-book.pdf`);
