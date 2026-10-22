// The city on the island, planned as the ancient planned cities were: a grid
// of streets of three ranks — the sacred way and the main street (avenues),
// streets, lanes — over blocks levelled into terraces that step up the hill.
// Where the two avenues cross lies the agora; at the top of the sacred way the
// sanctuary; to the west a grove; the east blocks are the works quarter.
// Every block is a plot that can be taken whole, in halves or in quarters,
// each facing its street; what no service or machine takes, houses fill.
// Walkways run along both sides of every street and meet at stepping-stone
// crossings; the people of the city walk that network.
//
// Pure and deterministic: the same land always gives the same city. Made
// once when the site is built (assets/map/city.json), with the land graded
// to it (assets/map/terrain.bin).

import { MAP, TOWN, heightAt, townWeight, type Terrain } from './terrain.ts';
import { seeded } from './noise.ts';

/** [x0, z0, x1, z1], x0 < x1, z0 < z1. */
export type Rect = [number, number, number, number];
export type Rank = 'avenue' | 'street' | 'lane';
export type District = 'town' | 'works' | 'agora' | 'sanctuary' | 'grove' | 'field';
export type Part = 'whole' | 'half' | 'quarter' | 'precinct' | 'field';

export type Lot = {
  id: string;
  part: Part;
  district: District;
  rect: Rect;
  /** The turn that faces a building's front (+z) to the lot's street. */
  facing: number;
  /** The height of its level ground. */
  ground: number;
  /** The lot it is part of (a quarter's half, a half's whole). */
  parent?: string;
};

/** A street between two crossings: its nodes, its rank, its width (walkways included). */
export type Street = { a: number; b: number; rank: Rank; width: number; walk: number };
export type Node = { x: number; z: number; y: number };
/** An open space: a paved square, or the grove. */
export type Square = { kind: 'agora' | 'sanctuary' | 'grove' | 'field'; rect: Rect; level: number };
/** Where the people walk: points (x, y, z) and the ways between them, with how much each way is used. */
export type Walk = { nodes: [number, number, number][]; edges: [number, number][]; use: number[] };
/**
 * The city's circuit: its wall along the outer edge of the streets at the
 * town's edge ([x0, z0, x1, z1, y0, y1]: from one end to the other, the
 * street's height at each), towers at its corners and along it, gates where
 * the avenues leave the town ([x, y, z, turn]).
 */
export type Circuit = { walls: [number, number, number, number, number, number][]; towers: [number, number, number][]; gates: [number, number, number, number][] };
/** A building of the city itself (not a service): drawn from the catalogue in plain stone; at `y`, or on the square it stands in. */
export type Fixture = { type: string; x: number; z: number; rotation: number; scale: number; y?: number };
/** A road out of a gate across the land ([x, z] points, laid on the land as it is), and the harbour's mole where one reaches the sea. */
export type Road = { points: [number, number][]; width: number };
export type Mole = { rect: Rect; level: number; light: boolean };

export type CityPlan = {
  version: 1;
  grid: { x0: number; z0: number; px: number; pz: number };
  /** The town's extent, streets included. */
  bounds: Rect;
  nodes: Node[];
  streets: Street[];
  squares: Square[];
  lots: Lot[];
  walk: Walk;
  fixtures: Fixture[];
  circuit: Circuit;
  roads: Road[];
  moles: Mole[];
  furniture: {
    /** [x, y, z] */
    lamps: [number, number, number][];
    /** [x, y, z, turn] */
    benches: [number, number, number, number][];
    fountains: [number, number, number][];
    /** [x, y, z, scale, kind: 0 plane tree, 1 cypress, 2 olive] */
    trees: [number, number, number, number, number][];
  };
};

/** The grid: lines every px along x and pz along z, through (x0, z0) — the sacred way and the main street. */
export const GRID = { x0: 0, z0: 100, px: 22, pz: 18, ni: 12, nj: 10 } as const;
const WIDTH: Record<Rank, number> = { avenue: 6, street: 4.2, lane: 3 };
const WALKWAY: Record<Rank, number> = { avenue: 1.3, street: 1, lane: 0.75 };

const r2 = (v: number) => Math.round(v * 100) / 100;
/** N–S line i: the sacred way at 0, a street every third line, lanes between. */
const rankX = (i: number): Rank => (i === 0 ? 'avenue' : Math.abs(i) % 3 === 0 ? 'street' : 'lane');
/** E–W line j: the main street at 0, a street every other line, lanes between. */
const rankZ = (j: number): Rank => (j === 0 ? 'avenue' : Math.abs(j) % 2 === 0 ? 'street' : 'lane');
const lineX = (i: number) => GRID.x0 + i * GRID.px;
const lineZ = (j: number) => GRID.z0 + j * GRID.pz;

/** The level ground of block (i, j): the cell between its streets. */
function blockRect(i: number, j: number): Rect {
  return [lineX(i) + WIDTH[rankX(i)] / 2, lineZ(j) + WIDTH[rankZ(j)] / 2, lineX(i + 1) - WIDTH[rankX(i + 1)] / 2, lineZ(j + 1) - WIDTH[rankZ(j + 1)] / 2];
}

const key = (i: number, j: number) => `${i}:${j}`;
const inRect = (r: Rect, x: number, z: number, m = 0) => x >= r[0] - m && x <= r[2] + m && z >= r[1] - m && z <= r[3] + m;

