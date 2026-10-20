// SVG documents for a mark: clean production files, and presentation
// treatments. Geometry stays one clean path; every material effect is a
// separate layer on top of it and never part of the mark.

import { ARTBOARD, C, RIM } from '../geometry/math.ts';
import { borderLayout, PROFILES, type Detail, type Mark } from '../geometry/crest.ts';
import { lineText } from '../geometry/fonts.ts';
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
  // Square marks sit on the 512 artboard; lockups carry their own width and height.
  const w = mark.width ?? S;
  const h = mark.height ?? S;
  const outW = Math.round(size * (w / Math.max(w, h)));
  const outH = Math.round(size * (h / Math.max(w, h)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${outW}" height="${outH}">
  <title>${esc(title)}</title>${bg ? `\n  <rect id="ground" width="${w}" height="${h}" fill="${bg}"/>` : ''}
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
  graphite: 'Graphite monolith',
  blueprint: 'Technical blueprint',
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

// A softer recess for the graphite: shallow engraving, a faint lit lower lip.
const recessSoft = (id: string) => `
  ${filterHead(id)}
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="b"/>
    <feOffset in="b" dx="1" dy="1.3" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out" result="lip"/>
    <feFlood flood-color="#000000" flood-opacity="0.85"/><feComposite in2="lip" operator="in" result="dark"/>
    <feOffset in="b" dx="-0.7" dy="-0.7" result="o2"/><feComposite in="SourceAlpha" in2="o2" operator="out" result="lip2"/>
    <feFlood flood-color="#FFFFFF" flood-opacity="0.14"/><feComposite in2="lip2" operator="in" result="light"/>
    <feMerge><feMergeNode in="dark"/><feMergeNode in="light"/></feMerge>
  </filter>`;

// Fine stone grain, seeded: a faint light-and-dark speckle.
const grain = (id: string) => `
  ${filterHead(id)}
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0.9 0.9 0.9 0 -1.25"/>
  </filter>`;

/**
 * The technical blueprint: the mark as a construction drawing — grid, centre
 * lines, the construction circles of the border (from the crest's own
 * layout), dimensions in artboard units, and a title block.
 */
function blueprintSvg(mark: Mark, size: number): string {
  const ink = PALETTE.graphite;
  const faint = PALETTE.silver;
  const M = 84; // margin around the artboard for dimensions
  const V = S + 2 * M;
  const label = (text: string, x: number, baseline: number, cap = 7, align: 'left' | 'centre' = 'left', fill: string = ink) => {
    const probe = lineText(text, { cx: 0, baseline, size: 100, tracking: 0.1, role: 'companion' });
    const k = cap / probe.capHeight;
    const t = lineText(text, { cx: 0, baseline, size: 100 * k, tracking: 0.1, role: 'companion' });
    return `<path d="${lineText(text, { cx: align === 'left' ? x + t.width / 2 : x, baseline, size: 100 * k, tracking: 0.1, role: 'companion' }).d}" fill="${fill}"/>`;
  };
  const kind = mark.id.split('-')[0];
  const detail: Detail = mark.id.includes('-print') ? 'print' : 'fine';
  const circles: [string, number][] = [['rim', RIM]];
  if (kind === 'crest') {
    const b = borderLayout(PROFILES[detail]);
    circles.push(['key band', b.keyOut], ['inner rule', b.ruleIn], ['bead ring', b.beadR], ['field', b.fieldR]);
  }
  let g = '';
  // Construction circles with radial leaders to labels in the right margin.
  circles.forEach(([name, r], i) => {
    const a = (-62 + i * 14) * (Math.PI / 180);
    const px = C + r * Math.cos(a);
    const py = C + r * Math.sin(a);
    const ly = 18 + i * 26;
    g += `<circle cx="${C}" cy="${C}" r="${r.toFixed(2)}" fill="none" stroke="${faint}" stroke-width="0.5" stroke-dasharray="4 2.5"/>`;
    g += `<path d="M${px.toFixed(2)} ${py.toFixed(2)} L${(S + 6).toFixed(2)} ${ly} L${(S + 14).toFixed(2)} ${ly}" fill="none" stroke="${ink}" stroke-width="0.45"/><circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="1.3" fill="${ink}"/>`;
    g += label(`R ${Math.round(r * 10) / 10}`, S + 16, ly + 3);
    g += label(name.toUpperCase(), S + 16, ly + 13, 4.6, 'left', PALETTE.slate);
  });
  // Overall dimension under the mark.
  const dy = C + RIM + 26;
  g += `<path d="M${C - RIM} ${C + RIM + 6} V${dy + 6} M${C + RIM} ${C + RIM + 6} V${dy + 6} M${C - RIM} ${dy} H${C + RIM}" fill="none" stroke="${ink}" stroke-width="0.45"/>`;
  g += `<path d="M${C - RIM} ${dy} l7 -2.4 v4.8 z M${C + RIM} ${dy} l-7 -2.4 v4.8 z" fill="${ink}"/>`;
  g += `<rect x="${C - 26}" y="${dy - 7}" width="52" height="14" fill="#F3F3F3"/>` + label(`Ø ${2 * RIM}`, C, dy + 3.5, 7, 'centre');
  // Title block.
  const what = `${kind.toUpperCase()}${kind === 'seal' ? '' : ` · ${detail.toUpperCase()} EDITION`}`;
  g += label('THE OLYMPUS', -M + 14, S + M - 26, 7) + label(`${what} · CONSTRUCTION · UNITS OF THE ${S} ARTBOARD`, -M + 14, S + M - 13, 4.6, 'left', PALETTE.slate);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-M} ${-M} ${V} ${V}">
<defs>
  <pattern id="bp-minor" width="8" height="8" patternUnits="userSpaceOnUse" x="0" y="0"><path d="M8 0H0V8" fill="none" stroke="#E2E2E2" stroke-width="0.4"/></pattern>
  <pattern id="bp-major" width="64" height="64" patternUnits="userSpaceOnUse" x="0" y="0"><rect width="64" height="64" fill="url(#bp-minor)"/><path d="M64 0H0V64" fill="none" stroke="#CDCDCD" stroke-width="0.6"/></pattern>
</defs>
<rect x="${-M}" y="${-M}" width="${V}" height="${V}" fill="#F3F3F3"/>
<rect x="${-M}" y="${-M}" width="${V}" height="${V}" fill="url(#bp-major)"/>
<path d="M${C} ${-M + 8} V${S + M - 40} M${-M + 8} ${C} H${S + M - 8}" stroke="${faint}" stroke-width="0.5" stroke-dasharray="10 3 2 3"/>
<path d="${mark.d}" fill="${ink}" fill-opacity="0.07" stroke="${ink}" stroke-width="0.42"/>
${g}
<rect x="${-M + 4}" y="${-M + 4}" width="${V - 8}" height="${V - 8}" fill="none" stroke="${ink}" stroke-width="0.8"/>
</svg>
`;
}

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
  } else if (treatment === 'graphite') {
    // A graphite monolith: dark, finely grained, the design shallowly engraved.
    bg = '#D4D4D4';
    defs = `${recessSoft(`${u}-is`)}${bevel(`${u}-bvd`, 2, 3, 0.22, 0.6)}${shadow(`${u}-dsh`, 9, 11, 0.5)}${discMask}${grain(`${u}-gr`)}
      <radialGradient id="${u}-sheen" cx="0.38" cy="0.3" r="0.85"><stop offset="0" stop-color="#3C3C3C"/><stop offset="0.6" stop-color="#2A2A2A"/><stop offset="1" stop-color="#202020"/></radialGradient>`;
    body = `<g filter="url(#${u}-dsh)">${disc}</g>
  <g mask="url(#${u}-disc)"><rect width="${S}" height="${S}" fill="url(#${u}-sheen)"/><rect width="${S}" height="${S}" filter="url(#${u}-gr)"/></g>
  <g filter="url(#${u}-bvd)">${disc}</g>
  <path d="${mark.d}" fill="#141414" fill-opacity="0.55"/><g filter="url(#${u}-is)">${path('#000')}</g>`;
  } else if (treatment === 'blueprint') {
    return blueprintSvg(mark, size);
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
