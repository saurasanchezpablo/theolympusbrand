// The Olympus — master crest (composition I · Classic) and its size tiers.
//
//   crest({ detail, patron, medal, logo })  ≥ 256 px, print, plaques
//   emblem({ detail, patron })               64–256 px, dashboards, avatars
//   seal({ patron })                         ≤ 48 px, favicons
//
// The patron is the god of a service (or a monogram); Zeus is the master.
//
// Two detail profiles: `fine` (screens, large prints) and `print` (every rib
// and gap ≥ ~4 units on the 512 artboard; verified by src/print/printcheck.ts).
// Pure and deterministic: the same config always yields identical path data.

import { C, RIM, type Ring } from './math.ts';
import { annulus, circle, rect, rectHole, ribbon, solid, hole, transformPath, scaleAbout } from './path.ts';
import { flatten, union, difference, intersection, offset, ringsPath, noSpecks } from './poly.ts';
import { lineText, type FontRole } from './fonts.ts';
import { keyBand, beadAndReel } from './border.ts';
import { laurelBranch, engravedClouds, type LaurelStyle, type CloudBank } from './ornament.ts';
import { patronSymbol, sealGlyph, type Patron } from './pantheon.ts';
import { BORDER, type BorderRhythms } from '../brand/identity.ts';

/* ---------------------------------------------------------------- */
/* Detail profiles                                                   */
/* ---------------------------------------------------------------- */
export type Detail = 'fine' | 'print';

type Profile = {
  minFeature: number;
  border: { rimW: number; gapRimKey: number; keyW: number; gapKeyRule: number; ruleW: number; gapRuleBeads: number; beadT: number; beadRepeat: number; gapBeadsField: number };
  flutes: number; fluteW: number; bayInset: number;
  rack: { h: number; gap: number; led: number; slot: number };
  triglyph: { slots: number; w: number; pitch: number };
  entGap: number; templeGap: number; rise: number; bolt: number[]; boltGrip: boolean;
  name: { role: FontRole; tracking: number; boost: number; width: number; ruleH: number; contourW: number };
  cloud: { line: number; gap: number; seams: boolean };
  laurel: LaurelStyle;
  medal: { mode: 'seal' | 'bold'; r: number; cy: number; halo: number };
};

export const PROFILES: Record<Detail, Profile> = {
  fine: {
    minFeature: 1.2,
    border: { rimW: 5, gapRimKey: 4, keyW: 22, gapKeyRule: 3.5, ruleW: 3, gapRuleBeads: 4.7, beadT: 3.6, beadRepeat: 4, gapBeadsField: 3.2 },
    flutes: 3, fluteW: 2.2, bayInset: 3,
    rack: { h: 7.6, gap: 3, led: 1.25, slot: 1.7 },
    triglyph: { slots: 3, w: 2.4, pitch: 3.2 },
    entGap: 2, templeGap: 3.5, rise: 52, bolt: [5.6, 5, 4.4, 3.8, 3.4], boltGrip: true,
    name: { role: 'inscription', tracking: 0.13, boost: 0, width: 292, ruleH: 1.4, contourW: 1.5 },
    cloud: { line: 2, gap: 2, seams: true },
    laurel: { stem: 2.6, taper: 0.6, leafScale: 1, berries: true },
    medal: { mode: 'seal', r: 25, cy: 433, halo: 3.5 },
  },
  print: {
    minFeature: 4.2,
    border: { rimW: 7, gapRimKey: 4.6, keyW: 24, gapKeyRule: 4.6, ruleW: 5, gapRuleBeads: 4.6, beadT: 5, beadRepeat: 3, gapBeadsField: 4.6 },
    flutes: 2, fluteW: 4.6, bayInset: 4.6,
    rack: { h: 9, gap: 4.8, led: 0, slot: 0 },
    triglyph: { slots: 2, w: 4.6, pitch: 9.2 },
    entGap: 4.6, templeGap: 4.8, rise: 60, bolt: [6.4, 6, 5.4, 5, 4.6], boltGrip: false,
    // Cinzel Black, emboldened 0.62: balances the cut-out hairlines against the P's counter.
    name: { role: 'inscriptionHeavy', tracking: 0.2, boost: 0.62, width: 322, ruleH: 0, contourW: 0 },
    cloud: { line: 4.6, gap: 4.6, seams: false },
    laurel: { stem: 4.6, taper: 0, leafScale: 1.1, berries: true },
    // Fits between the plinth and the bead ring with a printable gap on both sides.
    medal: { mode: 'bold', r: 25, cy: 429.5, halo: 5 },
  },
};

