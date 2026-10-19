// Strict problems of one printed monogram across widths: node scripts/dev/diag-letter.ts R
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { variableParts } from '../../src/geometry/crest.ts';
import { union, flatten } from '../../src/geometry/poly.ts';
import { problemsAt } from '../../src/print/printcheck.ts';
import { signedArea } from '../../src/geometry/math.ts';
loadNodeFonts();
const ch = process.argv[2];
const v = variableParts({ detail: 'print', patron: { monogram: ch } });
for (const [name, d] of [['cella', v.cella], ['both', v.cella + v.medal]]) {
  const G = union(flatten(d));
  for (const w of [3.4, 3.5, 3.6, 3.7, 3.8, 4.0]) {
    const p = problemsAt(G, w, { topology: true });
    const a = (rs: number[][][]) => rs.map((r) => signedArea(r as never).toFixed(1)).join(',');
    console.log(name, w, 'thin', a(p.thin), 'gaps', a(p.gaps), p.lostIslands.length, p.lostHoles.length, p.topology);
  }
}
