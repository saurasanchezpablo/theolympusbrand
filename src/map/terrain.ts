// The island of the map: Mount Olympus rising from a dark sea, its ridges and
// valleys from seeded noise. Made once, when the site is built, and carried to
// the browser as a compact height file; levelled under each building there.

import { gradientNoise } from './noise.ts';

/**
 * The map: `size` map units square, sampled on a res × res grid; the island's
 * shape drawn at `scale` (larger than the approved sketch, to give 150
 * buildings room); buildings drawn at `buildingScale` of their catalogue size.
 */
export const MAP = { size: 500, res: 625, seed: 1337, sea: 0, scale: 1.4, buildingScale: 0.6 } as const;

/** Heights on a res × res grid covering size × size map units, centred on the origin; row by row along z. */
export type Terrain = { size: number; res: number; heights: Float32Array };

/** The land's height at a point, before any terrace: a domain-warped island, the massif, its ridges and hills. */
function landHeight(n: ReturnType<typeof gradientNoise>, x: number, z: number): number {
  x /= MAP.scale;
  z /= MAP.scale;
  const wx = x + n.fbm(x * 0.008 + 11, z * 0.008 + 3, 4) * 40;
  const wz = z + n.fbm(x * 0.008 + 7, z * 0.008 + 19, 4) * 40;
  const r = Math.hypot(wx, wz * 1.15) / 150;
  const island = Math.max(0, 1 - r * r);
  const massif = Math.exp(-((x - 4) ** 2 + (z + 6) ** 2) / (2 * 46 ** 2));
  const range = n.ridged(wx * 0.011, wz * 0.011);
  const hills = n.fbm(wx * 0.03, wz * 0.03, 5) * 0.5 + 0.5;
  return island * (6 + hills * 10) + massif * (34 + range * 46) + island * range * 14 - 9;
}

export function makeTerrain(): Terrain {
  const { size, res, seed } = MAP;
  const n = gradientNoise(seed);
  const heights = new Float32Array(res * res);
  for (let j = 0; j < res; j++) {
    const z = -size / 2 + (size * j) / (res - 1);
    for (let i = 0; i < res; i++) heights[j * res + i] = landHeight(n, -size / 2 + (size * i) / (res - 1), z);
  }
  return { size, res, heights };
}

/** The height at any point (bilinear between grid points; the edge beyond the map). */
export function heightAt(t: Terrain, x: number, z: number): number {
  const f = (v: number) => Math.min(t.res - 1, Math.max(0, ((v + t.size / 2) / t.size) * (t.res - 1)));
  const gx = f(x),
    gz = f(z);
  const i = Math.min(t.res - 2, Math.floor(gx)),
    j = Math.min(t.res - 2, Math.floor(gz));
  const u = gx - i,
    v = gz - j;
  const h = (a: number, b: number) => t.heights[b * t.res + a];
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
}

/** How steep the land is at a point: the largest height difference one unit away. */
export function slopeAt(t: Terrain, x: number, z: number): number {
  const h = heightAt(t, x, z);
  return Math.max(Math.abs(heightAt(t, x + 1, z) - h), Math.abs(heightAt(t, x - 1, z) - h), Math.abs(heightAt(t, x, z + 1) - h), Math.abs(heightAt(t, x, z - 1) - h));
}

/** The island as bytes: "OLYT", res (u32), size, min, max (f32), then each height as a u16 between min and max. */
export function encodeTerrain(t: Terrain): Uint8Array {
  let min = Infinity,
    max = -Infinity;
  for (const v of t.heights) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const out = new Uint8Array(20 + t.heights.length * 2);
  const dv = new DataView(out.buffer);
  out.set([79, 76, 89, 84], 0);
  dv.setUint32(4, t.res, true);
  dv.setFloat32(8, t.size, true);
  dv.setFloat32(12, min, true);
  dv.setFloat32(16, max, true);
  const span = max - min || 1;
  for (let i = 0; i < t.heights.length; i++) dv.setUint16(20 + i * 2, Math.round(((t.heights[i] - min) / span) * 65535), true);
  return out;
}

export function decodeTerrain(bytes: Uint8Array): Terrain {
  if (bytes.length < 20 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'OLYT') throw new Error('not a map terrain file');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const res = dv.getUint32(4, true);
  if (bytes.length !== 20 + res * res * 2) throw new Error('map terrain file of the wrong length');
  const size = dv.getFloat32(8, true),
    min = dv.getFloat32(12, true),
    max = dv.getFloat32(16, true);
  const heights = new Float32Array(res * res);
  for (let i = 0; i < heights.length; i++) heights[i] = min + (dv.getUint16(20 + i * 2, true) / 65535) * (max - min);
  return { size, res, heights };
}

/** The land levelled under each building: flat within r of its centre, blending back to the land by 2.2 r. */
export function withTerraces(t: Terrain, sites: readonly { x: number; z: number; r: number }[]): Terrain {
  const heights = new Float32Array(t.heights);
  const step = t.size / (t.res - 1);
  for (const s of sites) {
    const level = heightAt(t, s.x, s.z);
    const reach = s.r * 2.2;
    const i0 = Math.max(0, Math.floor((s.x - reach + t.size / 2) / step)),
      i1 = Math.min(t.res - 1, Math.ceil((s.x + reach + t.size / 2) / step));
    const j0 = Math.max(0, Math.floor((s.z - reach + t.size / 2) / step)),
      j1 = Math.min(t.res - 1, Math.ceil((s.z + reach + t.size / 2) / step));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(-t.size / 2 + i * step - s.x, -t.size / 2 + j * step - s.z);
        if (d >= reach) continue;
        const k = Math.min(1, Math.max(0, (d - s.r) / (reach - s.r)));
        const e = k * k * (3 - 2 * k);
        const idx = j * t.res + i;
        heights[idx] = level + (heights[idx] - level) * e;
      }
  }
  return { size: t.size, res: t.res, heights };
}
