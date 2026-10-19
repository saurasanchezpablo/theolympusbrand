// Ornament: laurel branches and engraved cloud banks.

import { type Pt, type Ring, polar, rad } from './math.ts';
import { circle, leaf, rect, ribbon, sector } from './path.ts';
import { difference, flatten, intersection, offset, union } from './poly.ts';

/* ---------------------------------------------------------------- */
/* Laurel                                                            */
/* ---------------------------------------------------------------- */

export type LaurelStyle = { stem: number; taper: number; leafScale: number; berries: boolean };

/**
 * Laurel branch along a circle of radius R, from angle `from` to `to` (degrees;
 * the direction is implied). Paired leaves lean off the stem, alternating
 * slightly, and shorten towards the tip; berries sit outside every third pair.
 */
export function laurelBranch(R: number, from: number, to: number, leaves: number, s: LaurelStyle): string {
  const dir = Math.sign(to - from);
  let d = '';
  const segs = 24;
  for (let i = 0; i < segs; i++) {
    const a0 = from + ((to - from) * i) / segs;
    const a1 = from + ((to - from) * (i + 1)) / segs;
    const w = s.stem * (1 - (s.taper * i) / segs);
    d += sector(Math.min(a0, a1) - 0.15, Math.max(a0, a1) + 0.15, R - w / 2, R + w / 2);
  }
  for (let i = 0; i < leaves; i++) {
    const t = (i + 0.5) / leaves;
    const a = from + (to - from) * t;
    const base = polar(a, R);
    const tangent: Pt = [-Math.sin(rad(a)) * dir, Math.cos(rad(a)) * dir];
    const radial: Pt = [Math.cos(rad(a)), Math.sin(rad(a))];
    const len = (22 - 9 * t) * s.leafScale;
    for (const side of [1, -1]) {
      const tilt = 0.62;
      const v: Pt = [tangent[0] + radial[0] * side * tilt, tangent[1] + radial[1] * side * tilt];
      const L = Math.hypot(v[0], v[1]);
      const off = side * (i % 2 === 0 ? 0 : 2.5);
      const b: Pt = [base[0] + tangent[0] * off, base[1] + tangent[1] * off];
      d += leaf(b, [b[0] + (v[0] / L) * len, b[1] + (v[1] / L) * len], len * 0.42);
    }
    if (s.berries && i % 3 === 1) {
      const bp = polar(a + dir * 2.2, R + 9);
      d += circle(bp[0], bp[1], 2.6);
    }
  }
  const tipBase = polar(to, R);
  const tangent: Pt = [-Math.sin(rad(to)) * dir, Math.cos(rad(to)) * dir];
  d += leaf(tipBase, [tipBase[0] + tangent[0] * 15, tipBase[1] + tangent[1] * 15], 6);
  return d;
}

/* ---------------------------------------------------------------- */
/* Engraved clouds                                                   */
/* ---------------------------------------------------------------- */

/** Puffs [x, y, r] back → front; `lobes` are front puffs whose seam with the billows behind is engraved. */
export type CloudBank = { puffs: [number, number, number][]; lobes: number[]; foot?: [number, number, number, number] };

function arcRibbon(x: number, y: number, r: number, a0: number, a1: number, w: number): Ring[] {
  const pts: Ring = [];
  for (let a = a0; a <= a1 + 1e-6; a += (a1 - a0) / 14) pts.push([x + r * Math.cos(rad(a)), y + r * Math.sin(rad(a))]);
  return flatten(ribbon(pts, pts.map((_, i) => 0.5 + w * Math.sin((Math.PI * i) / (pts.length - 1)))));
}

/**
 * Engraved cloud banks: one scalloped contour per bank plus seam lines only
 * where a front billow overlaps the billows behind it. Returns the cloud body,
 * the clear-space halo it cuts out of whatever is behind, and the ink outline.
 */
export function engravedClouds(banks: CloudBank[], { clip, line, halo }: { clip: Ring[]; line: number; halo: number }) {
  const built = banks.map(({ puffs, lobes, foot }) => {
    const discs = puffs.map(([x, y, r]) => flatten(circle(x, y, r)));
    const parts = foot ? [...discs, flatten(rect(...foot))] : discs;
    const body = intersection(union(...parts), offset(clip, -line - 1));
    const contour = difference(offset(body, line), body);
    const seams = lobes.map((i) => intersection(arcRibbon(...puffs[i], 180, 360, line - 0.4), union(...discs.slice(0, i)), offset(body, -1.5)));
    return { body, lines: union(contour, ...seams) };
  });
  const body = union(...built.map((b) => b.body));
  return { body, halo: offset(body, halo), outline: union(...built.map((b) => b.lines)) };
}