export function planCity(land: Terrain): CityPlan {
  // ---- which blocks: wholly on the town's gentle land, above the sea ----
  const ok = new Set<string>();
  for (let j = -GRID.nj; j < GRID.nj; j++)
    for (let i = -GRID.ni; i < GRID.ni; i++) {
      const [x0, z0, x1, z1] = [lineX(i) - 2, lineZ(j) - 2, lineX(i + 1) + 2, lineZ(j + 1) + 2];
      let fine = true;
      for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2], [(x0 + x1) / 2, z0], [(x0 + x1) / 2, z1], [x0, (z0 + z1) / 2], [x1, (z0 + z1) / 2]])
        // On the town's land, above the sea, and below the mountain's flanks (the town does not climb it).
        if (townWeight(x, z) < 0.25 || heightAt(land, x, z) < MAP.sea + 1.2 || heightAt(land, x, z) > 28) fine = false;
      if (fine) ok.add(key(i, j));
    }
  // The largest connected group of blocks round the crossing of the avenues.
  const blocks = new Set<string>();
  const seed = key(0, 0);
  if (!ok.has(seed)) throw new Error('the town has no centre: the avenues do not cross on the town’s land');
  const stack = [seed];
  while (stack.length) {
    const k = stack.pop()!;
    if (blocks.has(k) || !ok.has(k)) continue;
    blocks.add(k);
    const [i, j] = k.split(':').map(Number);
    stack.push(key(i + 1, j), key(i - 1, j), key(i, j + 1), key(i, j - 1));
  }
  const has = (i: number, j: number) => blocks.has(key(i, j));

  // ---- the squares: the agora where the avenues cross, the sanctuary at the top of the sacred way, the grove to the west ----
  const squareCells: { kind: Square['kind']; cells: [number, number][] }[] = [];
  const agora: [number, number][] = [[-1, -1], [0, -1], [-1, 0], [0, 0]];
  if (!agora.every(([i, j]) => has(i, j))) throw new Error('no room for the agora');
  squareCells.push({ kind: 'agora', cells: agora });
  let top = -1;
  while (has(-1, top - 1) && has(0, top - 1) && has(-1, top - 2) && has(0, top - 2)) top--;
  if (top - 1 >= -GRID.nj && top < -2) {
    squareCells.push({ kind: 'sanctuary', cells: [[-1, top - 1], [0, top - 1], [-1, top], [0, top]] });
    // The sacred way ends at the sanctuary: nothing of the town above it in its two columns.
    for (let j = top - 2; j >= -GRID.nj; j--) {
      blocks.delete(key(-1, j));
      blocks.delete(key(0, j));
    }
  }
  const used = new Set(squareCells.flatMap((s) => s.cells.map(([i, j]) => key(i, j))));
  let grove: [number, number][] | null = null;
  let best = Infinity;
  for (const k of blocks) {
    const [i, j] = k.split(':').map(Number);
    if (!has(i + 1, j) || used.has(k) || used.has(key(i + 1, j))) continue;
    const d = Math.hypot(lineX(i + 1) + 90, lineZ(j) + GRID.pz / 2 - 110);
    if (d < best) {
      best = d;
      grove = [[i, j], [i + 1, j]];
    }
  }
  if (grove) {
    squareCells.push({ kind: 'grove', cells: grove });
    for (const [i, j] of grove) used.add(key(i, j));
  }
  // Two sports grounds, a pair of blocks each, at the town's east and west ends: open fields, or room for a stadium.
  for (const side of [-1, 1]) {
    let pick: [number, number][] | null = null;
    let far = -Infinity;
    for (const k of [...blocks].sort()) {
      const [i, j] = k.split(':').map(Number);
      if (!has(i + 1, j) || used.has(k) || used.has(key(i + 1, j))) continue;
      const x = lineX(i + 1);
      if (Math.sign(x) !== side) continue;
      // Far along the town's long axis, and low (near the main street's row).
      const score = Math.abs(x) - Math.abs(lineZ(j) + GRID.pz / 2 - GRID.z0) * 1.5;
      if (score > far) {
        far = score;
        pick = [[i, j], [i + 1, j]];
      }
    }
    if (pick) {
      squareCells.push({ kind: 'field', cells: pick });
      for (const [i, j] of pick) used.add(key(i, j));
    }
  }
  const squareOf = new Map<string, number>();
  squareCells.forEach((s, n) => s.cells.forEach(([i, j]) => squareOf.set(key(i, j), n)));

  // ---- the crossings and their heights ----
  const nodes: Node[] = [];
  const nodeIndex = new Map<string, number>();
  const nodeAt = (i: number, j: number) => {
    const k = key(i, j);
    let n = nodeIndex.get(k);
    if (n === undefined) {
      const x = lineX(i),
        z = lineZ(j);
      n = nodes.push({ x, z, y: heightAt(land, x, z) }) - 1;
      nodeIndex.set(k, n);
    }
    return n;
  };
  for (const k of [...blocks].sort()) {
    const [i, j] = k.split(':').map(Number);
    for (const [a, b] of [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]]) nodeAt(a, b);
  }
  // A square is level: its crossings take its level.
  const squares: Square[] = squareCells.map((s) => {
    const is = s.cells.map(([i]) => i),
      js = s.cells.map(([, j]) => j);
    const [i0, i1, j0, j1] = [Math.min(...is), Math.max(...is) + 1, Math.min(...js), Math.max(...js) + 1];
    const corner = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) corner.push(nodes[nodeAt(i, j)]);
    const level = r2(corner.reduce((a, n) => a + n.y, 0) / corner.length);
    for (const n of corner) n.y = level;
    return { kind: s.kind, rect: [lineX(i0) + WIDTH[rankX(i0)] / 2, lineZ(j0) + WIDTH[rankZ(j0)] / 2, lineX(i1) - WIDTH[rankX(i1)] / 2, lineZ(j1) - WIDTH[rankZ(j1)] / 2] as Rect, level };
  });
  for (const n of nodes) n.y = r2(n.y);

  // ---- the streets: every grid segment beside a block, except inside a square ----
  const streets: Street[] = [];
  const inside = (i: number, j: number, dir: 'x' | 'z') => {
    // A segment is inside a square when the cells on both its sides belong to the same square.
    const [a, b] = dir === 'x' ? [key(i, j - 1), key(i, j)] : [key(i - 1, j), key(i, j)];
    return squareOf.has(a) && squareOf.get(a) === squareOf.get(b);
  };
  const seen = new Set<string>();
  for (const k of [...blocks].sort()) {
    const [i, j] = k.split(':').map(Number);
    // Its four sides: north and south run along x, west and east along z.
    const sides: [number, number, number, number, 'x' | 'z'][] = [
      [i, j, i + 1, j, 'x'],
      [i, j + 1, i + 1, j + 1, 'x'],
      [i, j, i, j + 1, 'z'],
      [i + 1, j, i + 1, j + 1, 'z'],
    ];
    for (const [ai, aj, bi, bj, dir] of sides) {
      const sk = `${ai}:${aj}-${bi}:${bj}`;
      if (seen.has(sk)) continue;
      seen.add(sk);
      if (inside(dir === 'x' ? ai : ai, dir === 'x' ? aj : aj, dir)) continue;
      const rank = dir === 'x' ? rankZ(aj) : rankX(ai);
      streets.push({ a: nodeAt(ai, aj), b: nodeAt(bi, bj), rank, width: WIDTH[rank], walk: WALKWAY[rank] });
    }
  }
  // No street steeper than 1 in 5 (the sacred way between the agora and the sanctuary is as steep as that): the crossings' heights are eased towards each other where a street would climb harder (a square's crossings keep its level).
  const locked = new Set<number>();
  for (const q of squares) nodes.forEach((n, k) => {
    if (inRect(q.rect, n.x, n.z, 3.2)) locked.add(k);
  });
  for (let pass = 0; pass < 200; pass++) {
    let worst = 0;
    for (const st of streets) {
      const A = nodes[st.a],
        B = nodes[st.b];
      const len = Math.hypot(B.x - A.x, B.z - A.z);
      const excess = Math.abs(B.y - A.y) - len / 5.2;
      if (excess <= 0.001) continue;
      worst = Math.max(worst, excess);
      const [hi, lo] = A.y > B.y ? [st.a, st.b] : [st.b, st.a];
      const share = locked.has(hi) ? 0 : locked.has(lo) ? 1 : 0.5;
      nodes[hi].y -= excess * share;
      nodes[lo].y += excess * (1 - share);
    }
    if (worst < 0.01) break;
  }
  for (const n of nodes) n.y = r2(n.y);
  // A crossing inside a square is no crossing.
  const live = new Set(streets.flatMap((s) => [s.a, s.b]));

  // ---- the blocks' levels and their plots ----
  const lots: Lot[] = [];
  const blockLevel = new Map<string, number>();
  for (const k of [...blocks].sort()) {
    const [i, j] = k.split(':').map(Number);
    const level = r2([[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].reduce((a, [p, q]) => a + nodes[nodeAt(p, q)].y, 0) / 4);
    blockLevel.set(k, squareOf.has(k) ? squares[squareOf.get(k)!].level : level);
    if (squareOf.has(k)) continue;
    const rect = blockRect(i, j);
    // The works quarter: the east blocks below the main street, towards the harbour.
    const district: District = (rect[0] + rect[2]) / 2 > 30 && (rect[1] + rect[3]) / 2 > GRID.z0 ? 'works' : 'town';
    const ground = blockLevel.get(k)!;
    const north = rankZ(j),
      south = rankZ(j + 1);
    const order = { avenue: 2, street: 1, lane: 0 };
    // Whole and halves face the grander of their two streets (the south one when equal).
    const facing = order[north] > order[south] ? Math.PI : 0;
    const [x0, z0, x1, z1] = rect;
    const xm = r2((x0 + x1) / 2),
      zm = r2((z0 + z1) / 2);
    const id = `b${i}:${j}`;
    lots.push({ id, part: 'whole', district, rect, facing, ground });
    lots.push({ id: `${id}:w`, part: 'half', district, rect: [x0, z0, xm, z1], facing, ground, parent: id });
    lots.push({ id: `${id}:e`, part: 'half', district, rect: [xm, z0, x1, z1], facing, ground, parent: id });
    for (const [q, r, f, half] of [
      ['nw', [x0, z0, xm, zm], Math.PI, 'w'],
      ['ne', [xm, z0, x1, zm], Math.PI, 'e'],
      ['sw', [x0, zm, xm, z1], 0, 'w'],
      ['se', [xm, zm, x1, z1], 0, 'e'],
    ] as const)
      lots.push({ id: `${id}:${q}`, part: 'quarter', district, rect: r as unknown as Rect, facing: f, ground, parent: `${id}:${half}` });
  }
  // The sports grounds: one long plot each, for a stadium, or its two halves for others.
  squares.filter((q) => q.kind === 'field').forEach((q, n) => {
    const [x0, z0, x1, z1] = q.rect;
    const id = `f${n}`;
    const xm = r2((x0 + x1) / 2);
    lots.push({ id, part: 'field', district: 'field', rect: [r2(x0 + 1), r2(z0 + 1), r2(x1 - 1), r2(z1 - 1)], facing: 0, ground: q.level });
    lots.push({ id: `${id}:w`, part: 'whole', district: 'field', rect: [r2(x0 + 1), r2(z0 + 1), r2(xm - 0.5), r2(z1 - 1)], facing: 0, ground: q.level, parent: id });
    lots.push({ id: `${id}:e`, part: 'whole', district: 'field', rect: [r2(xm + 0.5), r2(z0 + 1), r2(x1 - 1), r2(z1 - 1)], facing: 0, ground: q.level, parent: id });
  });
  // The sanctuary's precincts: three along its back, one on each side, round the court the sacred way enters.
  const sanctuary = squares.find((s) => s.kind === 'sanctuary');
  if (sanctuary) {
    const [x0, z0, x1, z1] = sanctuary.rect;
    const w = (x1 - x0 - 4) / 3,
      d = (z1 - z0) * 0.46;
    for (let n = 0; n < 3; n++) lots.push({ id: `s${n}`, part: 'precinct', district: 'sanctuary', rect: [r2(x0 + 1 + n * (w + 1)), r2(z0 + 1), r2(x0 + 1 + n * (w + 1) + w), r2(z0 + 1 + d)], facing: 0, ground: sanctuary.level });
    const sw = (x1 - x0) * 0.27,
      sd = (z1 - z0) - d - 3;
    lots.push({ id: 's3', part: 'precinct', district: 'sanctuary', rect: [r2(x0 + 1), r2(z0 + d + 2), r2(x0 + 1 + sw), r2(z0 + d + 2 + sd)], facing: Math.PI / 2, ground: sanctuary.level });
    lots.push({ id: 's4', part: 'precinct', district: 'sanctuary', rect: [r2(x1 - 1 - sw), r2(z0 + d + 2), r2(x1 - 1), r2(z0 + d + 2 + sd)], facing: (Math.PI * 3) / 2, ground: sanctuary.level });
  }

  // ---- where people walk: both walkways of every street, corners, crossings, and paths over the squares ----
  const walkNodes: [number, number, number][] = [];
  const walkIndex = new Map<string, number>();
  const edges: [number, number][] = [];
  const use: number[] = [];
  const corner = (n: number, sx: number, sz: number) => {
    const k = `${n}:${sx}:${sz}`;
    let w = walkIndex.get(k);
    if (w === undefined) {
      const node = nodes[n];
      const [i, j] = [...nodeIndex.entries()].find(([, v]) => v === n)![0].split(':').map(Number);
      const ox = WIDTH[rankX(i)] / 2 - WALKWAY[rankX(i)] / 2,
        oz = WIDTH[rankZ(j)] / 2 - WALKWAY[rankZ(j)] / 2;
      const x = node.x + sx * ox,
        z = node.z + sz * oz;
      w = walkNodes.push([r2(x), r2(node.y), r2(z)]) - 1;
      walkIndex.set(k, w);
    }
    return w;
  };
  const weight = (rank: Rank) => (rank === 'avenue' ? 3 : rank === 'street' ? 2 : 1);
  const link = (a: number, b: number, u: number) => {
    if (a === b) return;
    edges.push([a, b]);
    use.push(u);
  };
  const arms = new Map<number, Set<string>>();
  for (const s of streets) {
    const A = nodes[s.a],
      B = nodes[s.b];
    const alongX = Math.abs(B.x - A.x) > Math.abs(B.z - A.z);
    const [p, q] = (alongX ? A.x < B.x : A.z < B.z) ? [s.a, s.b] : [s.b, s.a];
    for (const side of [-1, 1]) {
      if (alongX) link(corner(p, 1, side), corner(q, -1, side), weight(s.rank));
      else link(corner(p, side, 1), corner(q, side, -1), weight(s.rank));
    }
    arms.set(p, (arms.get(p) ?? new Set()).add(alongX ? 'e' : 's'));
    arms.set(q, (arms.get(q) ?? new Set()).add(alongX ? 'w' : 'n'));
  }
  // Stepping stones across each arm of a crossing.
  for (const [n, set] of arms) {
    for (const arm of [...set].sort()) {
      if (arm === 'e') link(corner(n, 1, -1), corner(n, 1, 1), 1);
      if (arm === 'w') link(corner(n, -1, -1), corner(n, -1, 1), 1);
      if (arm === 's') link(corner(n, -1, 1), corner(n, 1, 1), 1);
      if (arm === 'n') link(corner(n, -1, -1), corner(n, 1, -1), 1);
    }
  }
  // Over each square: paths from the corners on its edge to its centre.
  for (const sq of squares) {
    const [x0, z0, x1, z1] = sq.rect;
    const centre = walkNodes.push([r2((x0 + x1) / 2), sq.level, r2((z0 + z1) / 2)]) - 1;
    const near: number[] = [];
    walkNodes.forEach(([x, , z], w) => {
      if (w !== centre && inRect(sq.rect, x, z, 2.2) && !inRect(sq.rect, x, z, -0.01)) near.push(w);
    });
    // The four corner-most and the middle of each side.
    const pick = new Set<number>();
    const targets: [number, number][] = [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, z0], [(x0 + x1) / 2, z1], [x0, (z0 + z1) / 2], [x1, (z0 + z1) / 2]];
    for (const [tx, tz] of targets) {
      let bestW = -1,
        bestD = Infinity;
      for (const w of near) {
        const d = Math.hypot(walkNodes[w][0] - tx, walkNodes[w][2] - tz);
        if (d < bestD) {
          bestD = d;
          bestW = w;
        }
      }
      if (bestW >= 0 && bestD < 16) pick.add(bestW);
    }
    for (const w of [...pick].sort((a, b) => a - b)) link(w, centre, sq.kind === 'grove' ? 1 : 3);
  }
  // Only what is reachable from the agora: a walker never strands.
  const reach = keepConnected(walkNodes, edges, use, walkNodes.findIndex((p) => squares[0] && Math.abs(p[0] - (squares[0].rect[0] + squares[0].rect[2]) / 2) < 0.01 && Math.abs(p[2] - (squares[0].rect[1] + squares[0].rect[3]) / 2) < 0.01));

  // ---- the circuit: a wall along every street with town on one side only ----
  const circuit: Circuit = { walls: [], towers: [], gates: [] };
  {
    type Run = { line: 'x' | 'z'; at: number; a: number; b: number; ya: number; yb: number; na: number; nb: number; out: number };
    const runs: Run[] = [];
    for (const st of streets) {
      const A = nodes[st.a],
        B = nodes[st.b];
      const alongX = Math.abs(B.x - A.x) > Math.abs(B.z - A.z);
      const i = Math.round((Math.min(A.x, B.x) - GRID.x0) / GRID.px),
        j = Math.round((Math.min(A.z, B.z) - GRID.z0) / GRID.pz);
      // The cells on either side: north and south of a street along x, west and east of one along z.
      const [before, after] = alongX ? [has(i, j - 1), has(i, j)] : [has(i - 1, j), has(i, j)];
      if (before === after) continue;
      const out = before ? 1 : -1;
      const [p, q] = (alongX ? A.x < B.x : A.z < B.z) ? [st.a, st.b] : [st.b, st.a];
      const off = st.width / 2 + 0.6;
      runs.push(alongX ? { line: 'z', at: nodes[p].z + out * off, a: nodes[p].x, b: nodes[q].x, ya: nodes[p].y, yb: nodes[q].y, na: p, nb: q, out } : { line: 'x', at: nodes[p].x + out * off, a: nodes[p].z, b: nodes[q].z, ya: nodes[p].y, yb: nodes[q].y, na: p, nb: q, out });
    }
    // Each end meets the run that turns there (their lines cross), or the one that carries straight on.
    const endAt = (r: Run, n: number, end: number) => {
      const turn = runs.find((o) => o !== r && o.line !== r.line && (o.na === n || o.nb === n));
      return turn ? turn.at : end;
    };
    const towerAt = new Set<string>();
    const tower = (x: number, y: number, z: number) => {
      const k = `${r2(x)}:${r2(z)}`;
      if (towerAt.has(k)) return;
      towerAt.add(k);
      circuit.towers.push([r2(x), r2(y), r2(z)]);
    };
    // Gates: where an avenue's line leaves the town across the wall.
    const avenueEnds = new Set<number>();
    for (const st of streets) if (st.rank === 'avenue') for (const n of [st.a, st.b]) avenueEnds.add(n);
    for (const r of runs) {
      let a = endAt(r, r.na, r.a),
        b = endAt(r, r.nb, r.b);
      if (b < a) [a, b] = [b, a];
      const y = (t: number) => r.ya + ((r.yb - r.ya) * (t - r.a)) / (r.b - r.a || 1);
      // A gate where an avenue meets this run end-on: the avenue's line crosses the wall at that end's crossing.
      const cuts: number[] = [];
      for (const n of [r.na, r.nb]) {
        if (!avenueEnds.has(n)) continue;
        const ns = streets.filter((st) => st.rank === 'avenue' && (st.a === n || st.b === n));
        const crossing = ns.some((st) => {
          const A = nodes[st.a],
            B = nodes[st.b];
          return (Math.abs(B.x - A.x) > Math.abs(B.z - A.z) ? 'z' : 'x') !== r.line;
        });
        if (crossing) cuts.push(r.line === 'z' ? nodes[n].x : nodes[n].z);
      }
      const pieces: [number, number][] = [[a, b]];
      for (const c of cuts) {
        const k = pieces.findIndex(([p0, p1]) => c >= p0 - 0.01 && c <= p1 + 0.01);
        if (k < 0) continue;
        const [p0, p1] = pieces[k];
        const half = WIDTH.avenue / 2 + 0.4;
        pieces.splice(k, 1, ...([[p0, c - half], [c + half, p1]] as [number, number][]).filter(([u, v]) => v - u > 0.5));
        const [gx, gz] = r.line === 'z' ? [c, r.at] : [r.at, c];
        if (!circuit.gates.some((g) => g[0] === r2(gx) && g[2] === r2(gz))) circuit.gates.push([r2(gx), r2(y(c)), r2(gz), r.line === 'z' ? 0 : Math.PI / 2]);
        for (const side of [-1, 1]) tower(r.line === 'z' ? c + side * (half + 1.4) : r.at, y(c), r.line === 'z' ? r.at : c + side * (half + 1.4));
      }
      for (const [p0, p1] of pieces) {
        const [x0, z0, x1, z1] = r.line === 'z' ? [p0, r.at, p1, r.at] : [r.at, p0, r.at, p1];
        circuit.walls.push([r2(x0), r2(z0), r2(x1), r2(z1), r2(y(p0)), r2(y(p1))]);
      }
      // Towers at the corners, and at every other crossing along a straight run.
      for (const [n, end] of [
        [r.na, a],
        [r.nb, b],
      ] as const) {
        const turns = runs.some((o) => o !== r && o.line !== r.line && (o.na === n || o.nb === n));
        const k = r.line === 'z' ? Math.round((nodes[n].x - GRID.x0) / GRID.px) : Math.round((nodes[n].z - GRID.z0) / GRID.pz);
        if (turns || k % 2 === 0) tower(r.line === 'z' ? (turns ? end : nodes[n].x) : r.at, nodes[n].y, r.line === 'z' ? r.at : turns ? end : nodes[n].z);
      }
    }
    // A tower standing in a gate's opening is no tower.
    circuit.towers = circuit.towers.filter(([x, , z]) => !circuit.gates.some(([gx, , gz]) => Math.hypot(gx - x, gz - z) < WIDTH.avenue / 2 + 1));
  }

  // ---- roads out of the gates; where one reaches the sea, a mole with a lighthouse ----
  const roads: Road[] = [];
  const moles: Mole[] = [];
  const ag0 = squares.find((q) => q.kind === 'agora')!;
  const acx = (ag0.rect[0] + ag0.rect[2]) / 2,
    acz = (ag0.rect[1] + ag0.rect[3]) / 2;
  for (const [gx, , gz, turn] of circuit.gates) {
    // Out: across the wall, away from the agora.
    const across = Math.abs(Math.cos(turn)) > 0.5 ? ([0, Math.sign(gz - acz)] as const) : ([Math.sign(gx - acx), 0] as const);
    const pts: [number, number][] = [[r2(gx), r2(gz)]];
    let x = gx,
      z = gz,
      sea = false;
    for (let k = 0; k < 40; k++) {
      x += across[0] * 2;
      z += across[1] * 2;
      if (heightAt(land, x, z) <= MAP.sea + 0.3) {
        sea = true;
        break;
      }
      pts.push([r2(x), r2(z)]);
    }
    if (pts.length < 2) continue;
    roads.push({ points: pts, width: 3.6 });
    if (sea) {
      // The harbour's mole runs on into the sea from the gate on the sacred way's line, a lighthouse at its head; the others are landing stages.
      const harbour = Math.abs(gx - GRID.x0) < 1;
      const [ex, ez] = pts[pts.length - 1];
      const len = harbour ? 26 : 12;
      const hx = ex + across[0] * len,
        hz = ez + across[1] * len;
      const w = 2.6;
      const rect: Rect = across[0] ? [r2(Math.min(ex, hx)), r2(ez - w), r2(Math.max(ex, hx)), r2(ez + w)] : [r2(ex - w), r2(Math.min(ez, hz)), r2(ex + w), r2(Math.max(ez, hz))];
      moles.push({ rect, level: 1.2, light: harbour });
    }
  }

  // ---- the city's own buildings: stoas round the agora ----
  const fixtures: Fixture[] = [];
  const ag = squares.find((s) => s.kind === 'agora')!;
  {
    const [x0, z0, x1, z1] = ag.rect;
    const cx = (x0 + x1) / 2;
    // A long stoa along the north side, facing south; two along the west and east sides, facing in; space left by the sacred way.
    fixtures.push({ type: 'stoa-two-storey', x: r2(cx - 12), z: r2(z0 + 3.4), rotation: 0, scale: 1 });
    fixtures.push({ type: 'stoa-two-storey', x: r2(cx + 12), z: r2(z0 + 3.4), rotation: 0, scale: 1 });
    fixtures.push({ type: 'stoa', x: r2(x0 + 3.4), z: r2((z0 + z1) / 2 + 2), rotation: Math.PI / 2, scale: 1 });
    fixtures.push({ type: 'stoa', x: r2(x1 - 3.4), z: r2((z0 + z1) / 2 + 2), rotation: (Math.PI * 3) / 2, scale: 1 });
    // The market: rows of stalls in the southern quarters, facing in; statues and a column of honour between the paths.
    const cz = (z0 + z1) / 2;
    for (const side of [-1, 1]) {
      fixtures.push({ type: 'market-stalls', x: r2(cx + side * 9.5), z: r2(z1 - 3), rotation: Math.PI, scale: 1 });
      fixtures.push({ type: 'statue', x: r2(cx + side * 10.5), z: r2(cz - 4.5), rotation: side > 0 ? (Math.PI * 3) / 2 : Math.PI / 2, scale: 1 });
    }
    fixtures.push({ type: 'column-of-honour', x: r2(cx - 10.5), z: r2(cz + 5.5), rotation: 0, scale: 1 });
  }
  for (const m of moles.filter((mo) => mo.light)) {
    const [x0, z0, x1, z1] = m.rect;
    const along = x1 - x0 > z1 - z0;
    // At the head of the mole, the end farthest from the town.
    const hx = along ? (Math.abs(x0 - acx) > Math.abs(x1 - acx) ? x0 + 2.4 : x1 - 2.4) : (x0 + x1) / 2,
      hz = along ? (z0 + z1) / 2 : Math.abs(z0 - acz) > Math.abs(z1 - acz) ? z0 + 2.4 : z1 - 2.4;
    fixtures.push({ type: 'lighthouse', x: r2(hx), z: r2(hz), rotation: 0, scale: 1, y: m.level });
  }

  // ---- furniture: lamps and plane trees along the avenues and streets, fountains and benches in the squares ----
  const rnd = seeded(2718);
  const lamps: [number, number, number][] = [];
  const trees: [number, number, number, number, number][] = [];
  const benches: [number, number, number, number][] = [];
  const fountains: [number, number, number][] = [];
  for (const s of streets) {
    const A = nodes[s.a],
      B = nodes[s.b];
    const len = Math.hypot(B.x - A.x, B.z - A.z);
    const ux = (B.x - A.x) / len,
      uz = (B.z - A.z) / len;
    // The curb line of each walkway, a little in from the carriageway.
    const off = s.width / 2 - s.walk + 0.25;
    const clear = Math.max(WIDTH.avenue, s.width) / 2 + 2.5;
    if (s.rank === 'lane') {
      const t = len / 2;
      const side = (Math.round(A.x + A.z) & 1) === 0 ? 1 : -1;
      lamps.push([r2(A.x + ux * t - uz * off * side), r2(A.y + ((B.y - A.y) * t) / len), r2(A.z + uz * t + ux * off * side)]);
      continue;
    }
    const spacing = s.rank === 'avenue' ? 7 : 9.5;
    const count = Math.floor((len - 2 * clear) / spacing);
    if (count < 1) continue;
    const startT = (len - count * spacing) / 2;
    for (let n = 0; n <= count; n++) {
      const t = startT + n * spacing;
      for (const side of [-1, 1]) {
        const x = A.x + ux * t - uz * off * side,
          z = A.z + uz * t + ux * off * side;
        const y = A.y + ((B.y - A.y) * t) / len;
        // Lamps alternate sides; plane trees between them on the avenues.
        if ((n + (side > 0 ? 1 : 0)) % 2 === 0) lamps.push([r2(x), r2(y), r2(z)]);
        else if (s.rank === 'avenue') trees.push([r2(x), r2(y), r2(z), r2(0.85 + rnd() * 0.3), 0]);
      }
    }
  }
  for (const sq of squares) {
    const [x0, z0, x1, z1] = sq.rect;
    const cx = (x0 + x1) / 2,
      cz = (z0 + z1) / 2;
    if (sq.kind === 'agora' || sq.kind === 'grove') fountains.push([r2(cx), sq.level, r2(cz)]);
    if (sq.kind === 'agora') {
      // Benches round the fountain, plane trees at the square's corners.
      for (let n = 0; n < 6; n++) {
        const a = (n / 6) * Math.PI * 2 + Math.PI / 6;
        benches.push([r2(cx + Math.cos(a) * 6.5), sq.level, r2(cz + Math.sin(a) * 6.5), r2(-a + Math.PI / 2)]);
      }
      for (const [tx, tz] of [[x0 + 9, z1 - 4], [x1 - 9, z1 - 4], [cx - 8, cz + 9], [cx + 8, cz + 9]]) trees.push([r2(tx), sq.level, r2(tz), 1.1, 0]);
    }
    if (sq.kind === 'grove') {
      // Olive trees in rows, clear of the paths that cross to the fountain.
      for (let x = x0 + 2.5; x <= x1 - 2.5; x += 4.2)
        for (let z = z0 + 2.5; z <= z1 - 2.5; z += 4.2) {
          if (Math.hypot(x - cx, z - cz) < 6) continue;
          if (onPath(x, z, sq, walkNodes, edges, 1.6)) continue;
          trees.push([r2(x + (rnd() - 0.5) * 0.8), sq.level, r2(z + (rnd() - 0.5) * 0.8), r2(0.75 + rnd() * 0.3), 2]);
        }
      for (let n = 0; n < 4; n++) {
        const a = (n / 4) * Math.PI * 2 + Math.PI / 4;
        benches.push([r2(cx + Math.cos(a) * 4.2), sq.level, r2(cz + Math.sin(a) * 4.2), r2(-a + Math.PI / 2)]);
      }
    }
    if (sq.kind === 'sanctuary') {
      // Cypresses lining the court.
      for (let x = x0 + 3; x <= x1 - 3; x += 5) {
        if (Math.abs(x - cx) < 5) continue;
        trees.push([r2(x), sq.level, r2(z1 - 1.6), 1, 1]);
      }
    }
  }

  const bounds: Rect = [Infinity, Infinity, -Infinity, -Infinity];
  for (const n of nodes) {
    bounds[0] = Math.min(bounds[0], n.x - 3);
    bounds[1] = Math.min(bounds[1], n.z - 3);
    bounds[2] = Math.max(bounds[2], n.x + 3);
    bounds[3] = Math.max(bounds[3], n.z + 3);
  }
  void live;
  return {
    version: 1,
    grid: { x0: GRID.x0, z0: GRID.z0, px: GRID.px, pz: GRID.pz },
    bounds,
    nodes,
    streets,
    squares,
    lots,
    walk: reach,
    fixtures,
    circuit,
    roads,
    moles,
    furniture: { lamps, benches, fountains, trees },
  };
}

