// The city grows with the buildings on the map: a town of n blocks is the
// first n of a fixed order, so a larger town only adds — every plot of a
// smaller town is in it, unchanged — and every stage is a whole town on its
// own. How many blocks the buildings call for: enough plots, the town round
// them, never short of a block the owner built on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTerrain } from '../src/map/terrain.ts';
import { fullExtent, growthOf, planCity, type CityPlan, type Rect } from '../src/map/city.ts';
import { autoPlace, fitOnLot } from '../src/map/placement.ts';
import { BUILDINGS, buildingInfo, extentOf } from '../src/map/buildings/index.ts';
import { MIN_EXTENT, extentFor, ownedLots, type Wanted } from '../src/map/world.ts';

const land = makeTerrain();
const full = fullExtent(land);
const STAGES = [growthOf(land).core, MIN_EXTENT, 50, 70, 90, full];
const plans = new Map(STAGES.map((n) => [n, planCity(land, n)]));
const band = (p: CityPlan, s: CityPlan['streets'][number]): Rect => {
  const A = p.nodes[s.a],
    B = p.nodes[s.b];
  return [Math.min(A.x, B.x) - s.width / 2, Math.min(A.z, B.z) - s.width / 2, Math.max(A.x, B.x) + s.width / 2, Math.max(A.z, B.z) + s.width / 2];
};
const overlap = (a: Rect, b: Rect, m = 0) => a[0] < b[2] - m && b[0] < a[2] - m && a[1] < b[3] - m && b[1] < a[3] - m;

const kinds = BUILDINGS.filter((k) => k.kind === 'service').map((k) => k.id);
const itemsOf = (count: number): Wanted[] => Array.from({ length: count }, (_, i) => ({ id: `item-${String(i).padStart(3, '0')}`, kind: i % 5 === 0 ? 'machine' : 'service', building: i % 5 === 0 ? 'rack-hall' : kinds[i % kinds.length] }));

test('the full town is the city as it always was: growth only decides how much of it there is', () => {
  assert.deepEqual(planCity(land, full), planCity(land));
  assert.deepEqual(planCity(land, 10_000), planCity(land), 'never more than the land allows');
  assert.ok(planCity(land, 1).lots.length > 0, 'never less than the core: the agora and the sacred way to the sanctuary');
  assert.deepEqual(['agora', 'sanctuary'], planCity(land, 1).squares.map((s) => s.kind));
});

test('a larger town only adds: every plot of a smaller town is in it, unchanged, under the same id', () => {
  for (let k = 1; k < STAGES.length; k++) {
    const small = plans.get(STAGES[k - 1])!,
      large = plans.get(STAGES[k])!;
    const byId = new Map(large.lots.map((l) => [l.id, l]));
    for (const l of small.lots) {
      const m = byId.get(l.id);
      assert.ok(m, `${l.id} (town of ${STAGES[k - 1]}) is still there in a town of ${STAGES[k]}`);
      assert.deepEqual([m.rect, m.part, m.district, m.facing, m.parent], [l.rect, l.part, l.district, l.facing, l.parent], l.id);
    }
    assert.ok(large.lots.length > small.lots.length, 'and adds');
  }
});

test('every stage is a whole town: one street network, plots off the streets, one walking network, a wall with gates', () => {
  // From the smallest town there is (the core alone, which no avenue leaves, is never built on its own).
  for (const [n, plan] of [...plans].filter(([k]) => k >= MIN_EXTENT)) {
    const adj = plan.nodes.map(() => new Set<number>());
    for (const s of plan.streets) (adj[s.a].add(s.b), adj[s.b].add(s.a));
    const seen = new Set([plan.streets[0].a]);
    for (const stack = [plan.streets[0].a]; stack.length; ) for (const m of adj[stack.pop()!]) if (!seen.has(m)) (seen.add(m), stack.push(m));
    const used = new Set(plan.streets.flatMap((s) => [s.a, s.b]));
    assert.equal(seen.size, used.size, `town of ${n}: the streets are one network`);
    for (const l of plan.lots.filter((x) => x.part === 'whole' && x.id.startsWith('b')))
      for (const s of plan.streets) assert.ok(!overlap(l.rect, band(plan, s), 0.01), `town of ${n}: ${l.id} clear of the streets`);
    // The walking network reaches every one of its points.
    const wadj = plan.walk.nodes.map(() => [] as number[]);
    for (const [a, b] of plan.walk.edges) (wadj[a].push(b), wadj[b].push(a));
    const wseen = new Set([0]);
    for (const stack = [0]; stack.length; ) for (const m of wadj[stack.pop()!]) if (!wseen.has(m)) (wseen.add(m), stack.push(m));
    assert.equal(wseen.size, plan.walk.nodes.length, `town of ${n}: one walking network`);
    assert.ok(plan.circuit.walls.length > 0 && plan.circuit.gates.length > 0, `town of ${n}: walled, with gates`);
  }
});

test('the fields keep their names whichever the town reaches first', () => {
  const fieldLots = (p: CityPlan) => p.lots.filter((l) => l.part === 'field').map((l) => [l.id, Math.sign(l.rect[0] + l.rect[2])]);
  for (const p of plans.values()) for (const [id, side] of fieldLots(p)) assert.equal(id === 'f0' ? -1 : 1, side, `${id} is on its own side`);
});

test('more buildings, a larger town — never a smaller one; the same buildings, the same town', () => {
  let last = 0;
  for (const count of [0, 5, 16, 40, 80, 120, 150]) {
    const items = itemsOf(count);
    const n = extentFor(land, items, {}, buildingInfo);
    assert.ok(n >= last, `${count} buildings: ${n} blocks, not fewer than ${last}`);
    assert.ok(n >= MIN_EXTENT && n <= full);
    assert.deepEqual(autoPlace(planCity(land, n), items, {}, buildingInfo).unplaced, [], `${count} buildings all find plots in a town of ${n}`);
    assert.equal(extentFor(land, items, {}, buildingInfo), n, 'deterministic');
    last = n;
  }
  assert.ok(extentFor(land, itemsOf(16), {}, buildingInfo) < full, 'a few buildings: a compact town, not the whole island');
});

test('a building the owner placed far out keeps its block: the town reaches it, and stays when others go', () => {
  const g = growthOf(land);
  const far = g.order[g.order.length - 3];
  const [i, j] = far.split(':');
  const lot = planCity(land).lots.find((l) => l.id === `b${i}:${j}`)!;
  const at = fitOnLot(lot, extentOf('tholos'))!;
  assert.ok(at, 'a tholos fits a whole block');
  const items: Wanted[] = [{ id: 'far', kind: 'service', building: 'tholos' }, ...itemsOf(3)];
  const fixed = { far: { building: 'tholos', ...at } };
  const owned = ownedLots(land, items, fixed, buildingInfo);
  assert.equal(owned.far, lot.id);
  const n = extentFor(land, items, fixed, buildingInfo, owned);
  assert.ok(n >= g.order.indexOf(far) + 1, 'the town reaches the far block');
  const placed = autoPlace(planCity(land, n), items, fixed, buildingInfo);
  assert.equal(placed.lots.far, lot.id, 'and the building stands where the owner put it');
  assert.deepEqual(placed.places.far, fixed.far);
  // The others gone: still there.
  const alone = extentFor(land, items.slice(0, 1), fixed, buildingInfo, ownedLots(land, items.slice(0, 1), fixed, buildingInfo));
  assert.ok(alone >= g.order.indexOf(far) + 1);
});
