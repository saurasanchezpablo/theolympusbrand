// The map's building catalogue: more than fifty kinds for services and a
// family of their own for machines — each the same every time, standing on
// the ground within its footprint, light enough for a map of 150.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, building, DEFAULT_BUILDING } from '../src/map/buildings/index.ts';
import { CATEGORIES } from '../src/geometry/pantheon.ts';

const tris = (g: import('three').BufferGeometry) => g.attributes.position.count / 3;

test('more than fifty kinds for services, and a family for machines', () => {
  const services = BUILDINGS.filter((k) => k.kind === 'service');
  const machines = BUILDINGS.filter((k) => k.kind === 'machine');
  assert.ok(services.length >= 50, `${services.length} for services`);
  assert.ok(machines.length >= 8, `${machines.length} for machines`);
  const ids = BUILDINGS.map((k) => k.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  for (const id of ids) assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  for (const f of ['temples', 'sanctuary', 'civic', 'sport', 'works', 'monuments', 'machines']) assert.ok(BUILDINGS.some((k) => k.family === f), f);
  assert.equal(building(DEFAULT_BUILDING.service)?.kind, 'service');
  assert.equal(building(DEFAULT_BUILDING.machine)?.kind, 'machine');
  assert.equal(building('nonsense'), undefined);
  for (const k of BUILDINGS) assert.ok(k.name.length > 2 && k.name[0] === k.name[0].toUpperCase() && k.name !== k.name.toUpperCase(), `${k.id}: a name in sentence case`);
});

test('each is the same every time, stands on the ground within its footprint, and keeps to its budget', () => {
  for (const k of BUILDINGS) {
    const a = k.build('near');
    const b = k.build('near');
    assert.deepEqual(Buffer.from(a.attributes.position.array.buffer), Buffer.from(b.attributes.position.array.buffer), `${k.id}: deterministic`);
    const bb = a.boundingBox!;
    assert.ok(bb.min.y >= -0.01, `${k.id}: below ground ${bb.min.y}`);
    assert.ok(bb.max.y <= 40, `${k.id}: too tall ${bb.max.y}`);
    const pos = a.attributes.position;
    let reach = 0;
    for (let i = 0; i < pos.count; i++) reach = Math.max(reach, Math.hypot(pos.getX(i), pos.getZ(i)));
    assert.ok(reach <= k.footprint * 1.05 + 0.5, `${k.id}: reaches ${reach.toFixed(1)} beyond its footprint ${k.footprint}`);
    assert.ok(tris(a) <= 60_000, `${k.id}: ${tris(a)} triangles near`);
    const far = k.build('far');
    assert.ok(tris(far) <= 6_000, `${k.id}: ${tris(far)} triangles far`);
    assert.ok(tris(far) < tris(a), `${k.id}: far is lighter`);
  }
});

test('suggestions name real categories', () => {
  for (const k of BUILDINGS) {
    assert.ok(k.suggests.length > 0, k.id);
    for (const s of k.suggests) assert.ok(s in CATEGORIES || s === 'machine', `${k.id}: ${s}`);
  }
});
