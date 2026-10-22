// The map's built data: every service and machine with a place, the owner's
// places first, nothing that does not belong on a card, and a still picture
// of the island — all the same every time.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalog } from '../src/node/catalog.ts';
import { island } from '../src/map/island.ts';
import { mapData, ENTRY_KEYS } from '../src/map/items.ts';
import { stillImage } from '../src/map/still.ts';
import '../src/map/buildings/index.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const { plan: t, land } = island();
const services = loadCatalog(join(ROOT, 'catalog/services'));

test('the data lists every service and machine with a place', () => {
  const d = mapData(services, [{ id: 'node-1', name: 'Node 1', ip: '10.0.0.11', os: 'Proxmox VE 9' }], {}, t);
  assert.equal(d.version, 1);
  assert.equal(d.items.length, 17);
  assert.deepEqual(d.items.map((e) => e.id), [...d.items.map((e) => e.id)].sort());
  for (const e of d.items) {
    assert.equal(e.placed, 'auto');
    assert.ok(Number.isFinite(e.place.x) && Number.isFinite(e.place.z));
  }
  const node = d.items.find((e) => e.id === 'node-1')!;
  assert.equal(node.kind, 'machine');
  assert.equal(node.place.building, 'rack-hall');
  const jf = d.items.find((e) => e.id === 'jellyfin')!;
  assert.equal(jf.kind, 'service');
  assert.equal(jf.seal, 'files/assets/services/jellyfin/svg/the-olympus-jellyfin-seal.svg');
  assert.ok(existsSync(join(ROOT, jf.seal!.replace(/^files\//, ''))), 'the seal is a real published file');
  assert.equal(jf.url, 'https://jellyfin.theolympus.cloud');
});

test('owner places win — on the plot under them, turned to its street — and a building the catalogue does not have falls back', () => {
  // A great altar dropped near the middle of a block: it stands on that block, centred, facing its street.
  const block = t.lots.find((l) => l.part === 'whole' && l.district === 'town')!;
  const [x0, z0, x1, z1] = block.rect;
  const d = mapData(services, [], { jellyfin: { building: 'great-altar', x: (x0 + x1) / 2 + 1, z: (z0 + z1) / 2 - 2, rotation: 1 }, nextcloud: { building: 'no-such-building', x: 40, z: 40, rotation: 0 } }, t);
  const jf = d.items.find((e) => e.id === 'jellyfin')!;
  assert.equal(jf.lot, block.id);
  assert.equal(jf.place.building, 'great-altar');
  assert.equal(jf.place.rotation, Math.round(block.facing * 1000) / 1000);
  assert.equal(jf.placed, 'owner');
  const auto = mapData(services, [], {}, t).items.find((e) => e.id === 'nextcloud')!;
  assert.equal(d.items.find((e) => e.id === 'nextcloud')!.place.building, auto.place.building, 'the building it would be given');
});

test('nothing beyond the card leaves the data folder', () => {
  const d = mapData(services, [{ id: 'm', name: 'M', ip: '10.0.0.2', hostname: 'm.lan', role: 'NAS', description: 'Disks' }], {}, t);
  for (const e of d.items) for (const k of Object.keys(e)) assert.ok((ENTRY_KEYS as readonly string[]).includes(k), k);
});

test('the still picture is the same every time, one grey channel', () => {
  const d = mapData(services, [], {}, t);
  const a = stillImage(land, t, d, 256);
  const b = stillImage(land, t, d, 256);
  assert.equal(a.length, 256 * 256);
  assert.deepEqual(a, b);
  const values = new Set(a);
  assert.ok(values.size > 40, 'shaded, not flat');
});

test('a machine read back from its card keeps everything it had, its logo too', async () => {
  const { machineSpecOf } = await import('../src/map/items.ts');
  const d = mapData([], [{ id: 'nas', name: 'NAS', ip: '10.0.0.5', os: 'TrueNAS', role: 'Storage', logo: 'logos/nas.svg' }], {}, t, new Set(['nas']));
  const e = d.items.find((x) => x.id === 'nas')!;
  assert.deepEqual(machineSpecOf(e), { id: 'nas', name: 'NAS', ip: '10.0.0.5', os: 'TrueNAS', role: 'Storage', logo: 'logos/nas.svg' });
  const plain = mapData([], [{ id: 'pi', name: 'Pi' }], {}, t).items[0];
  assert.deepEqual(machineSpecOf(plain), { id: 'pi', name: 'Pi' });
});

test('items with no room left are reported, not dropped in silence', () => {
  // A town of one block: room for only a few buildings.
  const block = t.lots.find((l) => l.part === 'whole' && l.district === 'works')!;
  const tiny = { ...t, lots: t.lots.filter((l) => l.id === block.id || l.parent === block.id || l.parent?.startsWith(block.id + ':')) };
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `m-${String(i).padStart(2, '0')}`, name: `M ${i}` }));
  const d = mapData([], many, {}, tiny);
  assert.ok(d.items.length > 0 && d.items.length < 30);
  assert.equal(d.items.length + d.unplaced.length, 30, 'every item is either on the map or reported');
  assert.deepEqual(Object.keys(d.unplaced[0]).sort(), ['id', 'kind', 'name']);
});
