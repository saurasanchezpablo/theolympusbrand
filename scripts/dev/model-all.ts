// Validate every product for every patron, with back features: node scripts/dev/model-all.ts
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { buildModel, PRODUCTS, suggestedParams, type ProductId } from '../../src/manufacturing/products.ts';
import { markFor } from '../../src/manufacturing/files.ts';
import { GODS, type GodId } from '../../src/geometry/pantheon.ts';
loadNodeFonts();
let bad = 0;
const t0 = performance.now();
for (const god of Object.keys(GODS) as GodId[]) {
  const marks = { crest: markFor('crest', { god }, god), seal: markFor('seal', { god }, god) };
  for (const id of Object.keys(PRODUCTS) as ProductId[]) {
    const kind = PRODUCTS[id].mark;
    const mark = kind ? marks[kind] : undefined;
    const base = suggestedParams(id, mark?.minDiameterMM);
    for (const extra of [{}, { magnets: 2, keyhole: 1, base: 4.4, thickness: 5.5 }, { magnets: 3, layout: 1 }]) {
      const m = buildModel(id, { ...base, ...extra }, { mark, name: god, caption: `The Olympus · ${god}` });
      for (const p of m.parts) if (!p.report.ok) { bad++; console.log(god, id, JSON.stringify(extra), p.name, `bad ${p.report.badEdges} deg ${p.report.degenerate} overlaps ${p.report.overlaps} vol ${p.report.volume.toFixed(2)}/${p.report.expectedVolume.toFixed(2)}`); }
    }
  }
}
console.log(bad ? `${bad} invalid parts` : 'all parts valid', `${((performance.now() - t0) / 1000).toFixed(1)} s`);
