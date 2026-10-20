// Mockups: a sticker shown where it is meant to go, at its real size — on a
// laptop lid, on a server's front panel. Drawn scenes for previews and the
// guide (labelled as mockups), never production files.

import { stickerSvg, type Sticker } from '../manufacturing/stickers.ts';

export const MOCKUPS = { laptop: 'Laptop lid', server: 'Server, 2U front' } as const;
export type Mockup = keyof typeof MOCKUPS;

/** Place a sticker (mm) at (x, y) mm in a scene, tilted, with a soft shadow. */
function place(st: Sticker, x: number, y: number, angle: number): string {
  const inner = stickerSvg(st, '', { preview: true, bare: true })
    .replace(/<svg [^>]*>/, `<svg x="0" y="0" width="${st.width.toFixed(2)}" height="${st.height.toFixed(2)}" viewBox="0 0 ${st.width.toFixed(3)} ${st.height.toFixed(3)}">`)
    .replace(/<title>[^<]*<\/title>/, '');
  const cx = st.width / 2;
  const cy = st.height / 2;
  return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle} ${cx.toFixed(2)} ${cy.toFixed(2)})">
  <g filter="url(#sticker-shadow)">${inner}</g>
</g>`;
}

const defs = `<defs>
  <filter id="sticker-shadow" x="-10%" y="-10%" width="120%" height="130%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="0.35"/><feOffset dx="0.15" dy="0.45" result="s"/>
    <feFlood flood-color="#000000" flood-opacity="0.45"/><feComposite in2="s" operator="in"/>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <linearGradient id="lid" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#3B3B3B"/><stop offset="0.55" stop-color="#2A2A2A"/><stop offset="1" stop-color="#202020"/>
  </linearGradient>
  <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4A4A4A"/><stop offset="0.5" stop-color="#383838"/><stop offset="1" stop-color="#2C2C2C"/>
  </linearGradient>
</defs>`;

/** A 13-inch laptop lid (300 × 210 mm) with the sticker on it. */
function laptop(st: Sticker): string {
  const W = 340;
  const H = 250;
  const x = 20 + 300 * 0.62 - st.width / 2;
  const y = 20 + 210 * 0.56 - st.height / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 4}" height="${H * 4}">
${defs}
<rect width="${W}" height="${H}" fill="#E4E4E4"/>
<rect x="22" y="24" width="300" height="210" rx="9" fill="#000000" opacity="0.18" filter="url(#sticker-shadow)"/>
<rect x="20" y="20" width="300" height="210" rx="9" fill="url(#lid)"/>
<rect x="20.4" y="20.4" width="299.2" height="209.2" rx="8.6" fill="none" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="0.8"/>
<path d="M60 20 L120 20 L40 230 L20 230 L20 140 Z" fill="#FFFFFF" opacity="0.025"/>
${place(st, x, y, -6)}
</svg>
`;
}

/** A 2U rack server front (482.6 × 88.9 mm): ears, drive bays, vents, and the sticker on the bezel. */
function server(st: Sticker): string {
  const W = 520;
  const H = 150;
  const top = 30;
  const bays = Array.from({ length: 6 }, (_, i) => {
    const bx = 60 + i * 26;
    return `<rect x="${bx}" y="${top + 12}" width="22" height="64" rx="1.5" fill="#2A2A2A" stroke="#555555" stroke-width="0.5"/><rect x="${bx + 3}" y="${top + 66}" width="16" height="6" rx="1" fill="#1C1C1C"/><circle cx="${bx + 5}" cy="${top + 17}" r="0.9" fill="#BDBDBD"/>`;
  }).join('');
  const vents = Array.from({ length: 9 }, (_, r) => Array.from({ length: 22 }, (_, c) => `<rect x="${300 + c * 7}" y="${top + 10 + r * 7.6}" width="4.6" height="4.6" rx="0.6" fill="#1E1E1E"/>`).join('')).join('');
  // The bezel between the bays (to x = 216) and the vents (from x = 300).
  const scale = Math.min(1, 72 / st.height, 76 / st.width);
  const sw = st.width * scale;
  const sh = st.height * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 3}" height="${H * 3}">
${defs}
<rect width="${W}" height="${H}" fill="#E4E4E4"/>
<rect x="18.7" y="${top}" width="482.6" height="88.9" rx="2" fill="url(#panel)"/>
<rect x="18.7" y="${top}" width="22" height="88.9" rx="2" fill="#303030"/><rect x="479.3" y="${top}" width="22" height="88.9" rx="2" fill="#303030"/>
<circle cx="29.7" cy="${top + 12}" r="2.6" fill="#1A1A1A"/><circle cx="29.7" cy="${top + 77}" r="2.6" fill="#1A1A1A"/><circle cx="490.3" cy="${top + 12}" r="2.6" fill="#1A1A1A"/><circle cx="490.3" cy="${top + 77}" r="2.6" fill="#1A1A1A"/>
${bays}
${vents}
<g transform="translate(${(257 - sw / 2).toFixed(2)} ${(top + 44.45 - sh / 2).toFixed(2)}) scale(${scale.toFixed(4)})">${place(st, 0, 0, 0)}</g>
<circle cx="465" cy="${top + 20}" r="2.2" fill="#9A9A9A"/><circle cx="465" cy="${top + 30}" r="1.4" fill="#EDEDED"/>
</svg>
`;
}

export function mockupSvg(kind: Mockup, st: Sticker): string {
  return kind === 'laptop' ? laptop(st) : server(st);
}

