// Grayscale only: every brand colour, and every colour literal the renderers
// can emit, must be a neutral grey (R = G = B).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PALETTE } from '../src/brand/palette.ts';

const neutral = (hex: string): boolean => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return full.slice(0, 2) === full.slice(2, 4) && full.slice(2, 4) === full.slice(4, 6);
};

test('palette tokens are neutral greys', () => {
  for (const [name, hex] of Object.entries(PALETTE)) assert.ok(neutral(hex), `${name} ${hex} has a hue`);
});

test('no hue anywhere in the brand source', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []));
  for (const file of files(new URL('../src', import.meta.url).pathname)) {
    const src = readFileSync(file, 'utf8');
    for (const [hex] of src.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) assert.ok(neutral(hex), `${file}: ${hex} has a hue`);
    for (const [, r, g, b] of src.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) assert.ok(r === g && g === b, `${file}: rgb(${r},${g},${b}) has a hue`);
  }
});
