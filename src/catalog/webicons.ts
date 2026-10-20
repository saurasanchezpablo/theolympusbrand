// The icons a web app needs — for any self-hosted service whose favicon or
// app icon can be set: a scalable favicon that follows the browser's light or
// dark mode, an Apple touch icon, the 192 / 512 px icons and a maskable one for
// Android launchers, the web manifest that lists them, and the HTML to link
// them. Pure: rasters are returned as SVG + width for the host to render.

import type { Mark } from '../geometry/crest.ts';
import { ARTBOARD } from '../geometry/math.ts';
import { PALETTE } from '../brand/palette.ts';
import { commentText } from './text.ts';

const S = ARTBOARD;

/** The seal centred on a square, scaled to `fill` of its side, on an optional ground. */
function square(seal: Mark, fill: number, ground: string | null, ink: string = PALETTE.charcoal): string {
  const k = fill;
  const t = (S * (1 - k)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${ground ? `<rect width="${S}" height="${S}" fill="${ground}"/>` : ''}<path transform="translate(${t} ${t}) scale(${k})" d="${seal.d}" fill="${ink}"/></svg>`;
}

/** A favicon that switches ink with the browser's colour scheme. */
export function faviconSvg(seal: Mark, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
  <title>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>
  <style>path { fill: ${PALETTE.charcoal}; } @media (prefers-color-scheme: dark) { path { fill: ${PALETTE.marble}; } }</style>
  <path d="${seal.d}"/>
</svg>
`;
}

export type WebIcons = {
  /** Text files: favicon.svg, site.webmanifest, head.html. */
  files: { path: string; data: string }[];
  /** PNGs to render: the SVG and its pixel width. */
  rasters: { path: string; svg: string; width: number }[];
};

/**
 * The web icon set for a seal. `name` and `short` go into the manifest; paths
 * are relative to `web/` and `base` is where the files will be served from.
 */
export function webIcons(seal: Mark, { name, short, base = '/' }: { name: string; short: string; base?: string }): WebIcons {
  const manifest = {
    name,
    short_name: short,
    icons: [
      { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    theme_color: PALETTE.obsidian,
    background_color: PALETTE.paper,
    display: 'standalone',
  };
  const head = `<!-- ${commentText(name)} — icons -->
<link rel="icon" href="${base}favicon.svg" type="image/svg+xml">
<link rel="icon" href="${base}favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="${base}apple-touch-icon.png">
<link rel="manifest" href="${base}site.webmanifest">
<meta name="theme-color" content="${PALETTE.obsidian}">
`;
  return {
    files: [
      { path: 'favicon.svg', data: faviconSvg(seal, name) },
      { path: 'site.webmanifest', data: JSON.stringify(manifest, null, 2) + '\n' },
      { path: 'head.html', data: head },
    ],
    rasters: [
      // iOS rounds the corners itself and wants an opaque square.
      { path: 'apple-touch-icon.png', svg: square(seal, 0.78, PALETTE.paper), width: 180 },
      { path: 'icon-192.png', svg: square(seal, 1, null), width: 192 },
      { path: 'icon-512.png', svg: square(seal, 1, null), width: 512 },
      // Maskable: launchers crop to any shape inside the central 80 % circle.
      { path: 'icon-maskable-512.png', svg: square(seal, 0.68, PALETTE.obsidian, PALETTE.marble), width: 512 },
    ],
  };
}
