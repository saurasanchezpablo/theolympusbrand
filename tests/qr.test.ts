// QR codes: every code the house makes is read back by an independent
// decoder (jsQR) — from the encoder, from a printed label, and from the
// raised layer of a 3D nameplate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Resvg } from '@resvg/resvg-js';
import jsQRModule from 'jsqr';
import './helpers.ts';
import { qr } from '../src/geometry/qr.ts';
import { baseMarks } from '../src/catalog/fileset.ts';
import { buildSticker, stickerSvg, STICKER_DEFAULTS, STICKER_STYLES, type StickerStyle } from '../src/manufacturing/stickers.ts';
import { buildModel, suggestedParams } from '../src/manufacturing/products.ts';
import { markFor } from '../src/manufacturing/files.ts';
import { rasterise } from '../src/manufacturing/lithophane.ts';
import { validateSpec } from '../src/catalog/service.ts';

const jsQR = ((jsQRModule as unknown as { default?: unknown }).default ?? jsQRModule) as (d: Uint8ClampedArray, w: number, h: number) => { data: string } | null;

function scanModules(modules: boolean[][]): string | null {
  const scale = 5;
  const q = 4;
  const n = (modules.length + 2 * q) * scale;
  const px = new Uint8ClampedArray(n * n * 4).fill(255);
  modules.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (!dark) return;
      for (let y = 0; y < scale; y++)
        for (let x = 0; x < scale; x++) {
          const o = (((r + q) * scale + y) * n + (c + q) * scale + x) * 4;
          px[o] = px[o + 1] = px[o + 2] = 0;
        }
    }),
  );
  return jsQR(px, n, n)?.data ?? null;
}

test('the encoder: every version from 1 to 10, levels M and Q, reads back', () => {
  const versions = new Set<number>();
  for (const level of ['M', 'Q'] as const) {
    for (const text of ['x', 'https://theolympus.cloud', 'https://home-assistant.theolympus.cloud/lovelace/0', 'b'.repeat(60), 'c'.repeat(110), 'd'.repeat(150), 'e'.repeat(200)]) {
      let code;
      try {
        code = qr(text, level);
      } catch {
        continue; // longer than version 10 holds at this level
      }
      versions.add(code.version);
      assert.equal(scanModules(code.modules), text, `${level} v${code.version}`);
    }
  }
  assert.ok(versions.size >= 8, [...versions].join(','));
  assert.throws(() => qr('f'.repeat(400), 'Q'), /too long/);
});

test('QR label stickers scan in every colourway', () => {
  const m = baseMarks({ god: 'hades' });
  const input = { marks: { crestFine: m['crest-fine'].d, crestPrint: m['crest-print'].d, emblemFine: m['emblem-fine'].d, emblemPrint: m['emblem-print'].d, seal: m.seal.d }, name: 'Storage', caption: 'The Olympus · HADES', url: 'https://storage.theolympus.cloud' };
  for (const style of Object.keys(STICKER_STYLES) as StickerStyle[]) {
    const st = buildSticker(input, { ...STICKER_DEFAULTS, art: 'qr-label', style, size: 80 });
    const r = new Resvg(stickerSvg(st, 'x', { preview: true }), { fitTo: { mode: 'width', value: 800 }, background: style === 'clear-light' ? '#3A3A3A' : '#FFFFFF' }).render();
    assert.equal(jsQR(new Uint8ClampedArray(r.pixels), r.width, r.height)?.data, input.url, style);
    assert.equal(st.spec.shape, 'rounded');
  }
});

test('a nameplate’s QR code reads from its raised layer, and the solid is valid', () => {
  const mark = markFor('crest', { god: 'iris' }, 'network');
  const url = 'https://network.theolympus.cloud';
  const m = buildModel('nameplate', { ...suggestedParams('nameplate', mark.minDiameterMM), qr: 1 }, { mark, name: 'Network', caption: 'The Olympus · IRIS', url });
  assert.ok(m.parts[0].report.ok, JSON.stringify(m.parts[0].report));
  // The relief, seen from above as a two-colour print shows it.
  const relief = m.parts[0].layers!.at(-1)!.rings;
  const half = Math.max(m.size[0], m.size[1]) / 2;
  const cov = rasterise(relief, half, 0.25);
  const px = new Uint8ClampedArray(cov.size * cov.size * 4);
  for (let i = 0; i < cov.data.length; i++) {
    const g = cov.data[i] > 0.5 ? 0 : 255;
    px[4 * i] = px[4 * i + 1] = px[4 * i + 2] = g;
    px[4 * i + 3] = 255;
  }
  assert.equal(jsQR(px, cov.size, cov.size)?.data, url);
});

test('service addresses are validated', () => {
  assert.equal(validateSpec({ id: 'a', name: 'A', category: 'web', url: 'https://a.theolympus.cloud' }).url, 'https://a.theolympus.cloud');
  assert.throws(() => validateSpec({ id: 'a', name: 'A', category: 'web', url: 'javascript:alert(1)' }), /url/);
  assert.throws(() => validateSpec({ id: 'a', name: 'A', category: 'web', url: 'ftp://x' }), /url/);
});
