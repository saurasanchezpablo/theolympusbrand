// Contact sheet of the symbol library: every symbol fine and bold, large, and
// the bold drawing at true seal sizes.   node scripts/dev/symbol-sheet.ts out.png
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { SYMBOLS, type SymbolId } from '../../src/geometry/symbols.ts';
import { flatten, union, ringsPath } from '../../src/geometry/poly.ts';

const ids = Object.keys(SYMBOLS) as SymbolId[];
const cols = 8;
const cellW = 260;
const cellH = 340;
const raster = (d: string, px: number) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="228 194 56 116" width="${px}" height="${Math.round((px * 116) / 56)}"><rect x="228" y="194" width="56" height="116" fill="#FAFAFA"/><path d="${d}" fill="#1C1C1C"/></svg>`;
  return new Resvg(svg).render().asPng().toString('base64');
};
let inner = '';
ids.forEach((id, i) => {
  const x = (i % cols) * cellW;
  const y = Math.floor(i / cols) * cellH;
  (['fine', 'bold'] as const).forEach((det, j) => {
    const d = ringsPath(union(flatten(SYMBOLS[id](det))));
    inner += `<svg x="${x + 8 + j * 104}" y="${y + 8}" width="100" height="207" viewBox="228 194 56 116"><rect x="228" y="194" width="56" height="116" fill="#FAFAFA"/><path d="${d}" fill="#1C1C1C"/></svg>`;
    if (det === 'bold') {
      inner += `<image x="${x + 8}" y="${y + 224}" width="40" height="83" image-rendering="optimizeSpeed" href="data:image/png;base64,${raster(d, 20)}"/>`;
      inner += `<image x="${x + 56}" y="${y + 224}" width="20" height="41" image-rendering="optimizeSpeed" href="data:image/png;base64,${raster(d, 10)}"/>`;
    }
  });
  inner += `<text x="${x + 90}" y="${y + 250}" font-size="18" font-family="Nimbus Sans">${id}</text>`;
});
const W = cols * cellW;
const H = Math.ceil(ids.length / cols) * cellH;
writeFileSync(process.argv[2] ?? 'symbols.png', new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#DDDDDD"/>${inner}</svg>`, { font: { loadSystemFonts: true } }).render().asPng());
