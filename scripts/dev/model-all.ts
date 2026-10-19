// Validate every product for every patron: node scripts/dev/model-all.ts
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { crest, seal } from '../../src/geometry/crest.ts';
import { buildModel, PRODUCTS, defaults, type ProductId } from '../../src/manufacturing/products.ts';
import { GODS, type GodId } from '../../src/geometry/pantheon.ts';
loadNodeFonts();
let bad = 0;
const t0 = performance.now();
for (const god of Object.keys(GODS) as GodId[]) {
  const marks = { crest: crest({ detail: 'print', patron: { god } }).d, seal: seal({ patron: { god } }).d };
  for (const id of Object.keys(PRODUCTS) as ProductId[]) {
    const kind = PRODUCTS[id].mark;
    for (const diameter of id === 'token' ? [32, 40, 60] : [70, 100, 200]) {
      const m = buildModel(id, { ...defaults(id), diameter, magnets: 2 }, kind ? { d: marks[kind], minDiameterMM: 0 } : undefined);
      for (const p of m.parts) if (!p.report.ok) { bad++; console.log(god, id, diameter, p.name, `bad ${p.report.badEdges} deg ${p.report.degenerate} vol ${p.report.volume.toFixed(2)}/${p.report.expectedVolume.toFixed(2)}`); }
    }
  }
}
console.log(bad ? `${bad} invalid parts` : 'all parts valid', `${((performance.now() - t0) / 1000).toFixed(1)} s`);
