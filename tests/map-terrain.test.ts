// The map's island: the same land every time, an island with its summit,
// carried to the browser in a compact file, levelled under each building.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP, decodeTerrain, encodeTerrain, heightAt, makeTerrain, slopeAt, withTerraces } from '../src/map/terrain.ts';

const t = makeTerrain();

test('the island is the same every time', () => {
  const again = makeTerrain();
  assert.equal(t.res, MAP.res);
  assert.deepEqual(Buffer.from(again.heights.buffer), Buffer.from(t.heights.buffer));
});

test('an island: sea at the edges, the summit high', () => {
  const h = MAP.size / 2 - 1;
  for (const [x, z] of [[-h, -h], [h, -h], [-h, h], [h, h]]) assert.ok(heightAt(t, x, z) < MAP.sea, `corner ${x},${z} under the sea`);
  let max = -Infinity;
  for (const v of t.heights) max = Math.max(max, v);
  assert.ok(max > 60, `summit ${max}`);
  assert.ok(max - heightAt(t, 4, -6) < 12, 'the summit is near the massif\'s centre');
  assert.ok(slopeAt(t, 0, 100) >= 0);
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

test('a terrace is level', () => {
  const site = { x: 30, z: 22, r: 6 };
  const level = withTerraces(t, [site]);
  const centre = heightAt(level, site.x, site.z);
  for (let a = 0; a < 6.28; a += 0.5) for (const d of [0, 2, 4, 5.5]) assert.ok(Math.abs(heightAt(level, site.x + Math.cos(a) * d, site.z + Math.sin(a) * d) - centre) < 0.05);
  assert.equal(heightAt(level, -100, -100), heightAt(t, -100, -100), 'elsewhere unchanged');
});

test('the island is the one the site ships (assets/map/terrain.bin)', async () => {
  const { readFileSync } = await import('node:fs');
  const shipped = readFileSync(new URL('../assets/map/terrain.bin', import.meta.url));
  assert.ok(Buffer.from(encodeTerrain(t)).equals(shipped), 'run `npm run map` after an intended change to the land');
});