/* ---------------------------------------------------------------- */
/* Composition — I · Classic (immutable)                             */
/* ---------------------------------------------------------------- */
export const COMPOSITION = {
  columns: [177, 223, 289, 335],
  shaftW: 22,
  templeK: 1.05, // temple scale on the plinth
  plateauY: 339, // the summit the temple stands on
  nominalField: 203, // the centre is laid out for this field radius, then scaled to the real one
  laurel: { R: 174, leaves: 8, left: [160, 212], right: [20, -32] },
  plinthTop: [
    [20, 396], [46, 380], [72, 362], [90, 349], [106, 357], [130, 339],
    [382, 339], [406, 358], [424, 347], [446, 362], [470, 378], [492, 396],
  ] as Ring,
  plinthBottom: 400,
  contour: [
    [[20, 404], [46, 388], [72, 370], [90, 357], [106, 365], [126, 351], [134, 346]],
    [[378, 346], [386, 351], [406, 366], [424, 355], [446, 370], [470, 386], [492, 404]],
  ] as Ring[],
  clouds: [
    {
      puffs: [
        [184, 422, 11], [212, 415, 17], [246, 420, 10], [272, 415, 17], [306, 419, 13], [334, 424, 10],
        [158, 432, 9], [356, 432, 9], [186, 438, 12], [326, 437, 12], [220, 441, 10], [294, 441, 10],
      ],
      seamLobes: [8, 9],
      foot: [150, 424, 362, 456],
    },
  ],
} as const;

/** Radii of the border bands for a profile, outside → in. */
export function borderLayout(P: Profile) {
  const b = P.border;
  const rimIn = RIM - b.rimW;
  const keyOut = rimIn - b.gapRimKey;
  const keyIn = keyOut - b.keyW;
  const ruleOut = keyIn - b.gapKeyRule;
  const ruleIn = ruleOut - b.ruleW;
  const beadR = ruleIn - b.gapRuleBeads - b.beadT / 2;
  const fieldR = beadR - b.beadT / 2 - b.gapBeadsField;
  return { rimIn, keyOut, keyIn, ruleOut, ruleIn, beadR, fieldR };
}

/* ---------------------------------------------------------------- */
/* Temple                                                            */
/* ---------------------------------------------------------------- */
function rackUnits([x0, x1]: [number, number], P: Profile, leds = 1, y0 = 197, y1 = 304 - Math.max(1, P.minFeature)): string {
  const { h, gap, led, slot } = P.rack;
  const pitch = h + gap;
  const units = Math.floor((y1 - y0 + gap) / pitch);
  const start = y0 + (y1 - y0 - (units * pitch - gap)) / 2;
  let d = '';
  for (let i = 0; i < units; i++) {
    const y = start + i * pitch;
    d += rect(x0, y, x1, y + h);
    if (led) for (let k = 0; k < leds; k++) d += circle(x0 + 3.6 + k * 4.2, y + h / 2, led, true);
    if (slot && x1 - x0 > 16) d += rectHole(x0 + 3.6 + leds * 4.2, y + h / 2 - slot / 2, x1 - 2.6, y + h / 2 + slot / 2);
  }
  return d;
}

const BOLT = { xs: [11, 20, 30, 40, 48], ys: [0, -7.5, 6, -6.5, 0], tip: 60, head: 45, headH: 6, grip: 12, gripH: 7 };

