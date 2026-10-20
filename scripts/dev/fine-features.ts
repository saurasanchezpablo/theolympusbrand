// Smallest features of the fine editions (for sticker size rules): node scripts/dev/fine-features.ts
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { crest, emblem, seal } from '../../src/geometry/crest.ts';
import { geometryOf, minFeature } from '../../src/print/printcheck.ts';
loadNodeFonts();
for (const [name, m] of [['crest fine', crest()], ['emblem fine', emblem()], ['seal', seal()], ['crest fine apollo', crest({ patron: { god: 'apollo' } })], ['crest print', crest({ detail: 'print' })]] as const) {
  const t = performance.now();
  const { w } = minFeature(geometryOf(m.d), { hi: 6 });
  console.log(name.padEnd(18), w.toFixed(2), 'u', ((performance.now() - t) / 1000).toFixed(1), 's', '→ min size at 0.15 mm lines:', ((0.15 * 504) / w).toFixed(0), 'mm');
}
