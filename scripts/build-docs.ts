// Builds the design-system boards into docs/design-system/.
//   npm run build:docs

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNodeFonts } from '../src/node/fonts.ts';
import { crest, emblem, seal, borderLayout, PROFILES, COMPOSITION } from '../src/geometry/crest.ts';
import { productionSvg, treatmentSvg } from '../src/render/svg.ts';
import { geometryOf, minFeature, minDiameterMM } from '../src/print/printcheck.ts';
import { PALETTE } from '../src/brand/palette.ts';
import { BORDER } from '../src/brand/identity.ts';
import { board, header, text, paragraph, place, pixels, measure } from './lib/board.ts';

loadNodeFonts();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'design-system');
const W = 1800;
const P = PALETTE;

const fine = crest({ detail: 'fine' });
const print = crest({ detail: 'print' });
const L = borderLayout(PROFILES.fine);
const printW = minFeature(geometryOf(print.d)).w;
const fineW = minFeature(geometryOf(fine.d)).w;

// Temple extents on the artboard (fine profile: the centre is not rescaled).
const TK = COMPOSITION.templeK;
const tBottom = COMPOSITION.plateauY - PROFILES.fine.templeGap;
const tTop = tBottom - (334 - (144 - PROFILES.fine.rise)) * TK;
const tHalf = (COMPOSITION.columns[3] + COMPOSITION.shaftW / 2 + 22 - 256) * TK;

