// The city on the island: planned the same way every time, its streets one
// connected network, its plots beside their streets and clear of them, its
// terraces level, people's ways on walkways and squares only, its furniture
// where it belongs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeTerrain, heightAt } from '../src/map/terrain.ts';
import { planCity, UNDER, type CityPlan, type Rect } from '../src/map/city.ts';
import { island } from '../src/map/island.ts';

const { plan, land } = island();
const inRect = (r: Rect, x: number, z: number, m = 0) => x >= r[0] - m && x <= r[2] + m && z >= r[1] - m && z <= r[3] + m;
const overlap = (a: Rect, b: Rect, m = 0) => a[0] < b[2] - m && b[0] < a[2] - m && a[1] < b[3] - m && b[1] < a[3] - m;
const band = (p: CityPlan, s: CityPlan['streets'][number]): Rect => {
  const A = p.nodes[s.a],
    B = p.nodes[s.b];
  return [Math.min(A.x, B.x) - s.width / 2, Math.min(A.z, B.z) - s.width / 2, Math.max(A.x, B.x) + s.width / 2, Math.max(A.z, B.z) + s.width / 2];
};
const onStreet = (x: number, z: number, m = 0) => plan.streets.some((s) => inRect(band(plan, s), x, z, m));
const onSquare = (x: number, z: number, m = 0) => plan.squares.some((q) => inRect(q.rect, x, z, m));

test('the same city every time, and the one the site ships (assets/map/city.json)', () => {
  const again = planCity(makeTerrain());
  assert.deepEqual(again, plan);
  const shipped = JSON.parse(readFileSync(new URL('../assets/map/city.json', import.meta.url), 'utf8'));
  assert.deepEqual(shipped, JSON.parse(JSON.stringify(plan)), 'run `npm run map` after an intended change to the city');
});

test('a city: an agora, a sanctuary, a grove, sports grounds, a works quarter, streets of three ranks', () => {
  assert.deepEqual([...new Set(plan.squares.map((s) => s.kind))].sort(), ['agora', 'field', 'grove', 'sanctuary']);
  assert.deepEqual([...new Set(plan.streets.map((s) => s.rank))].sort(), ['avenue', 'lane', 'street']);
  assert.ok(plan.lots.some((l) => l.district === 'works'));
  assert.ok(plan.lots.filter((l) => l.part === 'whole').length >= 60, 'a city, not a village');
});

test('the streets are one network: every crossing reaches every other', () => {
  const adj = plan.nodes.map(() => new Set<number>());
  for (const s of plan.streets) {
    adj[s.a].add(s.b);
    adj[s.b].add(s.a);
  }
  // A square joins the crossings round it.
  for (const q of plan.squares) {
    const round = plan.nodes.map((n, k) => (inRect(q.rect, n.x, n.z, 3.2) ? k : -1)).filter((k) => k >= 0);
    for (const a of round) for (const b of round) if (a !== b) adj[a].add(b);
  }
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) for (const m of adj[stack.pop()!]) if (!seen.has(m)) (seen.add(m), stack.push(m));
  const used = new Set(plan.streets.flatMap((s) => [s.a, s.b]));
  for (const n of used) assert.ok(seen.has(n), `crossing ${n} is cut off`);
  // No street ends in the air: each end is a crossing with another street or a square.
  for (const n of used) {
    const degree = plan.streets.filter((s) => s.a === n || s.b === n).length;
    assert.ok(degree >= 2 || plan.squares.some((q) => inRect(q.rect, plan.nodes[n].x, plan.nodes[n].z, 3.2)), `street dead-ends at ${plan.nodes[n].x},${plan.nodes[n].z}`);
  }
});

test('plots sit beside their streets, clear of them and of each other', () => {
  for (const l of plan.lots) {
    for (const s of plan.streets) assert.ok(!overlap(l.rect, band(plan, s), 0.01), `${l.id} is on a street`);
    // Plots of the sanctuary and the sports grounds lie on their squares; others never do.
    for (const q of plan.squares) if (l.district !== 'sanctuary' && l.district !== 'field') assert.ok(!overlap(l.rect, q.rect, 0.01), `${l.id} is on a square`);
    // Its front: just beyond the edge it faces lies a street, or the square it opens on.
    const [x0, z0, x1, z1] = l.rect;
    const fx = (x0 + x1) / 2 + Math.sin(l.facing) * ((x1 - x0) / 2 + 0.8);
    const fz = (z0 + z1) / 2 + Math.cos(l.facing) * ((z1 - z0) / 2 + 0.8);
    assert.ok(onStreet(fx, fz) || onSquare(fx, fz), `${l.id} faces no street`);
  }
  // Plots of one rank never overlap.
  for (const part of ['whole', 'half', 'quarter', 'precinct', 'field'] as const) {
    const ls = plan.lots.filter((l) => l.part === part);
    for (let a = 0; a < ls.length; a++) for (let b = a + 1; b < ls.length; b++) assert.ok(!overlap(ls[a].rect, ls[b].rect, 0.01), `${ls[a].id} overlaps ${ls[b].id}`);
  }
  // Halves and quarters share their whole's ground.
  const byId = new Map(plan.lots.map((l) => [l.id, l]));
  for (const l of plan.lots) if (l.parent) assert.equal(l.ground, byId.get(l.parent)!.ground);
});