function thunderbolt(P: Profile, cx: number, cy: number, s: number): string {
  let d = solid([[cx - BOLT.grip * s, cy], [cx - 5 * s, cy - BOLT.gripH * s], [cx + 5 * s, cy - BOLT.gripH * s], [cx + BOLT.grip * s, cy], [cx + 5 * s, cy + BOLT.gripH * s], [cx - 5 * s, cy + BOLT.gripH * s]]);
  if (P.boltGrip) d += rectHole(cx - 7.6 * s, cy - 4.2 * s, cx - 6.2 * s, cy + 4.2 * s) + rectHole(cx + 6.2 * s, cy - 4.2 * s, cx + 7.6 * s, cy + 4.2 * s);
  for (const side of [1, -1]) {
    d += ribbon(BOLT.xs.map((x, i) => [cx + side * x * s, cy + BOLT.ys[i] * s]), P.bolt);
    d += solid([[cx + side * BOLT.head * s, cy - BOLT.headH * s], [cx + side * BOLT.tip * s, cy], [cx + side * BOLT.head * s, cy + BOLT.headH * s]]);
  }
  return d;
}

/** Largest bolt (scale ≤ 1) that sits inside the tympanum with `margin` clear on every side. */
function fitBolt(P: Profile, tBase: number, tApex: number, tan: number, margin: number) {
  const rake = (x: number) => tApex + Math.abs(x) * tan;
  for (let s = 1; s >= 0.5; s -= 0.01) {
    const half = Math.max(...BOLT.ys.map((y, i) => Math.abs(y) * s + P.bolt[i] / 2), BOLT.gripH * s);
    const cy = tBase - margin - half;
    const ok =
      BOLT.xs.every((x, i) => cy + BOLT.ys[i] * s - P.bolt[i] / 2 >= rake(x * s) + margin) &&
      cy - BOLT.headH * s >= rake(BOLT.head * s) + margin &&
      cy >= rake(BOLT.tip * s) + margin &&
      cy - BOLT.gripH * s >= rake(5 * s) + margin;
    if (ok) return { s, cy };
  }
  return { s: 0.5, cy: tBase - margin - 8 };
}

/** The central bay of the temple, in temple coordinates. */
function centralBay(P: Profile): [number, number] {
  const cols = COMPOSITION.columns;
  const H = COMPOSITION.shaftW / 2;
  return [cols[1] + H + P.bayInset, cols[2] - H - P.bayInset];
}

/** The patron's symbol placed in the central bay (bold in print editions); null for the master. */
function cella(P: Profile, patron: Patron): string | null {
  // Symbols are drawn for a 38-wide bay centred on x = 256.
  const symbol = patronSymbol(patron, P.medal.mode === 'bold' ? 'bold' : 'fine');
  if (!symbol) return null;
  const [b0, b1] = centralBay(P);
  const k = (b1 - b0) / 38;
  return transformPath(symbol, k, (b0 + b1) / 2 - C * k, 251 - 251 * k);
}