/* ---------------------------------------------------------------- */
/* 1 — Construction                                                  */
/* ---------------------------------------------------------------- */
{
  const S = 920;
  const [ox, oy] = [64, 170];
  const k = S / 512;
  const X = (x: number) => ox + x * k;
  const Y = (y: number) => oy + y * k;
  const guide = '#7A7A7A';
  let b = header(W, 'CONSTRUCTION', 'MASTER CREST · FINE EDITION · 512-UNIT ARTBOARD, RIM Ø 504 · ALL DIMENSIONS IN ARTBOARD UNITS', true);
  // grid
  for (let i = 0; i <= 32; i++) {
    const g = i % 8 === 0 ? '#3A3A3A' : '#262626';
    b += `<rect x="${X(i * 16)}" y="${oy}" width="1" height="${S}" fill="${g}"/><rect x="${ox}" y="${Y(i * 16)}" width="${S}" height="1" fill="${g}"/>`;
  }
  b += place(productionSvg(fine, { ink: P.marble }).replace('fill="#EDEDED"', 'fill="#EDEDED" fill-opacity="0.55"'), ox, oy, S);
  const rings: [number, string][] = [
    [252, 'A'], [L.keyOut, 'B'], [L.keyIn, 'B'], [L.ruleOut, 'C'], [L.beadR, 'D'], [L.fieldR, 'E'], [COMPOSITION.laurel.R, 'F'],
  ];
  for (const [r] of rings) b += `<circle cx="${X(256)}" cy="${Y(256)}" r="${r * k}" fill="none" stroke="${guide}" stroke-width="1" stroke-dasharray="6 5"/>`;
  const hLines: [number, string][] = [[tTop, 'G'], [tBottom, 'G'], [COMPOSITION.plateauY, 'H'], [COMPOSITION.plinthBottom, 'H'], [PROFILES.fine.medal.cy, 'J']];
  for (const [y] of hLines) b += `<rect x="${X(40)}" y="${Y(y)}" width="${(512 - 80) * k}" height="1" fill="${guide}"/>`;
  for (const x of [256 - tHalf, 256 + tHalf]) b += `<rect x="${X(x)}" y="${Y(tTop - 12)}" width="1" height="${(tBottom - tTop + 24) * k}" fill="${guide}"/>`;
  b += `<rect x="${X(256)}" y="${oy}" width="1" height="${S}" fill="${guide}" fill-opacity="0.6"/>`;
  b += `<circle cx="${X(256)}" cy="${Y(PROFILES.fine.medal.cy)}" r="${PROFILES.fine.medal.r * k}" fill="none" stroke="${guide}" stroke-dasharray="4 4"/>`;
  // tags
  const tag = (x: number, y: number, t: string) =>
    `<circle cx="${x}" cy="${y}" r="13" fill="#161616" stroke="${P.marble}" stroke-width="1.2"/>` + text(x, y + 5, t, { size: 13, font: 'semibold', fill: P.marble, anchor: 'middle' });
  b += tag(X(256 + 249.5 * Math.cos(-0.6)), Y(256 + 249.5 * Math.sin(-0.6)), 'A');
  b += tag(X(256 + 232 * Math.cos(-0.45)), Y(256 + 232 * Math.sin(-0.45)), 'B');
  b += tag(X(256 + L.ruleOut * Math.cos(-0.25)), Y(256 + L.ruleOut * Math.sin(-0.25)), 'C');
  b += tag(X(256 + L.beadR * Math.cos(-0.05)), Y(256 + L.beadR * Math.sin(-0.05)), 'D');
  b += tag(X(256 + L.fieldR * Math.cos(0.18)), Y(256 + L.fieldR * Math.sin(0.18)), 'E');
  b += tag(X(256 - 174 * Math.cos(0.25)), Y(256 - 174 * Math.sin(0.25)), 'F');
  b += tag(X(256 - tHalf - 18), Y((tTop + tBottom) / 2 + 40), 'G');
  b += tag(X(470), Y(COMPOSITION.plateauY), 'H');
  b += tag(X(326), Y(PROFILES.fine.medal.cy), 'J');
  // legend
  const lx = 1060;
  const spec: [string, string, string][] = [
    ['A', 'Rim', `r ${L.rimIn}–252 · the die-cut silhouette, never broken`],
    ['B', 'Greek key', `r ${L.keyIn}–${L.keyOut} · 5 cells deep · ${BORDER.hooks.length} units, each 6 cells long`],
    ['C', 'Inner rule', `r ${L.ruleIn}–${L.ruleOut}`],
    ['D', 'Bead-and-reel', `r ${L.beadR} · bead Ø ${PROFILES.fine.border.beadT} · closes the ring exactly`],
    ['E', 'Field', `r ${L.fieldR} · nothing in the centre crosses it`],
    ['F', 'Laurel', `on r ${COMPOSITION.laurel.R} · ${COMPOSITION.laurel.leaves} leaf pairs a side, 160°–212° and 20°–−32°`],
    ['G', 'Temple-server', `x ${(256 - tHalf).toFixed(1)}–${(256 + tHalf).toFixed(1)} · y ${tTop.toFixed(1)}–${tBottom.toFixed(1)} · 4 columns`],
    ['H', 'Name plinth', `plateau y ${COMPOSITION.plateauY} · base y ${COMPOSITION.plinthBottom} · THE OLYMPUS cut out`],
    ['J', 'Logo slot', `Ø ${PROFILES.fine.medal.r * 2} centred at y ${PROFILES.fine.medal.cy} · on the cloud bank`],
  ];
  spec.forEach(([t, name, body], i) => {
    const y = 210 + i * 86;
    b += tag(lx + 13, y - 5, t);
    b += text(lx + 44, y, name.toUpperCase(), { size: 14, font: 'semibold', spacing: 0.14, fill: P.marble });
    b += text(lx + 44, y + 24, body, { size: 14, fill: P.silver });
  });
  b += text(lx, 1010, 'Grid: 16 units (light) · 128 units (heavy). Centre (256, 256).', { size: 13, fill: P.slate });
  b += text(lx, 1034, 'The print edition keeps this composition and widens bands and gaps (see Print).', { size: 13, fill: P.slate });
  board(join(OUT, 'ds-1-construction.png'), W, 1140, '#161616', b);
}

/* ---------------------------------------------------------------- */
/* 2 — Palette                                                       */
/* ---------------------------------------------------------------- */
{
  let b = header(W, 'PALETTE', 'GRAYSCALE ONLY · EVERY VALUE IS A NEUTRAL GREY (R = G = B) · ENFORCED BY THE TEST SUITE');
  const roles: Record<string, string> = {
    obsidian: 'Deepest ground · black marble base',
    charcoal: 'Primary ink on light grounds',
    graphite: 'Secondary ink · dark interface surfaces',
    slate: 'Captions · tertiary text',
    silver: 'Marble veining · disabled states',
    ash: 'Hairlines and dividers on light grounds',
    marble: 'Primary ink on dark grounds · white marble base',
    paper: 'Lightest ground',
  };
  Object.entries(P).forEach(([name, hex], i) => {
    const x = 64 + (i % 4) * 424;
    const y = 180 + Math.floor(i / 4) * 330;
    const v = parseInt(hex.slice(1, 3), 16);
    b += `<rect x="${x}" y="${y}" width="400" height="200" fill="${hex}" stroke="${P.ash}"/>`;
    b += text(x, y + 236, name.toUpperCase(), { size: 16, font: 'semibold', spacing: 0.16 });
    b += text(x, y + 262, `${hex} · RGB ${v} ${v} ${v} · ${Math.round((v / 255) * 100)} % L`, { size: 14, font: 'mono', fill: P.graphite });
    b += text(x, y + 288, roles[name], { size: 14, fill: P.slate });
  });
  b += text(64, 900, 'PAIRINGS', { size: 14, font: 'semibold', spacing: 0.16 });
  b += place(productionSvg(fine, { ground: 'light' }), 64, 924, 200) + text(284, 1000, 'Charcoal on paper — light grounds', { size: 15 });
  b += place(productionSvg(fine, { ground: 'dark' }), 700, 924, 200) + text(920, 1000, 'Marble on obsidian — dark grounds', { size: 15 });
  board(join(OUT, 'ds-2-palette.png'), W, 1170, P.paper, b);
}

