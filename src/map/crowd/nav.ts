// Where the people of the city can walk, and where they go: the city's
// walking network (both walkways of every street, the stepping-stone
// crossings, the paths over the squares) with, added to it, a door for every
// building on the map — a short path from the walkway to the middle of its
// front — and the places people stand about in the squares. Each way knows
// how wide it is (people keep within it) and whether it crosses a carriageway
// (people wait their turn there). Routes are found with A*.
//
// Pure: the same plan and buildings, the same graph.

import type { CityPlan, Rect, Square } from '../city.ts';
import type { MapEntry } from '../items.ts';
import type { Extent } from '../placement.ts';

/** How high a walkway stands over its roadway (the city's curb, as drawn). */
export const CURB = 0.15;

export type WayKind = 'walkway' | 'crossing' | 'square' | 'door';
export type Way = { a: number; b: number; len: number; kind: WayKind; /** half the width people may use, either side of the middle */ half: number; cost: number };
export type Destination = { kind: 'door' | 'square' | 'fountain'; node: number; /** an item's id, or the square's kind */ of: string; weight: number; /** where to stand about it: a centre and how far round it */ spread: number };

export type Nav = {
  /** Points [x, y, z]: y is the walking surface (a walkway's top, a square's paving). */
  pts: [number, number, number][];
  /** The points that can be reached from the agora (where people may start). */
  reachable: number[];
  ways: Way[];
  /** Ways out of each point (indices into `ways`). */
  out: number[][];
  destinations: Destination[];
  squares: Square[];
  /** The middles of the squares (where their fountains stand): a way through, never a place to stand or leave from. */
  centres: Set<number>;
  /** Whether a person may stand at a point: clear of the buildings, the city's furniture, the fountains, the benches and the trees. */
  free(x: number, z: number): boolean;
  /** Whether a person may walk straight from one point to another. */
  clear(ax: number, az: number, bx: number, bz: number): boolean;
};

const inRect = (r: Rect, x: number, z: number, m = 0) => x >= r[0] - m && x <= r[2] + m && z >= r[1] - m && z <= r[3] + m;

/** Buildings people go to: their weight by family (temples and the agora's halls draw more than a workshop or a rack hall). */
const DRAW: Record<string, number> = { temples: 3, sanctuary: 2.5, civic: 2.5, sport: 2, monuments: 1.5, works: 1, machines: 0.6 };

/**
 * The graph for a plan and the buildings on it. `extent(type)` and
 * `family(type)` describe a building (buildings/index.ts in the page and the
 * tests; passed in so this module stays free of the buildings' drawings).
 */
