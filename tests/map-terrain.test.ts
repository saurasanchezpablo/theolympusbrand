// The map's island: the same land every time, an island with its summit and
// the gentle land of its town, carried to the browser in a compact file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP, TOWN, decodeTerrain, encodeTerrain, heightAt, makeTerrain, slopeAt, townWeight } from '../src/map/terrain.ts';
import { island } from '../src/map/island.ts';

const t = makeTerrain();

test('the island is the same every time', () => {
  const again = makeTerrain();
  assert.equal(t.res, MAP.res);
  assert.deepEqual(Buffer.from(again.heights.buffer), Buffer.from(t.heights.buffer));
});

test('an island: sea at the edges, the mountain high behind the town, gentle land under it', () => {
  const h = MAP.size / 2 - 1;
  for (const [x, z] of [[-h, -h], [h, -h], [-h, h], [h, h]]) assert.ok(heightAt(t, x, z) < MAP.sea, `corner ${x},${z} under the sea`);
  let max = -Infinity,
    at = 0;
  t.heights.forEach((v, k) => {
    if (v > max) (max = v), (at = k);
  });
  assert.ok(max > 60, `summit ${max}`);
  const sz = -MAP.size / 2 + (MAP.size * Math.floor(at / t.res)) / (t.res - 1);
  assert.ok(sz < TOWN.cz - TOWN.rz * 0.6, 'the summit rises behind (north of) the town');
  // Under the town the land is gentle: no more than a tenth of a unit of rise per unit.
  for (const [x, z] of [[0, 100], [-80, 60], [90, 120]]) {
    assert.equal(townWeight(x, z), 1);
    assert.ok(slopeAt(t, x, z) < 0.2, `steep at ${x},${z}`);
  }
});

test('encoding round-trips', () => {
  const bytes = encodeTerrain(t);
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'OLYT');
  const back = decodeTerrain(bytes);
  assert.equal(back.res, t.res);
  assert.equal(back.size, t.size);
  let worst = 0;
  for (let i = 0; i < t.heights.length; i++) worst = Math.max(worst, Math.abs(back.heights[i] - t.heights[i]));
  assert.ok(worst <= 0.01, `quantisation ${worst}`);
  assert.throws(() => decodeTerrain(new Uint8Array([1, 2, 3])));
});

test('the island is the one the site ships (assets/map/terrain.bin)', async () => {
  const { readFileSync } = await import('node:fs');
  const shipped = readFileSync(new URL('../assets/map/terrain.bin', import.meta.url));
  assert.ok(Buffer.from(encodeTerrain(island().land)).equals(shipped), 'run `npm run map` after an intended change to the land or the city');
});