/** The temple-server in its own coordinates (bottom step at y = 334). */
function temple(P: Profile, patron: Patron): string {
  const cols = COMPOSITION.columns;
  const H = COMPOSITION.shaftW / 2;
  const first = cols[0];
  const last = cols[cols.length - 1];
  const minF = P.minFeature;
  let d = '';
  // Crepidoma — three steps.
  d += rect(first - H - 22, 326, last + H + 22, 334) + rect(first - H - 14, 318, last + H + 14, 326) + rect(first - H - 6, 310, last + H + 6, 318);
  // Columns: as many flutes as the shaft can carry at this detail level.
  const flutes = Math.max(0, Math.min(P.flutes, Math.floor((COMPOSITION.shaftW - minF) / (P.fluteW + minF))));
  const land = (COMPOSITION.shaftW - flutes * P.fluteW) / (flutes + 1);
  for (const c of cols) {
    d += rect(c - H - 4, 304, c + H + 4, 310) + rect(c - H, 196, c + H, 304);
    for (let i = 0; i < flutes; i++) {
      const x = c - H + land * (i + 1) + P.fluteW * i;
      d += rectHole(x, 202, x + P.fluteW, 298);
    }
    d += solid([[c - H - 6, 190], [c + H + 6, 190], [c + H, 196], [c - H, 196]]) + rect(c - H - 7, 184, c + H + 7, 190);
  }
  // Entablature: architrave, frieze with triglyph vents, cornice.
  const x0 = first - H - 12;
  const x1 = last + H + 12;
  const friezeB = 170 - P.entGap;
  const friezeT = friezeB - 14;
  const corniceB = friezeT - P.entGap;
  const corniceT = corniceB - 8;
  d += rect(x0, 170, x1, 184) + rect(x0, friezeT, x1, friezeB);
  const bays: [number, number][] = cols.slice(0, -1).map((c, i) => [c + H + P.bayInset, cols[i + 1] - H - P.bayInset]);
  const tg = P.triglyph;
  const tgHalf = ((tg.slots - 1) * tg.pitch + tg.w) / 2;
  const candidates = [...cols, ...cols.slice(0, -1).map((c, i) => (c + cols[i + 1]) / 2)].sort((a, b) => a - b);
  const spacing = Math.min(...candidates.slice(1).map((x, i) => x - candidates[i]));
  for (const x of spacing - 2 * tgHalf >= minF ? candidates : cols) {
    for (let k = 0; k < tg.slots; k++) {
      const sx = x - tgHalf + k * tg.pitch;
      d += rectHole(sx, friezeT + 3, sx + tg.w, friezeB - 3);
    }
  }
  const cL = x0 - 8;
  const cR = x1 + 8;
  d += rect(cL, corniceT, cR, corniceB);
  // Pediment, recessed tympanum, and Zeus' thunderbolt fitted inside it.
  const apexY = corniceT - P.rise;
  d += solid([[cL, corniceT], [C, apexY], [cR, corniceT]]);
  const tan = P.rise / (C - cL);
  const tApex = apexY + 8 * Math.sqrt(1 + tan * tan);
  const tBase = corniceT - 5;
  const tw = (tBase - tApex) / tan;
  d += hole([[C - tw, tBase], [C, tApex], [C + tw, tBase]]);
  const bolt = fitBolt(P, tBase, tApex, tan, Math.max(minF, 2.5));
  d += thunderbolt(P, C, bolt.cy, bolt.s);
  // Bays: racks either side; the god (or, for the master, more racks) in the centre.
  const mid = Math.floor(bays.length / 2);
  bays.forEach((bay, i) => {
    if (i !== mid) d += rackUnits(bay, P);
  });
  const c = cella(P, patron);
  d += c ?? rackUnits(bays[mid], P, 2);
  return d;
}

/* ---------------------------------------------------------------- */
/* Plinth — Mount Olympus carrying the name                          */
/* ---------------------------------------------------------------- */
function plinth(P: Profile, ringR: number, fieldR: number, withName = true): Ring[] {
  const band = intersection([[...COMPOSITION.plinthTop, [520, COMPOSITION.plinthBottom], [-8, COMPOSITION.plinthBottom]]], flatten(circle(C, C, ringR)));
  if (!withName) return band;
  const n = P.name;
  // Glyph contours merge under nonzero first: some Cinzel weights draw a letter
  // from overlapping contours, which an even-odd fill would punch holes into.
  let name = union(flatten(lineText('THE OLYMPUS', { cx: C, baseline: 386, size: 40, tracking: n.tracking, maxWidth: n.width, role: n.role }).d));
  if (n.boost) name = offset(name, n.boost); // print emboldening
  const cuts: Ring[][] = [name];
  if (n.ruleH) {
    const hw = Math.sqrt(ringR * ringR - (394 - C) ** 2) - 18;
    cuts.push(flatten(rect(C - hw, 393, C + hw, 393 + n.ruleH)));
  }
  if (n.contourW) {
    const lines = union(...COMPOSITION.contour.map((pts) => flatten(ribbon(pts, n.contourW))));
    cuts.push(intersection(lines, flatten(circle(C, C, fieldR + 1))));
  }
  return difference(band, ...cuts);
}

/* ---------------------------------------------------------------- */
/* Logo slot medallion                                               */
/* ---------------------------------------------------------------- */
export type MedalMode = 'seal' | 'slot';