export function buildNav(plan: CityPlan, items: readonly Pick<MapEntry, 'id' | 'place'>[], extent: (type: string) => Extent, family: (type: string) => string): Nav {
  const squares = plan.squares;
  // What stands in the way: the buildings on the map and the city's own (stoas, statues, the lighthouse), each its box on the ground.
  const blocks: Rect[] = [
    ...items.map((it) => boxOf(it.place.x, it.place.z, it.place.rotation, extent(it.place.building), 1)),
    ...plan.fixtures.map((f) => boxOf(f.x, f.z, f.rotation, extent(f.type), f.scale)),
  ].map(([x0, z0, x1, z1]) => [x0 + 0.3, z0 + 0.3, x1 - 0.3, z1 - 0.3] as Rect);
  const blocked = (A: [number, number, number], B: [number, number, number]) => {
    for (let t = 0; t <= 1; t += 0.04) {
      const x = A[0] + (B[0] - A[0]) * t,
        z = A[2] + (B[2] - A[2]) * t;
      if (blocks.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3])) return true;
    }
    return false;
  };
  const onSquare = (x: number, z: number) => squares.find((q) => inRect(q.rect, x, z, 0.05));
  const pts: [number, number, number][] = plan.walk.nodes.map(([x, y, z]) => {
    // On a square, its paving; elsewhere the walkway, a curb above the crossing's height.
    const q = onSquare(x, z);
    return [x, q ? q.level : y + CURB, z];
  });
  const ways: Way[] = [];
  const add = (a: number, b: number, kind: WayKind, half: number) => {
    const len = Math.max(0.01, Math.hypot(pts[b][0] - pts[a][0], pts[b][2] - pts[a][2]));
    // A crossing costs more (people prefer not to cross), a square a little less (they like to cross one).
    const cost = len * (kind === 'crossing' ? 1.6 : kind === 'square' ? 0.9 : kind === 'door' ? 1 : 1);
    ways.push({ a, b, len, kind, half, cost });
  };
  plan.walk.edges.forEach(([a, b], k) => {
    const A = pts[a],
      B = pts[b];
    // A way a building now stands on (a path over a square where a stadium was built, say) is no way.
    if (blocked(A, B)) return;
    if (onSquare(A[0], A[2]) || onSquare(B[0], B[2])) {
      // A path over a square (from a corner of its streets to its middle): wide.
      add(a, b, 'square', 1.6);
      return;
    }
    // Along a street both ends keep the same side; across one, the line runs over the carriageway.
    const use = plan.walk.use[k];
    const across = isCrossing(plan, A, B);
    add(a, b, across ? 'crossing' : 'walkway', across ? 0.3 : use >= 3 ? 0.5 : use >= 2 ? 0.38 : 0.26);
  });

  // ---- the squares: their centres, where people stand about ----
  const destinations: Destination[] = [];
  const centreOf = new Map<Square, number>();
  for (const q of squares) {
    const cx = (q.rect[0] + q.rect[2]) / 2,
      cz = (q.rect[1] + q.rect[3]) / 2;
    let best = -1,
      d = Infinity;
    pts.forEach((p, k) => {
      const e = Math.hypot(p[0] - cx, p[2] - cz);
      if (e < d) (d = e), (best = k);
    });
    if (best < 0) continue;
    centreOf.set(q, best);
    const reach = Math.min(q.rect[2] - q.rect[0], q.rect[3] - q.rect[1]) / 2;
    const pull = q.kind === 'agora' ? 5 : q.kind === 'sanctuary' ? 3 : q.kind === 'grove' ? 2.5 : 1;
    destinations.push({ kind: 'square', node: best, of: q.kind, weight: pull, spread: reach * 0.6 });
  }
  // What can be reached from the agora so far: doors open onto it, never onto a piece of walkway cut off behind buildings.
  const agoraNode = destinations.find((d) => d.of === 'agora')?.node ?? 0;
  const reached = new Set<number>([agoraNode]);
  {
    const adj = pts.map(() => [] as number[]);
    for (const w of ways) (adj[w.a].push(w.b), adj[w.b].push(w.a));
    for (const stack = [agoraNode]; stack.length; ) for (const m of adj[stack.pop()!]) if (!reached.has(m)) (reached.add(m), stack.push(m));
  }

  // ---- doors: a short path from the walkway (or across a square's paving) to the middle of each building's front ----
  for (const it of items) {
    const e = extent(it.place.building);
    const r = it.place.rotation;
    // The box's centre, as the building stands; its front faces (sin r, cos r).
    const c = Math.cos(r),
      s = Math.sin(r);
    const bx = it.place.x + e.cx * c + e.cz * s,
      bz = it.place.z - e.cx * s + e.cz * c;
    // The door: in the middle of its front — or, for a building turned to fit its plot with its front to a neighbour, of the side nearest a way.
    const faces = [0, Math.PI / 2, -Math.PI / 2, Math.PI].map((turn) => {
      const a = r + turn;
      // Half the building's own depth to its front or back, half its width to a side.
      const deep = (Math.abs(Math.sin(turn)) > 0.5 ? e.w : e.d) / 2;
      const p: [number, number, number] = [bx + Math.sin(a) * (deep + 0.25), 0, bz + Math.cos(a) * (deep + 0.25)];
      const q = onSquare(p[0], p[2]);
      // Onto a square: straight across its paving to its middle, when nothing stands between.
      const centre = q ? centreOf.get(q) : undefined;
      if (centre !== undefined && reached.has(centre) && !blocked(p, pts[centre])) return { p, q, centre, d: 0 };
      const near = nearestWay(pts, ways, p[0], p[2], (w) => w.kind !== 'door' && w.kind !== 'crossing' && reached.has(w.a) && reached.has(w.b));
      if (!near) return null;
      const A = pts[ways[near.way].a],
        B = pts[ways[near.way].b];
      const foot: [number, number, number] = [A[0] + (B[0] - A[0]) * near.t, 0, A[2] + (B[2] - A[2]) * near.t];
      return { p, q, near, d: near.d + (blocked(p, foot) ? 100 : 0) };
    });
    const face = faces.find((f) => f && f.d < 2.5) ?? faces.filter((f): f is NonNullable<typeof f> => !!f).sort((x, y) => x.d - y.d)[0];
    if (!face) continue;
    const at = 'centre' in face && face.centre !== undefined ? face.centre : splitWay(pts, ways, face.near!.way, face.near!.t);
    reached.add(at);
    const dy = face.q ? face.q.level : pts[at][1];
    const d = pts.push([round(face.p[0]), dy, round(face.p[2])]) - 1;
    reached.add(d);
    add(at, d, 'door', 0.4);
    destinations.push({ kind: 'door', node: d, of: it.id, weight: DRAW[family(it.place.building)] ?? 1, spread: 0.6 });
  }

  const out: number[][] = pts.map(() => []);
  ways.forEach((w, k) => (out[w.a].push(k), out[w.b].push(k)));
  // Only what can be reached from the agora: nobody heads for a door or a square cut off by a building.
  const agora = destinations.find((d) => d.kind === 'square' && d.of === 'agora');
  const seen = new Set<number>([agora?.node ?? 0]);
  for (const stack = [agora?.node ?? 0]; stack.length; )
    for (const k of out[stack.pop()!])
      for (const m of [ways[k].a, ways[k].b])
        if (!seen.has(m)) {
          seen.add(m);
          stack.push(m);
        }
  // Where nobody stands: the buildings (as above), the fountains' basins, the benches, the trees' trunks in the squares.
  const discs: [number, number, number][] = [
    // A fountain with room for a companion walking on the inside of its leader.
    ...plan.furniture.fountains.map(([x, , z]) => [x, z, 3.3] as [number, number, number]),
    ...plan.furniture.benches.map(([x, , z]) => [x, z, 0.9] as [number, number, number]),
    ...plan.furniture.trees.map(([x, , z, scale]) => [x, z, 0.5 * scale] as [number, number, number]),
  ];
  const free = (x: number, z: number) => !blocks.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3]) && !discs.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r);
  const clear = (ax: number, az: number, bx: number, bz: number) => {
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.4));
    for (let k = 1; k <= n; k++) if (!free(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n)) return false;
    return true;
  };
  return { pts, ways, out, reachable: [...seen].sort((a, b) => a - b), destinations: destinations.filter((d) => seen.has(d.node)), squares, centres: new Set(centreOf.values()), free, clear };
}

