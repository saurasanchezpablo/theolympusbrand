// The pantheon: the god of every service. Each god brings a symbol (its
// attribute) that stands in the temple's central bay and becomes its seal.
// Zeus is the master — his bay holds more server racks. Services with no
// fitting god can use a `monogram`: their initial, cut in Cinzel.

import { C, RIM } from './math.ts';
import { annulus, poly, rect, ribbonPts, solid, transformPath } from './path.ts';
import { ccw, signedArea } from './math.ts';
import { flatten, union, difference, offset, ringsPath } from './poly.ts';
import { lineText } from './fonts.ts';
import { SYMBOLS, type SymbolDetail, type SymbolId } from './symbols.ts';
import { PRINT_MIN_UNITS, isClean, problemsAt } from '../print/printcheck.ts';

// The categories live in a module of their own (no geometry), so the pages that only list them do not load the drawings.
import { CATEGORIES, type Category } from '../catalog/categories.ts';
export { CATEGORIES, type Category };

export type GodId =
  | 'zeus' | 'atlas' | 'iris' | 'hermes' | 'hades' | 'kronos' | 'argus' | 'athena' | 'nephele'
  | 'apollo' | 'hestia' | 'poseidon' | 'arachne' | 'nike' | 'hephaestus' | 'ares' | 'dionysus';

export type God = {
  id: GodId;
  name: string;
  /** Who the god is, in a phrase. */
  title: string;
  /** What stands in the bay. */
  attribute: string;
  /** The categories this god presides over by default. */
  categories: Category[];
  symbol?: SymbolId;
};

export const GODS: Record<GodId, God> = {
  zeus: { id: 'zeus', name: 'ZEUS', title: 'King of Olympus', attribute: 'Server racks — the master host itself', categories: [] },
  atlas: { id: 'atlas', name: 'ATLAS', title: 'The Titan who holds up the heavens', attribute: 'Celestial sphere on a pillar', categories: ['virtualization'], symbol: 'sphere' },
  iris: { id: 'iris', name: 'IRIS', title: 'Messenger of the rainbow, the bridge between worlds', attribute: 'Rainbow arches', categories: ['networking'], symbol: 'rainbow' },
  hermes: { id: 'hermes', name: 'HERMES', title: 'God of roads, crossings and travellers', attribute: 'Kerykeion — the herald’s winged staff', categories: ['proxy'], symbol: 'kerykeion' },
  hades: { id: 'hades', name: 'HADES', title: 'Lord of the vault below, where nothing is lost', attribute: 'Key', categories: ['storage'], symbol: 'key' },
  kronos: { id: 'kronos', name: 'KRONOS', title: 'Titan of time', attribute: 'Hourglass', categories: ['backup'], symbol: 'hourglass' },
  argus: { id: 'argus', name: 'ARGUS', title: 'The hundred-eyed watchman', attribute: 'Watching eyes', categories: ['monitoring'], symbol: 'eyes' },
  athena: { id: 'athena', name: 'ATHENA', title: 'Goddess of wisdom and defence', attribute: 'Owl', categories: ['security'], symbol: 'owl' },
  nephele: { id: 'nephele', name: 'NEPHELE', title: 'Nymph of the clouds', attribute: 'Clouds', categories: ['cloud'], symbol: 'clouds' },
  apollo: { id: 'apollo', name: 'APOLLO', title: 'God of music and the arts', attribute: 'Lyre', categories: ['media'], symbol: 'lyre' },
  hestia: { id: 'hestia', name: 'HESTIA', title: 'Goddess of the hearth and the home', attribute: 'Flame on the household altar', categories: ['home'], symbol: 'hearth' },
  poseidon: { id: 'poseidon', name: 'POSEIDON', title: 'Lord of the sea and all it carries', attribute: 'Trident', categories: ['containers'], symbol: 'trident' },
  arachne: { id: 'arachne', name: 'ARACHNE', title: 'The weaver whom Athena could not outdo', attribute: 'Web', categories: ['web'], symbol: 'web' },
  nike: { id: 'nike', name: 'NIKE', title: 'Goddess of victory', attribute: 'Victor’s wreath', categories: ['gaming'], symbol: 'wreath' },
  hephaestus: { id: 'hephaestus', name: 'HEPHAESTUS', title: 'The divine smith', attribute: 'Hammer and anvil', categories: ['sandbox'], symbol: 'forge' },
  ares: { id: 'ares', name: 'ARES', title: 'God of contest and combat', attribute: 'Crested helmet', categories: ['competitive'], symbol: 'helmet' },
  dionysus: { id: 'dionysus', name: 'DIONYSUS', title: 'God of the feast and its company', attribute: 'Kantharos — the cup of the feast', categories: ['community'], symbol: 'kantharos' },
};

/**
 * A service's patron: a god, a monogram for services no god fits, or the
 * service's own logo (imported path data, any scale) — with its initial, cut
 * in print editions when the logo would not keep its shape there.
 */
export type Patron = { god: GodId } | { monogram: string } | { logo: string; letter: string };

/** The default patron for a category. */
export function defaultPatron(category: Category, name: string): Patron {
  const god = (Object.values(GODS) as God[]).find((g) => g.categories.includes(category));
  return god ? { god: god.id } : { monogram: initialOf(name) };
}

