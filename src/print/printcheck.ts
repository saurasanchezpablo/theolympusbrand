// Printability by morphology on the real geometry.
//
// For a feature size w (artboard units):
//   · a positive feature thinner than w disappears under an *opening*
//     (shrink by w/2, grow by w/2): a rib, a hairline, a bead too small;
//   · a gap narrower than w fills under a *closing* (grow, then shrink):
//     a slot, a counter, a hole too small.
// Losses at sharp tips and in acute crevices are ignored — they print as
// slightly rounded corners — but whole islands or holes that vanish never are.
// For glyphs, `topology` also rejects bridges that break and gaps that fuse.
// The largest clean w is the mark's minimum feature; the minimum printable
// diameter follows from the printer's finest reliable feature in mm.

import { RIM, type Pt, type Ring, signedArea } from '../geometry/math.ts';
import { difference, flatten, offset, union } from '../geometry/poly.ts';

export const MARK_DIAMETER = 2 * RIM; // 504 units: the outer rim

const inside = ([x, y]: Pt, ring: Ring): boolean => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/**
 * Group rings into regions (outer + the holes directly inside it) measured by
 * net area: a hair-thin sliver along a long curved edge is an outer ring with
 * a hole just inside it — tiny net area, however large the ring.
 */
function regions(rings: Ring[]) {
  const outers = rings.filter((r) => signedArea(r) > 0).sort((a, b) => signedArea(a) - signedArea(b));
  const holes = rings.filter((r) => signedArea(r) < 0);
  return outers.map((outer) => {
    const own = holes.filter((h) => inside(h[0], outer) && !outers.some((o) => o !== outer && signedArea(o) < signedArea(outer) && inside(h[0], o)));
    return { outer, net: signedArea(outer) + own.reduce((s, h) => s + signedArea(h), 0) };
  });
}

// A wedge crevice or tip loses area ∝ w² (≈ 2.9 w² for a 10° wedge); a real
// narrow rib or slot loses area ∝ w × its length — above 3 w² it is real.
// Below 0.5 unit² a region is numerical dust from integer rounding.
const significant = (rings: Ring[], w: number, k = 3): Ring[] =>
  regions(rings)
    .filter((g) => g.net > Math.max(k * w * w, 0.5))
    .map((g) => g.outer);

export type Problems = { thin: Ring[]; gaps: Ring[]; lostIslands: Ring[]; lostHoles: Ring[]; topology: string[] };

/** Outer rings and holes that matter at feature size w (the same 3 w² as above). */
const census = (rings: Ring[], w: number) => {
  const real = rings.filter((r) => Math.abs(signedArea(r)) > Math.max(3 * w * w, 0.5));
  return { parts: real.filter((r) => signedArea(r) > 0).length, holes: real.filter((r) => signedArea(r) < 0).length };
};

export type CheckOptions = {
  /**
   * Also fail on any change of topology — a bridge that breaks, a gap that
   * fuses, a counter that fills. For letters and symbols, where a broken
   * hairline makes a different glyph; the architecture tolerates pinches.
   */
  topology?: boolean;
};

export function problemsAt(G: Ring[], w: number, { topology: strict = false }: CheckOptions = {}): Problems {
  const opened = offset(offset(G, -w / 2), w / 2);
  const closed = offset(offset(G, w / 2), -w / 2);
  // A short hairline loses little area, but if it breaks, the shape is broken:
  // whatever its area, a change of topology is never a rounded corner.
  const topology: string[] = [];
  if (strict) {
    const g = census(G, w);
    const o = census(opened, w);
    // A counter shrinks under closing; it is lost only if nothing of it is left.
    const c = { parts: census(closed, 0).parts, holes: closed.filter((r) => signedArea(r) < -0.5).length };
    if (o.parts > g.parts) topology.push(`a thin bridge breaks (${g.parts} → ${o.parts} parts)`);
    if (c.parts < g.parts) topology.push(`a narrow gap fills (${g.parts} → ${c.parts} parts)`);
    if (c.holes < g.holes) topology.push(`a counter fills (${g.holes} → ${c.holes} holes)`);
  }
  return {
    thin: significant(difference(G, opened), w),
    gaps: significant(difference(closed, G), w),
    lostIslands: G.filter((r) => signedArea(r) > 0 && offset([r], -w / 2).length === 0),
    lostHoles: G.filter((r) => signedArea(r) < 0 && offset([[...r].reverse()], -w / 2).length === 0),
    topology,
  };
}

export const isClean = (p: Problems): boolean => !p.thin.length && !p.gaps.length && !p.lostIslands.length && !p.lostHoles.length && !p.topology.length;

/** Largest w (to ±0.05 units) at which nothing is lost. */
export function minFeature(G: Ring[], { lo = 0.1, hi = 8, ...opts }: { lo?: number; hi?: number } & CheckOptions = {}): { w: number; problems: Problems } {
  let a = lo;
  let b = hi;
  if (!isClean(problemsAt(G, a, opts))) return { w: 0, problems: problemsAt(G, a, opts) };
  while (b - a > 0.05) {
    const m = (a + b) / 2;
    if (isClean(problemsAt(G, m, opts))) a = m;
    else b = m;
  }
  return { w: a, problems: problemsAt(G, b, opts) };
}

/** Minimum printable outer diameter (mm) for a printer whose finest reliable feature is `featureMM`. */
export const minDiameterMM = (w: number, featureMM: number): number => (featureMM * MARK_DIAMETER) / w;

export const geometryOf = (d: string): Ring[] => union(flatten(d));