/** A building's box on the ground as it stands (its extent turned by quarter turns, about its place). */
function boxOf(x: number, z: number, rotation: number, e: Extent, scale: number): Rect {
  const quarter = Math.round(rotation / (Math.PI / 2)) % 2 === 1;
  const [w, d] = quarter ? [e.d, e.w] : [e.w, e.d];
  const c = Math.cos(rotation),
    s = Math.sin(rotation);
  const bx = x + (e.cx * c + e.cz * s) * scale,
    bz = z + (-e.cx * s + e.cz * c) * scale;
  return [bx - (w * scale) / 2, bz - (d * scale) / 2, bx + (w * scale) / 2, bz + (d * scale) / 2];
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Whether a walking edge crosses a carriageway: its two ends are on opposite walkways of one street. */
function isCrossing(plan: CityPlan, A: [number, number, number], B: [number, number, number]): boolean {
  const dx = Math.abs(B[0] - A[0]),
    dz = Math.abs(B[2] - A[2]);
  // Crossings are short and run straight across a street (stepping stones from corner to corner).
  return Math.hypot(dx, dz) < 7.2 && plan.streets.some((s) => {
    const P = plan.nodes[s.a],
      Q = plan.nodes[s.b];
    const alongX = Math.abs(Q.x - P.x) > Math.abs(Q.z - P.z);
    const mx = (A[0] + B[0]) / 2,
      mz = (A[2] + B[2]) / 2;
    const [x0, x1] = [Math.min(P.x, Q.x), Math.max(P.x, Q.x)],
      [z0, z1] = [Math.min(P.z, Q.z), Math.max(P.z, Q.z)];
    // The middle of the edge lies on the carriageway, and the edge runs across the street's line.
    const onCarriage = alongX ? Math.abs(mz - P.z) < s.width / 2 - s.walk && mx >= x0 - 3.2 && mx <= x1 + 3.2 : Math.abs(mx - P.x) < s.width / 2 - s.walk && mz >= z0 - 3.2 && mz <= z1 + 3.2;
    return onCarriage && (alongX ? dz > dx : dx > dz);
  });
}

/** The way nearest a point, and how far along it the point's foot lies. */
export function nearestWay(pts: [number, number, number][], ways: Way[], x: number, z: number, ok: (w: Way) => boolean = () => true): { way: number; t: number; d: number } | null {
  let best: { way: number; t: number; d: number } | null = null;
  ways.forEach((w, k) => {
    if (!ok(w)) return;
    const A = pts[w.a],
      B = pts[w.b];
    const dx = B[0] - A[0],
      dz = B[2] - A[2];
    const t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (z - A[2]) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(A[0] + dx * t - x, A[2] + dz * t - z);
    if (!best || d < best.d) best = { way: k, t, d };
  });
  return best;
}

/** A point on a way, made a node of the graph: the way is split in two there (an end, when the point is at one). */
function splitWay(pts: [number, number, number][], ways: Way[], k: number, t: number): number {
  const w = ways[k];
  if (t < 0.02) return w.a;
  if (t > 0.98) return w.b;
  const A = pts[w.a],
    B = pts[w.b];
  const n = pts.push([round(A[0] + (B[0] - A[0]) * t), A[1] + (B[1] - A[1]) * t, round(A[2] + (B[2] - A[2]) * t)]) - 1;
  const b = w.b;
  ways[k] = { ...w, b: n, len: w.len * t, cost: w.cost * t };
  ways.push({ ...w, a: n, b, len: w.len * (1 - t), cost: w.cost * (1 - t) });
  return n;
}

/** The cheapest route between two points of the graph (A* by straight-line distance), as the points to pass; null when none. */
export function route(nav: Nav, from: number, to: number): number[] | null {
  if (from === to) return [from];
  const { pts, ways, out } = nav;
  const h = (n: number) => Math.hypot(pts[n][0] - pts[to][0], pts[n][2] - pts[to][2]) * 0.9;
  const g = new Map<number, number>([[from, 0]]);
  const came = new Map<number, number>();
  // A small binary heap of [f, node].
  const heap: [number, number][] = [[h(from), from]];
  const push = (e: [number, number]) => {
    heap.push(e);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const closed = new Set<number>();
  while (heap.length) {
    const [, n] = pop();
    if (n === to) {
      const path = [to];
      for (let c = to; came.has(c); ) path.push((c = came.get(c)!));
      return path.reverse();
    }
    if (closed.has(n)) continue;
    closed.add(n);
    for (const k of out[n]) {
      const w = ways[k];
      const m = w.a === n ? w.b : w.a;
      // A door is a way in, not a way through: only to the door asked for.
      if (w.kind === 'door' && m !== to && n !== from) continue;
      const cost = g.get(n)! + w.cost;
      if (cost < (g.get(m) ?? Infinity)) {
        g.set(m, cost);
        came.set(m, n);
        push([cost + h(m), m]);
      }
    }
  }
  return null;
}

/** The way between two neighbouring points, or -1. */
export function wayBetween(nav: Nav, a: number, b: number): number {
  for (const k of nav.out[a]) {
    const w = nav.ways[k];
    if ((w.a === a && w.b === b) || (w.a === b && w.b === a)) return k;
  }
  return -1;
}