test('terraces are level, streets climb evenly, the land stays under the city, nothing is in the sea', () => {
  // The city is drawn as solid slabs: the land under them sits just below, so it never shows through.
  for (const l of plan.lots) {
    const [x0, z0, x1, z1] = l.rect;
    assert.ok(Math.abs(heightAt(land, (x0 + x1) / 2, (z0 + z1) / 2) - (l.ground - UNDER)) < 0.02, `${l.id}: land not just under its terrace`);
    for (const [x, z] of [[x0, z0], [x1, z1], [x0, z1], [x1, z0]]) assert.ok(heightAt(land, x, z) <= l.ground - UNDER + 0.02, `${l.id}: land pokes through`);
    assert.ok(l.ground > 1, `${l.id} is in the sea`);
  }
  for (const q of plan.squares) assert.ok(heightAt(land, (q.rect[0] + q.rect[2]) / 2, (q.rect[1] + q.rect[3]) / 2) <= q.level - UNDER + 0.02, `${q.kind}: land pokes through`);
  for (const s of plan.streets) {
    const A = plan.nodes[s.a],
      B = plan.nodes[s.b];
    // Away from its crossings (a crossing is level, at its own height).
    for (const t of [0.3, 0.5, 0.7]) {
      const x = A.x + (B.x - A.x) * t,
        z = A.z + (B.z - A.z) * t;
      assert.ok(heightAt(land, x, z) <= A.y + (B.y - A.y) * t - UNDER + 0.02, 'land pokes through a street');
    }
    assert.ok(Math.abs(B.y - A.y) / Math.hypot(B.x - A.x, B.z - A.z) < 0.2, 'no street steeper than 1 in 5');
  }
});

test('people walk on walkways and squares only, and can reach everywhere from the agora', () => {
  const { nodes, edges, use } = plan.walk;
  assert.equal(edges.length, use.length);
  const adj = nodes.map(() => [] as number[]);
  for (const [a, b] of edges) (adj[a].push(b), adj[b].push(a));
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) for (const m of adj[stack.pop()!]) if (!seen.has(m)) (seen.add(m), stack.push(m));
  assert.equal(seen.size, nodes.length, 'one network');
  for (const [a, b] of edges) {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const x = nodes[a][0] + (nodes[b][0] - nodes[a][0]) * t,
        z = nodes[a][2] + (nodes[b][2] - nodes[a][2]) * t;
      assert.ok(onStreet(x, z, 0.05) || onSquare(x, z, 0.05), `a way at ${x.toFixed(1)},${z.toFixed(1)} leaves the streets`);
      for (const l of plan.lots) if (l.district !== 'sanctuary' && l.district !== 'field') assert.ok(!inRect(l.rect, x, z, -0.05), `a way crosses ${l.id}`);
    }
  }
  // Every street has its walkways.
  for (const s of plan.streets) {
    const r = band(plan, s);
    assert.ok(edges.some(([a, b]) => inRect(r, (nodes[a][0] + nodes[b][0]) / 2, (nodes[a][2] + nodes[b][2]) / 2)), 'a street with no one walking it');
  }
});

test('furniture stands on the streets and squares, never on a plot or in the carriageway', () => {
  const { lamps, trees, benches, fountains } = plan.furniture;
  assert.ok(lamps.length > 100 && trees.length > 20 && benches.length > 0 && fountains.length >= 2);
  for (const [x, , z] of [...lamps, ...trees, ...benches, ...fountains]) {
    assert.ok(onStreet(x, z) || onSquare(x, z), `furniture off the streets at ${x},${z}`);
    for (const l of plan.lots) if (l.district !== 'sanctuary' && l.district !== 'field') assert.ok(!inRect(l.rect, x, z, -0.01), `furniture on ${l.id}`);
  }
  // Lamps and street trees keep to the walkways: off each carriageway's middle.
  for (const [x, , z] of [...lamps, ...trees.filter((t) => t[4] === 0)]) {
    for (const s of plan.streets) {
      const A = plan.nodes[s.a],
        B = plan.nodes[s.b];
      const alongX = Math.abs(B.x - A.x) > Math.abs(B.z - A.z);
      const r = band(plan, s);
      if (!inRect(r, x, z)) continue;
      const across = alongX ? Math.abs(z - A.z) : Math.abs(x - A.x);
      const inCrossing = plan.nodes.some((n) => Math.abs(n.x - x) < s.width / 2 + 3 && Math.abs(n.z - z) < s.width / 2 + 3 && (alongX ? Math.abs(n.x - x) : Math.abs(n.z - z)) < 2);
      if (!inCrossing) assert.ok(across >= s.width / 2 - s.walk - 0.01, `in the carriageway at ${x},${z}`);
    }
  }
});
