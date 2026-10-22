// The people of the city: the same crowd every time, walking only on the
// walkways, the crossings and the squares — never through a house or a
// precinct — at a walker's pace, stopping a while at the squares.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { island } from '../src/map/island.ts';
import type { Rect } from '../src/map/city.ts';
import { createPeople } from '../app/src/site/map/people.ts';

const { plan } = island();
const inRect = (r: Rect, x: number, z: number, m = 0) => x >= r[0] - m && x <= r[2] + m && z >= r[1] - m && z <= r[3] + m;
const { nodes, edges } = plan.walk;
/** How far a point is from the walking network. */
function offWay(x: number, z: number): number {
  let best = Infinity;
  for (const [a, b] of edges) {
    const A = nodes[a],
      B = nodes[b];
    const dx = B[0] - A[0],
      dz = B[2] - A[2];
    const t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (z - A[2]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(A[0] + dx * t - x, A[2] + dz * t - z));
  }
  return best;
}

test('the same crowd every time', () => {
  const a = createPeople(plan, { count: 60, still: false }),
    b = createPeople(plan, { count: 60, still: false });
  for (let k = 0; k < 50; k++) (a.update(0.1), b.update(0.1));
  assert.deepEqual(a.positions(), b.positions());
});

test('walkers keep to the walkways, crossings and squares, and never cross a plot', () => {
  const people = createPeople(plan, { count: 150, still: false });
  for (let step = 0; step < 600; step++) {
    people.update(0.1);
    if (step % 60) continue;
    for (const { at } of people.positions()) {
      const [x, , z] = at;
      const onSquare = plan.squares.some((q) => inRect(q.rect, x, z, 0.5));
      // Walkers keep to their side of the way, within its width; round a square's fountain they spread out.
      assert.ok(onSquare || offWay(x, z) < 0.75, `a walker strays to ${x.toFixed(1)},${z.toFixed(1)}`);
      for (const l of plan.lots) if (l.district !== 'sanctuary' && l.district !== 'field') assert.ok(!inRect(l.rect, x, z, -0.2), `a walker in ${l.id}`);
    }
  }
});

test('walkers go at a walking pace, and some stop at the squares', () => {
  const people = createPeople(plan, { count: 120, still: false });
  let before = people.positions();
  let stopped = 0;
  for (let s = 0; s < 300; s++) {
    people.update(0.1);
    const now = people.positions();
    now.forEach((p, k) => {
      const d = Math.hypot(p.at[0] - before[k].at[0], p.at[2] - before[k].at[2]);
      // A brisk walk is 0.6 units (about 1.5 m) a second; easing to the other side of a way after a turn adds a little. Never a jump.
      assert.ok(d <= 0.16, `a walker jumps ${d.toFixed(2)} in a tenth of a second`);
      if (p.stopped) stopped++;
    });
    before = now;
  }
  assert.ok(stopped > 0, 'nobody ever stops');
});

test('under reduced motion the crowd stands still', () => {
  const people = createPeople(plan, { count: 40, still: true });
  const a = people.positions();
  people.update(1);
  assert.deepEqual(people.positions(), a);
});
