// Board toolkit for documentation sheets: outlined Jost lettering (so boards
// render identically everywhere), mark placement and PNG output.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import opentype, { type Font } from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';
import { PALETTE } from '../../src/brand/palette.ts';

const require = createRequire(import.meta.url);
const load = (file: string): Font => {
  const b = readFileSync(require.resolve(file));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
};

export const FONTS = {
  regular: load('@fontsource/jost/files/jost-latin-400-normal.woff'),
  medium: load('@fontsource/jost/files/jost-latin-500-normal.woff'),
  semibold: load('@fontsource/jost/files/jost-latin-600-normal.woff'),
  mono: load('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff'),
  cinzel: load('@fontsource/cinzel/files/cinzel-latin-700-normal.woff'),
  cinzelBlack: load('@fontsource/cinzel/files/cinzel-latin-900-normal.woff'),
};
export type FontName = keyof typeof FONTS;

type TextOpts = { size?: number; font?: FontName; fill?: string; spacing?: number; anchor?: 'start' | 'middle' | 'end' };

/** Text as outlined paths. `spacing` is letter-spacing in ems. */
export function text(x: number, y: number, s: string, { size = 14, font = 'regular', fill = PALETTE.charcoal, spacing = 0, anchor = 'start' }: TextOpts = {}): string {
  const f = FONTS[font];
  const k = size / f.unitsPerEm;
  const glyphs = f.stringToGlyphs(s);
  const adv = glyphs.map((g, i) => (g.advanceWidth ?? 0) * k + (i < glyphs.length - 1 ? f.getKerningValue(g, glyphs[i + 1]) * k + spacing * size : 0));
  const total = adv.reduce((a, b) => a + b, 0);
  let cx = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
  let d = '';
  glyphs.forEach((g, i) => {
    d += g.getPath(cx, y, size).toPathData(2);
    cx += adv[i];
  });
  return `<path d="${d}" fill="${fill}"/>`;
}

/** Measure text width without drawing it. */
export function measure(s: string, { size = 14, font = 'regular', spacing = 0 }: TextOpts = {}): number {
  const f = FONTS[font];
  const k = size / f.unitsPerEm;
  const glyphs = f.stringToGlyphs(s);
  return glyphs.reduce((w, g, i) => w + (g.advanceWidth ?? 0) * k + (i < glyphs.length - 1 ? f.getKerningValue(g, glyphs[i + 1]) * k + spacing * size : 0), 0);
}

/** Wrap a paragraph to a width; returns the lines. */
export function wrap(s: string, width: number, opts: TextOpts = {}): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of s.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next, opts) > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function paragraph(x: number, y: number, s: string, width: number, opts: TextOpts & { leading?: number } = {}): { svg: string; height: number } {
  const lead = opts.leading ?? (opts.size ?? 14) * 1.5;
  const lines = wrap(s, width, opts);
  return { svg: lines.map((l, i) => text(x, y + i * lead, l, opts)).join(''), height: lines.length * lead };
}

let ns = 0;
/** Place a standalone 512-artboard SVG at (x, y) with size s, namespacing its ids; optional viewBox crop. */
export function place(svg: string, x: number, y: number, s: number, vb: [number, number, number, number] = [0, 0, 512, 512]): string {
  const p = `n${ns++}_`;
  const h = (s * vb[3]) / vb[2];
  return svg
    .replace(/<svg [^>]*>/, `<svg x="${x}" y="${y}" width="${s}" height="${h}" viewBox="${vb.join(' ')}">`)
    .replace(/<title>[^<]*<\/title>/, '')
    .replace(/id="([^"]+)"/g, `id="${p}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`);
}

export function header(W: number, title: string, sub: string, dark = false): string {
  const ink = dark ? PALETTE.marble : PALETTE.charcoal;
  return (
    text(64, 78, title, { size: 30, font: 'medium', spacing: 0.24, fill: ink }) +
    text(64, 108, sub, { size: 13, spacing: 0.16, fill: dark ? PALETTE.silver : PALETTE.slate }) +
    `<rect x="64" y="130" width="${W - 128}" height="1" fill="${dark ? '#333333' : PALETTE.ash}"/>`
  );
}

export const png = (svg: string, width?: number) =>
  new Resvg(svg, { fitTo: width ? { mode: 'width', value: width } : { mode: 'original' } }).render().asPng();

export function board(file: string, W: number, H: number, bg: string, inner: string): void {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${inner}</svg>`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png(svg));
}

/** A raster at true pixel size, shown enlarged with hard pixels. */
export function pixels(svg: string, x: number, y: number, size: number, scale = 2): string {
  const data = png(svg, size).toString('base64');
  const s = size * scale;
  return `<rect x="${x - 1}" y="${y - 1}" width="${s + 2}" height="${s + 2}" fill="none" stroke="${PALETTE.ash}"/><image x="${x}" y="${y}" width="${s}" height="${s}" image-rendering="optimizeSpeed" href="data:image/png;base64,${data}"/>`;
}
