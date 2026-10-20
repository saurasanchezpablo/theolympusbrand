// The crest for terminals: a mark drawn in text, for the message of the day,
// the console login and the SSH banner. Braille cells give eight dots per
// character (a fine drawing where the font has them); plain ASCII uses a ramp
// of characters by ink coverage, for any terminal. No colour codes: the
// terminal's own ink draws the mark.

import { flatten, union } from '../geometry/poly.ts';
import { rasterise } from '../manufacturing/lithophane.ts';

/** Ink coverage (0–1) of path data over its w × h box, on a grid gw × gh, rows top to bottom. */
export function coverage(d: string, w: number, h: number, gw: number, gh: number): Float32Array {
  const kx = gw / w;
  const ky = gh / h;
  // To a y-up frame centred on the box, one unit per grid cell (cells may be non-square: scale y apart).
  const rings = union(flatten(d)).map((r) => r.map(([x, y]): [number, number] => [(x - w / 2) * kx, ((h / 2 - y) * ky)]));
  const half = Math.max(gw, gh) / 2;
  const r = rasterise(rings, half, 1);
  const out = new Float32Array(gw * gh);
  const ox = Math.floor((r.size - gw) / 2);
  const oy = Math.floor((r.size - gh) / 2);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) out[y * gw + x] = r.data[(y + oy) * r.size + x + ox] ?? 0;
  return out;
}

const DOTS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];

/** A drawing in braille, `cols` characters wide (each 2 × 4 dots; a terminal cell is about twice as tall as wide). */
export function braille(d: string, w: number, h: number, cols: number, threshold = 0.45): string[] {
  const gw = cols * 2;
  const rows = Math.max(1, Math.round((gw * h) / w / 4));
  const gh = rows * 4;
  const cov = coverage(d, w, h, gw, gh);
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      let bits = 0;
      for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 2; dx++) if (cov[(r * 4 + dy) * gw + c * 2 + dx] > threshold) bits |= DOTS[dy][dx];
      line += String.fromCodePoint(0x2800 + bits);
    }
    lines.push(line.replace(/⠀+$/, ''));
  }
  return trimBlank(lines, '⠀');
}

const RAMP = ' .:-=+*#%@';

/** A drawing in plain ASCII, `cols` characters wide, by ink coverage. */
export function ascii(d: string, w: number, h: number, cols: number): string[] {
  const S = 4;
  const rows = Math.max(1, Math.round((cols * h) / w / 2));
  const gw = cols * S;
  const gh = rows * S * 2;
  const cov = coverage(d, w, h, gw, gh);
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      for (let y = 0; y < 2 * S; y++) for (let x = 0; x < S; x++) sum += cov[(r * 2 * S + y) * gw + c * S + x];
      const v = sum / (2 * S * S);
      line += RAMP[Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1)))];
    }
    lines.push(line.trimEnd());
  }
  return trimBlank(lines, ' ');
}

/** Drop blank lines above and below, and the columns every line leaves empty on the left. */
function trimBlank(lines: string[], blank: string): string[] {
  const empty = (l: string) => [...l].every((ch) => ch === blank);
  let a = 0;
  let b = lines.length;
  while (a < b && empty(lines[a])) a++;
  while (b > a && empty(lines[b - 1])) b--;
  const kept = lines.slice(a, b);
  const lead = Math.min(...kept.filter((l) => !empty(l)).map((l) => [...l].findIndex((ch) => ch !== blank)));
  return kept.map((l) => [...l].slice(lead).join(''));
}
