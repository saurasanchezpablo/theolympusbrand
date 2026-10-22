// The city drawn: every terrace, street and square a solid slab of stone at
// its own level — so where two levels meet, the slab's side is the retaining
// wall — walkways raised along the streets with their curbs, stepping stones
// at the crossings, the stoas round the agora, lamps, benches, fountains and
// trees; and, for the plots no service takes, the houses (fabric.ts).
//
// Surfaces carry their pattern in the shader, from world position: paving
// flagstones, walkway tiles, ashlar courses, the squares' great slabs — no
// texture to tile, the same stone at every distance. Grey only.

import { BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CityPlan, Lot, Rect } from '../../../../src/map/city.ts';
import type { House } from '../../../../src/map/fabric.ts';

// ---- the stone: one shader, several cuts ----

type Cut = 'avenue' | 'carriage' | 'lane' | 'walk' | 'square' | 'ashlar' | 'earth' | 'court' | 'field' | 'sand' | 'rampart';
const CUTS: Record<Cut, { tone: number; joint: number; size: [number, number]; vary: number; rough: number }> = {
  // The avenues: great pale slabs, the city's spine read from the air.
  avenue: { tone: 0.62, joint: 0.42, size: [1.7, 1.1], vary: 0.06, rough: 0.8 },
  // Long flagstones of the streets' roadways, laid across them.
  carriage: { tone: 0.46, joint: 0.3, size: [1.3, 0.75], vary: 0.07, rough: 0.9 },
  // The lanes: small dark setts.
  lane: { tone: 0.36, joint: 0.24, size: [0.6, 0.45], vary: 0.07, rough: 0.95 },
  // The walkways' small square slabs, paler.
  walk: { tone: 0.6, joint: 0.46, size: [0.62, 0.62], vary: 0.05, rough: 0.85 },
  // The squares: great marble slabs.
  square: { tone: 0.7, joint: 0.55, size: [1.8, 1.8], vary: 0.06, rough: 0.6 },
  // The terraces' walls: courses of ashlar.
  ashlar: { tone: 0.5, joint: 0.34, size: [1.15, 0.5], vary: 0.06, rough: 0.9 },
  // The city's wall: great blocks, darker with age.
  rampart: { tone: 0.42, joint: 0.27, size: [1.6, 0.7], vary: 0.07, rough: 0.95 },
  // The ground of a plot round its houses: beaten earth.
  earth: { tone: 0.3, joint: 0.3, size: [1, 1], vary: 0, rough: 1 },
  // A precinct's court: marble paving, finer than the squares'.
  court: { tone: 0.74, joint: 0.6, size: [1.1, 1.1], vary: 0.05, rough: 0.55 },
  // A sports ground: beaten earth, darker than the paving round it.
  field: { tone: 0.27, joint: 0.27, size: [1, 1], vary: 0, rough: 1 },
  // Its running track: pale sand.
  sand: { tone: 0.62, joint: 0.62, size: [1, 1], vary: 0, rough: 1 },
};

/** Stone cut to a pattern drawn from world position. Ashlar runs along the wall, its courses level. */
export function stone(cut: Cut): MeshStandardMaterial {
  const c = CUTS[cut];
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: c.rough, metalness: 0 });
  // three.js keys its compiled shaders by this function's text, the same for every cut: each cut needs a key of its own.
  m.customProgramCacheKey = () => `stone:${cut}`;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vNw;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz; vNw = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vW; varying vec3 vNw;
