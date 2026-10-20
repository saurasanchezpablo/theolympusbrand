// The marble lithophane: a thin disc whose thickness carries the crest and a
// marble veining. Unlit it is a pale relief; held to the light, thick places
// stay dark and thin places glow — white plastic turns into backlit stone.
//
// Everything is deterministic: the veining is seeded noise (no randomness),
// the mark is rasterised by an exact scanline fill, and the disc is a polar
// heightfield whose edge is a true circle.

import earcut, { refine } from 'earcut';
import type { Ring } from '../geometry/math.ts';
import type { Mesh } from './mesh.ts';

/* ---------------------------------------------------------------- */
/* Marble veining                                                     */
/* ---------------------------------------------------------------- */

function hash(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function fbm(x: number, y: number, seed: number, octaves = 5): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * f, y * f, seed + i * 101);
    amp *= 0.5;
    f *= 2.03;
  }
  return sum;
}

/**
 * Darkness of the veining at (x, y) mm, 0 (clear stone) to 1 (a dark vein):
 * long warped veins at a diagonal, finer secondary veins, a faint cloudiness.
 */
export function marble(x: number, y: number, seed = 11): number {
  const a = (-32 * Math.PI) / 180;
  const u = (x * Math.cos(a) + y * Math.sin(a)) / 26;
  const warp = fbm(x / 22, y / 22, seed) * 5.2;
  const main = Math.abs(Math.sin((u + warp) * Math.PI));
  const veins = Math.pow(1 - Math.min(1, main / 0.12), 2);
  const fine = Math.pow(1 - Math.min(1, Math.abs(Math.sin((u * 2.7 + fbm(x / 9, y / 9, seed + 7) * 3.1) * Math.PI)) / 0.06), 2) * 0.45;
  const cloud = fbm(x / 14, y / 14, seed + 3) * 0.22;
  return Math.min(1, veins + fine + cloud);
}

/* ---------------------------------------------------------------- */
/* Coverage raster of a mark                                          */
/* ---------------------------------------------------------------- */

export type Raster = { data: Float32Array; size: number; px: number; origin: number };

/**
 * Coverage (0–1) of rings over a square grid centred on the origin, by an
 * exact nonzero scanline fill at 4 × 4 samples per pixel.
 */
export function rasterise(rings: Ring[], halfWidth: number, px: number): Raster {
  const size = Math.ceil((2 * halfWidth) / px);
  const data = new Float32Array(size * size);
  const S = 4;
  const origin = -halfWidth;
  // Edges as [yLow, yHigh, x at yLow, dx/dy, winding], sorted by yLow.
  const edges: [number, number, number, number, number][] = [];
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const [x0, y0] = r[i];
      const [x1, y1] = r[(i + 1) % r.length];
      if (y0 === y1) continue;
      const [ya, yb, xa, xb, w] = y0 < y1 ? [y0, y1, x0, x1, 1] : [y1, y0, x1, x0, -1];
      edges.push([ya, yb, xa, (xb - xa) / (yb - ya), w]);
    }
  }
  edges.sort((p, q) => p[0] - q[0]);
  let next = 0;
  let active: typeof edges = [];
  // Sweep sample rows from the bottom of the square (y = −halfWidth) upwards.
  for (let row = 0; row < size * S; row++) {
    const y = origin + ((row + 0.5) * px) / S;
    while (next < edges.length && edges[next][0] <= y) active.push(edges[next++]);
    active = active.filter((e) => e[1] > y);
    if (!active.length) continue;
    const xs = active.map((e): [number, number] => [e[2] + (y - e[0]) * e[3], e[4]]).sort((p, q) => p[0] - q[0]);
    // Image rows run top to bottom.
    const pyRow = (size - 1 - Math.floor(row / S)) * size;
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1];
      if (wind === 0) continue;
      const c0 = Math.max(0, Math.ceil(((xs[i][0] - origin) / px) * S - 0.5));
      const c1 = Math.min(size * S - 1, Math.floor(((xs[i + 1][0] - origin) / px) * S - 0.5));
      for (let c = c0; c <= c1; c++) data[pyRow + Math.floor(c / S)] += 1 / (S * S);
    }
  }
  return { data, size, px, origin };
}

/** Bilinear coverage at (x, y) mm. */
export function sample(r: Raster, x: number, y: number): number {
  const fx = (x - r.origin) / r.px - 0.5;
  const fy = (-y - r.origin) / r.px - 0.5;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= r.size || j >= r.size ? 0 : r.data[j * r.size + i]);
  return at(ix, iy) * (1 - tx) * (1 - ty) + at(ix + 1, iy) * tx * (1 - ty) + at(ix, iy + 1) * (1 - tx) * ty + at(ix + 1, iy + 1) * tx * ty;
}

/* ---------------------------------------------------------------- */
/* The lithophane                                                     */
/* ---------------------------------------------------------------- */

export type LithophaneSpec = {
  diameter: number;
  frame: number;
  minThickness: number;
  maxThickness: number;
  resolution: number;
  /** 0–1: how strongly the veining shows. */
  veins: number;
};

/** Thickness (mm) at a point inside the picture. */
export function thicknessAt(spec: LithophaneSpec, mark: Raster, x: number, y: number): number {
  const m = Math.min(1, sample(mark, x, y));
  const v = marble(x, y) * spec.veins;
  // The design reads darkest; the veining sits in the middle tones.
  const dark = Math.min(1, Math.max(m * 0.95, 0.06 + v * 0.62));
  return spec.minThickness + dark * (spec.maxThickness - spec.minThickness);
}

