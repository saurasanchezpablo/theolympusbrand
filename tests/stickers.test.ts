// Stickers: the cut follows the design with its margin, the bleed surrounds
// the cut, the white underbase hides inside the ink, small sizes are handled
// honestly, and the PDF carries layers and spot colours a print provider's
// software reads.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, unzlibSync } from 'fflate';
import './helpers.ts';
import { baseMarks } from '../src/catalog/fileset.ts';
import { union, offset, difference } from '../src/geometry/poly.ts';
import { area } from '../src/manufacturing/mesh.ts';
import { buildSticker, layoutSheet, sheetPdf, stickerPdf, stickerSvg, PAPERS, STICKER_DEFAULTS, STICKER_STYLES, type StickerInput, type StickerStyle } from '../src/manufacturing/stickers.ts';

const input = (god: 'zeus' | 'apollo' | 'hestia', name = 'Jellyfin'): StickerInput => {
  const m = baseMarks({ god });
  return { marks: { crestFine: m['crest-fine'].d, crestPrint: m['crest-print'].d, emblemFine: m['emblem-fine'].d, emblemPrint: m['emblem-print'].d, seal: m.seal.d }, name, caption: 'The Olympus · APOLLO' };
};

test('the cut keeps the border around the design, and the bleed surrounds the cut', () => {
  for (const art of ['crest', 'seal', 'lockup-horizontal', 'lockup-vertical'] as const) {
    const st = buildSticker(input('apollo'), { ...STICKER_DEFAULTS, art, size: 90, border: 3, bleed: 2 });
    // The design grown by just under the border still fits inside the cut.
    const inner = offset(union(st.art), 2.9);
    assert.ok(area(difference(inner, [st.cut])) < 0.01, `${art}: design too close to the cut`);
    assert.ok(area(difference(offset([st.cut], 1.9), [st.bleed])) < 0.01, `${art}: bleed short of 2 mm`);
    const xs = st.cut.map((p) => p[0]);
    const ys = st.cut.map((p) => p[1]);
    const longest = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    assert.ok(Math.abs(longest - 90) < 0.6, `${art}: cut ${longest} mm`);
  }
});

test('a rounded cut is one rounded rectangle; a contour cut is one smooth outline', () => {
  const r = buildSticker(input('apollo'), { ...STICKER_DEFAULTS, art: 'lockup-horizontal', shape: 'rounded', size: 120 });
  const c = buildSticker(input('apollo'), { ...STICKER_DEFAULTS, art: 'lockup-horizontal', shape: 'contour', size: 120 });
  assert.ok(area([c.cut]) < area([r.cut]), 'the contour hugs the design');
  assert.equal(r.warnings.length, 0);
});

test('clear vinyl gets a white underbase choked inside the ink; other styles none', () => {
  for (const style of Object.keys(STICKER_STYLES) as StickerStyle[]) {
    const st = buildSticker(input('hestia'), { ...STICKER_DEFAULTS, style });
    assert.equal(st.underbase.length > 0, STICKER_STYLES[style].underbase, style);
    if (st.underbase.length) {
      assert.ok(area(difference(st.underbase, union(st.art))) < 1e-3, 'white never outside the ink');
      assert.ok(area(st.underbase) > 0.5 * area(union(st.art)), 'most of the ink is backed');
    }
  }
});

test('the edition follows the size and the finest line; too small is warned about', () => {
  assert.equal(buildSticker(input('zeus'), { ...STICKER_DEFAULTS, size: 75 }).edition, 'print');
  assert.equal(buildSticker(input('zeus'), { ...STICKER_DEFAULTS, size: 220 }).edition, 'fine');
  assert.equal(buildSticker(input('zeus'), { ...STICKER_DEFAULTS, size: 30, finest: 0.3 }).warnings.length > 0, true);
  assert.equal(buildSticker(input('apollo'), { ...STICKER_DEFAULTS, art: 'seal', size: 25 }).warnings.length, 0);
});

test('the PDF has the four layers, the CutContour and White spot colours, and stays grayscale', () => {
  const st = buildSticker(input('apollo'), { ...STICKER_DEFAULTS, style: 'clear-light' });
  const bytes = stickerPdf(st, 'Test');
  const text = strFromU8(bytes, true);
  assert.ok(text.startsWith('%PDF-1.6'));
  for (const name of ['Artwork', 'White', 'CutContour']) assert.ok(text.includes(`/Type /OCG /Name (${name})`), name);
  assert.ok(text.includes('/Separation /CutContour /DeviceGray') && text.includes('/Separation /White /DeviceGray'));
  assert.ok(!/DeviceRGB|DeviceCMYK/.test(text), 'no colour spaces with hue');
  // Every cross-reference offset points at its object.
  const xref = text.slice(text.lastIndexOf('xref'));
  const offsets = [...xref.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  offsets.forEach((o, i) => assert.ok(text.startsWith(`${i + 1} 0 obj`, o), `object ${i + 1}`));
  // The content stream draws the cut with the spot colour.
  const streams = [...text.matchAll(/\/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/g)];
  const content = streams.map((m) => {
    const start = (m.index ?? 0) + m[0].length;
    try {
      return strFromU8(unzlibSync(bytes.subarray(start, start + Number(m[1]))));
    } catch {
      return '';
    }
  });
  assert.ok(content.some((c) => c.includes('/GSop gs') && c.includes('SCN') && c.includes('\nS\n')));
});

test('marble grounds are embedded images; the SVG names its layers', () => {
  const st = buildSticker(input('zeus'), { ...STICKER_DEFAULTS, style: 'marble-dark', size: 40 });
  const svg = stickerSvg(st, 'Test');
  for (const id of ['Bleed', 'Artwork', 'CutContour']) assert.ok(svg.includes(`id="${id}" inkscape:groupmode="layer"`), id);
  assert.ok(svg.includes('data:image/png;base64,'));
  assert.ok(strFromU8(stickerPdf(st, 'T'), true).includes('/Subtype /Image /Width'));
});

test('sheets keep every sticker inside the paper margins and apart', () => {
  const stickers = ['zeus', 'apollo', 'hestia'].flatMap((g) => Array.from({ length: 8 }, () => buildSticker(input(g as 'zeus'), { ...STICKER_DEFAULTS, art: 'seal', size: 45 })));
  const layout = layoutSheet(stickers, 'a4', { margin: 10, gutter: 3 });
  const [W, H] = PAPERS.a4;
  assert.equal(layout.pages.flat().length, 24);
  for (const pg of layout.pages) {
    for (const a of pg) {
      assert.ok(a.x >= 10 - 1e-9 && a.y >= 10 - 1e-9 && a.x + a.sticker.width <= W - 10 + 1e-9 && a.y + a.sticker.height <= H - 10 + 1e-9);
      for (const b of pg) if (a !== b) assert.ok(a.x + a.sticker.width + 3 - 1e-6 <= b.x || b.x + b.sticker.width + 3 - 1e-6 <= a.x || a.y + a.sticker.height + 3 - 1e-6 <= b.y || b.y + b.sticker.height + 3 - 1e-6 <= a.y);
    }
  }
  const text = strFromU8(sheetPdf(layout, 'Sheet'), true);
  assert.ok(text.includes(`/Count ${layout.pages.length}`));
});