float hs(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ns(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hs(i), hs(i + vec2(1, 0)), f.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), f.x), f.y); }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
// On a side (a wall), the pattern runs along it and up; on a top, over the ground.
vec2 uv = abs(vNw.y) > 0.5 ? vW.xz : vec2(vW.x + vW.z, vW.y);
vec2 size = vec2(${c.size[0].toFixed(3)}, ${c.size[1].toFixed(3)});
vec2 g = uv / size;
// Courses offset by half a stone, row by row.
g.x += mod(floor(g.y), 2.0) * 0.5;
vec2 cell = floor(g), f = fract(g);
float tone = ${c.tone.toFixed(3)} + (hs(cell) - 0.5) * ${(c.vary * 2).toFixed(3)};
// Joints: thin, crisp at any distance.
vec2 fw = fwidth(g) * 1.2;
float joint = 1.0 - min(smoothstep(0.0, fw.x + 0.03, f.x) * smoothstep(0.0, fw.x + 0.03, 1.0 - f.x), smoothstep(0.0, fw.y + 0.04, f.y) * smoothstep(0.0, fw.y + 0.04, 1.0 - f.y));
// Wear: soft clouding over the stones.
float wear = ns(uv * 0.35) * 0.08 + ns(uv * 2.7) * 0.04;
float t = mix(tone, ${c.joint.toFixed(3)}, joint * ${cut === 'earth' || cut === 'field' || cut === 'sand' ? '0.0' : '0.85'}) - wear + 0.04;
diffuseColor.rgb = vec3(t);`,
      );
  };
  return m;
}

// ---- geometry: slabs and boxes, merged ----

/** Gathers quads into one geometry: positions and flat normals. */
class Mesher {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  /** A quad a, b, c, d (in order round it), facing `out`; grey g for vertex colours. */
  quad(a: number[], b: number[], c: number[], d: number[], out: number[], g = 1): void {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((k) => k / l);
    let pts = [a, b, c, d];
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) {
      pts = [a, d, c, b];
      n = n.map((k) => -k);
    }
    for (const [p, q, r] of [
      [pts[0], pts[1], pts[2]],
      [pts[0], pts[2], pts[3]],
    ]) {
      this.pos.push(...p, ...q, ...r);
      for (let k = 0; k < 3; k++) {
        this.nor.push(...n);
        this.col.push(g, g, g);
      }
    }
  }
  /**
   * A slab: four corners on the ground plan (in order round it), each with its
   * top height, down to one bottom height. Its top and its sides go to two meshers.
   */
  static slab(top: Mesher, sides: Mesher | null, corners: [number, number][], tops: number[], bottom: number): void {
    const t = corners.map(([x, z], k) => [x, tops[k], z]);
    top.quad(t[0], t[1], t[2], t[3], [0, 1, 0]);
    if (!sides) return;
    const cx = corners.reduce((a, c) => a + c[0], 0) / 4,
      cz = corners.reduce((a, c) => a + c[1], 0) / 4;
    for (let k = 0; k < 4; k++) {
      const [x0, z0] = corners[k],
        [x1, z1] = corners[(k + 1) % 4];
      const mx = (x0 + x1) / 2 - cx,
        mz = (z0 + z1) / 2 - cz;
      sides.quad([x0, tops[k], z0], [x1, tops[(k + 1) % 4], z1], [x1, bottom, z1], [x0, bottom, z0], [mx, 0, mz]);
    }
  }
  geometry(colours = false): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    if (colours) g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.computeBoundingSphere();
    return g;
  }
}

const rectCorners = ([x0, z0, x1, z1]: Rect): [number, number][] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

/** How deep slabs reach under their tops: below any land beside them. */
const DEPTH = 7;
/** How high a walkway stands over the roadway: its curb. */
const CURB = 0.15;

/** `fields`: each sports ground's track and banks, by its plot's id (f0, f1…) — hidden while a building stands on the ground. */
export type CityParts = { group: Group; fields: Map<string, Group>; dispose(): void };

/**
 * The city's stone, built once: terraces, streets with walkways and
 * crossings, squares, stoas, furniture. `fixture(type)` gives a catalogue
 * building's geometry (the stoas are drawn from it).
 */
export function buildCity(plan: CityPlan, fixture: (type: string) => BufferGeometry, scale: number, trees: { plane: BufferGeometry; cypress: BufferGeometry; olive: BufferGeometry }, ground: (x: number, z: number) => number): CityParts {
  const group = new Group();
  const mats: Material[] = [];
  const geos: BufferGeometry[] = [];
  const add = (geo: BufferGeometry, mat: Material, shadows = true) => {
    const m = new Mesh(geo, mat);
    m.castShadow = shadows;
    m.receiveShadow = true;
    group.add(m);
    geos.push(geo);
    if (!mats.includes(mat)) mats.push(mat);
    return m;
  };
  const tops = { avenue: new Mesher(), carriage: new Mesher(), lane: new Mesher(), walk: new Mesher(), square: new Mesher(), earth: new Mesher(), field: new Mesher() };
  const sides = new Mesher();

  // Terraces: every block a slab at its level (its plots' ground; houses and precincts stand on it).
  for (const l of plan.lots) if (l.part === 'whole' && l.district !== 'field') Mesher.slab(tops.earth, sides, rectCorners(l.rect), [l.ground, l.ground, l.ground, l.ground], l.ground - DEPTH);
  // Squares.
  for (const q of plan.squares) {
    const top = q.kind === 'field' || q.kind === 'grove' ? tops.field : tops.square;
    Mesher.slab(top, sides, rectCorners(q.rect), [q.level, q.level, q.level, q.level], q.level - DEPTH);
  }
  // Streets: the roadway a slab climbing from crossing to crossing; a walkway on each side, raised by its curb,
  // stopping at the roadways it crosses (the corners belong to the street along x).
  const crossWidth = new Map<string, number>();
  for (const s of plan.streets) {
    const A = plan.nodes[s.a],
      B = plan.nodes[s.b];
    const alongX = Math.abs(B.x - A.x) > Math.abs(B.z - A.z);
    for (const n of [s.a, s.b]) {
      const k = `${n}:${alongX ? 'x' : 'z'}`;
      crossWidth.set(k, Math.max(crossWidth.get(k) ?? 0, s.width));
    }
  }
  const stones: Matrix4[] = [];
  const m4 = new Matrix4();
  for (const s of plan.streets) {
    const [A, B] = [plan.nodes[s.a], plan.nodes[s.b]].sort((p, q) => p.x - q.x || p.z - q.z);
    const na = plan.nodes.indexOf(A),
      nb = plan.nodes.indexOf(B);
    const alongX = Math.abs(B.x - A.x) > Math.abs(B.z - A.z);
    const len = alongX ? B.x - A.x : B.z - A.z;
    const h = s.width / 2;
    const y = (t: number) => A.y + ((B.y - A.y) * t) / len;
    // The roadway (the whole width; its walkways sit on it).
    const corners: [number, number][] = alongX
      ? [
          [A.x, A.z - h],
          [B.x, B.z - h],
          [B.x, B.z + h],
          [A.x, A.z + h],
        ]
      : [
          [A.x - h, A.z],
          [A.x + h, A.z],
          [B.x + h, B.z],
          [B.x - h, B.z],
        ];
    Mesher.slab(s.rank === 'avenue' ? tops.avenue : s.rank === 'lane' ? tops.lane : tops.carriage, sides, corners, [y(0), alongX ? y(len) : y(0), alongX ? y(len) : y(len), alongX ? y(0) : y(len)], Math.min(A.y, B.y) - DEPTH);
    // The crossing streets' half widths at each end: a walkway stops at the roadway it meets.
    const otherA = (crossWidth.get(`${na}:${alongX ? 'z' : 'x'}`) ?? 0) / 2,
      otherB = (crossWidth.get(`${nb}:${alongX ? 'z' : 'x'}`) ?? 0) / 2;
    for (const side of [-1, 1]) {
      // Along x the walkway runs on through the corner (to the inner edge of the crossing street's walkway); along z it stops at the corner.
      const t0 = alongX ? (otherA ? otherA - walkOf(plan, na, 'z') : 0) : otherA,
        t1 = len - (alongX ? (otherB ? otherB - walkOf(plan, nb, 'z') : 0) : otherB);
      if (t1 - t0 < 0.3) continue;
      const o0 = side * (h - s.walk),
        o1 = side * h;
      const p = (t: number, o: number): [number, number] => (alongX ? [A.x + t, A.z + o] : [A.x + o, A.z + t]);
      const c: [number, number][] = [p(t0, o0), p(t1, o0), p(t1, o1), p(t0, o1)];
      const ty = [y(t0), y(t1), y(t1), y(t0)].map((v) => v + CURB);
      Mesher.slab(tops.walk, sides, c, ty, Math.min(y(t0), y(t1)) - 0.05);
    }
    // Stepping stones across the roadway, just beyond each crossing.
    for (const [t, other] of [
      [otherA, otherA],
      [len - otherB, otherB],
    ] as const) {
      if (!other) continue;
      const at = t + (t < len / 2 ? 0.7 : -0.7);
      const road = h - s.walk;
      const count = Math.max(2, Math.round((road * 2) / 0.9));
      for (let k = 0; k < count; k++) {
        const o = -road + ((k + 0.5) * road * 2) / count;
        const [x, z] = alongX ? [A.x + at, A.z + o] : [A.x + o, A.z + at];
        stones.push(m4.clone().compose(new Vector3(x, y(at) + 0.05, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), alongX ? Math.PI / 2 : 0), new Vector3(1, 1, 1)));
      }
    }
  }
  add(tops.avenue.geometry(), stone('avenue'));
  add(tops.carriage.geometry(), stone('carriage'));
  add(tops.lane.geometry(), stone('lane'));
  add(tops.walk.geometry(), stone('walk'));
  add(tops.square.geometry(), stone('square'));
  add(tops.earth.geometry(), stone('earth'));
  add(tops.field.geometry(), stone('field'));
  add(sides.geometry(), stone('ashlar'));
  const stoneGeo = new BoxGeometry(0.55, 0.22, 0.42);
  const stoneMat = stone('walk');
  const stoneMesh = new InstancedMesh(stoneGeo, stoneMat, stones.length);
  stones.forEach((m, k) => stoneMesh.setMatrixAt(k, m));
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);
  geos.push(stoneGeo);
  mats.push(stoneMat);

  // The city's wall, its towers and gates.
  const rampart = new Mesher();
  const W = 0.9,
    HIGH = 2.8;
  for (const [x0, z0, x1, z1, y0, y1] of plan.circuit.walls) {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const c: [number, number][] = alongX
      ? [
          [x0, z0 - W / 2],
          [x1, z1 - W / 2],
          [x1, z1 + W / 2],
          [x0, z0 + W / 2],
        ]
      : [
          [x0 - W / 2, z0],
          [x0 + W / 2, z0],
          [x1 + W / 2, z1],
          [x1 - W / 2, z1],
        ];
    const t = alongX ? [y0, y1, y1, y0] : [y0, y0, y1, y1];
    Mesher.slab(rampart, rampart, c, t.map((v) => v + HIGH), Math.min(y0, y1) - 4);
  }
  for (const [x, y, z] of plan.circuit.towers) {
    const top = y + HIGH + 1.6;
    Mesher.slab(rampart, rampart, rectCorners([x - 1.7, z - 1.7, x + 1.7, z + 1.7]), [top, top, top, top], y - 4);
    // Its cornice: a course standing out round the top.
    Mesher.slab(rampart, rampart, rectCorners([x - 1.95, z - 1.95, x + 1.95, z + 1.95]), [top + 0.35, top + 0.35, top + 0.35, top + 0.35], top - 0.05);
  }
  // A gate: a lintel of stone over the avenue, between its two towers.
  for (const [x, y, z, turn] of plan.circuit.gates) {
    const along = Math.abs(Math.cos(turn)) > 0.5;
    const half = 3.4,
      d = W / 2 + 0.2;
    Mesher.slab(rampart, rampart, rectCorners(along ? [x - half - 0.4, z - d, x + half + 0.4, z + d] : [x - d, z - half - 0.4, x + d, z + half + 0.4]), [y + HIGH + 0.9, y + HIGH + 0.9, y + HIGH + 0.9, y + HIGH + 0.9], y + HIGH - 0.3);
  }
  // The harbour's mole and the landing stages: stone piers out into the sea.
  const moleTop = new Mesher();
  for (const m of plan.moles) Mesher.slab(moleTop, rampart, rectCorners(m.rect), [m.level, m.level, m.level, m.level], m.level - 4);
  add(moleTop.geometry(), stone('walk'));
  // Roads out of the gates, laid on the land.
  const road = new Mesher();
  for (const r of plan.roads)
    for (let k = 1; k < r.points.length; k++) {
      const [ax, az] = r.points[k - 1],
        [bx, bz] = r.points[k];
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const nx = (-(bz - az) / len) * (r.width / 2),
        nz = ((bx - ax) / len) * (r.width / 2);
      const y = (x: number, z: number) => ground(x, z) + 0.12;
      road.quad([ax + nx, y(ax + nx, az + nz), az + nz], [bx + nx, y(bx + nx, bz + nz), bz + nz], [bx - nx, y(bx - nx, bz - nz), bz - nz], [ax - nx, y(ax - nx, az - nz), az - nz], [0, 1, 0]);
    }
  add(road.geometry(), stone('lane'));
  // The sports grounds: a running track round the field, banks for the onlookers along its long sides.
  const fields = new Map<string, Group>();
  const sandMat = stone('sand'),
    bankMat = stone('rampart');
  mats.push(sandMat, bankMat);
  for (const [fi, q] of plan.squares.filter((sq) => sq.kind === 'field').entries()) {
    const track = new Mesher(),
      banks = new Mesher();
    const [x0, z0, x1, z1] = q.rect;
    const y = q.level + 0.03;
    const cz = (z0 + z1) / 2,
      rOut = (z1 - z0) / 2 - 2.2,
      rIn = rOut - 1.4;
    const straight0 = x0 + rOut + 2.4,
      straight1 = x1 - rOut - 2.4;
    const ring = (t: number, r: number): number[] => {
      // Along the track: the north straight, the east bend, the south straight, the west bend.
      const L = straight1 - straight0;
      const per = 2 * L + 2 * Math.PI * r;
      let d = (((t % 1) + 1) % 1) * per;
      if (d < L) return [straight0 + d, y, cz - r];
      d -= L;
      if (d < Math.PI * r) return [straight1 + Math.sin(d / r) * r, y, cz - Math.cos(d / r) * r];
      d -= Math.PI * r;
      if (d < L) return [straight1 - d, y, cz + r];
      d -= L;
      return [straight0 - Math.sin(d / r) * r, y, cz + Math.cos(d / r) * r];
    };
    const n = 64;
    for (let k = 0; k < n; k++) track.quad(ring(k / n, rOut), ring((k + 1) / n, rOut), ring((k + 1) / n, rIn), ring(k / n, rIn), [0, 1, 0]);
    for (const zs of [z0 + 0.4, z1 - 1.6]) {
      Mesher.slab(banks, banks, rectCorners([straight0, zs, straight1, zs + 1.2]), [q.level + 0.5, q.level + 0.5, q.level + 0.5, q.level + 0.5], q.level);
      const inner = zs < cz ? zs + 0.6 : zs;
      Mesher.slab(banks, banks, rectCorners([straight0, inner, straight1, inner + 0.6]), [q.level + 0.95, q.level + 0.95, q.level + 0.95, q.level + 0.95], q.level);
    }
    const g = new Group();
    const tg = track.geometry(),
      bg = banks.geometry();
    geos.push(tg, bg);
    const tm = new Mesh(tg, sandMat);
    tm.receiveShadow = true;
    const bm = new Mesh(bg, bankMat);
    bm.castShadow = bm.receiveShadow = true;
    g.add(tm, bm);
    group.add(g);
    fields.set(`f${fi}`, g);
  }
  add(rampart.geometry(), stone('rampart'));

  // The stoas round the agora, in plain limestone.
  const limestone = new MeshStandardMaterial({ color: 0xbdbdbd, roughness: 0.82 });
  mats.push(limestone);
  const byType = new Map<string, Matrix4[]>();
  for (const f of plan.fixtures) {
    const list = byType.get(f.type) ?? [];
    list.push(new Matrix4().compose(new Vector3(f.x, f.y ?? groundUnder(plan, f.x, f.z), f.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), f.rotation), new Vector3(scale * f.scale, scale * f.scale, scale * f.scale)));
    byType.set(f.type, list);
  }
  for (const [type, list] of byType) {
    const mesh = new InstancedMesh(fixture(type), limestone, list.length);
    list.forEach((m, k) => mesh.setMatrixAt(k, m));
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Furniture.
  const bronze = new MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 });
  const marbleBench = new MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.5 });
  const water = new MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.08, metalness: 0.2 });
  mats.push(bronze, marbleBench, water);
  const instanced = (geo: BufferGeometry, mat: Material, at: number[][], turn = (_: number[]) => 0, size = (_: number[]) => 1) => {
    const mesh = new InstancedMesh(geo, mat, Math.max(1, at.length));
    mesh.count = at.length;
    at.forEach((p, k) => mesh.setMatrixAt(k, new Matrix4().compose(new Vector3(p[0], p[1], p[2]), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), turn(p)), new Vector3(size(p), size(p), size(p)))));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    geos.push(geo);
    return mesh;
  };
  // A lamp: a slender bronze post with a bowl, standing on the walkway.
  const lampGeo = merge([new CylinderGeometry(0.05, 0.07, 1.7, 6).translate(0, CURB + 0.85, 0), new CylinderGeometry(0.2, 0.08, 0.16, 8).translate(0, CURB + 1.75, 0), new CylinderGeometry(0.12, 0.12, 0.08, 6).translate(0, CURB + 0.04, 0)]);
  instanced(lampGeo, bronze, plan.furniture.lamps.map(([x, yy, z]) => [x, yy, z]));
  // A bench: a marble seat on two blocks.
  const benchGeo = merge([new BoxGeometry(1.3, 0.1, 0.42).translate(0, 0.42, 0), new BoxGeometry(0.12, 0.38, 0.36).translate(-0.5, 0.19, 0), new BoxGeometry(0.12, 0.38, 0.36).translate(0.5, 0.19, 0)]);
  instanced(benchGeo, marbleBench, plan.furniture.benches, (p) => p[3]);
  // A fountain: a round basin of water, a column with its bowl.
  const basin = merge([new CylinderGeometry(2.2, 2.3, 0.5, 28).translate(0, 0.25, 0), new CylinderGeometry(0.28, 0.34, 1.6, 12).translate(0, 0.8, 0), new CylinderGeometry(0.75, 0.3, 0.3, 16).translate(0, 1.65, 0)]);
  instanced(basin, marbleBench, plan.furniture.fountains);
  instanced(new CylinderGeometry(1.95, 1.95, 0.05, 28).translate(0, 0.44, 0), water, plan.furniture.fountains);
  // Trees: plane trees on the avenues and the agora, cypresses in the sanctuary, olives in the grove.
  const leaf = new MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.95, flatShading: true });
  const cypressLeaf = new MeshStandardMaterial({ color: 0x3e3e3e, roughness: 0.95, flatShading: true });
  const oliveLeaf = new MeshStandardMaterial({ color: 0x969696, roughness: 0.95, flatShading: true });
  mats.push(leaf, cypressLeaf, oliveLeaf);
  const tr = plan.furniture.trees;
  const turn = (p: number[]) => ((p[0] * 7.13 + p[2] * 3.7) % 6.28) as number;
  instanced(trees.plane, leaf, tr.filter((t) => t[4] === 0), turn, (p) => p[3]);
  instanced(trees.cypress, cypressLeaf, tr.filter((t) => t[4] === 1), turn, (p) => p[3]);
  instanced(trees.olive, oliveLeaf, tr.filter((t) => t[4] === 2), turn, (p) => p[3]);

  return {
    group,
    fields,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

/** A walkway's width on the streets through a crossing along an axis. */
function walkOf(plan: CityPlan, node: number, axis: 'x' | 'z'): number {
  let w = 0;
  for (const s of plan.streets) {
    if (s.a !== node && s.b !== node) continue;
    const A = plan.nodes[s.a],
      B = plan.nodes[s.b];
    const alongX = Math.abs(B.x - A.x) > Math.abs(B.z - A.z);
    if ((axis === 'x') === alongX) w = Math.max(w, s.walk);
  }
  return w;
}

/** The ground at a point of a square or plot (for the stoas). */
function groundUnder(plan: CityPlan, x: number, z: number): number {
  const q = plan.squares.find((s) => x >= s.rect[0] - 1 && x <= s.rect[2] + 1 && z >= s.rect[1] - 1 && z <= s.rect[3] + 1);
  return q ? q.level : 0;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const clean = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    return g;
  });
  return mergeGeometries(clean)!;
}

// ---- the houses, and the precincts of the services ----

/** Greys of the houses: plaster, roof tile, doorways and windows, the court's floor, a garden's ground. */
const PLASTER = 0.55,
  TILE = 0.21,
  OPENING = 0.12,
  FLOOR = 0.5,
  SOIL = 0.24;

/**
 * The houses, one geometry per kind on a unit square of ground (front to +z),
 * scaled to their plot: plaster walls with their doorways and windows, tiled
 * roofs. A courtyard house's roofs slope in to its court, as Greek houses' did.
 */
function houseGeometry(kind: House['kind']): BufferGeometry {
  const m = new Mesher();
  /** A box from y0 to y1, its every face in one grey. */
  const box = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, g: number) => {
    const from = m.col.length;
    Mesher.slab(m, m, rectCorners([x0, z0, x1, z1]), [y1, y1, y1, y1], y0);
    for (let k = from; k < m.col.length; k++) m.col[k] = g;
  };
  /** A roof of one slope over a rectangle, falling from its high edge (`high`: the side) to the low one, with eaves. */
  const shed = (x0: number, z0: number, x1: number, z1: number, y: number, rise: number, high: 'n' | 's' | 'e' | 'w') => {
    const e = 0.04;
    [x0, z0, x1, z1] = [x0 - e, z0 - e, x1 + e, z1 + e];
    const hy = (x: number, z: number) => y + (high === 'n' ? (z1 - z) / (z1 - z0) : high === 's' ? (z - z0) / (z1 - z0) : high === 'w' ? (x1 - x) / (x1 - x0) : (x - x0) / (x1 - x0)) * rise;
    const c: [number, number][] = rectCorners([x0, z0, x1, z1]);
    const from = m.col.length;
    Mesher.slab(m, m, c, c.map(([x, z]) => hy(x, z)), y - 0.06);
    for (let k = from; k < m.col.length; k++) m.col[k] = TILE;
  };
  /** A roof of two slopes, its ridge along the longer side. */
  const gable = (x0: number, z0: number, x1: number, z1: number, y: number, rise: number) => {
    const e = 0.05;
    [x0, z0, x1, z1] = [x0 - e, z0 - e, x1 + e, z1 + e];
    const alongX = x1 - x0 >= z1 - z0;
    const from = m.col.length;
    if (alongX) {
      const zm = (z0 + z1) / 2;
      m.quad([x0, y, z0], [x1, y, z0], [x1, y + rise, zm], [x0, y + rise, zm], [0, 1, -1], TILE);
      m.quad([x0, y, z1], [x1, y, z1], [x1, y + rise, zm], [x0, y + rise, zm], [0, 1, 1], TILE);
      m.quad([x0, y, z0], [x0, y + rise, zm], [x0, y, z1], [x0, y, z1], [-1, 0, 0], PLASTER);
      m.quad([x1, y, z0], [x1, y + rise, zm], [x1, y, z1], [x1, y, z1], [1, 0, 0], PLASTER);
    } else {
      const xm = (x0 + x1) / 2;
      m.quad([x0, y, z0], [x0, y, z1], [xm, y + rise, z1], [xm, y + rise, z0], [-1, 1, 0], TILE);
      m.quad([x1, y, z0], [x1, y, z1], [xm, y + rise, z1], [xm, y + rise, z0], [1, 1, 0], TILE);
      m.quad([x0, y, z0], [xm, y + rise, z0], [x1, y, z0], [x1, y, z0], [0, 0, -1], PLASTER);
      m.quad([x0, y, z1], [xm, y + rise, z1], [x1, y, z1], [x1, y, z1], [0, 0, 1], PLASTER);
    }
    void from;
  };
  /** A dark opening on the street face (z = 0.5): a door or a window. */
  const opening = (x: number, w: number, y0: number, y1: number) => box(x - w / 2, 0.5, x + w / 2, 0.506, y0, y1, OPENING);
  if (kind === 'courtyard') {
    // Rooms round a court; the street wing a little higher, its roof and the others' sloping in to the court.
    const t = 0.3;
    box(-0.5, 0.5 - t, 0.5, 0.5, 0, 2.2, PLASTER);
    box(-0.5, -0.5, 0.5, -0.5 + t, 0, 1.9, PLASTER);
    box(-0.5, -0.5 + t, -0.5 + t, 0.5 - t, 0, 1.9, PLASTER);
    box(0.5 - t, -0.5 + t, 0.5, 0.5 - t, 0, 1.9, PLASTER);
    shed(-0.5, 0.5 - t, 0.5, 0.5, 2.2, 0.45, 's');
    shed(-0.5, -0.5, 0.5, -0.5 + t, 1.9, 0.4, 'n');
    shed(-0.5, -0.5 + t, -0.5 + t, 0.5 - t, 1.9, 0.4, 'w');
    shed(0.5 - t, -0.5 + t, 0.5, 0.5 - t, 1.9, 0.4, 'e');
    box(-0.5 + t, -0.5 + t, 0.5 - t, 0.5 - t, 0, 0.04, FLOOR);
    opening(0, 0.16, 0, 1.25);
    opening(-0.3, 0.08, 1.35, 1.7);
    opening(0.3, 0.08, 1.35, 1.7);
  } else if (kind === 'storey') {
    // A house of two storeys, its gable along the street; a door, windows above.
    box(-0.47, -0.45, 0.47, 0.45, 0, 3.4, PLASTER);
    gable(-0.47, -0.45, 0.47, 0.45, 3.4, 0.65);
    box(-0.47, 0.45, 0.47, 0.5, 1.6, 1.68, PLASTER);
    opening(0, 0.16, 0, 1.3);
    for (const x of [-0.3, -0.1, 0.1, 0.3]) opening(x, 0.07, 2.2, 2.75);
  } else if (kind === 'garden') {
    // A garden behind a low wall, a small house at its back; its trees are planted with it.
    box(-0.5, -0.5, 0.5, -0.46, 0, 0.9, PLASTER);
    box(-0.5, 0.46, -0.08, 0.5, 0, 0.9, PLASTER);
    box(0.08, 0.46, 0.5, 0.5, 0, 0.9, PLASTER);
    box(-0.5, -0.46, -0.46, 0.46, 0, 0.9, PLASTER);
    box(0.46, -0.46, 0.5, 0.46, 0, 0.9, PLASTER);
    box(-0.46, -0.46, 0.46, -0.12, 0, 2, PLASTER);
    shed(-0.46, -0.46, 0.46, -0.12, 2, 0.4, 'n');
    box(-0.46, -0.12, 0.46, 0.46, 0, 0.05, SOIL);
  } else if (kind === 'villa') {
    // A large house round a court with a colonnade: rooms on all four sides, roofs sloping in, columns round the court.
    const t = 0.22;
    box(-0.5, 0.5 - t, 0.5, 0.5, 0, 2.5, PLASTER);
    box(-0.5, -0.5, 0.5, -0.5 + t, 0, 2.2, PLASTER);
    box(-0.5, -0.5 + t, -0.5 + t, 0.5 - t, 0, 2.2, PLASTER);
    box(0.5 - t, -0.5 + t, 0.5, 0.5 - t, 0, 2.2, PLASTER);
    shed(-0.5, 0.5 - t, 0.5, 0.5, 2.5, 0.5, 's');
    shed(-0.5, -0.5, 0.5, -0.5 + t, 2.2, 0.45, 'n');
    shed(-0.5, -0.5 + t, -0.5 + t, 0.5 - t, 2.2, 0.45, 'w');
    shed(0.5 - t, -0.5 + t, 0.5, 0.5 - t, 2.2, 0.45, 'e');
    box(-0.5 + t, -0.5 + t, 0.5 - t, 0.5 - t, 0, 0.05, FLOOR);
    // The peristyle: a roof round the court on its colonnade, sloping in (the columns are lost at this size; their shade is not).
    const p = 0.08;
    shed(-0.5 + t, -0.5 + t, 0.5 - t, -0.5 + t + p, 1.7, 0.12, 'n');
    shed(-0.5 + t, 0.5 - t - p, 0.5 - t, 0.5 - t, 1.7, 0.12, 's');
    shed(-0.5 + t, -0.5 + t + p, -0.5 + t + p, 0.5 - t - p, 1.7, 0.12, 'w');
    shed(0.5 - t - p, -0.5 + t + p, 0.5 - t, 0.5 - t - p, 1.7, 0.12, 'e');
    opening(0, 0.1, 0, 1.5);
    for (const x of [-0.32, -0.18, 0.18, 0.32]) opening(x, 0.04, 1.6, 2.0);
  } else if (kind === 'orchard') {
    // An orchard: a low wall round rows of trees (planted with it), a gate on the street.
    box(-0.5, -0.5, 0.5, -0.49, 0, 0.8, PLASTER);
    box(-0.5, 0.49, -0.06, 0.5, 0, 0.8, PLASTER);
    box(0.06, 0.49, 0.5, 0.5, 0, 0.8, PLASTER);
    box(-0.5, -0.49, -0.49, 0.49, 0, 0.8, PLASTER);
    box(0.49, -0.49, 0.5, 0.49, 0, 0.8, PLASTER);
    box(-0.49, -0.49, 0.49, 0.49, 0, 0.04, SOIL);
  } else {
    // A workshop: a long hall at the back with a lean-to roof, a walled yard to the street, a kiln.
    box(-0.5, -0.5, 0.5, 0.05, 0, 2.5, PLASTER);
    shed(-0.5, -0.5, 0.5, 0.05, 2.5, 0.5, 'n');
    box(-0.5, 0.46, -0.1, 0.5, 0, 1.1, PLASTER);
    box(0.1, 0.46, 0.5, 0.5, 0, 1.1, PLASTER);
    box(-0.5, 0.05, -0.46, 0.46, 0, 1.1, PLASTER);
    box(0.46, 0.05, 0.5, 0.46, 0, 1.1, PLASTER);
    box(-0.46, 0.05, 0.46, 0.46, 0, 0.04, FLOOR);
    box(0.22, 0.12, 0.4, 0.3, 0, 1.3, PLASTER);
    box(-0.3, 0.05, 0.3, 0.056, 0, 1.6, OPENING);
  }
  return m.geometry(true);
}

/**
 * Plaster and tile: the houses' greys from their vertices, and on the slopes
 * of the roofs, rows of tiles running down them.
 */
function houseMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vNw;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vNw = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vNw;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// A roof: its rows of tiles run down the slope; across them, the joints.
if (vNw.y > 0.25 && vNw.y < 0.97) {
  vec2 down = normalize(vNw.xz);
  float across = dot(vW.xz, vec2(-down.y, down.x));
  float along = dot(vW.xz, down);
  float row = abs(fract(across / 0.34) - 0.5);
  float course = abs(fract(along / 0.42) - 0.5);
  diffuseColor.rgb *= 0.8 + 0.25 * smoothstep(0.0, 0.32, row) - 0.12 * (1.0 - smoothstep(0.0, 0.06, course));
}`,
      );
  };
  return m;
}

