// The crest's border bands: a running Greek key and a bead-and-reel astragal.
// Both follow a rhythm (src/brand/identity.ts) rather than a fixed repeat, so
// the border is the house's own and not a stock ornament.

import { type Ring, polar } from './math.ts';
import { circle, sector, solid } from './path.ts';

/**
 * Running Greek key: one unit per entry of `hooks`. Each unit is 6 × 5 cells;
 * a '0' unit has the full inner hook, a '1' unit a hook one cell shorter.
 *
 *   '0'        '1'
 *   █████·     █████·
 *   █···█·     █···█·
 *   █·███·     █··██·
 *   █·····     █·····
 *   ██████     ██████
 */
export function keyBand(rOut: number, rIn: number, hooks: string): { d: string; units: number } {
  const h = (rOut - rIn) / 5;
  const dA = 360 / (hooks.length * 6);
  let d = '';
  [...hooks].forEach((hook, k) => {
    const cells: [number, number, number, number][] = [
      [0, 1, 0, 5],
      [0, 5, 0, 1],
      [4, 5, 0, 3],
      [hook === '1' ? 3 : 2, 5, 2, 3],
      [0, 6, 4, 5],
    ];
    for (const [x0, x1, y0, y1] of cells) d += sector(-90 + (k * 6 + x0) * dA, -90 + (k * 6 + x1) * dA, rOut - y1 * h, rOut - y0 * h);
  });
  return { d, units: hooks.length };
}

/** A bead-and-reel rhythm: [length, gap after] pairs, in units; length 1 = bead, 3 = reel. */
export type BeadRhythm = readonly (readonly [number, number])[];

export type Bead = { at: number; len: number };

/** The rhythm laid out round the ring, `repeat` times. */
export function beadTimeline(rhythm: BeadRhythm, repeat = 1): { beads: Bead[]; units: number } {
  const beads: Bead[] = [];
  let t = 0;
  for (let r = 0; r < repeat; r++) {
    for (const [len, gap] of rhythm) {
      beads.push({ at: t, len });
      t += len + gap;
    }
  }
  return { beads, units: t };
}

/** Bead-and-reel astragal on radius R, sized so the rhythm closes the ring exactly. */
export function beadAndReel(R: number, rhythm: BeadRhythm, { thickness = 3.6, repeat = 1 } = {}): { d: string; units: number; unitLen: number } {
  const { beads, units } = beadTimeline(rhythm, repeat);
  const unitDeg = 360 / units;
  const unitLen = (2 * Math.PI * R) / units;
  let d = '';
  for (const b of beads) {
    const mid = -90 + (b.at + b.len / 2) * unitDeg;
    if (b.len === 1) {
      const [x, y] = polar(mid, R);
      d += circle(x, y, Math.min(thickness / 2, unitLen * 0.48));
      continue;
    }
    // Reel: a stadium along the tangent.
    const len = b.len * unitLen - unitLen * 0.18;
    const r = thickness / 2;
    const a = (mid * Math.PI) / 180;
    const t = [-Math.sin(a), Math.cos(a)];
    const u = [Math.cos(a), Math.sin(a)];
    const [cx, cy] = polar(mid, R);
    const pts: Ring = [];
    for (const end of [1, -1]) {
      const ex = cx + t[0] * end * (len / 2 - r);
      const ey = cy + t[1] * end * (len / 2 - r);
      for (let i = 0; i <= 8; i++) {
        const th = ((-90 + (180 * i) / 8) * Math.PI) / 180;
        // The back cap runs the other way round so the outline never crosses itself.
        const dx = Math.cos(th) * end;
        const dy = Math.sin(th) * end;
        pts.push([ex + t[0] * dx * r + u[0] * dy * r, ey + t[1] * dx * r + u[1] * dy * r]);
      }
    }
    d += solid(pts);
  }
  return { d, units, unitLen };
}