/** Fit path data into a circle of radius r centred at (cx, cy), by its bounding box. */
function fitInto(d: string, r: number, cx: number, cy: number): string {
  const pts = flatten(d).flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = r / Math.hypot((x1 - x0) / 2, (y1 - y0) / 2);
  return transformPath(d, k, cx - ((x0 + x1) / 2) * k, cy - ((y0 + y1) / 2) * k);
}

/**
 * The logo slot. Fine: the patron's seal, or an external logo (path data, any
 * scale) fitted to the safe area inside the ring. Print: a heavy ring around a
 * bold temple glyph for every crest — at this size no seal, logo or letter
 * keeps its shape on a 0.4 mm nozzle; the cella carries the patron instead.
 */
function medallion(P: Profile, patron: Patron, mode: MedalMode, logo?: string): string {
  const { r, cy } = P.medal;
  const bold = P.medal.mode === 'bold';
  const ringW = bold ? 5 : r * (38 / RIM);
  const ring = annulus(r - ringW, r, C, cy);
  if (mode === 'slot') return ring;
  if (!bold) {
    if (logo) return ring + fitInto(logo, (r - ringW) * 0.86, C, cy);
    const k = r / RIM;
    return transformPath(sealGlyph(patron), k, C - C * k, cy - C * k);
  }
  // A bold temple glyph (drawn for r = 28), every part ≥ the print minimum.
  const g = r / 28;
  let d = ring;
  d += solid([[C - 15 * g, cy - 5 * g], [C, cy - 14 * g], [C + 15 * g, cy - 5 * g]]);
  for (const x of [-9.8, 0, 9.8]) d += rect(C + (x - 2.5) * g, cy - 5.5 * g, C + (x + 2.5) * g, cy + 9.5 * g);
  d += rect(C - 12.5 * g, cy + 9 * g, C + 12.5 * g, cy + 13.5 * g);
  return d;
}

/* ---------------------------------------------------------------- */
/* Tiers                                                             */
/* ---------------------------------------------------------------- */
export type Mark = { id: string; d: string; width?: number; height?: number };

export type CrestConfig = {
  detail?: Detail;
  /** The service's god, or a monogram. Default: Zeus, the master. */
  patron?: Patron;
  medal?: MedalMode;
  /** External logo (path data at any scale) for the fine edition's logo slot. */
  logo?: string;
  border?: BorderRhythms;
};

const ZEUS: Patron = { god: 'zeus' };
const patronId = (p: Patron) => ('god' in p ? p.god : `monogram-${p.monogram}`);

const placeTemple = (P: Profile, d: string) => {
  const k = COMPOSITION.templeK;
  return transformPath(d, k, C * (1 - k), COMPOSITION.plateauY - P.templeGap - 334 * k);
};

/** The crest's parts, in their drawing order: the border, then the centre (laid out for the nominal field). */
export const CREST_PARTS = ['rim', 'ornament', 'laurels', 'temple', 'plinth', 'clouds'] as const;
export type CrestPart = (typeof CREST_PARTS)[number];

