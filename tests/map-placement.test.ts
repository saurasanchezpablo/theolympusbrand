// Where buildings may stand, where the map puts those not yet placed, and
// where its forests grow.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP, makeTerrain, heightAt } from '../src/map/terrain.ts';
import { canPlace, autoPlace } from '../src/map/placement.ts';
import { scatterTrees } from '../src/map/vegetation.ts';
import { building, BUILDINGS } from '../src/map/buildings/index.ts';

const t = makeTerrain();
const fp = (id: string) => building(id)!.footprint * MAP.buildingScale;

test('invalid drops are refused with a reason', () => {
  assert.deepEqual(canPlace(t, { building: 'temple-doric', x: 245, z: 245, rotation: 0 }, fp('temple-doric'), []), { ok: false, why: 'outside' });
  assert.deepEqual(canPlace(t, { building: 'altar', x: 238, z: 0, rotation: 0 }, fp('altar'), []), { ok: false, why: 'sea' });
  // A gentle slope low on the island is fine; the same spot taken is not.
  const spot = autoPlace(t, [{ id: 'a', kind: 'service', building: 'temple-doric' }], {}).places.a;
  assert.deepEqual(canPlace(t, spot, fp('temple-doric'), []), { ok: true });
  assert.deepEqual(canPlace(t, { ...spot, x: spot.x + 3 }, fp('temple-doric'), [{ place: spot, footprint: fp('temple-doric') }]), { ok: false, why: 'crowded' });
  // Somewhere steep on the massif is a cliff.
  let cliff = null as null | { x: number; z: number };
  for (let x = -60; x < 60 && !cliff; x += 2) for (let z = -60; z < 60 && !cliff; z += 2) if (heightAt(t, x, z) > 10 && canPlace(t, { building: 'temple-doric', x, z, rotation: 0 }, fp('temple-doric'), []).ok === false) {
    const r = canPlace(t, { building: 'temple-doric', x, z, rotation: 0 }, fp('temple-doric'), []);
    if (!r.ok && r.why === 'cliff') cliff = { x, z };
  }
  assert.ok(cliff, 'the massif has cliffs that are refused');
});

test('a hundred and fifty items find a place, the same way every time', () => {
  const kinds = BUILDINGS.map((k) => k.id);
  const items = Array.from({ length: 150 }, (_, i) => ({ id: `item-${String(i).padStart(3, '0')}`, kind: (i % 5 === 0 ? 'machine' : 'service') as 'service' | 'machine', building: i % 5 === 0 ? 'rack-hall' : kinds[i % 66] }));
  const a = autoPlace(t, items, {});
  assert.deepEqual(a.unplaced, []);
  assert.equal(Object.keys(a.places).length, 150);
  const placed = items.map((it) => ({ place: a.places[it.id], footprint: fp(it.building) }));
  for (let i = 0; i < placed.length; i++) {
    const others = placed.filter((_, j) => j !== i);
    assert.deepEqual(canPlace(t, placed[i].place, placed[i].footprint, others), { ok: true }, items[i].id);
  }
  assert.deepEqual(autoPlace(t, items, {}), a, 'deterministic');
});

test('places chosen by the owner are kept, and others keep clear of them', () => {
  const fixed = { mine: { building: 'tholos', x: 30, z: 22, rotation: 1 } };
  const r = autoPlace(t, [{ id: 'mine', kind: 'service', building: 'tholos' }, { id: 'other', kind: 'service', building: 'stoa' }], fixed);
  assert.deepEqual(r.places.mine, fixed.mine);
  assert.ok(Math.hypot(r.places.other.x - 30, r.places.other.z - 22) >= fp('tholos') + fp('stoa') + 1.5);
});

test('trees keep off terraces and the sea, and grow in their bands', () => {
  const sites = [{ x: 30, z: 22, r: 6 }];
  const { broad, pine } = scatterTrees(t, sites);
  assert.ok(broad.length / 5 > 3000 && broad.length / 5 <= 14_000, `${broad.length / 5} broadleaf`);
  assert.ok(pine.length / 5 > 2000 && pine.length / 5 <= 11_000, `${pine.length / 5} pines`);
  for (const arr of [broad, pine])
    for (let i = 0; i < arr.length; i += 5) {
      const [x, y, z] = [arr[i], arr[i + 1], arr[i + 2]];
      assert.ok(y > MAP.sea, 'not in the sea');
      assert.ok(Math.hypot(x - 30, z - 22) >= 6 * 1.6, 'not on a terrace');
    }
  assert.deepEqual(scatterTrees(t, sites), { broad, pine }, 'deterministic');
});
