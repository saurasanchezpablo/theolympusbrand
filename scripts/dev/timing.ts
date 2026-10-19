// Generation timings, to size the web app's worker: node scripts/dev/timing.ts
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { crest, emblem, seal, variableParts } from '../../src/geometry/crest.ts';
import { lockup } from '../../src/geometry/lockup.ts';
import { union, flatten } from '../../src/geometry/poly.ts';
import { geometryOf, isClean, problemsAt, minFeature } from '../../src/print/printcheck.ts';
loadNodeFonts();
const t = (label: string, f: () => unknown) => { const a = performance.now(); f(); console.log(label.padEnd(28), (performance.now() - a).toFixed(0), 'ms'); };
const p = { god: 'apollo' } as const;
t('crest fine (cold)', () => crest({ patron: p }));
t('crest fine', () => crest({ patron: { god: 'hades' } }));
t('crest print', () => crest({ patron: p, detail: 'print' }));
t('emblem fine+print', () => { emblem({ patron: p }); emblem({ patron: p, detail: 'print' }); });
t('seal', () => seal({ patron: p }));
t('lockups', () => { const c = crest({ patron: p }); lockup(c, { name: 'Jellyfin', caption: 'X', layout: 'horizontal' }); });
t('print gate (strict)', () => { const v = variableParts({ detail: 'print', patron: p }); const G = union(flatten(v.cella + v.medal)); isClean(problemsAt(G, 3.6, { topology: true })); });
t('variable minFeature', () => { const v = variableParts({ detail: 'print', patron: p }); minFeature(union(flatten(v.cella + v.medal)), { topology: true }); });
t('polygonise print crest', () => geometryOf(crest({ patron: p, detail: 'print' }).d));