/** The height of the street at a point in a street's band, or null if no street is there. */
function gradedStreet(nodes: Node[], index: Map<string, number>, x: number, z: number): number | null {
  const i = Math.round((x - GRID.x0) / GRID.px),
    j = Math.round((z - GRID.z0) / GRID.pz);
  const nx = lineX(i),
    nz = lineZ(j);
  const inX = Math.abs(x - nx) <= WIDTH[rankX(i)] / 2 + 1e-6;
  const inZ = Math.abs(z - nz) <= WIDTH[rankZ(j)] / 2 + 1e-6;
  const at = (a: number, b: number) => {
    const n = index.get(key(a, b));
    return n === undefined ? null : nodes[n].y;
  };
  const alongZ = (li: number, zz: number) => {
    const j0 = Math.floor((zz - GRID.z0) / GRID.pz);
    const a = at(li, j0),
      b = at(li, j0 + 1);
    if (a === null || b === null) return a ?? b;
    return a + (b - a) * ((zz - lineZ(j0)) / GRID.pz);
  };
  const alongX = (lj: number, xx: number) => {
    const i0 = Math.floor((xx - GRID.x0) / GRID.px);
    const a = at(i0, lj),
      b = at(i0 + 1, lj);
    if (a === null || b === null) return a ?? b;
    return a + (b - a) * ((xx - lineX(i0)) / GRID.px);
  };
  if (inX && inZ) {
    // A crossing: under both streets that meet there, so the lower of their grades.
    const ys = [alongZ(i, z), alongX(j, x)].filter((v): v is number => v !== null);
    return ys.length ? Math.min(...ys) : at(i, j);
  }
  if (inX) {
    // A street along z, on line i, between the crossings above and below.
    const j0 = Math.floor((z - GRID.z0) / GRID.pz);
    const a = at(i, j0),
      b = at(i, j0 + 1);
    if (a === null || b === null) return a ?? b;
    const t = (z - lineZ(j0)) / GRID.pz;
    return a + (b - a) * t;
  }
  if (inZ) {
    const i0 = Math.floor((x - GRID.x0) / GRID.px);
    const a = at(i0, j),
      b = at(i0 + 1, j);
    if (a === null || b === null) return a ?? b;
    const t = (x - lineX(i0)) / GRID.px;
    return a + (b - a) * t;
  }
  // Just off the street (the edge of a terrace): the nearer street line.
  const dx = Math.abs(x - nx) - WIDTH[rankX(i)] / 2,
    dz = Math.abs(z - nz) - WIDTH[rankZ(j)] / 2;
  if (Math.min(dx, dz) > 0.05) return null;
  return dx < dz ? gradedStreet(nodes, index, nx + Math.sign(x - nx) * (WIDTH[rankX(i)] / 2), z) : gradedStreet(nodes, index, x, nz + Math.sign(z - nz) * (WIDTH[rankZ(j)] / 2));
}

