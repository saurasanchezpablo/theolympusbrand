// Scan the QR label stickers as printed (production SVG → pixels → decoder): node scripts/dev/qr-sticker-check.ts [out.png]
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import jsQRModule from 'jsqr';
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { baseMarks } from '../../src/catalog/fileset.ts';
import { buildSticker, stickerSvg, STICKER_DEFAULTS, STICKER_STYLES, type StickerStyle } from '../../src/manufacturing/stickers.ts';
const jsQR = ((jsQRModule as unknown as { default?: unknown }).default ?? jsQRModule) as (d: Uint8ClampedArray, w: number, h: number) => { data: string } | null;
loadNodeFonts();
const m = baseMarks({ god: 'apollo' });
const input = { marks: { crestFine: m['crest-fine'].d, crestPrint: m['crest-print'].d, emblemFine: m['emblem-fine'].d, emblemPrint: m['emblem-print'].d, seal: m.seal.d }, name: 'Jellyfin', caption: 'The Olympus · APOLLO', url: 'https://jellyfin.theolympus.cloud' };
for (const style of Object.keys(STICKER_STYLES) as StickerStyle[]) {
  const st = buildSticker(input, { ...STICKER_DEFAULTS, art: 'qr-label', style, size: 90 });
  // As it would look printed: on the substrate (the preview draws it), at 600 px.
  const svg = stickerSvg(st, 'x', { preview: true });
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: 900 }, background: style === 'clear-light' ? '#3A3A3A' : '#FFFFFF' }).render();
  const got = jsQR(new Uint8ClampedArray(r.pixels), r.width, r.height);
  console.log(style.padEnd(13), got?.data === input.url ? 'scans OK' : `NO SCAN (${got?.data})`, st.warnings.join(' '));
  if (process.argv[2] && style === 'dark') writeFileSync(process.argv[2], r.asPng());
}
