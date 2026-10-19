// The border bands follow the house's rhythms — verified on the drawn geometry.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inked, shape } from './helpers.ts';
import { C, polar } from '../src/geometry/math.ts';
import { crest, borderLayout, PROFILES, type Detail } from '../src/geometry/crest.ts';
import { beadTimeline } from '../src/geometry/border.ts';
import { BORDER } from '../src/brand/identity.ts';

for (const detail of ['fine', 'print'] as Detail[]) {
  const G = shape(crest({ detail }).d);
  const L = borderLayout(PROFILES[detail]);

  test(`${detail}: the Greek key follows the house rhythm`, () => {
    const units = BORDER.hooks.length;
    const h = (L.keyOut - L.keyIn) / 5;
    const dA = 360 / (units * 6);
    // A short hook leaves the cell at column 2, row 2 empty.
    const hooks = Array.from({ length: units }, (_, k) => (inked(G, polar(-90 + (k * 6 + 2.5) * dA, L.keyOut - 2.5 * h)) ? '0' : '1')).join('');
    assert.equal(hooks, BORDER.hooks);
  });

  test(`${detail}: the bead-and-reel follows the house rhythm and closes the ring`, () => {
    const repeat = PROFILES[detail].border.beadRepeat;
    const { beads, units } = beadTimeline(BORDER.beads, repeat);
    // Sample the ring at quarter-unit resolution and rebuild the beads from the ink.
    const samples = units * 4;
    const ink = Array.from({ length: samples }, (_, i) => inked(G, polar(-90 + ((i + 0.5) * 360) / samples, L.beadR)));
    const found: { at: number; len: number }[] = [];
    for (let i = 0; i < samples; ) {
      if (!ink[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < samples && ink[j]) j++;
      found.push({ at: Math.round(i / 4), len: (j - i) / 4 > 2 ? 3 : 1 });
      i = j;
    }
    assert.deepEqual(found, beads);
  });
}

test('the logo slot medallion is a ring on the vertical axis, clear of the frame', () => {
  for (const detail of ['fine', 'print'] as Detail[]) {
    const P = PROFILES[detail];
    const L = borderLayout(P);
    const k = L.fieldR / 203;
    const cy = C + (P.medal.cy - C) * k;
    const r = P.medal.r * k;
    const G = shape(crest({ detail, medal: 'slot' }).d);
    assert.ok(inked(G, [C, cy - r + 1]), `${detail}: ring inked at its top`);
    assert.ok(!inked(G, [C, cy]), `${detail}: empty slot is empty`);
    assert.ok(cy + r <= L.fieldR + C, `${detail}: medallion inside the field`);
    if (detail === 'print') assert.ok(L.beadR - P.border.beadT / 2 - (cy + r - C) >= P.minFeature, 'print: printable gap to the beads');
  }
});
