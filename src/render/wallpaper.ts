// Marble grounds for screens — dashboard and login backgrounds, wallpapers.
// Seen whole and large, stone needs a different veining from the stickers'
// fine all-over pattern: a few long main veins that taper and fade, finer
// veins crossing them, a soft cloudiness, and a gentle vignette. Built on the
// house's seeded noise, so the same size and tone give the same pixels
// everywhere.

import { fbm } from '../manufacturing/lithophane.ts';

export type ScreenTone = 'marble-dark' | 'marble-light';

/** Width of the composition in the veining's units: the same stone at every resolution. */
const SPAN = 1000;

const smooth = (e0: number, e1: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * One family of veins: parallel at `angle`, `period` apart, bent by a warp
 * gentle enough never to close them into loops, varying in width and fading
 * in and out along their length.
 */
function veins(x: number, y: number, seed: number, angle: number, period: number, warpScale: number, warp: number, width: number): number {
  const a = (angle * Math.PI) / 180;
  const u = (x * Math.cos(a) + y * Math.sin(a)) / period;
  const w = (fbm(x / warpScale, y / warpScale, seed) - 0.47) * warp + (fbm((6 * x) / warpScale, (6 * y) / warpScale, seed + 1) - 0.47) * warp * 0.12;
  const d = Math.abs(Math.sin((u + w) * Math.PI));
  const core = Math.pow(1 - Math.min(1, d / (width * (0.5 + fbm(x / 90, y / 90, seed + 2)))), 2.2);
  return core * smooth(0.38, 0.62, fbm(x / 130, y / 130, seed + 3));
}

/** Darkness of the veining at (x, y), 0 (clear stone) to 1. */
export function screenStone(x: number, y: number, seed: number): number {
  const main = veins(x, y, seed, -32, 330, 420, 1.1, 0.045);
  const halo = veins(x, y, seed, -32, 330, 420, 1.1, 0.25) * 0.22;
  const second = veins(x, y, seed + 40, -58, 140, 260, 0.9, 0.03) * 0.55;
  const third = veins(x, y, seed + 80, 12, 75, 160, 0.8, 0.025) * 0.3;
  const cloud = (fbm(x / 60, y / 60, seed + 3) - 0.47) * 0.36 + (fbm(x / 14, y / 14, seed + 4) - 0.47) * 0.1;
  return Math.max(0, Math.min(1, Math.max(main, second, third) + halo + cloud));
}

/** An 8-bit gray marble ground, w × h pixels, rows top to bottom. */
export function marbleScreen(w: number, h: number, tone: ScreenTone = 'marble-dark'): Uint8Array {
  return marbleRows(w, h, tone, 0, h);
}

/** Rows y0 … y1 − 1 of the same ground: each pixel depends on its place alone, so parts made apart join into the whole. */
export function marbleRows(w: number, h: number, tone: ScreenTone, y0: number, y1: number): Uint8Array {
  const out = new Uint8Array(w * (y1 - y0));
  const k = SPAN / Math.max(w, h);
  const dark = tone === 'marble-dark';
  const seed = dark ? 23 : 11;
  for (let y = y0; y < y1; y++) {
    const ny = (y + 0.5) / h - 0.5;
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5) / w - 0.5;
      const v = screenStone((x + 0.5) * k, (y + 0.5) * k, seed);
      const r2 = (nx * nx + ny * ny) / 0.5;
      const g = dark ? (18 + 70 * v) * (1 - 0.35 * r2) : (246 - 70 * v) * (1 - 0.06 * r2);
      out[(y - y0) * w + x] = Math.max(0, Math.min(255, Math.round(g)));
    }
  }
  return out;
}
