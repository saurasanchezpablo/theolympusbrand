// The print edition must stay printable: measured by erosion/dilation on the
// real geometry (see src/print/printcheck.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.ts';
import { crest, emblem } from '../src/geometry/crest.ts';
import { geometryOf, minFeature, minDiameterMM } from '../src/print/printcheck.ts';
import { SHARED_PRINT_MIN_UNITS } from '../src/print/service.ts';

// Filament printer, 0.4 mm nozzle: the finest feature that reliably survives
// is about one extrusion width and a bit — 0.5 mm.
const PRINTER_MM = 0.5;

test('print crest: smallest feature ≥ 3.6 units — prints from Ø ≤ 70 mm on a 0.4 mm nozzle', () => {
  const { w } = minFeature(geometryOf(crest({ detail: 'print' }).d));
  assert.ok(w >= 3.6, `minimum feature ${w.toFixed(2)} u`);
  assert.ok(minDiameterMM(w, PRINTER_MM) <= 70, `prints from Ø ${minDiameterMM(w, PRINTER_MM).toFixed(0)} mm`);
});

test('print crest with an empty logo slot is just as printable', () => {
  const { w } = minFeature(geometryOf(crest({ detail: 'print', medal: 'slot' }).d));
  assert.ok(w >= 3.6, `minimum feature ${w.toFixed(2)} u`);
  // The service print gate uses this measure as a constant; it must stay true.
  assert.equal(Math.round(w * 100) / 100, SHARED_PRINT_MIN_UNITS);
});

test('print emblem: smallest feature ≥ 3.6 units', () => {
  const { w } = minFeature(geometryOf(emblem({ detail: 'print' }).d));
  assert.ok(w >= 3.6, `minimum feature ${w.toFixed(2)} u`);
});
