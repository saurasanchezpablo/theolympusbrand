// Design files (what the web app saves, imports and exports) and the shared
// file plan: designs move between the app and the repository without loss.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './helpers.ts';
import { designFile, libraryFile, catalogFile, parseDesigns, type Design } from '../src/catalog/design.ts';
import { resolve } from '../src/catalog/service.ts';
import { serviceMarks, svgFiles, rasterJobs } from '../src/catalog/fileset.ts';
import { loadCatalog } from '../src/node/catalog.ts';

const NOW = '2026-01-01T00:00:00.000Z';
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>';
const design: Design = {
  spec: { id: 'vaultwarden', name: 'Vaultwarden', category: 'security', god: 'hades', caption: 'The Olympus · Vault', description: 'Passwords' },
  logoSvg: LOGO,
  version: 3,
  created: NOW,
  updated: NOW,
};

test('a design file round-trips, logo and history included', () => {
  const [back] = parseDesigns(designFile(design), NOW);
  assert.deepEqual(back, { ...design, spec: { ...design.spec, logo: 'logos/vaultwarden.svg' } });
});

test('a library file round-trips every design', () => {
  const other: Design = { ...design, spec: { id: 'gitea', name: 'Gitea', category: 'other' }, logoSvg: undefined, version: 1 };
  const back = parseDesigns(libraryFile([design, other], NOW), NOW);
  assert.deepEqual(back.map((d) => d.spec.id), ['vaultwarden', 'gitea']);
  assert.equal(back[0].logoSvg, LOGO);
  assert.equal(back[1].logoSvg, undefined);
});

test('catalogue files import as designs, and export byte-identical to the repository', () => {
  for (const s of loadCatalog()) {
    const file = readFileSync(new URL(`../catalog/services/${s.id}.json`, import.meta.url), 'utf8');
    const [d] = parseDesigns(file, NOW);
    assert.equal(d.version, 1);
    assert.equal(catalogFile(d), file, s.id);
  }
  const many = parseDesigns(JSON.stringify([{ id: 'a', name: 'A', category: 'web' }, { id: 'b', name: 'B', category: 'media' }]), NOW);
  assert.equal(many.length, 2);
});

test('a logo path without its SVG is dropped rather than left dangling', () => {
  const [d] = parseDesigns(JSON.stringify({ id: 'x', name: 'X', category: 'web', logo: 'logos/x.svg' }), NOW);
  assert.equal(d.spec.logo, undefined);
  assert.equal(d.logoSvg, undefined);
});

test('bad files fail with readable messages', () => {
  assert.throws(() => parseDesigns('{nope', NOW), /not valid JSON/);
  assert.throws(() => parseDesigns(JSON.stringify({ id: 'Bad Id', name: 'x', category: 'web' }), NOW), /kebab-case/);
  assert.throws(() => parseDesigns(JSON.stringify({ format: 'the-olympus/library', designs: 'x' }), NOW), /must be a list/);
  assert.throws(() => parseDesigns(JSON.stringify({ id: 'x', name: 'X', category: 'web', caption: '' }), NOW), /caption/);
});

test('a custom caption replaces the default lockup line', () => {
  assert.equal(resolve(design.spec).caption, 'The Olympus · Vault');
  assert.equal(resolve({ ...design.spec, caption: undefined }).caption, 'The Olympus · HADES');
});

test('the file plan: 28 SVGs and 11 PNGs per service, named by id', () => {
  const s = resolve(design.spec);
  const marks = serviceMarks(s);
  const svgs = svgFiles(s, marks);
  assert.equal(svgs.length, 28);
  assert.equal(rasterJobs(s, marks).length, 11);
  assert.ok(svgs.every((f) => f.path.startsWith('svg/the-olympus-vaultwarden-') && f.svg.startsWith('<svg')));
});
