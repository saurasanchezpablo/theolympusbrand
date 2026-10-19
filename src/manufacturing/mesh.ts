// Solid meshes from stacked 2D layers ("2.5D"): every model here is a pile of
// flat slabs — a backing plate, a raised relief, a pocket — so it can be built
// exactly, without 3D booleans:
//
//   · each layer is a set of rings in millimetres (y up), extruded from z0 to z1;
//   · walls follow every ring of every layer;
//   · where two layers meet, the area one has and the other lacks becomes a
//     horizontal face (up where the lower layer is wider, down where the upper is);
//   · a ring present in both layers needs no face — its walls simply continue.
//
// Rings in a stack must never cross; the products guarantee that (marks are
// strictly simple and sit inside their plates). `validate` then checks the
// result as a printer would need it: closed, manifold, consistently outward.

import earcut, { refine } from 'earcut';
import { type Pt, type Ring, signedArea } from '../geometry/math.ts';
import { union } from '../geometry/poly.ts';

export type Vec3 = [number, number, number];
export type Mesh = { positions: number[]; triangles: number[] };
export type Layer = { rings: Ring[]; z0: number; z1: number };

const ringKey = (r: Ring) => {
  // Same ring regardless of start vertex and orientation.
  const pts = r.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`);
  const start = pts.indexOf([...pts].sort()[0]);
  const a = [...pts.slice(start), ...pts.slice(0, start)];
  const b = [a[0], ...a.slice(1).reverse()];
  return a.join(' ') < b.join(' ') ? a.join(' ') : b.join(' ');
};

function inside([x, y]: Pt, ring: Ring): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

type Box = [number, number, number, number];
const boxOf = (r: Ring): Box => {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of r) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
};

/**
 * Drop vertices closer than `eps` to their predecessor, and vertices lying on
 * the line through their neighbours: they make zero-area triangles. Clean each
 * ring once, before it is shared between layers, so every copy stays identical.
 */
export function cleanRing(r: Ring, eps = 1e-3): Ring {
  let pts = r;
  for (let pass = 0; pass < 8 && pts.length > 3; pass++) {
    const out: Ring = [];
    for (let i = 0; i < pts.length; i++) {
      const prev = out.length ? out[out.length - 1] : pts[pts.length - 1];
      const cur = pts[i];
      const next = pts[(i + 1) % pts.length];
      const lp = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      const ln = Math.hypot(next[0] - prev[0], next[1] - prev[1]);
      const off = ln > 0 ? Math.abs((cur[0] - prev[0]) * (next[1] - prev[1]) - (cur[1] - prev[1]) * (next[0] - prev[0])) / ln : 0;
      if (lp < eps || off < eps * 0.1) continue;
      out.push(cur);
    }
    if (out.length === pts.length) break;
    pts = out;
  }
  return pts;
}

export const cleanRings = (rings: Ring[], eps = 1e-3) => rings.map((r) => cleanRing(r, eps)).filter((r) => r.length >= 3 && Math.abs(signedArea(r)) > eps * eps * 10);

/** A face: an outer ring and its holes. `up` = the outer is anticlockwise (y up). */
export type Face = { outer: Ring; holes: Ring[]; up: boolean };

/**
 * Nest non-crossing rings into faces. Top-level rings are outers, their
 * children holes, their grandchildren outers again. A ring's orientation says
 * which way its face looks: anticlockwise up, clockwise down.
 */
export function nest(rings: Ring[]): Face[] {
  const items = rings
    .filter((r) => r.length >= 3)
    .map((r) => ({ r, a: signedArea(r), box: boxOf(r), parent: -1 }))
    .sort((p, q) => Math.abs(q.a) - Math.abs(p.a));
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    // A test point: a vertex that is not shared with the candidate parent.
    for (let j = i - 1; j >= 0; j--) {
      const p = items[j];
      const [x0, y0, x1, y1] = p.box;
      if (it.box[0] < x0 || it.box[1] < y0 || it.box[2] > x1 || it.box[3] > y1) continue;
      const own = new Set(p.r.map(([x, y]) => `${x},${y}`));
      const probe = it.r.find(([x, y]) => !own.has(`${x},${y}`));
      if (probe && inside(probe, p.r)) {
        it.parent = j;
        break;
      }
    }
  }
  const depth = (i: number): number => (items[i].parent < 0 ? 0 : 1 + depth(items[i].parent));
  const faces = new Map<number, Face>();
  items.forEach((it, i) => {
    if (depth(i) % 2 === 0) faces.set(i, { outer: it.r, holes: [], up: it.a > 0 });
  });
  items.forEach((it, i) => {
    if (depth(i) % 2 === 1) {
      const f = faces.get(it.parent)!;
      if (it.a > 0 === f.up) throw new Error('mesh: overlapping regions in one layer interface');
      f.holes.push(it.r);
    }
  });
  return [...faces.values()];
}

/** Rings with anticlockwise outers and clockwise holes (as `nest` reads them) for a set of solids. */
export const area = (rings: Ring[]) => rings.reduce((s, r) => s + signedArea(r), 0);

/**
 * Split every triangle whose edge passes through another vertex of the face.
 * Ear clipping can leave such T-junctions where vertices of different rings
 * line up exactly (column feet on one baseline, rack bars in a row); the
 * walls meet those vertices, so the face must too.
 */
function splitTJunctions(idx: number[], flat: number[]): number[] {
  const n = flat.length / 2;
  const cell = 2;
  const grid = new Map<string, number[]>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  for (let i = 0; i < n; i++) {
    const k = key(Math.floor(flat[2 * i] / cell), Math.floor(flat[2 * i + 1] / cell));
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  }
  const onEdge = (a: number, b: number): number => {
    const [ax, ay, bx, by] = [flat[2 * a], flat[2 * a + 1], flat[2 * b], flat[2 * b + 1]];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let best = -1;
    let bestT = 2;
    for (let cx = Math.floor(Math.min(ax, bx) / cell); cx <= Math.floor(Math.max(ax, bx) / cell); cx++) {
      for (let cy = Math.floor(Math.min(ay, by) / cell); cy <= Math.floor(Math.max(ay, by) / cell); cy++) {
        for (const i of grid.get(key(cx, cy)) ?? []) {
          if (i === a || i === b) continue;
          const px = flat[2 * i] - ax;
          const py = flat[2 * i + 1] - ay;
          const t = (px * dx + py * dy) / len2;
          if (t <= 1e-9 || t >= 1 - 1e-9) continue;
          if (Math.abs(px * dy - py * dx) > 1e-9 * Math.sqrt(len2)) continue;
          if (t < bestT) {
            bestT = t;
            best = i;
          }
        }
      }
    }
    return best;
  };
  const out: number[] = [];
  const queue = [...idx];
  while (queue.length) {
    const c = queue.pop()!;
    const b = queue.pop()!;
    const a = queue.pop()!;
    const tri = [a, b, c];
    let split = false;
    for (let e = 0; e < 3 && !split; e++) {
      const [p, q, r] = [tri[e], tri[(e + 1) % 3], tri[(e + 2) % 3]];
      const m = onEdge(p, q);
      if (m >= 0) {
        queue.push(p, m, r, m, q, r);
        split = true;
      }
    }
    if (!split) out.push(a, b, c);
  }
  return out;
}

class Builder {
  positions: number[] = [];
  triangles: number[] = [];
  private index = new Map<string, number>();

  vertex(x: number, y: number, z: number): number {
    const key = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
    let i = this.index.get(key);
    if (i === undefined) {
      i = this.positions.length / 3;
      this.positions.push(x, y, z);
      this.index.set(key, i);
    }
    return i;
  }

  tri(a: number, b: number, c: number) {
    if (a !== b && b !== c && a !== c) this.triangles.push(a, b, c);
  }

  /** A horizontal face at z, looking up (+z) or down. */
  face(f: Face, z: number, up: boolean) {
    const rings = [f.outer, ...f.holes];
    const flat: number[] = [];
    const holes: number[] = [];
    for (const r of rings) {
      if (r !== f.outer) holes.push(flat.length / 2);
      for (const [x, y] of r) flat.push(x, y);
    }
    const idx = earcut(flat, holes);
    // Lawson flips toward the constrained Delaunay triangulation: removes the
    // zero-area slivers ear clipping can leave along hole bridges.
    refine(idx, flat);
    const tris = splitTJunctions(idx, flat);
    const v = (k: number) => this.vertex(flat[2 * k], flat[2 * k + 1], z);
    for (let t = 0; t < tris.length; t += 3) {
      const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
      const ccw = (flat[2 * b] - flat[2 * a]) * (flat[2 * c + 1] - flat[2 * a + 1]) - (flat[2 * c] - flat[2 * a]) * (flat[2 * b + 1] - flat[2 * a + 1]) > 0;
      if (ccw === up) this.tri(v(a), v(b), v(c));
      else this.tri(v(a), v(c), v(b));
    }
  }

  /** Walls along a ring from z0 to z1, facing away from the solid (anticlockwise = outer). */
  wall(r: Ring, z0: number, z1: number) {
    for (let i = 0; i < r.length; i++) {
      const [ax, ay] = r[i];
      const [bx, by] = r[(i + 1) % r.length];
      const a0 = this.vertex(ax, ay, z0);
      const b0 = this.vertex(bx, by, z0);
      const a1 = this.vertex(ax, ay, z1);
      const b1 = this.vertex(bx, by, z1);
      this.tri(a0, b0, b1);
      this.tri(a0, b1, a1);
    }
  }
}

/**
 * Build a closed solid from layers stacked bottom to top (each layer's z0 is
 * the previous layer's z1). Solid rings anticlockwise, holes clockwise.
 */
export function stack(layers: Layer[]): Mesh {
  const b = new Builder();
  layers.forEach((L, i) => {
    if (i > 0 && Math.abs(L.z0 - layers[i - 1].z1) > 1e-9) throw new Error('mesh: layers must touch');
  });
  // Bottom and top.
  for (const f of nest(layers[0].rings)) b.face(f, layers[0].z0, !f.up);
  const last = layers[layers.length - 1];
  for (const f of nest(last.rings)) b.face(f, last.z1, f.up);
  // Interfaces: what the lower layer has and the upper lacks looks up, and vice versa.
  for (let i = 0; i + 1 < layers.length; i++) {
    const lower = new Map(layers[i].rings.map((r) => [ringKey(r), r]));
    const upper = new Map(layers[i + 1].rings.map((r) => [ringKey(r), r]));
    const rings = [...[...lower].filter(([k]) => !upper.has(k)).map(([, r]) => r), ...[...upper].filter(([k]) => !lower.has(k)).map(([, r]) => [...r].reverse())];
    for (const f of nest(rings)) b.face(f, layers[i].z1, f.up);
  }
  for (const L of layers) for (const r of L.rings) b.wall(r, L.z0, L.z1);
  return { positions: b.positions, triangles: b.triangles };
}

/* ---------------------------------------------------------------- */
/* Validation                                                         */
/* ---------------------------------------------------------------- */

export type MeshReport = {
  ok: boolean;
  triangles: number;
  vertices: number;
  /** Edges not shared by exactly two triangles, or shared twice in the same direction. */
  badEdges: number;
  degenerate: number;
  /** Layers whose rings overlap one another (the solid would intersect itself). */
  overlaps: number;
  volume: number;
  expectedVolume: number;
  size: Vec3;
};

/** Signed volume (mm³) — positive when every triangle faces outwards. */
export function volume(m: Mesh): number {
  const p = m.positions;
  let v = 0;
  for (let t = 0; t < m.triangles.length; t += 3) {
    const [a, b, c] = [m.triangles[t] * 3, m.triangles[t + 1] * 3, m.triangles[t + 2] * 3];
    v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return v / 6;
}

export function bounds(m: Mesh): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i++) {
    const k = i % 3;
    min[k] = Math.min(min[k], m.positions[i]);
    max[k] = Math.max(max[k], m.positions[i]);
  }
  return { min, max };
}

/**
 * Check a solid: oriented 2-manifold (every edge used once each way), no
 * slivers, no self-intersection (each layer's rings are disjoint: their union
 * has the area of their sum), and the volume it was designed to have.
 */
export function validate(m: Mesh, layers: Layer[]): MeshReport {
  const expectedVolume = stackVolume(layers);
  const overlaps = layers.filter((L) => {
    const a = area(L.rings);
    return Math.abs(area(union(L.rings)) - a) > 1e-4 * Math.max(1, Math.abs(a));
  }).length;
  const edges = new Map<string, number>();
  let degenerate = 0;
  const p = m.positions;
  for (let t = 0; t < m.triangles.length; t += 3) {
    const tri = [m.triangles[t], m.triangles[t + 1], m.triangles[t + 2]];
    for (let e = 0; e < 3; e++) {
      const [a, b] = [tri[e], tri[(e + 1) % 3]];
      edges.set(`${a}>${b}`, (edges.get(`${a}>${b}`) ?? 0) + 1);
    }
    const [a, b, c] = tri.map((i) => [p[3 * i], p[3 * i + 1], p[3 * i + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]);
    if (n < 1e-10) degenerate++;
  }
  let badEdges = 0;
  for (const [k, n] of edges) {
    const [a, b] = k.split('>');
    if (n !== 1 || edges.get(`${b}>${a}`) !== 1) badEdges++;
  }
  const v = volume(m);
  const { min, max } = bounds(m);
  const ok = badEdges === 0 && degenerate === 0 && overlaps === 0 && v > 0 && Math.abs(v - expectedVolume) <= 1e-6 * Math.max(1, expectedVolume);
  return { ok, triangles: m.triangles.length / 3, vertices: p.length / 3, badEdges, degenerate, overlaps, volume: v, expectedVolume, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

/** The volume a stack should have: each layer's area times its height. */
export const stackVolume = (layers: Layer[]) => layers.reduce((s, L) => s + area(L.rings) * (L.z1 - L.z0), 0);
