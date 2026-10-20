// Printable models: every product, for every patron, is a closed, manifold,
// non-self-intersecting solid of the designed size and volume; the features
// on its back are placed or refused with a reason; the files that carry it
// (STL, 3MF, OpenSCAD) say the same thing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import './helpers.ts';
import { GODS, type GodId } from '../src/geometry/pantheon.ts';
import { buildModel, estimate, PRODUCTS, defaults, suggestedParams, textRings, DEFAULT_SETTINGS, type ProductId, type Params } from '../src/manufacturing/products.ts';
import { markFor, modelFiles, type MarkSource } from '../src/manufacturing/files.ts';
import { stack, validate, area, type Layer } from '../src/manufacturing/mesh.ts';
import { readStl } from '../src/export/stl.ts';
import { renderMeshes } from '../src/render/mesh-render.ts';
import { DOMAIN } from '../src/brand/identity.ts';

const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];
const marks = new Map<string, MarkSource>();
const markOf = (id: ProductId, god: GodId) => {
  const kind = PRODUCTS[id].mark;
  if (!kind) return undefined;
  const key = `${kind}-${god}`;
  if (!marks.has(key)) marks.set(key, markFor(kind, { god }, god));
  return marks.get(key);
};
const build = (id: ProductId, god: GodId, params: Params = {}, name = 'Jellyfin') => {
  const mark = markOf(id, god);
  return buildModel(id, { ...suggestedParams(id, mark?.minDiameterMM), ...params }, { mark, name, caption: 'The Olympus · APOLLO' });
};

