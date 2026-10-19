// Build every product for one patron and report: node scripts/dev/model-smoke.ts [god]
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { crest, seal } from '../../src/geometry/crest.ts';
import { buildModel, PRODUCTS, defaults, modelVolume, type ProductId } from '../../src/manufacturing/products.ts';
import type { GodId } from '../../src/geometry/pantheon.ts';
loadNodeFonts();
const god = (process.argv[2] ?? 'apollo') as GodId;
const crestD = crest({ detail: 'print', patron: { god } }).d;
const sealD = seal({ patron: { god } }).d;
for (const id of Object.keys(PRODUCTS) as ProductId[]) {
  const t = performance.now();
  const markSrc = PRODUCTS[id].mark === 'crest' ? { d: crestD, minDiameterMM: 67 } : PRODUCTS[id].mark === 'seal' ? { d: sealD, minDiameterMM: 32 } : undefined;
  const m = buildModel(id, { ...defaults(id), magnets: id === 'medallion' ? 2 : 0 }, markSrc);
  console.log(id.padEnd(11), `${(performance.now() - t).toFixed(0)} ms`, m.size.join('×'), `${modelVolume(m).toFixed(1)} cm³`, m.parts.map((p) => `${p.name}: ${p.report.ok ? 'OK' : 'BAD'} ${p.report.triangles} tris bad ${p.report.badEdges} deg ${p.report.degenerate} vol ${p.report.volume.toFixed(1)}/${p.report.expectedVolume.toFixed(1)}`).join(' | '), m.warnings.join(' '));
}
