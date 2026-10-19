// Quick look at patrons in the crest: node scripts/dev/patron-sheet.ts out.png god|monogram:X ...
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { crest, seal } from '../../src/geometry/crest.ts';
import { productionSvg } from '../../src/render/svg.ts';
import type { Patron, GodId } from '../../src/geometry/pantheon.ts';

loadNodeFonts();
const patrons: Patron[] = process.argv.slice(3).map((a) => (a.startsWith('monogram:') ? { monogram: a.slice(9) } : { god: a as GodId }));
const S = 420;
let inner = '';
patrons.forEach((patron, i) => {
  const place = (svg: string, x: number, y: number, s: number) => svg.replace(/<svg [^>]*>/, `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 512 512">`);
  inner += place(productionSvg(crest({ patron }), { ground: 'light' }), i * S, 0, S - 10);
  inner += place(productionSvg(crest({ patron, detail: 'print' }), { ground: 'light' }), i * S, S, S - 10);
  const png = (px: number) => new Resvg(productionSvg(seal({ patron }), { ground: 'light' }), { fitTo: { mode: 'width', value: px } }).render().asPng().toString('base64');
  inner += `<image x="${i * S}" y="${2 * S}" width="128" height="128" href="data:image/png;base64,${png(128)}"/>`;
  inner += `<image x="${i * S + 140}" y="${2 * S}" width="64" height="64" image-rendering="optimizeSpeed" href="data:image/png;base64,${png(32)}"/>`;
  inner += `<image x="${i * S + 216}" y="${2 * S}" width="32" height="32" image-rendering="optimizeSpeed" href="data:image/png;base64,${png(16)}"/>`;
});
const W = patrons.length * S;
writeFileSync(process.argv[2], new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${2 * S + 140}"><rect width="${W}" height="${2 * S + 140}" fill="#DDDDDD"/>${inner}</svg>`).render().asPng());
