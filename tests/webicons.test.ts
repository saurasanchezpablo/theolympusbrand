// The web icon set: a favicon that follows the colour scheme, a manifest that
// lists real files, and a maskable icon that survives any launcher's crop.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import './helpers.ts';
import { seal } from '../src/geometry/crest.ts';
import { webIcons } from '../src/catalog/webicons.ts';
import { RIM, ARTBOARD } from '../src/geometry/math.ts';

test('the favicon switches ink in dark mode; the manifest lists the icons it ships', () => {
  const w = webIcons(seal({ patron: { god: 'hades' } }), { name: 'Storage · The Olympus', short: 'Storage' });
  const fav = w.files.find((f) => f.path === 'favicon.svg')!.data;
  assert.match(fav, /prefers-color-scheme: dark/);
  const manifest = JSON.parse(w.files.find((f) => f.path === 'site.webmanifest')!.data);
  const shipped = new Set(w.rasters.map((r) => r.path));
  for (const icon of manifest.icons) assert.ok(shipped.has(icon.src.replace(/^\//, '')), icon.src);
  assert.ok(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable'));
  const head = w.files.find((f) => f.path === 'head.html')!.data;
  for (const href of head.matchAll(/href="\/([^"]+)"/g)) assert.ok(shipped.has(href[1]) || w.files.some((f) => f.path === href[1]) || href[1] === 'favicon.ico', href[1]);
});

test('the maskable icon keeps the seal inside the central 80 % circle', () => {
  const r = webIcons(seal(), { name: 'The Olympus', short: 'Olympus' }).rasters.find((x) => x.path === 'icon-maskable-512.png')!;
  const k = Number(r.svg.match(/scale\(([\d.]+)\)/)![1]);
  assert.ok(RIM * k <= 0.4 * ARTBOARD, `seal radius ${RIM * k} of ${ARTBOARD}`);
});

test('every service ships its web set', () => {
  for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-512.png', 'icon-maskable-512.png', 'site.webmanifest', 'head.html'])
    assert.ok(existsSync(new URL(`../assets/services/jellyfin/web/${f}`, import.meta.url)), f);
});
