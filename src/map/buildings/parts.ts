// The parts of Greek architecture the map's buildings are made of: steps,
// fluted columns of the three orders, entablatures, gables with their tiles,
// domes, arcades, walls, stairs and statues. Each part adds its pieces to a
// Builder, which merges them into one geometry — one mesh per building, in
// the one marble material. Units are the map's; a building stands at the
// origin on y = 0. Everything is deterministic: no randomness at all.
//
// "near" is the full detail; "far" is what a building looks like from across
// the island — the same masses, without flutes, triglyphs or tiles.

import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, ExtrudeGeometry, IcosahedronGeometry, LatheGeometry, Path, Shape, SphereGeometry, TorusGeometry, Vector2, CapsuleGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Detail = 'near' | 'far';
export type Order = 'doric' | 'ionic' | 'corinthian';

export class Builder {
  private parts: BufferGeometry[] = [];
  add(g: BufferGeometry): void {
    this.parts.push(g);
  }
  /** One geometry: positions and normals only, not indexed, with its bounding box. */
  finish(): BufferGeometry {
    const clean = this.parts.map((p) => {
      const g = p.index ? p.toNonIndexed() : p;
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      return g;
    });
    this.parts = [];
    const merged = mergeGeometries(clean, false);
    if (!merged) throw new Error('the parts could not be merged');
    merged.computeBoundingBox();
    return merged;
  }
}

const put = (b: Builder, g: BufferGeometry, x = 0, y = 0, z = 0, ry = 0) => {
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  b.add(g);
};

/** A box standing on y (its base at y). */
export function box(b: Builder, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0): void {
  put(b, new BoxGeometry(w, h, d), x, y + h / 2, z, ry);
}

/** A cylinder standing on y. */
export function cylinder(b: Builder, rTop: number, rBottom: number, h: number, x: number, y: number, z: number, segments = 24): void {
  put(b, new CylinderGeometry(rTop, rBottom, h, segments), x, y + h / 2, z);
}

/**
 * A column standing on y, height h, lower radius r: the shaft fluted (16
 * flutes, with entasis) and its capital — Doric: echinus and abacus; Ionic:
 * a base and four volutes; Corinthian: a base, a bell of two rings of leaves
 * and corner volutes.
 */
export function column(b: Builder, x: number, y: number, z: number, h: number, r: number, order: Order, detail: Detail, flutes = 16): void {
  const top = r * 0.84;
  if (detail === 'far') {
    put(b, new CylinderGeometry(top, r, h * 0.9, 6), x, y + h * 0.45, z);
    put(b, new BoxGeometry(top * 2.8, h * 0.1, top * 2.8), x, y + h * 0.95, z);
    return;
  }
  const prof: Vector2[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    prof.push(new Vector2(r * (1 - 0.16 * t) * (1 + 0.04 * Math.sin(Math.PI * t)), t * h * 0.88));
  }
  const shaft = new LatheGeometry(prof, flutes * 3);
  const p = shaft.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const k = 1 - 0.055 * (0.5 + 0.5 * Math.cos(a * flutes));
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  shaft.computeVertexNormals();
  put(b, shaft, x, y, z);
  const capY = y + h * 0.88;
  if (order === 'doric') {
    put(b, new LatheGeometry([new Vector2(top, 0), new Vector2(top * 1.05, 0.06 * h), new Vector2(top * 1.32, 0.09 * h), new Vector2(top * 1.38, 0.1 * h)], 28), x, capY, z);
    box(b, top * 2.9, h * 0.04, top * 2.9, x, y + h * 0.98, z);
    return;
  }
  // Ionic and Corinthian columns stand on a moulded base.
  const torus = new TorusGeometry(r * 1.02, r * 0.16, 6, 20);
  torus.rotateX(Math.PI / 2);
  put(b, torus, x, y + r * 0.16, z);
  put(b, new CylinderGeometry(r * 1.25, r * 1.25, r * 0.22, 28), x, y + r * 0.11, z);
  if (order === 'ionic') {
    put(b, new CylinderGeometry(top * 1.15, top, h * 0.05, 24), x, capY + h * 0.025, z);
    // Volutes: a scroll at each end of the capital, front and back.
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const v = new TorusGeometry(top * 0.42, top * 0.12, 5, 12, Math.PI * 1.75);
        put(b, v, x + sx * top * 1.05, capY + h * 0.04, z + sz * top * 0.55);
      }
    box(b, top * 2.9, h * 0.03, top * 1.6, x, capY + h * 0.08, z);
    box(b, top * 2.6, h * 0.025, top * 2.6, x, y + h * 0.975, z);
    return;
  }
  // Corinthian: the bell, two rings of acanthus leaves, small corner volutes, a concave abacus.
  put(b, new LatheGeometry([new Vector2(top, 0), new Vector2(top * 1.02, h * 0.06), new Vector2(top * 1.25, h * 0.1)], 24), x, capY, z);
  for (let ring = 0; ring < 2; ring++)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + ring * (Math.PI / 8);
      const leaf = new IcosahedronGeometry(top * 0.42, 0);
      leaf.scale(0.55, 1.15 - ring * 0.15, 0.4);
      leaf.rotateZ(-0.35);
      leaf.rotateY(-a);
      put(b, leaf, x + Math.cos(a) * top * (0.95 + ring * 0.12), capY + h * (0.025 + ring * 0.04), z + Math.sin(a) * top * (0.95 + ring * 0.12));
    }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    put(b, new TorusGeometry(top * 0.22, top * 0.07, 6, 14, Math.PI * 1.5), x + Math.cos(a) * top * 1.2, capY + h * 0.085, z + Math.sin(a) * top * 1.2, -a);
  }
  box(b, top * 2.8, h * 0.03, top * 2.8, x, y + h * 0.97, z);
}

