// A small software renderer for the printable meshes: z-buffered, flat-shaded,
// grayscale, deterministic. It draws the real triangles that go into the STL —
// a preview of the model, not a mockup — for the command line (PNG) and the
// web app (canvas) alike.

import type { Mesh } from '../manufacturing/mesh.ts';

export type RenderPart = { mesh: Mesh; tone: 'light' | 'dark' };
export type View = { azimuth: number; elevation: number; width: number; height: number; background?: number; supersample?: number; margin?: number };

const BASE = { light: 222, dark: 70 } as const;

/** RGBA pixels (R = G = B) of the parts seen from the given angles. */
export function renderMeshes(parts: RenderPart[], view: View): Uint8ClampedArray {
  const ss = view.supersample ?? 2;
  const W = view.width * ss;
  const H = view.height * ss;
  const bg = view.background ?? 246;
  const az = (view.azimuth * Math.PI) / 180;
  const el = (view.elevation * Math.PI) / 180;

  // Bounds of everything, to centre and fit.
  let [x0, y0, z0, x1, y1, z1] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const { mesh } of parts) {
    const p = mesh.positions;
    for (let i = 0; i < p.length; i += 3) {
      x0 = Math.min(x0, p[i]);
      x1 = Math.max(x1, p[i]);
      y0 = Math.min(y0, p[i + 1]);
      y1 = Math.max(y1, p[i + 1]);
      z0 = Math.min(z0, p[i + 2]);
      z1 = Math.max(z1, p[i + 2]);
    }
  }
  const [cx, cy, cz] = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];

  // Camera: turn about z by the azimuth, then tilt down by the elevation.
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  const toView = (x: number, y: number, z: number): [number, number, number] => {
    const [px, py, pz] = [x - cx, y - cy, z - cz];
    const rx = ca * px - sa * py;
    const ry = sa * px + ca * py;
    // Screen x = rx; screen up = z·cos(el) + ry·sin(el); depth (towards viewer) = −ry·cos(el) + z·sin(el).
    return [rx, pz * ce + ry * se, -ry * ce + pz * se];
  };
  // Fit the projected outline to the frame.
  let [u0, v0, u1, v1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { mesh } of parts) {
    const p = mesh.positions;
    for (let i = 0; i < p.length; i += 3) {
      const [u, v] = toView(p[i], p[i + 1], p[i + 2]);
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
  }
  const margin = view.margin ?? 0.08;
  const scale = Math.min((W * (1 - 2 * margin)) / (u1 - u0 || 1), (H * (1 - 2 * margin)) / (v1 - v0 || 1));
  const [mu, mv] = [(u0 + u1) / 2, (v0 + v1) / 2];
  const light = normalise([-0.45, 0.55, 0.7]);
  const fill = normalise([0.6, -0.2, 0.4]);

  const zbuf = new Float32Array(W * H).fill(-Infinity);
  const shade = new Float32Array(W * H).fill(-1);

  for (const { mesh, tone } of parts) {
    const p = mesh.positions;
    const t = mesh.triangles;
    for (let i = 0; i < t.length; i += 3) {
      const a = toView(p[3 * t[i]], p[3 * t[i] + 1], p[3 * t[i] + 2]);
      const b = toView(p[3 * t[i + 1]], p[3 * t[i + 1] + 1], p[3 * t[i + 1] + 2]);
      const c = toView(p[3 * t[i + 2]], p[3 * t[i + 2] + 1], p[3 * t[i + 2] + 2]);
      const n = normalise(cross(sub(b, a), sub(c, a)));
      if (n[2] <= 0) continue; // facing away
      const lum = Math.min(1.08, 0.34 + 0.62 * Math.max(0, dot(n, light)) + 0.16 * Math.max(0, dot(n, fill)) + 0.2 * Math.pow(Math.max(0, dot(reflect(light, n), [0, 0, 1])), 24));
      const value = BASE[tone] * lum;
      // To pixels.
      const sx = (v: number[]) => W / 2 + (v[0] - mu) * scale;
      const sy = (v: number[]) => H / 2 - (v[1] - mv) * scale;
      const [ax, ay, bx, by, qx, qy] = [sx(a), sy(a), sx(b), sy(b), sx(c), sy(c)];
      const area = (bx - ax) * (qy - ay) - (qx - ax) * (by - ay);
      if (Math.abs(area) < 1e-9) continue;
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, qx)));
      const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, qx)));
      const minY = Math.max(0, Math.floor(Math.min(ay, by, qy)));
      const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, qy)));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((bx - px) * (qy - py) - (qx - px) * (by - py)) / area;
          const w1 = ((qx - px) * (ay - py) - (ax - px) * (qy - py)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
          const depth = w0 * a[2] + w1 * b[2] + w2 * c[2];
          const k = y * W + x;
          if (depth > zbuf[k]) {
            zbuf[k] = depth;
            shade[k] = value;
          }
        }
      }
    }
  }

  // Downsample to the output size.
  const out = new Uint8ClampedArray(view.width * view.height * 4);
  for (let y = 0; y < view.height; y++) {
    for (let x = 0; x < view.width; x++) {
      let sum = 0;
      for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) {
        const s = shade[(y * ss + dy) * W + x * ss + dx];
        sum += s < 0 ? bg : s;
      }
      const g = Math.round(sum / (ss * ss));
      const o = 4 * (y * view.width + x);
      out[o] = out[o + 1] = out[o + 2] = g;
      out[o + 3] = 255;
    }
  }
  return out;
}

type V = [number, number, number] | number[];
const sub = (a: V, b: V): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalise = (a: V): [number, number, number] => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const reflect = (l: V, n: V): [number, number, number] => {
  const d = 2 * dot(l, n);
  return [d * n[0] - l[0], d * n[1] - l[1], d * n[2] - l[2]];
};