/** True when a point lies within w of any walk edge that touches the square. */
function onPath(x: number, z: number, sq: Square, pts: [number, number, number][], edges: [number, number][], w: number): boolean {
  for (const [a, b] of edges) {
    const A = pts[a],
      B = pts[b];
    if (!inRect(sq.rect, A[0], A[2], 2.5) && !inRect(sq.rect, B[0], B[2], 2.5)) continue;
    const dx = B[0] - A[0],
      dz = B[2] - A[2];
    const t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (z - A[2]) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(A[0] + dx * t - x, A[2] + dz * t - z) < w) return true;
  }
  return false;
}

/** The walk network reachable from one point, renumbered. */
function keepConnected(nodes: [number, number, number][], edges: [number, number][], use: number[], from: number): Walk {
  const adj = nodes.map(() => [] as number[]);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  const seen = new Set<number>();
  const stack = [Math.max(0, from)];
  while (stack.length) {
    const n = stack.pop()!;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const m of adj[n]) stack.push(m);
  }
  const map = new Map<number, number>();
  const out: Walk = { nodes: [], edges: [], use: [] };
  [...seen].sort((a, b) => a - b).forEach((n) => map.set(n, out.nodes.push(nodes[n]) - 1));
  edges.forEach(([a, b], k) => {
    if (map.has(a) && map.has(b)) {
      out.edges.push([map.get(a)!, map.get(b)!]);
      out.use.push(use[k]);
    }
  });
  return out;
}