test('every product is a valid solid for every patron', () => {
  const failures: string[] = [];
  for (const god of Object.keys(GODS) as GodId[]) {
    for (const id of PRODUCT_IDS) {
      // The lithophane is the heaviest mesh: every patron, at a coarser grid.
      const m = build(id, god, id === 'lithophane' ? { resolution: 0.5 } : { magnets: 2 });
      for (const p of m.parts) if (!p.report.ok) failures.push(`${god} ${id} ${p.name}: ${JSON.stringify(p.report)}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('sizes follow the parameters', () => {
  const m = build('medallion', 'apollo', { diameter: 120, base: 3.2, relief: 1.6 });
  assert.ok(Math.abs(m.parts[0].report.size[0] - 120) < 0.01 && Math.abs(m.parts[0].report.size[2] - 4.8) < 1e-9);
  assert.ok(Math.abs(build('engraved', 'apollo', { diameter: 80, thickness: 5, depth: 1.5 }).parts[0].report.size[2] - 5) < 1e-9);
  assert.deepEqual(build('two-colour', 'apollo').parts.map((p) => p.name), ['plate', 'relief']);
  const c = build('coaster', 'apollo', { thickness: 6 });
  assert.equal(c.parts[0].report.size[2], 6);
});

test('magnet pockets remove exactly their volume, and are refused when they would break through', () => {
  const plain = build('medallion', 'hades', { magnets: 0, inscription: 0 });
  const three = build('medallion', 'hades', { magnets: 3, magnetDiameter: 10.2, magnetDepth: 2.2, inscription: 0 });
  const pocket = Math.PI * 5.1 * 5.1 * 2.2;
  const removed = plain.parts[0].report.volume - three.parts[0].report.volume;
  assert.ok(Math.abs(removed - 3 * pocket) / (3 * pocket) < 0.01, `${removed} vs ${3 * pocket}`);
  const deep = build('medallion', 'hades', { magnets: 2, base: 2, magnetDepth: 1.8, inscription: 0 });
  assert.ok(deep.warnings.some((w) => w.includes('deeper')));
  assert.equal(deep.back.length, 0);
});

test('the keyhole is a lip over a wider chamber, and needs a thick enough plate', () => {
  const thin = build('medallion', 'argus', { keyhole: 1, inscription: 0 });
  assert.ok(thin.warnings.some((w) => w.includes('keyhole needs')));
  const ok = build('medallion', 'argus', { keyhole: 1, base: 4.4, inscription: 0 });
  assert.ok(ok.back.some((f) => f.kind === 'keyhole'));
  const layers = ok.parts[0].layers!;
  // Bands: under the lip, the chamber, and solid above it (then the relief).
  const holes = (L: Layer) => -L.rings.filter((r) => area([r]) < 0).reduce((s, r) => s + area([r]), 0);
  const lip = layers.find((L) => L.z0 === 0)!;
  const chamber = layers.find((L) => L.z0 > 0 && L.z1 <= 3.4 + 1e-9 && holes(L) > 0)!;
  assert.ok(holes(chamber) > holes(lip), 'the chamber is wider than the opening under the lip');
  assert.ok(ok.parts[0].report.ok);
});

test('the back inscription carries the domain, mirrored to read from behind', () => {
  const m = build('medallion', 'nike');
  const ins = m.back.find((f) => f.kind === 'inscription');
  assert.ok(ins && ins.kind === 'inscription');
  assert.deepEqual(ins.lines.map((l) => l.text), ['JELLYFIN', DOMAIN.toUpperCase()]);
  const lines = [{ text: 'OLYMPUS', cap: 5 }];
  const plain = textRings(lines, 0, 0, false).flat();
  const mirrored = textRings(lines, 0, 0, true).flat();
  const span = (pts: number[][]) => [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
  const [a0, a1] = span(plain);
  const [b0, b1] = span(mirrored);
  assert.ok(Math.abs(a0 + b1) < 0.05 && Math.abs(a1 + b0) < 0.05, 'mirrored left to right');
  // "O" comes first: on the right once mirrored.
  const firstLetterX = (pts: number[][]) => pts.reduce((s, p) => s + p[0], 0) / pts.length;
  assert.ok(Math.abs(firstLetterX(mirrored) + firstLetterX(plain)) < 0.5);
});

test('features that collide or do not fit are dropped with a reason, and the solid stays valid', () => {
  const m = build('medallion', 'iris', { diameter: 67, magnets: 4, magnetDiameter: 14, keyhole: 1, base: 4.4 });
  assert.ok(m.warnings.length > 0);
  assert.ok(m.parts[0].report.ok);
  const kinds = m.back.map((f) => f.kind);
  assert.equal(new Set(kinds).size, kinds.length);
});

test('a too-small size is warned about, and suggested sizes print cleanly', () => {
  assert.ok(build('medallion', 'apollo', { diameter: 50 }).warnings.some((w) => w.includes('nozzle')));
  const master = markFor('seal', undefined, 'master');
  const p = suggestedParams('token', master.minDiameterMM);
  assert.ok(p.diameter >= master.minDiameterMM + 2 * p.flange);
  assert.equal(buildModel('token', p, { mark: master }).warnings.length, 0);
});

test('nameplates fit the bed, in either layout, with or without a caption', () => {
  const long = build('nameplate', 'hestia', { bed: 200 }, 'Home Assistant');
  assert.ok(long.size[0] <= 200 + 1e-6 && long.size[1] <= 200 + 1e-6);
  assert.ok(long.warnings.some((w) => w.includes('Scaled down')));
  // Where the horizontal plate had to shrink, the vertical one fits at full size.
  const vertical = build('nameplate', 'hestia', { layout: 1, height: 110, bed: 200 }, 'Home Assistant');
  assert.ok(!vertical.warnings.some((w) => w.includes('Scaled down')), vertical.warnings.join(' / '));
  assert.equal(vertical.size[1], 110);
  const bare = build('nameplate', 'hestia', { caption: 0 }, 'Web');
  assert.ok(bare.parts[0].report.ok);
});

test('the lithophane: a valid disc, as thick as asked, with a backlit view and a heightmap', () => {
  const mark = markOf('lithophane', 'apollo')!;
  const { model, images } = modelFiles({ id: 'apollo', title: 'Apollo' }, 'lithophane', { diameter: 80, resolution: 0.4, minThickness: 0.8, maxThickness: 2.8 }, mark);
  const r = model.parts[0].report;
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(Math.abs(r.size[2] - 2.8) < 1e-6 && Math.abs(r.size[0] - 80) < 0.01);
  const imgs = images({ width: 40, height: 30 });
  assert.deepEqual(imgs.map((i) => i.path.replace('the-olympus-apollo-lithophane-', '')), ['preview.png', 'backlit.png', 'heightmap.png']);
  const lit = imgs[1].rgba;
  for (let i = 0; i < lit.length; i += 4) assert.ok(lit[i] === lit[i + 1] && lit[i + 1] === lit[i + 2]);
  assert.equal(imgs[2].width, Math.round((80 - 8) / 0.2));
});

test('print settings: layer warnings, colour-change layer, filament estimates', () => {
  const odd = build('medallion', 'apollo', { relief: 1.3 });
  assert.ok(odd.warnings.some((w) => w.includes('not a whole number')));
  const fine = buildModel('two-colour', { ...suggestedParams('two-colour'), base: 3 }, { mark: markOf('two-colour', 'apollo') }, { ...DEFAULT_SETTINGS, layer: 0.15 });
  assert.ok(fine.notes.some((n) => n.includes('layer 21')), fine.notes.join(' / '));
  const m = build('medallion', 'apollo');
  const e15 = estimate(m, DEFAULT_SETTINGS);
  const e100 = estimate(m, { ...DEFAULT_SETTINGS, infill: 100 });
  const solid = (m.parts[0].report.volume / 1000) * 1.24;
  assert.ok(e15.grams < e100.grams && Math.abs(e100.grams - solid) / solid < 1e-9, `${e15.grams} ${e100.grams} ${solid}`);
  assert.ok(Math.abs(e100.metres - (m.parts[0].report.volume / (Math.PI * 0.875 ** 2)) / 1000) < 1e-9);
});

test('overlapping rings in a layer are caught as self-intersection', () => {
  const sq = (x: number, y: number, s: number): [number, number][] => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
  const layers: Layer[] = [{ rings: [sq(0, 0, 10), sq(5, 5, 10)], z0: 0, z1: 1 }];
  assert.equal(validate(stack(layers), layers).ok, false);
});

test('STL and 3MF carry the validated mesh; generation is deterministic', async () => {
  const mark = markOf('two-colour', 'athena')!;
  const subject = { id: 'athena', title: 'The Olympus — Athena', name: 'VPN' };
  const a = modelFiles(subject, 'two-colour', defaults('two-colour'), mark);
  // Across a second boundary and in another time zone: archive timestamps must not leak into the files.
  await new Promise((r) => setTimeout(r, 1100));
  const tz = process.env.TZ;
  process.env.TZ = process.env.TZ === 'Pacific/Auckland' ? 'America/Los_Angeles' : 'Pacific/Auckland';
  const b = modelFiles(subject, 'two-colour', defaults('two-colour'), mark);
  if (tz === undefined) delete process.env.TZ;
  else process.env.TZ = tz;
  const hash = (d: Uint8Array | string) => createHash('sha256').update(d).digest('hex');
  assert.deepEqual(a.files.map((f) => hash(f.data)), b.files.map((f) => hash(f.data)));

  const relief = a.model.parts[1];
  const s = readStl(a.files.find((f) => f.path.endsWith('-relief.stl'))!.data as Uint8Array);
  assert.equal(s.triangles, relief.report.triangles);

  const zip = unzipSync(a.files.find((f) => f.path.endsWith('.3mf'))!.data as Uint8Array);
  assert.ok(zip['[Content_Types].xml'] && zip['_rels/.rels'] && zip['3D/3dmodel.model']);
  const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' }).parse(strFromU8(zip['3D/3dmodel.model']));
  const objects = [xml.model.resources.object].flat();
  const meshes = objects.filter((o: { mesh?: unknown }) => o.mesh);
  assert.equal(meshes.length, 2);
  assert.equal([meshes[1].mesh.triangles.triangle].flat().length, relief.report.triangles);
  const assembly = objects.find((o: { components?: unknown }) => o.components);
  assert.ok(assembly, 'parts are grouped into one object');
  assert.equal(String(xml.model.build.item.objectid), String(assembly.id));
  assert.equal(xml.model.unit, 'millimeter');
});

test('the OpenSCAD source declares every parameter, reads its files and cuts the same back', () => {
  for (const id of PRODUCT_IDS) {
    const mark = markOf(id, 'nike');
    const params = { ...suggestedParams(id, mark?.minDiameterMM), magnets: 2, ...(id === 'lithophane' ? { resolution: 0.5 } : {}) };
    const { files, model } = modelFiles({ id: 'nike', title: 'The Olympus — Game Server', name: 'Game Server' }, id, params, mark ?? null);
    const scad = files.find((f) => f.path.endsWith('.scad'))!.data as string;
    for (const p of PRODUCTS[id].params) assert.match(scad, new RegExp(`^${p.key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)} = `, 'm'), `${id}: ${p.key}`);
    for (const [, file] of scad.matchAll(/(?:import|surface)\((?:file = )?"([^"]+)"/g)) assert.ok(files.some((f) => f.path === file) || file.endsWith('-heightmap.png'), `${id}: ${file}`);
    const magnets = model.back.find((f) => f.kind === 'magnets');
    if (magnets && magnets.kind === 'magnets') for (const [x] of magnets.centres) assert.ok(scad.includes(String(Math.round(x * 1000) / 1000).replace(/\.?0+$/, '')), `${id}: magnet at ${x}`);
  }
});

test('previews are grayscale renders of the mesh, from the front and the back', () => {
  const m = build('token', 'iris');
  const px = renderMeshes(m.parts, { azimuth: -24, elevation: 52, width: 80, height: 60 });
  let lit = 0;
  for (let i = 0; i < px.length; i += 4) {
    assert.ok(px[i] === px[i + 1] && px[i + 1] === px[i + 2]);
    if (px[i] !== 246) lit++;
  }
  assert.ok(lit > 800, `${lit} pixels show the model`);
  const { images } = modelFiles({ id: 'iris', title: 'Iris', name: 'Network' }, 'medallion', { ...defaults('medallion'), magnets: 2 }, markOf('medallion', 'iris')!);
  assert.ok(images({ width: 20, height: 15 }).some((i) => i.path.endsWith('-back.png')));
});
