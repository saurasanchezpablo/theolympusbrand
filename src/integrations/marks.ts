// The drawings the integrations share: the seal struck as a coin, a banner
// for an application's header, a mark on its own, a home-screen tile, and a
// mark centred on a marble screen.

import type { Mark } from '../geometry/crest.ts';
import { lockupParts } from '../geometry/lockup.ts';
import { transformPath } from '../geometry/path.ts';
import { ARTBOARD } from '../geometry/math.ts';
import { PALETTE } from '../brand/palette.ts';
import { base64 } from '../export/png.ts';

const S = ARTBOARD;
const P = PALETTE;

export type KitMarks = { seal: Mark; emblem: Mark; crest: Mark };

/** A screen-sized ground: application backgrounds and splash screens. */
export const BACKGROUND = { width: 1920, height: 1080 } as const;

export type CoinTone = 'dark' | 'light';
const COIN = { dark: { disc: P.obsidian, ink: P.marble }, light: { disc: P.paper, ink: P.charcoal } } as const;

/**
 * A coin: the seal struck on a disc of its own ground, so it reads on any
 * dashboard, light or dark. The disc stops inside the seal's rim.
 */
export function coinSvg(seal: Mark, tone: CoinTone, title = 'The Olympus'): string {
  const c = COIN[tone];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
  <title>${esc(title)}</title>
  <circle cx="${S / 2}" cy="${S / 2}" r="${S / 2 - 6}" fill="${c.disc}"/>
  <path d="${seal.d}" fill="${c.ink}"/>
</svg>
`;
}

/**
 * A banner for an application's header: the seal and a name, set tight —
 * the name's capitals are 0.4 of the seal's height, so it reads at 30 px.
 */
export function bannerMark(seal: Mark, name: string): Mark {
  const parts = lockupParts(seal, { name, caption: '', layout: 'horizontal' });
  const k = 0.5;
  const shift = S + 72 - (S * k + 40);
  return {
    id: `${seal.id}-banner`,
    d: transformPath(seal.d, k, 0, 0) + transformPath(parts.name, 1, -shift, -(S * (1 - k)) / 2),
    width: parts.width - shift,
    height: S * k,
  };
}

export const markSvg = (m: Mark, ink: string, ground: string | null = null) => {
  const w = m.width ?? S;
  const h = m.height ?? S;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${ground ? `<rect width="${w}" height="${h}" fill="${ground}"/>` : ''}<path d="${m.d}" fill="${ink}"/></svg>\n`;
};

/** The seal centred on an opaque square — for home-screen icons. */
export const tileSvg = (seal: Mark, fill = 0.78) => {
  const t = (S * (1 - fill)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="${P.obsidian}"/><path transform="translate(${t} ${t}) scale(${fill})" d="${seal.d}" fill="${P.marble}"/></svg>`;
};

/** A screen: a marble ground with a mark centred on it, `scale` of the height. */
export function screenSvg(ground: Uint8Array, w: number, h: number, mark: Mark, scale: number, ink: string): string {
  const size = h * scale;
  const k = size / S;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><image width="${w}" height="${h}" href="data:image/png;base64,${base64(ground)}"/><path transform="translate(${(w - size) / 2} ${(h - size) / 2}) scale(${k})" d="${mark.d}" fill="${ink}"/></svg>`;
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