/** How far under its slab of paving or terrace the town's land lies: the slabs are drawn, the land under them never shows. */
export const UNDER = 0.4;

/**
 * The land graded to the city: under every terrace, square and street, just
 * below its level (the city is drawn as solid slabs on it); beyond the last
 * street, easing back to the land.
 */
export function gradeCity(land: Terrain, plan: CityPlan): Terrain {
  const heights = new Float32Array(land.heights);
  const step = land.size / (land.res - 1);
  const index = new Map<string, number>();
  plan.nodes.forEach((n, k) => index.set(key(Math.round((n.x - GRID.x0) / GRID.px), Math.round((n.z - GRID.z0) / GRID.pz)), k));
  const levels: { rect: Rect; y: number }[] = [...plan.squares.map((s) => ({ rect: s.rect, y: s.level }))];
  for (const l of plan.lots) if (l.part === 'whole') levels.push({ rect: l.rect, y: l.ground });
  const [bx0, bz0, bx1, bz1] = plan.bounds;
  // How far the grading reaches beyond the town's last street, easing back to the land: little, so the hills come down to the wall.
  const reach = 4;
  for (let j = 0; j < land.res; j++) {
    const z = -land.size / 2 + step * j;
    if (z < bz0 - reach || z > bz1 + reach) continue;
    for (let i = 0; i < land.res; i++) {
      const x = -land.size / 2 + step * i;
      if (x < bx0 - reach || x > bx1 + reach) continue;
      const k = j * land.res + i;
      // Under a terrace or a square, and the street beside it, the land keeps below both.
      const lv = levels.find((l) => inRect(l.rect, x, z, 0.9));
      const s = inStreetOfTown(plan, x, z, 0.9) ? gradedStreet(plan.nodes, index, x, z) : null;
      if (lv || s !== null) {
        heights[k] = Math.min(lv?.y ?? Infinity, s ?? Infinity, nearStreetY(plan, index, x, z)) - UNDER;
        continue;
      }
      // Beyond the last street: ease from the street's height back to the land.
      const near = nearestStreetPoint(plan, index, x, z);
      if (near && near.d < reach) {
        const t = near.d / reach;
        const e = t * t * (3 - 2 * t);
        heights[k] = near.y - UNDER + (heights[k] - near.y + UNDER) * e;
      }
    }
  }
  return { size: land.size, res: land.res, heights };
}

