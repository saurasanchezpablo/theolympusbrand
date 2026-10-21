// The server's own data folder: what is added from the map lives there, never
// in the repository, and is laid over the catalogue by the one loader every
// tool uses.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCatalog, logoOf } from '../src/node/catalog.ts';
import { loadMachines, loadPlaces, loadRemoved, removeItem, saveMachine, savePlace, saveService } from '../src/node/data.ts';
import { validateMachine } from '../src/catalog/machine.ts';
import { validateSpec } from '../src/catalog/service.ts';
import { validatePlaces } from '../src/map/places.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const DEFAULTS = ['backup', 'community', 'containers', 'game-server', 'home-assistant', 'jellyfin', 'minecraft', 'monitoring', 'multiplayer', 'network', 'nextcloud', 'proxmox', 'reverse-proxy', 'storage', 'vpn', 'web'];
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8"/></svg>';

beforeEach(() => {
  process.env.OLYMPUS_DATA = mkdtempSync(join(tmpdir(), 'olympus-data-'));
});

test('an empty data folder changes nothing', () => {
  assert.deepEqual(loadCatalog().map((s) => s.id), DEFAULTS);
  assert.deepEqual(loadMachines(), []);
  assert.deepEqual(loadPlaces(), {});
});

test('a service saved from the browser joins the catalogue; the repository is untouched', () => {
  saveService({ id: 'pihole', name: 'Pi-hole', category: 'networking', ip: '10.0.0.53', logo: 'logos/pihole.svg' }, LOGO);
  const s = loadCatalog().find((x) => x.id === 'pihole');
  assert.ok(s, 'in the catalogue');
  assert.equal(s.ip, '10.0.0.53');
  assert.ok(logoOf(s), 'its logo is read from the data folder');
  assert.ok(existsSync(join(process.env.OLYMPUS_DATA!, 'services/pihole.json')));
  assert.equal(execFileSync('git', ['status', '--porcelain', 'catalog/'], { cwd: ROOT, encoding: 'utf8' }), '');
});

test('a default edited in the browser overrides it', () => {
  saveService({ id: 'jellyfin', name: 'Cinema', category: 'media' });
  assert.equal(loadCatalog().find((x) => x.id === 'jellyfin')!.name, 'Cinema');
  assert.equal(loadCatalog().length, DEFAULTS.length);
});

test('deleting a default hides it; adding it again brings it back', () => {
  removeItem('service', 'jellyfin');
  assert.ok(!loadCatalog().some((x) => x.id === 'jellyfin'));
  assert.deepEqual(loadRemoved(), ['jellyfin']);
  saveService({ id: 'jellyfin', name: 'Jellyfin', category: 'media' });
  assert.ok(loadCatalog().some((x) => x.id === 'jellyfin'));
  assert.deepEqual(loadRemoved(), []);
  // A service only in the data folder is simply gone.
  saveService({ id: 'pihole', name: 'Pi-hole', category: 'networking' });
  removeItem('service', 'pihole');
  assert.ok(!loadCatalog().some((x) => x.id === 'pihole'));
  assert.deepEqual(loadRemoved(), []);
});

test('machines and places round-trip and are validated', () => {
  saveMachine({ id: 'node-1', name: 'Node 1', ip: '10.0.0.11', os: 'Proxmox VE 9' });
  assert.deepEqual(loadMachines(), [{ id: 'node-1', name: 'Node 1', ip: '10.0.0.11', os: 'Proxmox VE 9' }]);
  savePlace('node-1', { building: 'rack-hall', x: 10, z: -4, rotation: 7 });
  const p = loadPlaces()['node-1'];
  assert.equal(p.building, 'rack-hall');
  assert.ok(Math.abs(p.rotation - (7 - 2 * Math.PI)) < 1e-9, 'rotation in [0, 2π)');
  savePlace('node-1', null);
  assert.deepEqual(loadPlaces(), {});
  assert.throws(() => validateMachine({ id: 'X', name: '' }));
  assert.throws(() => validateMachine({ id: 'm', name: 'M', os: 'two\nlines' }));
  assert.throws(() => validatePlaces({ a: { building: 'temple', x: 900, z: 0, rotation: 0 } }));
  assert.throws(() => validatePlaces({ a: { building: '../x', x: 0, z: 0, rotation: 0 } }));
  removeItem('machine', 'node-1');
  assert.deepEqual(loadMachines(), []);
});

test('ip is validated', () => {
  const base = { id: 'x', name: 'X', category: 'networking' };
  assert.equal(validateSpec({ ...base, ip: '10.0.0.1' }).ip, '10.0.0.1');
  assert.equal(validateSpec({ ...base, ip: 'fd00::1' }).ip, 'fd00::1');
  assert.equal(validateSpec({ ...base, ip: 'nas.lan' }).ip, 'nas.lan');
  for (const ip of ['10.0.0.1; rm -rf /', '$(id)', 'a b', '']) assert.throws(() => validateSpec({ ...base, ip }), ip);
});

test('writes stay inside the data folder', () => {
  assert.throws(() => saveService({ id: '../evil', name: 'E', category: 'networking' } as never));
  assert.throws(() => removeItem('service', '../../catalog/services/jellyfin'));
  assert.ok(existsSync(join(ROOT, 'catalog/services/jellyfin.json')));
  assert.ok(readFileSync(join(ROOT, 'catalog/services/jellyfin.json'), 'utf8').includes('"jellyfin"'));
});

test('without OLYMPUS_DATA, builds read only the repository: nothing private reaches tracked files', () => {
  saveService({ id: 'pihole', name: 'Pi-hole', category: 'networking' });
  const was = process.env.OLYMPUS_DATA;
  delete process.env.OLYMPUS_DATA;
  try {
    assert.deepEqual(loadCatalog().map((s) => s.id), DEFAULTS, 'a working copy builds the house alone');
    assert.deepEqual(loadMachines(), []);
    assert.deepEqual(loadPlaces(), {});
    assert.throws(() => saveService({ id: 'x', name: 'X', category: 'other' }), /OLYMPUS_DATA/);
  } finally {
    process.env.OLYMPUS_DATA = was;
  }
});