export type Fabric = { group: Group; dispose(): void };

/**
 * The houses on the free plots and, round every service and machine, its
 * precinct: a court of marble paving and a low wall, open to the street.
 */
export function buildFabric(houses: readonly House[], precincts: readonly Lot[], gardenTree: BufferGeometry): Fabric {
  const group = new Group();
  const geos: BufferGeometry[] = [];
  const mats: Material[] = [];
  const plaster = houseMaterial();
  mats.push(plaster);
  for (const kind of ['courtyard', 'storey', 'garden', 'workshop', 'villa', 'orchard'] as const) {
    const list = houses.filter((h) => h.kind === kind);
    if (!list.length) continue;
    const geo = houseGeometry(kind);
    geos.push(geo);
    const mesh = new InstancedMesh(geo, plaster, list.length);
    const col = new Color();
    list.forEach((h, k) => {
      // Each house a little taller or lower, its plaster a shade lighter or darker; an orchard's wall stays low.
      const tall = h.kind === 'orchard' ? 1 : 0.85 + ((h.seed * 37) % 100) / 330;
      mesh.setMatrixAt(k, new Matrix4().compose(new Vector3(h.x, h.y, h.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), h.rotation), new Vector3(h.w, tall, h.d)));
      mesh.setColorAt(k, col.setScalar(0.9 + ((h.seed * 13) % 100) / 1000));
    });
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  // Gardens have trees; one courtyard in four has its tree in the court.
  const at = (h: House, u: number, v: number) => {
    const c = Math.cos(h.rotation),
      s = Math.sin(h.rotation);
    return [h.x + (u * h.w * c + v * h.d * s), h.y, h.z + (-u * h.w * s + v * h.d * c)];
  };
  const gardenTrees = houses.flatMap((h) =>
    h.kind === 'garden'
      ? [at(h, -0.22, 0.2), at(h, 0.2, 0.28)]
      : h.kind === 'courtyard' && h.seed % 4 === 1
        ? [at(h, 0.06, -0.04)]
        : h.kind === 'villa'
          ? [at(h, 0.08, -0.1)]
          : h.kind === 'orchard'
            ? orchardRows(h).map(([u, v]) => at(h, u, v))
            : [],
  );
  if (gardenTrees.length) {
    const leaf = new MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.95, flatShading: true });
    mats.push(leaf);
    const mesh = new InstancedMesh(gardenTree, leaf, gardenTrees.length);
    gardenTrees.forEach((p, k) => mesh.setMatrixAt(k, new Matrix4().compose(new Vector3(p[0], p[1], p[2]), new Quaternion(), new Vector3(0.7, 0.7, 0.7))));
    mesh.castShadow = true;
    group.add(mesh);
  }
  // Precincts: the court's paving, and a low wall round it with its gate on the street.
  const court = new Mesher();
  const wall = new Mesher();
  for (const l of precincts) {
    const [x0, z0, x1, z1] = l.rect;
    const y = l.ground;
    Mesher.slab(court, null, rectCorners([x0 + 0.2, z0 + 0.2, x1 - 0.2, z1 - 0.2]), [y + 0.03, y + 0.03, y + 0.03, y + 0.03], y);
    const t = 0.22,
      hgt = 0.75,
      gate = Math.min(3, (x1 - x0) * 0.3);
    const front = { s: Math.abs(Math.cos(l.facing) - 1) < 0.01, n: Math.abs(Math.cos(l.facing) + 1) < 0.01, e: Math.abs(Math.sin(l.facing) - 1) < 0.01, w: Math.abs(Math.sin(l.facing) + 1) < 0.01 };
    const run = (ax: number, az: number, bx: number, bz: number, open: boolean) => {
      // A side of the wall; the front one opens in its middle.
      const pieces: [number, number, number, number][] = [];
      if (!open) pieces.push([ax, az, bx, bz]);
      else {
        const mx = (ax + bx) / 2,
          mz = (az + bz) / 2;
        const len = Math.hypot(bx - ax, bz - az);
        const ux = (bx - ax) / len,
          uz = (bz - az) / len;
        pieces.push([ax, az, mx - (ux * gate) / 2, mz - (uz * gate) / 2], [mx + (ux * gate) / 2, mz + (uz * gate) / 2, bx, bz]);
      }
      for (const [p, q, r, s2] of pieces) {
        const r0: Rect = [Math.min(p, r) - t / 2, Math.min(q, s2) - t / 2, Math.max(p, r) + t / 2, Math.max(q, s2) + t / 2];
        const top = new Mesher();
        Mesher.slab(top, wall, rectCorners(r0), [y + hgt, y + hgt, y + hgt, y + hgt], y);
        wall.pos.push(...top.pos);
        wall.nor.push(...top.nor);
        wall.col.push(...top.col);
      }
    };
    const i = 0.2;
    run(x0 + i, z0 + i, x1 - i, z0 + i, front.n);
    run(x0 + i, z1 - i, x1 - i, z1 - i, front.s);
    run(x0 + i, z0 + i, x0 + i, z1 - i, front.w);
    run(x1 - i, z0 + i, x1 - i, z1 - i, front.e);
  }
  if (precincts.length) {
    const cg = court.geometry(),
      wg = wall.geometry();
    geos.push(cg, wg);
    const courtMat = stone('court'),
      wallMat = stone('ashlar');
    mats.push(courtMat, wallMat);
    const c = new Mesh(cg, courtMat);
    c.receiveShadow = true;
    const w = new Mesh(wg, wallMat);
    w.castShadow = w.receiveShadow = true;
    group.add(c, w);
  }
  return {
    group,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

/** An orchard's trees, in rows a little over 3 units apart, in the plot's own frame (−0.5 … 0.5). */
function orchardRows(h: House): [number, number][] {
  const out: [number, number][] = [];
  const nx = Math.max(2, Math.floor(h.w / 3.2)),
    nz = Math.max(2, Math.floor(h.d / 3.2));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) out.push([-0.5 + (i + 0.5) / nx, -0.5 + (j + 0.5) / nz]);
  return out;
}