/** The lowest street height within a grid step of a point (so land at a terrace's edge stays under the street beside it). */
function nearStreetY(plan: CityPlan, index: Map<string, number>, x: number, z: number): number {
  let y = Infinity;
  for (const [dx, dz] of [[0, 0], [0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]]) {
    const s = gradedStreet(plan.nodes, index, x + dx, z + dz);
    if (s !== null) y = Math.min(y, s);
  }
  return y;
}

/** Whether a point is on one of the plan's streets (not just on a grid line beyond the town). */
function inStreetOfTown(plan: CityPlan, x: number, z: number, m = 0.01): boolean {
  for (const s of plan.streets) {
    const A = plan.nodes[s.a],
      B = plan.nodes[s.b];
    const r: Rect = [Math.min(A.x, B.x) - s.width / 2, Math.min(A.z, B.z) - s.width / 2, Math.max(A.x, B.x) + s.width / 2, Math.max(A.z, B.z) + s.width / 2];
    if (inRect(r, x, z, m)) return true;
  }
  return false;
}

function nearestStreetPoint(plan: CityPlan, index: Map<string, number>, x: number, z: number): { d: number; y: number } | null {
  let best: { d: number; y: number } | null = null;
  for (const s of plan.streets) {
    const A = plan.nodes[s.a],
      B = plan.nodes[s.b];
    const r: Rect = [Math.min(A.x, B.x) - s.width / 2, Math.min(A.z, B.z) - s.width / 2, Math.max(A.x, B.x) + s.width / 2, Math.max(A.z, B.z) + s.width / 2];
    const px = Math.max(r[0], Math.min(r[2], x)),
      pz = Math.max(r[1], Math.min(r[3], z));
    const d = Math.hypot(px - x, pz - z);
    if (best && d >= best.d) continue;
    const y = gradedStreet(plan.nodes, index, px, pz);
    if (y !== null) best = { d, y };
  }
  return best;
}

