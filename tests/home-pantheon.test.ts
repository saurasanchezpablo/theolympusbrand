// The home page's pantheon: a card for each service, headed by its god — or,
// for a service no god stands for (its own logo, its initial), by its own name.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandName, deityCard } from '../app/src/site/deity.ts';

const base = { id: 'x', category: 'storage', url: null };

test('a god heads its service\'s card, its title under it, the service named below', () => {
  assert.deepEqual(deityCard({ ...base, name: 'Backup', patron: { god: 'kronos' }, title: 'Titan of time' }), { heading: 'Kronos', under: 'Titan of time', service: 'Backup' });
  assert.equal(bandName({ ...base, name: 'Backup', patron: { god: 'kronos' } }), 'Kronos');
});

test('a service under its own logo or its initial is headed by its own name', () => {
  assert.deepEqual(deityCard({ ...base, name: 'Pixel vault', patron: { logo: true, letter: 'P' }, title: null }), { heading: 'Pixel vault', under: 'Under its own logo', service: 'Storage' });
  assert.deepEqual(deityCard({ ...base, name: 'Ledger', patron: { monogram: 'L' }, title: null }), { heading: 'Ledger', under: 'Under its initial, L', service: 'Storage' });
  assert.equal(bandName({ ...base, name: 'Pixel vault', patron: { logo: true, letter: 'P' } }), 'Pixel vault');
});