/* ---------------------------------------------------------------- */
/* 3 — Typography                                                    */
/* ---------------------------------------------------------------- */
{
  let b = header(W, 'TYPOGRAPHY', 'THREE FAMILIES, ALL SIL OPEN FONT LICENSE · LETTERING IN THE MARK IS ALWAYS CONVERTED TO OUTLINES');
  const block = (y: number, label: string, use: string, specimen: string) => {
    b += text(64, y, label, { size: 15, font: 'semibold', spacing: 0.16 });
    b += text(64, y + 24, use, { size: 14, fill: P.slate });
    b += specimen;
  };
  block(190, 'CINZEL', 'Display and inscriptions. Bold (700) in the crest; Black (900), emboldened, in print editions.',
    text(64, 312, 'THE OLYMPUS', { size: 92, font: 'cinzel', spacing: 0.08 }) +
    text(64, 372, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ · 0123456789', { size: 30, font: 'cinzel', spacing: 0.06, fill: P.graphite }) +
    text(64, 430, 'THE OLYMPUS', { size: 44, font: 'cinzelBlack', spacing: 0.12, fill: P.graphite }) +
    text(64 + measure('THE OLYMPUS', { size: 44, font: 'cinzelBlack', spacing: 0.12 }) + 24, 428, 'Black · print editions', { size: 14, fill: P.slate }));
  block(500, 'JOST', 'Companion sans for interfaces, documents and captions. Geometric, after Futura — pairs with Roman capitals.',
    text(64, 588, 'Your own Olympus, above the cloud.', { size: 48, font: 'medium' }) +
    paragraph(64, 632, 'Every service on the server is a god with a domain: the temple stands for the machine, the god in its central bay for the service. Use Regular for text, Medium for headings, Semibold in capitals with generous tracking for labels.', 1100, { size: 18, fill: P.graphite, leading: 28 }).svg +
    text(64, 736, 'LABEL · SEMIBOLD · TRACKED +0.16 EM', { size: 15, font: 'semibold', spacing: 0.16, fill: P.slate }));
  block(800, 'JETBRAINS MONO', 'Technical text: hostnames, addresses, ports, configuration.',
    text(64, 880, 'proxmox  10.0.0.2:8006    jellyfin  10.0.0.5:8096', { size: 26, font: 'mono' }) +
    text(64, 918, 'ssh admin@olympus -p 22', { size: 20, font: 'mono', fill: P.slate }));
  board(join(OUT, 'ds-3-typography.png'), W, 990, P.paper, b);
}

/* ---------------------------------------------------------------- */
/* 4 — Size tiers                                                    */
/* ---------------------------------------------------------------- */
{
  let b = header(W, 'SIZE TIERS', 'ONE IDENTITY, THREE LEVELS OF DETAIL · RASTERS AT TRUE PIXEL SIZE (128 PX AND UP SHOWN 1×, SMALLER SHOWN 2×)');
  const tiers = [
    { label: 'CREST', use: 'Tier 1 · 256 px and up · login screens, print, plaques, stickers', mark: fine, sizes: [256, 128] },
    { label: 'EMBLEM', use: 'Tier 2 · 64–256 px · dashboards, avatars, app tiles', mark: emblem(), sizes: [128, 64] },
    { label: 'SEAL', use: 'Tier 3 · 48 px and below · favicons, tabs, tray icons', mark: seal(), sizes: [48, 32, 24, 16] },
  ];
  const rowY = [176, 560, 900];
  tiers.forEach((t, i) => {
    const y = rowY[i];
    b += place(productionSvg(t.mark), 64, y, 280);
    b += text(380, y + 30, t.label, { size: 18, font: 'semibold', spacing: 0.2 });
    b += text(380, y + 56, t.use, { size: 14, fill: P.slate });
    let x = 380;
    for (const s of t.sizes) {
      b += pixels(productionSvg(t.mark, { ground: 'light' }), x, y + 80, s, s >= 128 ? 1 : 2);
      b += text(x, y + 80 + (s >= 128 ? s : s * 2) + 22, `${s} px`, { size: 12, fill: P.slate });
      x += (s >= 128 ? s : s * 2) + 28;
    }
  });
  board(join(OUT, 'ds-4-tiers.png'), W, 1220, P.paper, b);
}

/* ---------------------------------------------------------------- */
/* 5 — Clear space and minimum sizes                                 */
/* ---------------------------------------------------------------- */
{
  let b = header(W, 'CLEAR SPACE AND MINIMUM SIZES', 'KEEP ONE-EIGHTH OF THE DIAMETER CLEAR ON EVERY SIDE · NEVER BELOW THE TIER MINIMUMS');
  const S = 560;
  const [x0, y0] = [130, 240];
  const m = S / 8;
  b += `<rect x="${x0 - m}" y="${y0 - m}" width="${S + 2 * m}" height="${S + 2 * m}" fill="none" stroke="${P.silver}" stroke-dasharray="8 6"/>`;
  b += `<rect x="${x0}" y="${y0}" width="${S}" height="${S}" fill="none" stroke="${P.ash}"/>`;
  b += place(productionSvg(fine), x0, y0, S);
  b += text(x0 + S / 2, y0 - m - 14, 'clear space = 1/8 of the diameter', { size: 13, fill: P.slate, anchor: 'middle' });
  const tx = 940;
  const rows: [string, string, string][] = [
    ['Crest · fine', '256 px', `screens; printed only from Ø ${Math.ceil(minDiameterMM(fineW, 0.1) / 10) * 10} mm at 0.1 mm`],
    ['Crest · print', `—`, `3D print from Ø ${Math.ceil(minDiameterMM(printW, 0.5))} mm (0.4 mm nozzle · 0.5 mm feature)`],
    ['Emblem', '64 px', 'below 64 px use the seal'],
    ['Seal', '16 px', 'favicons and tray icons'],
  ];
  b += text(tx, 250, 'MINIMUM SIZES', { size: 15, font: 'semibold', spacing: 0.16 });
  b += text(tx, 286, 'MARK', { size: 12, font: 'semibold', spacing: 0.14, fill: P.slate }) + text(tx + 220, 286, 'DIGITAL', { size: 12, font: 'semibold', spacing: 0.14, fill: P.slate }) + text(tx + 340, 286, 'PHYSICAL', { size: 12, font: 'semibold', spacing: 0.14, fill: P.slate });
  rows.forEach(([a, d, p], i) => {
    const y = 322 + i * 44;
    b += `<rect x="${tx}" y="${y - 28}" width="780" height="1" fill="${P.ash}"/>`;
    b += text(tx, y, a, { size: 15 }) + text(tx + 220, y, d, { size: 15, font: 'mono' }) + text(tx + 340, y, p, { size: 14, fill: P.graphite });
  });
  b += paragraph(tx, 540, `Physical sizes come from the measured smallest feature of each edition (fine ${fineW.toFixed(2)} u, print ${printW.toFixed(2)} u on the 504-unit rim) and the finest feature the process reproduces reliably. Confirm with the actual printer or print shop before production.`, 780, { size: 14, fill: P.slate, leading: 22 }).svg;
  board(join(OUT, 'ds-5-clearspace.png'), W, 960, P.paper, b);
}

/* ---------------------------------------------------------------- */
/* 6 — Fixed and variable                                            */
/* ---------------------------------------------------------------- */
{
  let b = header(W, 'FIXED AND VARIABLE', 'THE SILHOUETTE, BORDER, TEMPLE, NAME AND LAUREL NEVER CHANGE · A SERVICE CHANGES ONLY ITS GOD AND ITS LOGO SLOT');
  const S = 700;
  const [ox, oy] = [64, 170];
  const k = S / 512;
  b += place(productionSvg(fine, { ink: P.ash }), ox, oy, S);
  // variable zones, outlined
  const bay = { x0: 237 - 2, x1: 275 + 2 };
  const by0 = tBottom - (334 - 196) * TK;
  const by1 = tBottom - (334 - 304) * TK;
  const bx = (x: number) => ox + (256 + (x - 256) * TK) * k;
  b += `<rect x="${bx(bay.x0)}" y="${oy + by0 * k}" width="${(bay.x1 - bay.x0) * TK * k}" height="${(by1 - by0) * k}" fill="${P.charcoal}" fill-opacity="0.12" stroke="${P.charcoal}" stroke-width="2"/>`;
  b += `<circle cx="${ox + 256 * k}" cy="${oy + PROFILES.fine.medal.cy * k}" r="${PROFILES.fine.medal.r * k}" fill="${P.charcoal}" fill-opacity="0.12" stroke="${P.charcoal}" stroke-width="2"/>`;
  const lx = 840;
  const items: [string, string, string][] = [
    ['VARIABLE', 'Central bay', 'The god of the service, standing in the cella. The master has more server racks.'],
    ['VARIABLE', 'Logo slot', "The service's seal by default, or an application logo kept inside its own ring."],
    ['FIXED', 'Everything else', 'Rim, Greek key, bead-and-reel, laurel, temple, thunderbolt, name plinth, clouds, proportions.'],
  ];
  items.forEach(([kind, title, body], i) => {
    const y = 200 + i * 130;
    b += text(lx, y, kind, { size: 12, font: 'semibold', spacing: 0.16, fill: P.slate });
    b += text(lx, y + 28, title, { size: 20, font: 'medium' });
    b += paragraph(lx, y + 56, body, 880, { size: 15, fill: P.graphite, leading: 22 }).svg;
  });
  ['apollo', 'athena', 'argus'].forEach((god, i) => {
    b += place(productionSvg(crest({ god: god as 'apollo' })), lx + i * 300, 690, 260);
  });
  b += text(lx, 980, 'Apollo · Athena · Argus — the same crest; only the god and the slot change.', { size: 14, fill: P.slate });
  board(join(OUT, 'ds-6-system.png'), W, 1040, P.paper, b);
}

/* ---------------------------------------------------------------- */
/* 7 — Usage                                                         */
/* ---------------------------------------------------------------- */
{
  let b = header(W, 'USAGE', 'APPROVED GROUNDS AND TREATMENTS · AND WHAT NEVER TO DO');
  const good: [string, string][] = [
    [productionSvg(fine, { ground: 'light' }), 'Charcoal on paper'],
    [productionSvg(fine, { ground: 'dark' }), 'Marble on obsidian'],
    [treatmentSvg(fine, 'relief-white'), 'White marble relief'],
    [treatmentSvg(fine, 'relief-black'), 'Black marble relief'],
  ];
  good.forEach(([svg, label], i) => {
    const x = 64 + i * 424;
    b += place(svg, x, 170, 380) + text(x, 580, label, { size: 15 });
  });
  const base = productionSvg(fine, { ground: 'light' });
  const bad: [string, string][] = [
    [base.replace(/<svg [^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" preserveAspectRatio="none">`), 'Never stretch or squash'],
    [base.replace('<path id="mark"', '<path id="mark" transform="rotate(-14 256 256)"'), 'Never rotate'],
    [base, 'Never crop the rim'],
    [base.replace(`fill="${P.charcoal}"`, `fill="${P.ash}"`).replace(`fill="${P.paper}"`, `fill="${P.marble}"`), 'Never use low contrast'],
  ];
  bad.forEach(([svg, label], i) => {
    const x = 64 + i * 424;
    const w = i === 0 ? 380 : 380;
    const svgPlaced = i === 0
      ? `<svg x="${x}" y="660" width="${w}" height="${w * 0.62}" viewBox="0 0 512 512" preserveAspectRatio="none">${svg.replace(/<svg[^>]*>/, '').replace('</svg>', '')}</svg>`
      : place(svg, x, 660, w, i === 2 ? [46, 46, 420, 420] : undefined);
    b += svgPlaced;
    const cy = 660 + (i === 0 ? w * 0.31 : w / 2);
    b += `<g stroke="${P.charcoal}" stroke-width="6" stroke-linecap="round"><line x1="${x + w - 64}" y1="${cy - 150}" x2="${x + w - 24}" y2="${cy - 110}"/><line x1="${x + w - 24}" y1="${cy - 150}" x2="${x + w - 64}" y2="${cy - 110}"/></g>`;
    b += text(x, 1074, label, { size: 15 });
  });
  b += text(64, 1118, 'Also never: add colour, add effects to the production file, or rebuild the lettering in another typeface.', { size: 14, fill: P.slate });
  board(join(OUT, 'ds-7-usage.png'), W, 1160, P.paper, b);
}

console.log(`Design-system boards → ${OUT}`);
