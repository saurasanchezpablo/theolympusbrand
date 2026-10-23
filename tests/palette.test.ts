// Grey is the house: every brand colour, and every colour literal the
// renderers and the site can emit, is a neutral grey (R = G = B). Colour comes
// only from the house's pigments (src/brand/pigments.ts), and only where it
// carries meaning: a terminal's colours, the prompts, the status colours of
// the app themes that can take them, the map's online and offline marks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PALETTE } from '../src/brand/palette.ts';
import { PIGMENTS } from '../src/brand/pigments.ts';
import { STONE_ANSI } from '../src/screens/palette16.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const neutral = (hex: string): boolean => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return full.slice(0, 2) === full.slice(2, 4) && full.slice(2, 4) === full.slice(4, 6);
};
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|tsx|css|html)$/.test(e.name) ? [join(dir, e.name)] : []));
const sources = () => [...files(join(ROOT, 'src')), ...files(join(ROOT, 'app/src')), join(ROOT, 'app/index.html')];

/** The only file with a hue in it. */
const PIGMENT_FILE = 'src/brand/pigments.ts';
/** The files that may use the pigments: where colour carries meaning (the owner's choice). */
const MAY_USE_PIGMENTS = [
  'src/screens/palette16.ts', // a terminal's sixteen colours
  'src/screens/shell.ts', // the prompts: the branch in gold, a failure in red
  'src/integrations/themes/home-assistant.ts', // status colours
  'src/integrations/themes/nextcloud.ts',
  'src/integrations/themes/proxmox.ts',
];

test('palette tokens are neutral greys', () => {
  for (const [name, hex] of Object.entries(PALETTE)) assert.ok(neutral(hex), `${name} ${hex} has a hue`);
});

test('no hue anywhere in the brand source or the web app, except the pigments', () => {
  for (const file of sources()) {
    if (relative(ROOT, file) === PIGMENT_FILE) continue;
    const src = readFileSync(file, 'utf8');
    for (const [hex] of src.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) assert.ok(neutral(hex), `${file}: ${hex} has a hue — colour comes from ${PIGMENT_FILE}`);
    for (const [, r, g, b] of src.matchAll(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/g)) assert.ok(r === g && g === b, `${file}: rgb(${r} ${g} ${b}) has a hue`);
    assert.ok(!/\b(hsla?|hwb|lab|lch|oklab|oklch)\(/.test(src), `${file}: use neutral hex or rgb colours only`);
    // Tailwind's palette: only `neutral` is grey all through (slate, gray, zinc and stone are tinted).
    const tinted = src.match(/\b[a-z-]+-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|stone)-\d{2,3}\b/);
    assert.ok(!tinted, `${file}: ${tinted?.[0]} — use the house tokens or neutral-*`);
  }
});

test('the pigments are used only where colour carries meaning', () => {
  for (const file of sources()) {
    const rel = relative(ROOT, file);
    if (rel === PIGMENT_FILE) continue;
    const uses = /from ['"][./]*(?:src\/)?brand\/pigments\.ts['"]/.test(readFileSync(file, 'utf8')) || /pigments\.ts['"]/.test(readFileSync(file, 'utf8'));
    assert.ok(!uses || MAY_USE_PIGMENTS.includes(rel), `${rel} uses the pigments: colour is only for terminals, prompts, status colours and the map's states (add it to the list on purpose)`);
  }
});

test('every pigment reads on its ground (4.5:1 or more)', () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  for (const [name, p] of Object.entries(PIGMENTS)) {
    assert.ok(!neutral(p.dark), `${name} is a colour`);
    for (const k of ['dark', 'darkBright'] as const) assert.ok(contrast(p[k], PALETTE.obsidian) >= 4.5, `${name}.${k} on obsidian: ${contrast(p[k], PALETTE.obsidian).toFixed(2)}`);
    for (const k of ['light', 'lightBright'] as const) assert.ok(contrast(p[k], PALETTE.paper) >= 4.5, `${name}.${k} on paper: ${contrast(p[k], PALETTE.paper).toFixed(2)}`);
  }
});

test('the boot menu stays grey', () => {
  for (const hex of STONE_ANSI) assert.ok(neutral(hex), `${hex} has a hue`);
});
