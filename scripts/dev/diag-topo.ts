// Why a god's printed cella fails the strict check: node scripts/dev/diag-topo.ts god …
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { variableParts } from '../../src/geometry/crest.ts';
import { union, flatten } from '../../src/geometry/poly.ts';
import { problemsAt } from '../../src/print/printcheck.ts';
import type { GodId } from '../../src/geometry/pantheon.ts';
loadNodeFonts();
for (const god of process.argv.slice(2) as GodId[]) {
  const G = union(flatten(variableParts({ detail: 'print', patron: { god } }).cella));
  for (const w of [1, 2, 3, 3.6]) {
    const p = problemsAt(G, w, { topology: true });
    const bb = (rs: number[][][]) => rs.map((r) => { const xs = r.map((q) => q[0]), ys = r.map((q) => q[1]); return `${Math.min(...xs).toFixed(0)}-${Math.max(...xs).toFixed(0)},${Math.min(...ys).toFixed(0)}-${Math.max(...ys).toFixed(0)}`; }).join(' ');
    console.log(god, w, p.topology.join('; '), '| thin', bb(p.thin), '| gaps', bb(p.gaps));
  }
}
if (process.env.SHOW) {
  const { offset } = await import('../../src/geometry/poly.ts');
  const { signedArea } = await import('../../src/geometry/math.ts');
  const G = union(flatten(variableParts({ detail: 'print', patron: { god: process.argv[2] as GodId } }).cella));
  const w = Number(process.env.SHOW);
  const o = offset(offset(G, -w / 2), w / 2);
  for (const r of o) { const xs = r.map((q) => q[0]), ys = r.map((q) => q[1]); console.log(signedArea(r).toFixed(1), Math.min(...xs).toFixed(1), Math.max(...xs).toFixed(1), Math.min(...ys).toFixed(1), Math.max(...ys).toFixed(1)); }
}
