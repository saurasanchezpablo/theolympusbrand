// Polygon toolkit: flatten absolute path data into rings, then run booleans
// and offsets with Clipper (integer arithmetic, robust). Results keep the
// winding convention — outers clockwise on screen, holes counter-clockwise —
// so they drop straight into a nonzero fill.

import ClipperLib from 'clipper-lib';
import { type Pt, type Ring, signedArea } from './math.ts';

const SCALE = 1000; // 0.001-unit precision
const TOL = 0.35; // max chord deviation when flattening curves (artboard units)

/* ---------------------------------------------------------------- */
/* Flattening                                                        */
/* ---------------------------------------------------------------- */

function arcPoints(x0: number, y0: number, r: number, large: number, sweep: number, x1: number, y1: number): Ring {
  // SVG endpoint → centre parameterisation for circular arcs (rx = ry, no rotation).
  const hx = (x0 - x1) / 2;
  const hy = (y0 - y1) / 2;
  let rr = r;
  const lambda = (hx * hx + hy * hy) / (rr * rr);
  if (lambda > 1) rr *= Math.sqrt(lambda);
  const sign = large === sweep ? -1 : 1;
  const numr = rr ** 4 - rr * rr * hy * hy - rr * rr * hx * hx;
  const den = rr * rr * hy * hy + rr * rr * hx * hx;
  const coef = sign * Math.sqrt(Math.max(0, numr / den));
  const cxp = coef * hy;
  const cyp = -coef * hx;
  const cx = cxp + (x0 + x1) / 2;
  const cy = cyp + (y0 + y1) / 2;
  const a0 = Math.atan2(hy - cyp, hx - cxp);
  let da = Math.atan2(-hy - cyp, -hx - cxp) - a0;
  if (sweep === 0 && da > 0) da -= 2 * Math.PI;
  if (sweep === 1 && da < 0) da += 2 * Math.PI;
  const step = 2 * Math.acos(Math.max(-1, 1 - TOL / rr));
  const n = Math.max(2, Math.ceil(Math.abs(da) / step));
  const pts: Ring = [];
  for (let i = 1; i <= n; i++) {
    const a = a0 + (da * i) / n;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return pts;
}

function bezier(p0: Pt, ctrl: Pt[], p1: Pt): Ring {
  const pts = [p0, ...ctrl, p1];
  const len = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  const n = Math.max(2, Math.min(48, Math.ceil(Math.sqrt(len / TOL))));
  const out: Ring = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    if (ctrl.length === 1) {
      const c = ctrl[0];
      out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
    } else {
      const [c1, c2] = ctrl;
      out.push([
        u ** 3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p1[0],
        u ** 3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p1[1],
      ]);
    }
  }
  return out;
}

/** Absolute path data (M L A C Q Z) → closed rings. */
export function flatten(d: string): Ring[] {
  const rings: Ring[] = [];
  let ring: Ring | null = null;
  let cur: Pt = [0, 0];
  // Any other command letter (H, V, relative…) is an error, never silently skipped.
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let i = 0;
  let cmd: string | null = null;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    switch (cmd) {
      case 'M':
        if (ring && ring.length > 2) rings.push(ring);
        cur = [num(), num()];
        ring = [cur];
        cmd = 'L';
        break;
      case 'L':
        cur = [num(), num()];
        ring!.push(cur);
        break;
      case 'A': {
        const r = num();
        num();
        num();
        const large = num();
        const sweep = num();
        const end: Pt = [num(), num()];
        ring!.push(...arcPoints(cur[0], cur[1], r, large, sweep, end[0], end[1]));
        cur = end;
        break;
      }
      case 'Q': {
        const c1: Pt = [num(), num()];
        const end: Pt = [num(), num()];
        ring!.push(...bezier(cur, [c1], end));
        cur = end;
        break;
      }
      case 'C': {
        const c1: Pt = [num(), num()];
        const c2: Pt = [num(), num()];
        const end: Pt = [num(), num()];
        ring!.push(...bezier(cur, [c1, c2], end));
        cur = end;
        break;
      }
      case 'Z':
        if (ring && ring.length > 2) rings.push(ring);
        ring = null;
        cmd = null;
        break;
      default:
        throw new Error(`flatten: unsupported path command ${cmd ?? tokens[i]} (expected absolute M L A C Q Z)`);
    }
  }
  if (ring && ring.length > 2) rings.push(ring);
  return rings;
}

