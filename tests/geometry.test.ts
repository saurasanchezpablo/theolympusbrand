// The master is locked: deterministic, inside its silhouette, and unchanged
// unless golden fingerprints are deliberately refreshed (UPDATE_GOLDEN=1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { sha, shape } from './helpers.ts';
import { C, RIM, ARTBOARD } from '../src/geometry/math.ts';
import { crest, emblem, seal, type Detail } from '../src/geometry/crest.ts';
import { GODS, type GodId } from '../src/geometry/pantheon.ts';

const GOLDEN = new URL('./golden.json', import.meta.url);

const marks = () => {
  const out: Record<string, string> = {};
  for (const detail of ['fine', 'print'] as Detail[]) {
    out[`crest-${detail}`] = crest({ detail }).d;
    out[`crest-${detail}-slot`] = crest({ detail, medal: 'slot' }).d;
    out[`emblem-${detail}`] = emblem({ detail }).d;
  }
  for (const god of Object.keys(GODS) as GodId[]) {
    out[`seal-${god}`] = seal({ patron: { god } }).d;
    out[`crest-fine-${god}`] = crest({ patron: { god } }).d;
    out[`crest-print-${god}`] = crest({ detail: 'print', patron: { god } }).d;
  }
  out['crest-fine-monogram-V'] = crest({ patron: { monogram: 'V' } }).d;
  out['seal-monogram-V'] = seal({ patron: { monogram: 'V' } }).d;
  return out;
};

test('generation is deterministic', () => {
  assert.deepEqual(marks(), marks());
});

test('every mark matches its golden fingerprint', () => {
  const now = Object.fromEntries(Object.entries(marks()).map(([k, d]) => [k, sha(d)]));
  if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, JSON.stringify(now, null, 2) + '\n');
    return;
  }
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(now, golden, 'geometry changed — if intended, run `npm run test:update-golden` and review the boards');
});

test('every mark stays inside the rim and on the artboard', () => {
  for (const [name, d] of Object.entries(marks())) {
    let max = 0;
    for (const ring of shape(d)) for (const [x, y] of ring) {
      assert.ok(x >= 0 && x <= ARTBOARD && y >= 0 && y <= ARTBOARD, `${name}: point off the artboard`);
      max = Math.max(max, Math.hypot(x - C, y - C));
    }
    assert.ok(max <= RIM + 0.05, `${name}: geometry reaches r = ${max.toFixed(2)} beyond the rim`);
    assert.ok(max >= RIM - 0.5, `${name}: the rim is missing (max r = ${max.toFixed(2)})`);
  }
});
