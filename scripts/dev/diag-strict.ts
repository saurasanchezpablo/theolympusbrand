// Strict (topology-aware) print measure of every god and monogram: node scripts/dev/diag-strict.ts [gods|letters]
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { variableParts } from '../../src/geometry/crest.ts';
import { GODS, type GodId } from '../../src/geometry/pantheon.ts';
import { union, flatten } from '../../src/geometry/poly.ts';
import { minFeature } from '../../src/print/printcheck.ts';
loadNodeFonts();
const W = (d: string) => minFeature(union(flatten(d)), { topology: true }).w.toFixed(2);
const what = process.argv[2] ?? 'all';
if (what === 'all' || what === 'gods') {
  const row: string[] = [];
  for (const g of Object.keys(GODS).filter((g) => g !== 'zeus') as GodId[]) row.push(`${g} ${W(variableParts({ detail: 'print', patron: { god: g } }).cella)}`);
  console.log('cella gods:', row.join('  '));
}
if (what === 'all' || what === 'letters') {
  const c: string[] = [];
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
    const v = variableParts({ detail: 'print', patron: { monogram: ch } });
    c.push(`${ch} ${W(v.cella)}`);
  }
  console.log('cella letters:', c.join('  '));
  console.log('slot:', W(variableParts({ detail: 'print', patron: { god: 'atlas' } }).medal));
}