export const initialOf = (name: string): string => (name.match(/[A-Za-z0-9]/)?.[0] ?? 'O').toUpperCase();

/* ---------------------------------------------------------------- */
/* Drawing a patron                                                  */
/* ---------------------------------------------------------------- */

const BOLD_GROW = 2.3;
const BOLD_CHOKE = 0.2;

/** A monogram drawn in bay space: the initial, centred, fitted to the bay. */
function monogramSymbol(letter: string, detail: SymbolDetail): string {
  const bold = detail === 'bold';
  const t = lineText(letter, { cx: C, baseline: 0, size: 96, tracking: 0, maxWidth: bold ? 38 - 2 * BOLD_GROW : 36, role: 'inscription' });
  let rings = union(flatten(t.d));
  // Print: Cinzel Bold (its counters are more open than Black's) thickened by
  // BOLD_GROW, with the counters cut back in shrunk only by BOLD_CHOKE — the
  // hairlines grow without choking small counters (A, R, 4…). Every letter and
  // digit is checked against the print minimum in tests/catalog.test.ts.
  if (bold) rings = difference(offset(rings, BOLD_GROW), offset(rings.filter((r) => signedArea(r) < 0).map((r) => [...r].reverse()), -BOLD_CHOKE));
  const d = ringsPath(rings);
  // Centre the cap height on the bay's centre line (y = 251).
  return transformPath(d, 1, 0, 251 + t.capHeight / 2);
}

/** A logo fitted to the bay (x 237–275, y 198–304) by its bounding box, centred on the bay's centre line. */
function logoSymbol(d: string): string {
  const pts = flatten(d).flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min(34 / (x1 - x0 || 1), 96 / (y1 - y0 || 1));
  return transformPath(d, k, C - ((x0 + x1) / 2) * k, 251 - ((y0 + y1) / 2) * k);
}

/** A patron as files record it: a logo by name only (its drawing is the service's logo file). */
export const patronRecord = (p: Patron): { god: GodId } | { monogram: string } | { logo: true; letter: string } => ('logo' in p ? { logo: true, letter: p.letter } : p);

const printsAsLogo = new Map<string, boolean>();
/** Whether a logo patron keeps its shape in the print edition's bay (checked as the print gate checks a glyph); else the initial is cut. */
export function patronPrintsAsLogo(p: Patron): boolean {
  if (!('logo' in p)) return false;
  let ok = printsAsLogo.get(p.logo);
  if (ok === undefined) {
    ok = isClean(problemsAt(union(flatten(logoSymbol(p.logo))), PRINT_MIN_UNITS, { topology: true }));
    if (printsAsLogo.size > 64) printsAsLogo.clear();
    printsAsLogo.set(p.logo, ok);
  }
  return ok;
}

/** The patron's symbol in bay space (x 237–275, y 198–304). Zeus has none. */
export function patronSymbol(p: Patron, detail: SymbolDetail): string | null {
  if ('monogram' in p) return monogramSymbol(p.monogram, detail);
  if ('logo' in p) return detail === 'bold' && !patronPrintsAsLogo(p) ? monogramSymbol(p.letter, 'bold') : logoSymbol(p.logo);
  const s = GODS[p.god].symbol;
  return s ? SYMBOLS[s](detail) : null;
}

/* ---------------------------------------------------------------- */
/* Seals                                                             */
/* ---------------------------------------------------------------- */

/** Bold temple-server for the master seal: bolt in the pediment, rack bars in the bays. */
function templeGlyph(): string {
  let d = solid([[92, 186], [256, 86], [420, 186]]);
  d += poly(ccw(ribbonPts([[176, 166], [210, 147], [240, 170], [272, 145], [304, 168], [336, 156]], 10)));
  d += rect(104, 196, 408, 226);
  for (const x of [130, 206, 306, 382]) d += rect(x - 20, 236, x + 20, 372);
  for (const [x0, x1] of [[156, 180], [232, 280], [332, 356]]) {
    for (const y of [244, 270, 296, 322, 348]) d += rect(x0, y, x1, y + 14);
  }
  d += rect(92, 382, 420, 400) + rect(72, 408, 440, 428);
  return d;
}

/** Fit path data into a circle of radius `r` about the artboard centre, by its bounding box. */
export function fitToCircle(d: string, r: number): string {
  const pts = flatten(d).flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = r / Math.hypot((x1 - x0) / 2, (y1 - y0) / 2);
  return transformPath(d, k, C - ((x0 + x1) / 2) * k, C - ((y0 + y1) / 2) * k);
}

/** The seal tier (≤ 48 px): a heavy ring around one bold symbol. */
export function sealGlyph(p: Patron = { god: 'zeus' }): string {
  const ring = annulus(214, RIM);
  // A logo is the seal's whole subject, as drawn (the seal is not a print edition).
  if ('logo' in p) return ring + fitToCircle(p.logo, 170);
  const symbol = patronSymbol(p, 'bold');
  if (!symbol) return ring + transformPath(templeGlyph(), 0.76, 256 * 0.24, 257 * 0.24 - 4);
  return ring + fitToCircle(symbol, 'monogram' in p ? 150 : 176);
}
