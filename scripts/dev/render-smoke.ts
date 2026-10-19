// Render one product preview: node scripts/dev/render-smoke.ts out.png [product] [god]
import { writeFileSync } from 'node:fs';
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { crest, seal } from '../../src/geometry/crest.ts';
import { buildModel, defaults, PRODUCTS, type ProductId } from '../../src/manufacturing/products.ts';
import { renderMeshes } from '../../src/render/mesh-render.ts';
import { encodePng } from '../lib/png.ts';
import type { GodId } from '../../src/geometry/pantheon.ts';
loadNodeFonts();
const id = (process.argv[3] ?? 'medallion') as ProductId;
const god = (process.argv[4] ?? 'apollo') as GodId;
const kind = PRODUCTS[id].mark;
const m = buildModel(id, defaults(id), kind ? { d: kind === 'crest' ? crest({ detail: 'print', patron: { god } }).d : seal({ patron: { god } }).d, minDiameterMM: 0 } : undefined);
const t = performance.now();
const px = renderMeshes(m.parts, { azimuth: -24, elevation: 52, width: 900, height: 700 });
console.log('render', (performance.now() - t).toFixed(0), 'ms');
writeFileSync(process.argv[2], encodePng(px, 900, 700));