/** A fast test of whether a point is in the town — on its plots, squares or streets — within a margin (up to 6). */
export function townArea(plan: CityPlan): (x: number, z: number, margin?: number) => boolean {
  const rects: Rect[] = [...plan.lots.filter((l) => l.part === 'whole').map((l) => l.rect), ...plan.squares.map((q) => q.rect)];
  // The roads out of the gates, and the moles: no tree on them either.
  for (const r of plan.roads)
    for (let k = 1; k < r.points.length; k++) {
      const [ax, az] = r.points[k - 1],
        [bx, bz] = r.points[k];
      rects.push([Math.min(ax, bx) - r.width / 2, Math.min(az, bz) - r.width / 2, Math.max(ax, bx) + r.width / 2, Math.max(az, bz) + r.width / 2]);
    }
  for (const m of plan.moles) rects.push(m.rect);
  for (const s of plan.streets) {
    const A = plan.nodes[s.a],
      B = plan.nodes[s.b];
    rects.push([Math.min(A.x, B.x) - s.width / 2, Math.min(A.z, B.z) - s.width / 2, Math.max(A.x, B.x) + s.width / 2, Math.max(A.z, B.z) + s.width / 2]);
  }
  const C = 16,
    M = 6;
  const cells = new Map<string, Rect[]>();
  for (const r of rects)
    for (let i = Math.floor((r[0] - M) / C); i <= Math.floor((r[2] + M) / C); i++)
      for (let j = Math.floor((r[1] - M) / C); j <= Math.floor((r[3] + M) / C); j++) {
        const k = `${i}:${j}`;
        cells.set(k, [...(cells.get(k) ?? []), r]);
      }
  return (x, z, margin = 0) => (cells.get(`${Math.floor(x / C)}:${Math.floor(z / C)}`) ?? []).some((r) => inRect(r, x, z, margin));
}

export { TOWN };