/** Steps under a building: `steps` courses, each `rise` high and stepping in by `run`. Returns the top. */
export function crepidoma(b: Builder, w: number, d: number, steps: number, x: number, y: number, z: number, rise = 0.32, run = 0.5): number {
  for (let i = 0; i < steps; i++) box(b, w + (steps - i) * run * 2, rise, d + (steps - i) * run * 2, x, y + i * rise, z);
  return y + steps * rise;
}

/** Architrave, frieze (triglyphs, or a continuous band) and cornice around a w × d rectangle. Returns the top. */
export function entablature(b: Builder, w: number, d: number, x: number, y: number, z: number, frieze: 'triglyph' | 'continuous', detail: Detail, every = 1.6): number {
  box(b, w, 0.55, d, x, y, z);
  box(b, w - 0.1, 0.6, d - 0.1, x, y + 0.55, z);
  if (detail === 'near') {
    if (frieze === 'triglyph') {
      for (const [len, axis] of [[w, 'x'], [d, 'z']] as const) {
        const n = Math.max(2, Math.round(len / every));
        for (let i = 0; i <= n; i++) {
          const t = -len / 2 + (len * i) / n;
          for (const side of [-1, 1]) {
            if (axis === 'x') box(b, 0.42, 0.6, 0.08, x + t, y + 0.55, z + side * (d / 2 - 0.02));
            else box(b, 0.08, 0.6, 0.42, x + side * (w / 2 - 0.02), y + 0.55, z + t);
          }
        }
      }
    } else {
      // A continuous frieze: a fine moulding above and below the band.
      box(b, w + 0.12, 0.08, d + 0.12, x, y + 0.55, z);
      box(b, w + 0.12, 0.08, d + 0.12, x, y + 1.07, z);
    }
    // Dentils under the cornice.
    const n = Math.max(4, Math.round(w / 0.5));
    for (let i = 0; i <= n; i++) for (const side of [-1, 1]) box(b, 0.18, 0.12, 0.18, x - w / 2 + (w * i) / n, y + 1.03, z + side * (d / 2 + 0.05));
  }
  box(b, w + 0.5, 0.3, d + 0.5, x, y + 1.15, z);
  return y + 1.45;
}

/** A gabled roof on y: raking cornices, tiles and acroteria when near; the ridge runs along `along`. */
export function gable(b: Builder, w: number, d: number, x: number, y: number, z: number, pitch: number, along: 'x' | 'z', detail: Detail): void {
  const shape = new Shape();
  shape.moveTo(-w / 2 - 0.25, 0);
  shape.lineTo(w / 2 + 0.25, 0);
  shape.lineTo(0, w * pitch);
  shape.closePath();
  const roof = new ExtrudeGeometry(shape, { depth: d + 0.5, bevelEnabled: false, curveSegments: 1 });
  roof.translate(0, 0, -(d + 0.5) / 2);
  if (along === 'x') roof.rotateY(Math.PI / 2);
  put(b, roof, x, y, z);
  if (detail === 'far') return;
  const len = Math.hypot(w / 2 + 0.25, w * pitch);
  const ang = Math.atan2(w * pitch, w / 2 + 0.25);
  const onEnd = (g: BufferGeometry, end: number, lift = 0) => put(b, g, x + (along === 'x' ? end * (d / 2 + 0.3) : 0), y + lift, z + (along === 'z' ? end * (d / 2 + 0.3) : 0));
  for (const end of [-1, 1])
    for (const side of [-1, 1]) {
      const g = new BoxGeometry(len + 0.3, 0.22, 0.4);
      g.rotateZ(side * -ang);
      g.translate(side * (w / 4 + 0.06), (w * pitch) / 2 + 0.1, 0);
      if (along === 'x') g.rotateY(Math.PI / 2);
      onEnd(g, end);
    }
  // Tiles: cover-tile ridges down both slopes.
  const rows = Math.max(1, Math.round(d / 0.7));
  for (let i = 0; i <= rows; i++) {
    const t = -d / 2 + (d * i) / rows;
    for (const side of [-1, 1]) {
      const g = new BoxGeometry(len, 0.08, 0.1);
      g.rotateZ(side * -ang);
      g.translate(side * (w / 4), (w * pitch) / 2 + 0.07, t);
      if (along === 'x') g.rotateY(Math.PI / 2);
      put(b, g, x, y, z);
    }
  }
  for (const end of [-1, 1]) onEnd(new ConeGeometry(0.35, 0.8, 6), end, w * pitch + 0.4);
}

