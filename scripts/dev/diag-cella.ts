// Printed cella monograms, enlarged: node scripts/dev/diag-cella.ts out.png [LETTERS]
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { variableParts } from '../../src/geometry/crest.ts';
loadNodeFonts();
const chars = process.argv[3] ?? 'TDEHQZ2S';
const cells = [...chars].map((ch, i) => `<g transform="translate(${i * 50} 0)"><path d="${variableParts({ detail: 'print', patron: { monogram: ch } }).cella}" fill="#111" fill-rule="nonzero"/></g>`);
writeFileSync(process.argv[2], new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="225 190 ${chars.length * 50 + 10} 120" width="${(chars.length * 50 + 10) * 4}" height="480"><rect width="2000" height="2000" fill="#fafafa"/>${cells.join('')}</svg>`).render().asPng());
