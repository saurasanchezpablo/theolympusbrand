import { createHash } from 'node:crypto';
import { type Pt, type Ring } from '../src/geometry/math.ts';
import { flatten, union } from '../src/geometry/poly.ts';
import { loadNodeFonts } from '../src/node/fonts.ts';

loadNodeFonts();

export const sha = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 16);

/** Even-odd point-in-shape over boolean-normalised rings. */
export function inked(rings: Ring[], [x, y]: Pt): boolean {
  let c = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

export const shape = (d: string): Ring[] => union(flatten(d));
