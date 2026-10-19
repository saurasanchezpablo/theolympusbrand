// Smallest printable diameter of each tier on the house printer: node scripts/dev/print-sizes.ts
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { crest, emblem, seal } from '../../src/geometry/crest.ts';
import { geometryOf, minFeature, minDiameterMM } from '../../src/print/printcheck.ts';
loadNodeFonts();
for (const [name, m] of [['crest-print', crest({ detail: 'print' })], ['emblem-print', emblem({ detail: 'print' })], ['seal zeus', seal()], ['seal hades', seal({ patron: { god: 'hades' } })], ['seal arachne', seal({ patron: { god: 'arachne' } })]] as const) {
  const { w } = minFeature(geometryOf(m.d));
  console.log(name.padEnd(14), w.toFixed(2), 'u →', minDiameterMM(w, 0.5).toFixed(0), 'mm');
}
