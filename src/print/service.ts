// The print gate for a service crest, shared by the command line and the web app.

import { variableParts } from '../geometry/crest.ts';
import { flatten, union } from '../geometry/poly.ts';
import type { Patron } from '../geometry/pantheon.ts';
import { isClean, minDiameterMM, minFeature, problemsAt } from './printcheck.ts';

/** Filament printer, 0.4 mm nozzle: finest reliable printed feature (mm). */
export const PRINTER_MM = 0.5;
/** Print-edition features below this many units (on the 504-unit rim) fail. */
export const PRINT_MIN_UNITS = 3.6;
/**
 * Minimum feature of the parts every print crest shares (temple, name,
 * border), measured once: `minFeature` of the print crest with an empty slot.
 * tests/print.test.ts re-measures it, so it cannot drift from the geometry.
 */
export const SHARED_PRINT_MIN_UNITS = 3.77;

export type PrintReport = { ok: boolean; minUnits: number; minDiameterMM: number };

/**
 * Check what varies per service — the patron in the cella and the logo slot —
 * strictly (a glyph must keep its shape), then combine with the shared parts.
 */
export function checkPrint(patron: Patron): PrintReport {
  const v = variableParts({ detail: 'print', patron });
  const G = union(flatten(v.cella + v.medal));
  const ok = isClean(problemsAt(G, PRINT_MIN_UNITS, { topology: true }));
  const { w } = minFeature(G, { topology: true });
  const limit = Math.min(Math.max(w, ok ? PRINT_MIN_UNITS : 0), SHARED_PRINT_MIN_UNITS);
  return { ok, minUnits: Math.round(w * 100) / 100, minDiameterMM: Math.ceil(minDiameterMM(limit, PRINTER_MM)) };
}
