// Strict check of cella + slot together: node scripts/dev/diag-union.ts god
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { variableParts } from '../../src/geometry/crest.ts';
import { union, flatten } from '../../src/geometry/poly.ts';
import { minFeature, problemsAt } from '../../src/print/printcheck.ts';
import type { GodId } from '../../src/geometry/pantheon.ts';
loadNodeFonts();
for (const god of process.argv.slice(2) as GodId[]) {
  const v = variableParts({ detail: 'print', patron: { god } });
  const G = union(flatten(v.cella + v.medal));
  const r = minFeature(G, { topology: true });
  for (const w of [3.5, 3.55, 3.6, 3.7, 3.8, 4]) { const p = problemsAt(G, w, { topology: true }); console.log(god, w, 'thin', p.thin.length, 'gaps', p.gaps.length, 'isl', p.lostIslands.length, 'holes', p.lostHoles.length, p.topology); }
  console.log('min', r.w.toFixed(2));
}
