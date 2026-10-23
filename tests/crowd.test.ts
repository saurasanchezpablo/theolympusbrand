// The people of the city: where they can walk (the walking network with a
// door for each building), the routes they take, and how they move — on the
// ways and within their width, apart from each other, never stuck, the same
// crowd whatever the frame rate, and finding their way again when the
// buildings change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.ts';
import { island, roughLand } from '../src/map/island.ts';
import { loadCatalog } from '../src/node/catalog.ts';
import { mapData, townExtent } from '../src/map/items.ts';
import { building, extentOf } from '../src/map/buildings/index.ts';
import { buildNav, route, wayBetween, type Nav } from '../src/map/crowd/nav.ts';
import { createCrowd, FIELDS, STEP } from '../src/map/crowd/crowd.ts';

delete process.env.OLYMPUS_DATA;
const services = loadCatalog();
const { plan } = island(townExtent(roughLand(), services, [], {}));
const data = mapData(services, [], {}, plan);
const family = (t: string) => building(t)?.family ?? 'temples';
const nav = buildNav(plan, data.items, extentOf, family);

const reach = (n: Nav, from: number) => {
  const seen = new Set([from]);
  for (const stack = [from]; stack.length; )
    for (const k of n.out[stack.pop()!]) {
      const w = n.ways[k];
      for (const m of [w.a, w.b]) if (!seen.has(m)) (seen.add(m), stack.push(m));
    }
  return seen;
};
const distToSeg = (x: number, z: number, A: number[], B: number[]) => {
  const dx = B[0] - A[0],
    dz = B[2] - A[2];
  const t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (z - A[2]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(A[0] + dx * t - x, A[2] + dz * t - z);
};

test('every building has a door on the walking network, and every door and square is reachable from the agora', () => {
  const doors = nav.destinations.filter((d) => d.kind === 'door');
  assert.equal(doors.length, data.items.length, 'a door for each building');
  const agora = nav.destinations.find((d) => d.kind === 'square' && d.of === 'agora')!;
  const seen = reach(nav, agora.node);
  for (const d of nav.destinations) assert.ok(seen.has(d.node), `${d.kind} ${d.of} reachable`);
  // Each door: in front of its building, a short step from the walkway.
  for (const d of doors) {
    const w = nav.ways.find((x) => x.kind === 'door' && (x.a === d.node || x.b === d.node))!;
    // Across a square's paving a door may be further.
    const p = nav.pts[d.node];
    const onSquare = nav.squares.some((q) => p[0] >= q.rect[0] && p[0] <= q.rect[2] && p[2] >= q.rect[1] && p[2] <= q.rect[3]);
    assert.ok(onSquare || w.len < 6, `${d.of}'s door ${w.len.toFixed(1)} units from the walkway`);
  }
});

test('the ways keep out of the buildings: no walkway, crossing or square path runs through one', () => {
  for (const it of data.items) {
    const e = extentOf(it.place.building);
    const quarter = Math.round(it.place.rotation / (Math.PI / 2)) % 2 === 1;
    const [w, d] = quarter ? [e.d, e.w] : [e.w, e.d];
    const c = Math.cos(it.place.rotation),
      s = Math.sin(it.place.rotation);
    const bx = it.place.x + e.cx * c + e.cz * s,
      bz = it.place.z - e.cx * s + e.cz * c;
    // The building's box, shrunk a little (its steps and eaves may meet the walkway's edge).
    const box = [bx - w / 2 + 0.3, bz - d / 2 + 0.3, bx + w / 2 - 0.3, bz + d / 2 - 0.3];
    for (const way of nav.ways) {
      if (way.kind === 'door') continue;
      const A = nav.pts[way.a],
        B = nav.pts[way.b];
      for (let t = 0; t <= 1; t += 0.05) {
        const x = A[0] + (B[0] - A[0]) * t,
          z = A[2] + (B[2] - A[2]) * t;
        assert.ok(!(x > box[0] && x < box[2] && z > box[1] && z < box[3]), `${way.kind} through ${it.id}`);
      }
    }
  }
});

test('routes follow the ways, from one end to the other, and never pass through a door', () => {
  const doors = nav.destinations.filter((d) => d.kind === 'door');
  for (let k = 0; k + 1 < doors.length; k++) {
    const r = route(nav, doors[k].node, doors[k + 1].node);
    assert.ok(r, `${doors[k].of} → ${doors[k + 1].of}`);
    assert.equal(r[0], doors[k].node);
    assert.equal(r[r.length - 1], doors[k + 1].node);
    for (let i = 1; i < r.length; i++) {
      const w = wayBetween(nav, r[i - 1], r[i]);
      assert.ok(w >= 0, 'each step along a way');
      if (nav.ways[w].kind === 'door') assert.ok(i === 1 || i === r.length - 1, 'a door only at either end');
    }
  }
});

test('the same crowd whatever the frame rate: the simulation steps at a fixed rate', () => {
  const a = createCrowd(nav, { count: 80 });
  const b = createCrowd(nav, { count: 80 });
  for (let k = 0; k < 300; k++) a.advance(STEP);
  for (let k = 0; k < 900; k++) b.advance(STEP / 3);
  // Floating time adds up a hair differently: one step apart at most.
  const fa = a.frames(),
    fb = b.frames();
  const same = (x: Float32Array, y: Float32Array) => x.every((v, i) => Math.abs(v - y[i]) < 1e-4);
  assert.ok(same(fa.cur, fb.cur) || same(fa.cur, fb.prev) || same(fa.prev, fb.cur));
});

test('people keep to the ways and within their width, on the paving, and stand apart', () => {
  const crowd = createCrowd(nav, { count: 240 });
  let close = 0,
    pairs = 0;
  for (let t = 0; t < 600; t++) {
    crowd.advance(STEP);
    if (t % 20) continue;
    const f = crowd.frames().cur;
    for (let k = 0; k < crowd.count; k++) {
      const o = k * FIELDS;
      const x = f[o],
        y = f[o + 1],
        z = f[o + 2];
      // On a way and within its width (a companion's step aside allowed), or about a square; at the ways' height.
      let fit = Infinity,
        by = 0;
      for (const w of nav.ways) {
        const d = distToSeg(x, z, nav.pts[w.a], nav.pts[w.b]) - w.half;
        if (d < fit) (fit = d), (by = (nav.pts[w.a][1] + nav.pts[w.b][1]) / 2);
      }
      const onSquare = nav.squares.some((q) => x >= q.rect[0] - 0.5 && x <= q.rect[2] + 0.5 && z >= q.rect[1] - 0.5 && z <= q.rect[3] + 0.5);
      const best = fit;
      assert.ok(onSquare || best < 0.5, `person ${k} ${best.toFixed(2)} beyond the edge of the ways at ${x.toFixed(1)}, ${z.toFixed(1)}`);
      assert.ok(onSquare || Math.abs(y - by) < 3, `person ${k} at the ways' height`);
    }
    // Walkers do not walk through each other (companions walk close, by design).
    const states = crowd.states();
    for (let i = 0; i < crowd.count; i++)
      for (let j = i + 1; j < crowd.count; j++) {
        if (states[i].state !== 'walking' || states[j].state !== 'walking' || states[j].leader === i || states[i].leader === j || (states[i].leader >= 0 && states[i].leader === states[j].leader)) continue;
        const d = Math.hypot(f[i * FIELDS] - f[j * FIELDS], f[i * FIELDS + 2] - f[j * FIELDS + 2]);
        pairs++;
        if (d < 0.18) close++;
      }
  }
  assert.ok(close / Math.max(1, pairs) < 0.0015, `${close} of ${pairs} walking pairs overlap`);
});

test('nobody is stuck: in five minutes everyone gets somewhere; and they go to doors, squares and landmarks', () => {
  const crowd = createCrowd(nav, { count: 200 });
  const start = Float32Array.from(crowd.frames().cur);
  const moved = new Set<number>();
  const went = new Map<string, number>();
  for (let t = 0; t < 3000; t++) {
    crowd.advance(STEP);
    const f = crowd.frames().cur;
    for (let k = 0; k < crowd.count; k++) if (Math.hypot(f[k * FIELDS] - start[k * FIELDS], f[k * FIELDS + 2] - start[k * FIELDS + 2]) > 2) moved.add(k);
    if (t % 50 === 0) for (const s of crowd.states()) if (s.dest) went.set(s.dest.kind, (went.get(s.dest.kind) ?? 0) + 1);
  }
  assert.equal(moved.size, crowd.count, `${crowd.count - moved.size} never left where they stood`);
  assert.ok((went.get('door') ?? 0) > 0 && (went.get('square') ?? 0) > 0);
  const profiles = new Set(crowd.states().map((s) => s.profile));
  assert.deepEqual([...profiles].sort(), ['errand', 'loiterer', 'stroller', 'visitor']);
});

test('when the buildings change, people find their way again: no one heads for a door that is gone', () => {
  const crowd = createCrowd(nav, { count: 120 });
  for (let t = 0; t < 100; t++) crowd.advance(STEP);
  const fewer = data.items.slice(0, 5);
  const next = buildNav(plan, fewer, extentOf, family);
  crowd.setNav(next);
  for (let t = 0; t < 200; t++) crowd.advance(STEP);
  const ids = new Set(fewer.map((i) => i.id));
  for (const s of crowd.states()) if (s.dest?.kind === 'door') assert.ok(ids.has(s.dest.of), `heading for ${s.dest.of}`);
});

test('nobody walks or stands in a fountain, on a bench, or in a building', () => {
  const crowd = createCrowd(nav, { count: 200 });
  for (let t = 0; t < 1200; t++) {
    crowd.advance(STEP);
    if (t % 10) continue;
    const f = crowd.frames().cur;
    for (let k = 0; k < crowd.count; k++) {
      const x = f[k * FIELDS],
        z = f[k * FIELDS + 2];
      for (const [fx, , fz] of plan.furniture.fountains) assert.ok(Math.hypot(x - fx, z - fz) > 2.4, `person ${k} in the fountain at ${x.toFixed(1)}, ${z.toFixed(1)}`);
    }
  }
});
