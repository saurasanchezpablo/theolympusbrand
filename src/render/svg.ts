// SVG documents for a mark: clean production files, and presentation
// treatments. Geometry stays one clean path; every material effect is a
// separate layer on top of it and never part of the mark.

import { ARTBOARD, C, RIM } from '../geometry/math.ts';
import type { Mark } from '../geometry/crest.ts';
import { PALETTE } from '../brand/palette.ts';

const S = ARTBOARD;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* ---------------------------------------------------------------- */
/* Production files                                                  */
/* ---------------------------------------------------------------- */

export type Ground = 'transparent' | 'light' | 'dark';

/**
 * The production file: one path, one fill, optional ground. Transparent files
 * use charcoal ink unless `ink` says otherwise (e.g. marble for dark UIs).
 */
export function productionSvg(mark: Mark, { ground = 'transparent' as Ground, ink, title = 'The Olympus', size = S }: { ground?: Ground; ink?: string; title?: string; size?: number } = {}): string {
  const fill = ink ?? (ground === 'dark' ? PALETTE.marble : PALETTE.charcoal);
  const bg = ground === 'light' ? PALETTE.paper : ground === 'dark' ? PALETTE.obsidian : null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${size}" height="${size}">
  <title>${esc(title)}</title>${bg ? `\n  <rect id="ground" width="${S}" height="${S}" fill="${bg}"/>` : ''}
  <path id="mark" d="${mark.d}" fill="${fill}"/>
</svg>
`;
}

/* ---------------------------------------------------------------- */
/* Presentation treatments                                           */
/* ---------------------------------------------------------------- */

export const TREATMENTS = {
  'flat-dark': 'Flat · light ground',
  'flat-light': 'Flat · dark ground',
  'relief-white': 'White marble relief',
  'relief-black': 'Black marble relief',
  engraved: 'Engraved in marble',
} as const;
export type Treatment = keyof typeof TREATMENTS;

// Seeded turbulence marble — deterministic; all tones neutral grey.
const MARBLE = {
  white: { base: '#ECECEC', vein: '#8A8A8A', vein2: '#B6B6B6', seed: 11, warp: 190, period: 130, angle: -32 },
  black: { base: '#151515', vein: '#A2A2A2', vein2: '#484848', seed: 23, warp: 170, period: 118, angle: 38 },
};

function marble(id: string, kind: keyof typeof MARBLE) {
  const m = MARBLE[kind];
  const g = (gid: string, per: number, w: number, color: string, op: number) => `
  <linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${per}" spreadMethod="repeat" gradientTransform="rotate(${m.angle} ${C} ${C})">
    <stop offset="0" stop-color="${color}" stop-opacity="0"/><stop offset="${r3(0.5 - w)}" stop-color="${color}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${color}" stop-opacity="${op}"/>
    <stop offset="${r3(0.5 + w)}" stop-color="${color}" stop-opacity="0"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
  </linearGradient>`;
  // The filter region is pinned to the artboard in user space: resvg aborts on
  // feDisplacementMap when a masked filter region leaves the canvas.
  const defs = `${g(`${id}-v1`, m.period, 0.03, m.vein, 0.85)}${g(`${id}-v2`, m.period * 0.37, 0.045, m.vein2, 0.35)}
  <filter id="${id}-w" filterUnits="userSpaceOnUse" x="0" y="0" width="${S}" height="${S}" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.0045" numOctaves="4" seed="${m.seed}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="${m.warp}" xChannelSelector="R" yChannelSelector="G" result="w"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.017" numOctaves="2" seed="${m.seed + 7}" result="m"/>
    <feColorMatrix in="m" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0.33 0.33 0.33 0 -0.42" result="mottle"/>
    <feComposite in="mottle" in2="w" operator="atop"/>
  </filter>`;
  const R = (fill: string) => `<rect x="0" y="0" width="${S}" height="${S}" fill="${fill}"/>`;
  return { defs, body: `${R(m.base)}<g filter="url(#${id}-w)">${R(m.base)}${R(`url(#${id}-v1)`)}${R(`url(#${id}-v2)`)}</g>` };
}

const filterHead = (id: string) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${S}" height="${S}" color-interpolation-filters="sRGB">`;
const bevel = (id: string, depth: number, blur: number, hi: number, lo: number) => `
  ${filterHead(id)}
    <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="b"/>
    <feOffset in="b" dx="${depth}" dy="${depth}" result="bD"/><feOffset in="b" dx="${-depth}" dy="${-depth}" result="bU"/>
    <feComposite in="SourceAlpha" in2="bD" operator="out" result="eH"/><feComposite in="SourceAlpha" in2="bU" operator="out" result="eL"/>
    <feFlood flood-color="#FFFFFF" flood-opacity="${hi}"/><feComposite in2="eH" operator="in" result="h"/>
    <feFlood flood-color="#000000" flood-opacity="${lo}"/><feComposite in2="eL" operator="in" result="l"/>
    <feMerge><feMergeNode in="h"/><feMergeNode in="l"/></feMerge>
  </filter>`;
const shadow = (id: string, dy: number, blur: number, op: number) => `
  ${filterHead(id)}
    <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}"/><feOffset dx="${dy * 0.4}" dy="${dy}" result="s"/>
    <feFlood flood-color="#000000" flood-opacity="${op}"/><feComposite in2="s" operator="in"/>
  </filter>`;
const recess = (id: string) => `
  ${filterHead(id)}
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="b"/>
    <feOffset in="b" dx="1.6" dy="2" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out" result="lip"/>
    <feFlood flood-color="#000000" flood-opacity="0.8"/><feComposite in2="lip" operator="in" result="dark"/>
    <feOffset in="b" dx="-0.9" dy="-0.9" result="o2"/><feComposite in="SourceAlpha" in2="o2" operator="out" result="lip2"/>
    <feFlood flood-color="#FFFFFF" flood-opacity="0.3"/><feComposite in2="lip2" operator="in" result="light"/>
    <feMerge><feMergeNode in="dark"/><feMergeNode in="light"/></feMerge>
  </filter>`;

/** A presentation render of a mark (screen previews and documentation — not production art). */
export function treatmentSvg(mark: Mark, treatment: Treatment, { size = S } = {}): string {
  const u = `${mark.id}-${treatment}`;
  const path = (fill: string) => `<path d="${mark.d}" fill="${fill}"/>`;
  const disc = `<circle cx="${C}" cy="${C}" r="${RIM}"/>`;
  const discMask = `<mask id="${u}-disc" maskUnits="userSpaceOnUse" x="0" y="0" width="${S}" height="${S}"><circle cx="${C}" cy="${C}" r="${RIM}" fill="#fff"/></mask>`;
  let defs = '';
  let body = '';
  let bg: string = PALETTE.paper;

  if (treatment === 'flat-dark') body = path(PALETTE.charcoal);
  else if (treatment === 'flat-light') {
    bg = PALETTE.obsidian;
    body = path(PALETTE.marble);
  } else if (treatment === 'relief-white' || treatment === 'relief-black') {
    // A marble medallion: the field sunk and shaded, the design standing proud
    // of it in the same stone, lit from the upper left.
    const kind = treatment === 'relief-white' ? 'white' : 'black';
    const mb = marble(`${u}-m`, kind);
    bg = kind === 'white' ? PALETTE.charcoal : '#DADADA';
    defs = `${mb.defs}${bevel(`${u}-bv`, 1.3, 1.4, kind === 'white' ? 0.75 : 0.55, kind === 'white' ? 0.45 : 0.75)}
      ${bevel(`${u}-bvd`, 3, 4, 0.35, 0.5)}${shadow(`${u}-sh`, 2.2, 1.6, kind === 'white' ? 0.45 : 0.75)}${shadow(`${u}-dsh`, 10, 12, 0.55)}
      ${discMask}<mask id="${u}-art" maskUnits="userSpaceOnUse" x="0" y="0" width="${S}" height="${S}">${path('#fff')}</mask>`;
    body = `<g filter="url(#${u}-dsh)">${disc}</g>
  <g mask="url(#${u}-disc)">${mb.body}<circle cx="${C}" cy="${C}" r="${RIM}" fill="#000" fill-opacity="${kind === 'white' ? 0.16 : 0.45}"/></g>
  <g filter="url(#${u}-bvd)">${disc}</g><g filter="url(#${u}-sh)">${path('#000')}</g>
  <g mask="url(#${u}-art)">${mb.body}</g><g filter="url(#${u}-bv)">${path('#000')}</g>`;
  } else {
    // Engraved: the design cut into a white-marble medallion.
    const mb = marble(`${u}-m`, 'white');
    defs = `${mb.defs}${recess(`${u}-is`)}${bevel(`${u}-bvd`, 3, 4, 0.5, 0.35)}${shadow(`${u}-dsh`, 8, 10, 0.35)}${discMask}`;
    body = `<g filter="url(#${u}-dsh)">${disc}</g><g mask="url(#${u}-disc)">${mb.body}</g><g filter="url(#${u}-bvd)">${disc}</g>
  <path d="${mark.d}" fill="#000" fill-opacity="0.24"/><g filter="url(#${u}-is)">${path('#000')}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${S} ${S}">
<defs>${defs}</defs>
<rect width="${S}" height="${S}" fill="${bg}"/>
${body}
</svg>
`;
}
