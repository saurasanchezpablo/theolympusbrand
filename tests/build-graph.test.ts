// The incremental build: a step runs when what it is made from changed or its
// outputs are not what it left, and an incremental build makes the same bytes
// as a clean one. (On the map step: the quickest real one.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const MAP = ['terrain.bin', 'city.json', 'items.json', 'still.png'].map((f) => join(ROOT, 'assets/map', f));
const sums = () => MAP.map((f) => createHash('sha256').update(readFileSync(f)).digest('hex'));

test('the map step: skipped when nothing changed, run again when an output is missing or altered, the same bytes each time', () => {
  const cache = mkdtempSync(join(tmpdir(), 'olympus-build-cache-'));
  // A repository-only build: never the server's data folder.
  const env = { ...process.env, OLYMPUS_CACHE: cache, OLYMPUS_DATA: '' };
  const build = () => execFileSync('node', ['scripts/build.ts', 'map'], { cwd: ROOT, env, encoding: 'utf8' });
  try {
    assert.match(build(), /1 of 1 steps ran/, 'an empty cache: it runs');
    const clean = sums();
    assert.match(build(), /0 of 1 steps ran/, 'nothing changed: skipped');
    rmSync(MAP[2]);
    assert.match(build(), /1 of 1 steps ran/, 'an output gone: it runs again');
    assert.deepEqual(sums(), clean, 'and makes the same bytes');
    const items = readFileSync(MAP[2]);
    writeFileSync(MAP[2], '{}');
    assert.match(build(), /1 of 1 steps ran/, 'an output altered: it runs again');
    assert.deepEqual(readFileSync(MAP[2]), items);
    assert.deepEqual(sums(), clean);
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
});