/**
 * The disc as a closed polar heightfield: a centre vertex, concentric rings of
 * vertices one resolution step apart, zipped together; a flat bottom; a
 * cylindrical edge. Returns the mesh and its exact volume.
 */
export function lithophaneMesh(spec: LithophaneSpec, mark: Raster): { mesh: Mesh; volume: number } {
  const R = spec.diameter / 2;
  const K = Math.max(8, Math.round(R / spec.resolution));
  const step = R / K;
  const inner = R - spec.frame;
  const height = (x: number, y: number, r: number) => (r > inner + 1e-9 ? spec.maxThickness : thicknessAt(spec, mark, x, y));
  const positions: number[] = [];
  const triangles: number[] = [];
  const rings: number[][] = [];
  const angles: number[][] = [];
  positions.push(0, 0, height(0, 0, 0));
  for (let k = 1; k <= K; k++) {
    const r = k * step;
    const n = Math.max(8, Math.ceil((2 * Math.PI * r) / step));
    const idx: number[] = [];
    const ang: number[] = [];
    for (let j = 0; j < n; j++) {
      const t = (2 * Math.PI * j) / n;
      const x = r * Math.cos(t);
      const y = r * Math.sin(t);
      idx.push(positions.length / 3);
      ang.push(t);
      positions.push(x, y, height(x, y, r));
    }
    rings.push(idx);
    angles.push(ang);
  }
  // Top: a fan at the centre, then zip each ring to the next (anticlockwise from above).
  const first = rings[0];
  for (let j = 0; j < first.length; j++) triangles.push(0, first[j], first[(j + 1) % first.length]);
  for (let k = 0; k + 1 < rings.length; k++) {
    const a = rings[k];
    const b = rings[k + 1];
    const ta = angles[k];
    const tb = angles[k + 1];
    let i = 0;
    let j = 0;
    while (i < a.length || j < b.length) {
      const nextA = i < a.length ? (i + 1 < a.length ? ta[i + 1] : 2 * Math.PI) : Infinity;
      const nextB = j < b.length ? (j + 1 < b.length ? tb[j + 1] : 2 * Math.PI) : Infinity;
      if (nextB <= nextA) {
        triangles.push(a[i % a.length], b[j % b.length], b[(j + 1) % b.length]);
        j++;
      } else {
        triangles.push(a[i % a.length], b[j % b.length], a[(i + 1) % a.length]);
        i++;
      }
    }
  }
  // Exact volume: each top triangle stands on the bed as a prism.
  let volume = 0;
  const P = positions;
  for (let t = 0; t < triangles.length; t += 3) {
    const [p, q, r] = [triangles[t] * 3, triangles[t + 1] * 3, triangles[t + 2] * 3];
    const area = ((P[q] - P[p]) * (P[r + 1] - P[p + 1]) - (P[r] - P[p]) * (P[q + 1] - P[p + 1])) / 2;
    volume += (area * (P[p + 2] + P[q + 2] + P[r + 2])) / 3;
  }
  // Edge and bottom.
  const outer = rings[rings.length - 1];
  const bottom = outer.map((v) => {
    positions.push(P[v * 3], P[v * 3 + 1], 0);
    return positions.length / 3 - 1;
  });
  for (let j = 0; j < outer.length; j++) {
    const j1 = (j + 1) % outer.length;
    triangles.push(bottom[j], bottom[j1], outer[j1], bottom[j], outer[j1], outer[j]);
  }
  const flat: number[] = [];
  for (const v of bottom) flat.push(positions[v * 3], positions[v * 3 + 1]);
  const idx = earcut(flat);
  refine(idx, flat);
  for (let t = 0; t < idx.length; t += 3) triangles.push(bottom[idx[t]], bottom[idx[t + 2]], bottom[idx[t + 1]]);
  return { mesh: { positions, triangles }, volume };
}

/**
 * A simulation of the lithophane held to a light (RGBA, R = G = B): light
 * through plastic falls off exponentially with thickness.
 */
export function backlit(spec: LithophaneSpec, mark: Raster, size: number, background = 24): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const R = spec.diameter / 2;
  const k = 1.25; // per mm, white PLA, roughly
  const tMin = Math.exp(-k * spec.maxThickness);
  const tMax = Math.exp(-k * spec.minThickness);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = ((px + 0.5) / size - 0.5) * 2 * R * 1.04;
      const y = (0.5 - (py + 0.5) / size) * 2 * R * 1.04;
      const r = Math.hypot(x, y);
      let g = background;
      if (r <= R) {
        const t = r > R - spec.frame ? spec.maxThickness : thicknessAt(spec, mark, x, y);
        const light = (Math.exp(-k * t) - tMin) / (tMax - tMin);
        g = Math.round(28 + 227 * Math.pow(light, 0.85));
      }
      const o = 4 * (py * size + px);
      out[o] = out[o + 1] = out[o + 2] = g;
      out[o + 3] = 255;
    }
  }
  return out;
}

/** The thickness as a grayscale heightmap (white = thickest), for OpenSCAD's surface(). */
export function heightmap(spec: LithophaneSpec, mark: Raster, size: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const R = spec.diameter / 2 - spec.frame;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = ((px + 0.5) / size - 0.5) * 2 * R;
      const y = (0.5 - (py + 0.5) / size) * 2 * R;
      const t = thicknessAt(spec, mark, x, y);
      const g = Math.round((255 * (t - spec.minThickness)) / (spec.maxThickness - spec.minThickness));
      const o = 4 * (py * size + px);
      out[o] = out[o + 1] = out[o + 2] = g;
      out[o + 3] = 255;
    }
  }
  return out;
}
