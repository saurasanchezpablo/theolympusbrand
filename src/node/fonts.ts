// Node host: register the brand fonts from their @fontsource packages.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import opentype from 'opentype.js';
import { registerFont, type FontRole } from '../geometry/fonts.ts';

const require = createRequire(import.meta.url);

const FILES: Record<FontRole, string> = {
  inscription: '@fontsource/cinzel/files/cinzel-latin-700-normal.woff',
  inscriptionHeavy: '@fontsource/cinzel/files/cinzel-latin-900-normal.woff',
  companion: '@fontsource/jost/files/jost-latin-600-normal.woff',
  body: '@fontsource/jost/files/jost-latin-400-normal.woff',
};

let loaded = false;

export function loadNodeFonts(): void {
  if (loaded) return;
  for (const [role, file] of Object.entries(FILES) as [FontRole, string][]) {
    const b = readFileSync(require.resolve(file));
    registerFont(role, opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
  }
  loaded = true;
}
