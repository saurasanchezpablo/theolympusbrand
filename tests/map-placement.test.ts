// Where buildings stand: on the city's plots, turned to their streets, the
// smallest plot that takes them, never two on one plot; where the map puts
// those the owner has not placed; and where the forests grow.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP } from '../src/map/terrain.ts';
import { island } from '../src/map/island.ts';
import { townArea, type Lot } from '../src/map/city.ts';
import { autoPlace, placeAt, plotsOf, isFree, MARGIN, fitOnLot } from '../src/map/placement.ts';
import { scatterTrees } from '../src/map/vegetation.ts';
import { BUILDINGS, buildingInfo, extentOf } from '../src/map/buildings/index.ts';

const { plan, land } = island();
const plots = plotsOf(plan);
const centre = (l: Lot) => [(l.rect[0] + l.rect[2]) / 2, (l.rect[1] + l.rect[3]) / 2];
/** The ground a building covers on the plan, turned as it stands. */
function covers(type: string, p: { x: number; z: number; rotation: number }): [number, number, number, number] {
  const e = extentOf(type);
  const quarter = Math.round(p.rotation / (Math.PI / 2)) % 2 === 1;
  const c = Math.cos(p.rotation),
    s = Math.sin(p.rotation);
  const cx = p.x + e.cx * c + e.cz * s,
    cz = p.z - e.cx * s + e.cz * c;
  const w = (quarter ? e.d : e.w) / 2,
    d = (quarter ? e.w : e.d) / 2;
  return [cx - w, cz - d, cx + w, cz + d];
}

test('a building dropped on the map lands on the plot under it, turned to its street, or is refused with a reason', () => {
  const quarter = plan.lots.find((l) => l.part === 'quarter' && l.district === 'town')!;
  const [x, z] = centre(quarter);
  // A small building takes the quarter; a temple needs its half; a stadium no ordinary block.
  const small = placeAt(plots, x, z, extentOf('statue'), new Map());
  assert.ok(small.ok && small.lot.id === quarter.id && small.place.rotation === Math.round(quarter.facing * 1000) / 1000);
  const temple = placeAt(plots, x, z, extentOf('temple-doric'), new Map());
  assert.ok(temple.ok && temple.lot.id === quarter.parent);
  assert.deepEqual(placeAt(plots, x, z, extentOf('stadium'), new Map()), { ok: false, why: 'too-big' });
  // In the middle of a street, or out in the forest: no plot.
  const n = plan.nodes[plan.streets[0].a];
  assert.deepEqual(placeAt(plots, n.x, n.z, extentOf('statue'), new Map()), { ok: false, why: 'no-plot' });
  assert.deepEqual(placeAt(plots, 0, -150, extentOf('statue'), new Map()), { ok: false, why: 'no-plot' });
  // Taken: the half under a building on its quarter is not free, the other quarter is.
  const taken = new Map([[quarter.id, 'a']]);
  assert.equal(isFree(plots, quarter.parent!, taken), false);
  const sibling = plan.lots.find((l) => l.parent === quarter.parent && l.id !== quarter.id)!;
  assert.equal(isFree(plots, sibling.id, taken), true);
  assert.deepEqual(placeAt(plots, x, z, extentOf('temple-doric'), taken), { ok: false, why: 'taken' });
  assert.ok(placeAt(plots, x, z, extentOf('temple-doric'), taken, { except: 'a' }).ok, 'a building may move within its own plot');
});

test('a hundred and fifty items find plots, the same way every time, each inside its plot and none sharing', () => {
  const kinds = BUILDINGS.filter((k) => k.kind === 'service').map((k) => k.id);
  const items = Array.from({ length: 150 }, (_, i) => ({ id: `item-${String(i).padStart(3, '0')}`, kind: (i % 5 === 0 ? 'machine' : 'service') as 'service' | 'machine', building: i % 5 === 0 ? 'rack-hall' : kinds[i % kinds.length] }));
  const a = autoPlace(plan, items, {}, buildingInfo);
  assert.deepEqual(a.unplaced, []);
  assert.equal(Object.keys(a.places).length, 150);
  const taken = new Map<string, string>();
  for (const it of items) {
    const lot = plots.byId.get(a.lots[it.id])!;
    assert.ok(isFree(plots, lot.id, taken), `${it.id} shares ${lot.id}`);
    taken.set(lot.id, it.id);
    const [x0, z0, x1, z1] = covers(it.building, a.places[it.id]);
    assert.ok(x0 >= lot.rect[0] + MARGIN - 0.02 && z0 >= lot.rect[1] + MARGIN - 0.02 && x1 <= lot.rect[2] - MARGIN + 0.02 && z1 <= lot.rect[3] - MARGIN + 0.02, `${it.id} (${it.building}) spills off ${lot.id}`);
  }
  // Machines go to the works quarter first, temples to the sanctuary.
  const first = items.filter((it) => it.kind === 'machine').slice(0, 5);
  for (const it of first) assert.equal(plots.byId.get(a.lots[it.id])!.district, 'works');
  assert.ok(items.some((it) => /^temple/.test(it.building) && plots.byId.get(a.lots[it.id])!.district === 'sanctuary'));
  assert.deepEqual(autoPlace(plan, items, {}, buildingInfo), a, 'deterministic');
});

test('places chosen by the owner are kept on their plot, and others keep off it', () => {
  const half = plan.lots.find((l) => l.part === 'half' && l.district === 'town')!;
  const at = fitOnLot(half, extentOf('tholos'))!;
  const fixed = { mine: { building: 'tholos', ...at } };
  const r = autoPlace(plan, [{ id: 'mine', kind: 'service', building: 'tholos' }, { id: 'other', kind: 'service', building: 'stoa' }], fixed, buildingInfo);
  assert.deepEqual(r.places.mine, fixed.mine);
  assert.equal(r.lots.mine, half.id);
  assert.ok(isFree(plots, r.lots.other, new Map([[r.lots.mine, 'mine']])));
  // A place saved before the city (anywhere on the island) moves to the nearest free plot that takes it.
  const old = autoPlace(plan, [{ id: 'old', kind: 'service', building: 'temple-doric' }], { old: { building: 'temple-doric', x: 0, z: -150, rotation: 1.3 } }, buildingInfo);
  assert.ok(old.lots.old);
});

test('the forests keep out of the town and the sea, and grow in their bands', () => {
  const inTown = townArea(plan);
  const forest = scatterTrees(land, (x, z) => inTown(x, z, 4));
  const { broad, pine } = forest;
  assert.ok(broad.length / 5 > 1500 && broad.length / 5 <= 14_000, `${broad.length / 5} broadleaf`);
  assert.ok(pine.length / 5 > 1500 && pine.length / 5 <= 11_000, `${pine.length / 5} pines`);
  for (const arr of [broad, pine])
    for (let i = 0; i < arr.length; i += 5) {
      assert.ok(arr[i + 1] > MAP.sea, 'not in the sea');
      assert.ok(!inTown(arr[i], arr[i + 2], 3.9), 'not in the town');
    }
  assert.deepEqual(scatterTrees(land, (x, z) => inTown(x, z, 4)), forest, 'deterministic');
});