/* ---------------------------------------------------------------- */
/* Clipper wrappers — rings in, rings out                            */
/* ---------------------------------------------------------------- */

type CPath = { X: number; Y: number }[];
const toC = (rings: Ring[]): CPath[] => rings.map((r) => r.map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) })));
const fromC = (paths: CPath[]): Ring[] => paths.map((p) => p.map(({ X, Y }): Pt => [X / SCALE, Y / SCALE]));

function run(type: number, subject: Ring[], clip: Ring[] = [], fill = ClipperLib.PolyFillType.pftNonZero): Ring[] {
  const c = new ClipperLib.Clipper();
  c.AddPaths(toC(subject), ClipperLib.PolyType.ptSubject, true);
  if (clip.length) c.AddPaths(toC(clip), ClipperLib.PolyType.ptClip, true);
  const out = new ClipperLib.Paths();
  c.Execute(type, out, fill, fill);
  return fromC(out);
}

/** Union under nonzero winding (overlapping solids merge, reverse-wound holes cut). */
export const union = (...sets: Ring[][]): Ring[] => run(ClipperLib.ClipType.ctUnion, sets.flat());
/** Union under even-odd (for contours of mixed winding). */
export const unionEvenOdd = (rings: Ring[]): Ring[] => run(ClipperLib.ClipType.ctUnion, rings, [], ClipperLib.PolyFillType.pftEvenOdd);
/** subject − (clip₁ ∪ clip₂ ∪ …). */
export const difference = (subject: Ring[], ...clips: Ring[][]): Ring[] => run(ClipperLib.ClipType.ctDifference, subject, clips.flat());
/** subject ∩ clip₁ ∩ clip₂ ∩ … — each clip applied in turn. */
export const intersection = (subject: Ring[], ...clips: Ring[][]): Ring[] =>
  clips.reduce((acc, clip) => run(ClipperLib.ClipType.ctIntersection, acc, clip), subject);

/**
 * Grow (delta > 0) or shrink (delta < 0) with round joins. Arcs are drawn to
 * within `arcTolerance` (0.25 artboard units by default; pass a finer value
 * when working in millimetres).
 */
export function offset(rings: Ring[], delta: number, arcTolerance = 0.25): Ring[] {
  const co = new ClipperLib.ClipperOffset(2, arcTolerance * SCALE);
  co.AddPaths(toC(union(rings)), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const out = new ClipperLib.Paths();
  co.Execute(out, delta * SCALE);
  return fromC(out);
}

const r2 = (v: number) => Math.round(v * 100) / 100;
export const ringsPath = (rings: Ring[]): string => rings.map((r) => `M${r.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}Z`).join('');

/**
 * Union into strictly simple rings: no ring touches itself or another at a
 * vertex. Solid meshes need this — a pinch point would be a non-manifold vertex.
 */
export function strictlySimple(rings: Ring[]): Ring[] {
  const c = new ClipperLib.Clipper();
  c.StrictlySimple = true;
  c.AddPaths(toC(rings), ClipperLib.PolyType.ptSubject, true);
  const out = new ClipperLib.Paths();
  c.Execute(ClipperLib.ClipType.ctUnion, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return fromC(out);
}

/** Drop microscopic islands left behind by boolean cuts. */
export const noSpecks = (rings: Ring[], min = 1): Ring[] => rings.filter((r) => Math.abs(signedArea(r)) >= min);

/** Path data in, boolean-normalised rings out. */
export const solidRings = (d: string): Ring[] => union(flatten(d));
