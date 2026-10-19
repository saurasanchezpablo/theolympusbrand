// Which monograms fail the print gate (clean at 3.6 u, strict): node scripts/dev/diag-gate.ts
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { variableParts } from '../../src/geometry/crest.ts';
import { union, flatten } from '../../src/geometry/poly.ts';
import { isClean, problemsAt } from '../../src/print/printcheck.ts';
loadNodeFonts();
const bad: string[] = [];
for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
  const v = variableParts({ detail: 'print', patron: { monogram: ch } });
  for (const w of [3.6, 3.8]) if (!isClean(problemsAt(union(flatten(v.cella + v.medal)), w, { topology: true }))) { bad.push(`${ch}@${w}`); break; }
}
console.log(bad.join(' ') || 'all clean at 3.6 and 3.8');