/** The city's trees: a plane tree (a stout trunk under a layered crown), an olive (low, open, silvery), a cypress. */
export function cityTrees(): { plane: BufferGeometry; olive: BufferGeometry; cypress: BufferGeometry } {
  const crown = (parts: [number, number, number, number, number][]) => parts.map(([x, y, z, r, flat]) => new IcosahedronGeometry(r, 1).scale(1, flat, 1).translate(x, y, z));
  const plane = merge([
    new CylinderGeometry(0.14, 0.22, 2.6, 7).translate(0, 1.3, 0),
    new CylinderGeometry(0.06, 0.1, 1.2, 5).rotateZ(0.6).translate(0.4, 2.6, 0),
    new CylinderGeometry(0.06, 0.1, 1.2, 5).rotateZ(-0.6).translate(-0.4, 2.6, 0.1),
    ...crown([
      [0, 3.6, 0, 1.45, 0.75],
      [0.95, 3.2, 0.3, 1.0, 0.7],
      [-0.9, 3.3, -0.35, 1.05, 0.7],
      [0.2, 4.3, -0.2, 1.0, 0.7],
      [-0.3, 3.1, 0.9, 0.85, 0.7],
    ]),
  ]);
  const olive = merge([
    new CylinderGeometry(0.1, 0.17, 1.1, 6).rotateZ(0.12).translate(0, 0.55, 0),
    ...crown([
      [0.1, 1.55, 0, 0.85, 0.6],
      [0.65, 1.35, 0.25, 0.6, 0.6],
      [-0.55, 1.4, -0.2, 0.62, 0.6],
    ]),
  ]);
  return { plane, olive, cypress: cypressGeometry() };
}

/** A cypress: a tall slim flame of dark green, here dark grey. */
export function cypressGeometry(): BufferGeometry {
  return merge([new ConeGeometry(0.55, 4.2, 7).translate(0, 2.6, 0), new SphereGeometry(0.5, 7, 5).scale(1, 1.3, 1).translate(0, 1.0, 0), new CylinderGeometry(0.08, 0.1, 0.6, 5).translate(0, 0.3, 0)]);
}