/** Columns all round a w × d rectangle, at about `spacing` apart. */
export function peristyle(b: Builder, w: number, d: number, y: number, x: number, z: number, h: number, r: number, spacing: number, order: Order, detail: Detail): void {
  const cx = Math.max(2, Math.round(w / spacing) + 1),
    cz = Math.max(2, Math.round(d / spacing) + 1);
  for (let i = 0; i < cx; i++) for (const s of [-1, 1]) column(b, x - w / 2 + (w * i) / (cx - 1), y, z + (s * d) / 2, h, r, order, detail);
  for (let j = 1; j < cz - 1; j++) for (const s of [-1, 1]) column(b, x + (s * w) / 2, y, z - d / 2 + (d * j) / (cz - 1), h, r, order, detail);
}

/** A dome of radius r springing at y, flattened to `rise` of a hemisphere, with ribs when near. */
export function dome(b: Builder, r: number, y: number, ribs: number, detail: Detail, rise = 0.55): void {
  const g = new SphereGeometry(r, detail === 'near' ? 40 : 12, detail === 'near' ? 16 : 5, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, rise, 1);
  put(b, g, 0, y, 0);
  if (detail === 'far') return;
  for (let i = 0; i < ribs; i++) {
    const rib = new TorusGeometry(r, 0.07, 4, 24, Math.PI / 2);
    rib.scale(1, rise, 1);
    rib.rotateY((i / ribs) * Math.PI * 2);
    put(b, rib, 0, y, 0);
  }
}

/** A row of n round arches, each w wide, h high and d deep, along x, standing on y. */
export function arcade(b: Builder, w: number, h: number, d: number, n: number, x: number, y: number, z: number): void {
  const s = new Shape();
  s.moveTo((-w * n) / 2, 0);
  s.lineTo((w * n) / 2, 0);
  s.lineTo((w * n) / 2, h);
  s.lineTo((-w * n) / 2, h);
  s.closePath();
  for (let i = 0; i < n; i++) {
    const c = (-w * n) / 2 + w * (i + 0.5);
    const hole = new Path();
    hole.moveTo(c - w * 0.32, 0);
    hole.lineTo(c - w * 0.32, h - w * 0.55);
    hole.absarc(c, h - w * 0.55, w * 0.32, Math.PI, 0, true);
    hole.lineTo(c + w * 0.32, 0);
    s.holes.push(hole);
  }
  const g = new ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -d / 2);
  put(b, g, x, y, z);
}

/** A wall len long, h high, t thick, centred at (x, z), turned by ry; with merlons when crenellated. */
export function wall(b: Builder, len: number, h: number, t: number, x: number, y: number, z: number, ry: number, crenellated: boolean): void {
  box(b, len, h, t, x, y, z, ry);
  if (!crenellated) return;
  const n = Math.max(2, Math.floor(len / 1.3));
  for (let i = 0; i < n; i++) {
    const along = -len / 2 + (len * (i + 0.5)) / n;
    box(b, (len / n) * 0.55, h * 0.12 + 0.4, t * 1.05, x + Math.cos(ry) * along, y + h, z - Math.sin(ry) * along, ry);
  }
}

/** A flight of steps w wide rising along +z from (x, y, z), turned by ry. */
export function stair(b: Builder, w: number, steps: number, x: number, y: number, z: number, ry: number): void {
  for (let i = 0; i < steps; i++) {
    const g = new BoxGeometry(w, 0.3 * (i + 1), 0.5);
    g.translate(0, 0.15 * (i + 1), 0.25 + i * 0.5);
    put(b, g, x, y, z, ry);
  }
}

/** A standing figure h tall on a small plinth. */
export function statue(b: Builder, x: number, y: number, z: number, h: number): void {
  box(b, h * 0.45, h * 0.15, h * 0.45, x, y, z);
  put(b, new CapsuleGeometry(h * 0.13, h * 0.5, 4, 10), x, y + h * 0.15 + h * 0.38, z);
  put(b, new SphereGeometry(h * 0.1, 12, 8), x, y + h * 0.15 + h * 0.75, z);
}