function crestPieces({ detail = 'fine', patron = ZEUS, medal = 'seal', logo, border: rhythms = BORDER }: CrestConfig): { border: Record<'rim' | 'ornament', string>; centre: Record<'laurels' | 'temple' | 'plinth' | 'clouds', string>; k: number } {
  const P = PROFILES[detail];
  const L = borderLayout(P);
  const b = P.border;
  const border = {
    rim: annulus(L.rimIn, RIM),
    ornament: keyBand(L.keyOut, L.keyIn, rhythms.hooks).d + annulus(L.ruleIn, L.ruleOut) + beadAndReel(L.beadR, rhythms.beads, { thickness: b.beadT, repeat: b.beadRepeat }).d,
  };

  // The centre is laid out for the nominal field, then scaled to the real one.
  const k = L.fieldR / COMPOSITION.nominalField;
  const field = flatten(circle(C, C, COMPOSITION.nominalField));
  // Clouds clear their own outline plus a printable gap, and drop just far
  // enough to stay a printable distance below the lettering.
  const halo = (P.cloud.line + P.cloud.gap) / k;
  const drop = Math.max(0, 386 + P.name.boost + P.minFeature / k + halo - 397);
  const banks: CloudBank[] = COMPOSITION.clouds.map((c) => ({
    puffs: c.puffs.map(([x, y, r]) => [x, y + drop, r] as [number, number, number]),
    lobes: P.cloud.seams ? [...c.seamLobes] : [],
    foot: [c.foot[0], c.foot[1] + drop, c.foot[2], c.foot[3] + drop],
  }));
  const cl = engravedClouds(banks, { clip: field, line: P.cloud.line / k, halo });
  const medalHalo = flatten(circle(C, P.medal.cy, P.medal.r + P.medal.halo));
  const lr = COMPOSITION.laurel;

  const centre = {
    laurels: laurelBranch(lr.R, lr.left[0], lr.left[1], lr.leaves, P.laurel) + laurelBranch(lr.R, lr.right[0], lr.right[1], lr.leaves, P.laurel),
    temple: placeTemple(P, temple(P, patron)),
    // The plinth ends at the field, so it never covers the bead-and-reel.
    plinth: ringsPath(noSpecks(difference(plinth(P, COMPOSITION.nominalField, COMPOSITION.nominalField), cl.halo))),
    clouds: ringsPath(noSpecks(difference(cl.outline, medalHalo))) + medallion(P, patron, medal, logo),
  };
  return { border, centre, k };
}

/** Tier 1 — the full crest. */
export function crest(config: CrestConfig = {}): Mark {
  const { detail = 'fine', patron = ZEUS, medal = 'seal' } = config;
  const { border, centre, k } = crestPieces(config);
  const d = border.rim + border.ornament + scaleAbout(centre.laurels + centre.temple + centre.plinth + centre.clouds, k);
  return { id: `crest-${detail}-${patronId(patron)}${medal === 'slot' ? '-slot' : ''}`, d };
}

/**
 * The crest taken apart, each part where it sits in the finished crest: the
 * rim, the border ornament (key, rule, beads), the laurels, the temple, the
 * name plinth, and the clouds with the logo slot. Together they are the crest.
 */
export function crestParts(config: CrestConfig = {}): Record<CrestPart, string> {
  const { border, centre, k } = crestPieces(config);
  return {
    rim: border.rim,
    ornament: border.ornament,
    laurels: scaleAbout(centre.laurels, k),
    temple: scaleAbout(centre.temple, k),
    plinth: scaleAbout(centre.plinth, k),
    clouds: scaleAbout(centre.clouds, k),
  };
}

/**
 * The parts of a crest that vary per service — the bay symbol and the logo
 * slot — exactly where they sit in the finished crest. Used to print-check a
 * new service quickly without re-checking the fixed parts.
 */
export function variableParts({ detail = 'fine', patron = ZEUS, medal = 'seal', logo }: CrestConfig = {}): { cella: string; medal: string } {
  const P = PROFILES[detail];
  const k = borderLayout(P).fieldR / COMPOSITION.nominalField;
  const c = cella(P, patron);
  return {
    cella: c ? scaleAbout(placeTemple(P, c), k) : '',
    medal: scaleAbout(medallion(P, patron, medal, logo), k),
  };
}

/** Tier 2 — the emblem: heavy ring, temple-server, plinth; no lettering, laurel or border code. */
export function emblem({ detail = 'fine', patron = ZEUS }: CrestConfig = {}): Mark {
  const P = PROFILES[detail];
  const k = 1.08;
  const ringIn = detail === 'print' ? 220 : 222;
  const centre = placeTemple(P, temple(P, patron)) + ringsPath(plinth(P, (ringIn + 4) / k, COMPOSITION.nominalField, false));
  const d = annulus(234, RIM) + annulus(ringIn, ringIn + 4) + scaleAbout(centre, k);
  return { id: `emblem-${detail}-${patronId(patron)}`, d };
}

/** Tier 3 — the seal: a heavy ring around one bold symbol. */
export function seal({ patron = ZEUS }: CrestConfig = {}): Mark {
  return { id: `seal-${patronId(patron)}`, d: sealGlyph(patron) };
}

export const TIERS = { crest, emblem, seal } as const;
export type Tier = keyof typeof TIERS;
