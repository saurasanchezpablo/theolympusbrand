// Printable models: every product, for every patron, is a closed, manifold,
// non-self-intersecting solid of the designed size and volume; the files that
// carry it (STL, 3MF, OpenSCAD) say the same thing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import './helpers.ts';
import { GODS, type GodId } from '../src/geometry/pantheon.ts';
import { buildModel, PRODUCTS, defaults, suggestedParams, type ProductId } from '../src/manufacturing/products.ts';
import { markFor, modelFiles } from '../src/manufacturing/files.ts';
import { stack, validate, type Layer } from '../src/manufacturing/mesh.ts';
import { readStl } from '../src/export/stl.ts';
import { renderMeshes } from '../src/render/mesh-render.ts';

const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];
const markOf = (id: ProductId, god: GodId) => {
  const kind = PRODUCTS[id].mark;
  return kind ? markFor(kind, { god }, god) : null;
};

test('every product is a valid solid for every patron', () => {
  const failures: string[] = [];
  for (const god of Object.keys(GODS) as GodId[]) {
    for (const id of PRODUCT_IDS) {
      const mark = markOf(id, god);
      const m = buildModel(id, { ...suggestedParams(id, mark?.minDiameterMM), magnets: 2 }, mark ?? undefined);
      for (const p of m.parts) if (!p.report.ok) failures.push(`${god} ${id} ${p.name}: ${JSON.stringify(p.report)}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('sizes follow the parameters', () => {
  const mark = markOf('medallion', 'apollo')!;
  const m = buildModel('medallion', { diameter: 120, base: 3.2, relief: 1.6 }, mark);
  const r = m.parts[0].report;
  assert.ok(Math.abs(r.size[0] - 120) < 0.01 && Math.abs(r.size[1] - 120) < 0.01, `${r.size}`);
  assert.ok(Math.abs(r.size[2] - 4.8) < 1e-9);
  const e = buildModel('engraved', { diameter: 80, thickness: 5, depth: 1.5 }, mark);
  assert.ok(Math.abs(e.parts[0].report.size[2] - 5) < 1e-9);
  const t = buildModel('two-colour', defaults('two-colour'), mark);
  assert.deepEqual(t.parts.map((p) => p.name), ['plate', 'relief']);
});

test('magnet pockets remove exactly their volume, and are refused when they would break through', () => {
  const mark = markOf('medallion', 'hades')!;
  const plain = buildModel('medallion', { magnets: 0 }, mark);
  const three = buildModel('medallion', { magnets: 3, magnetDiameter: 10.2, magnetDepth: 2.2 }, mark);
  const pocket = Math.PI * 5.1 * 5.1 * 2.2;
  const removed = plain.parts[0].report.volume - three.parts[0].report.volume;
  assert.ok(Math.abs(removed - 3 * pocket) / (3 * pocket) < 0.01, `${removed} vs ${3 * pocket}`);
  const deep = buildModel('medallion', { magnets: 2, base: 2, magnetDepth: 1.8 }, mark);
  assert.ok(deep.warnings.some((w) => w.includes('deeper')));
  const same = buildModel('medallion', { magnets: 0, base: 2 }, mark);
  assert.equal(deep.parts[0].report.volume, same.parts[0].report.volume, 'refused pockets leave the plate whole');
});

test('a too-small size is warned about, and suggested sizes print cleanly', () => {
  const mark = markOf('medallion', 'apollo')!;
  assert.ok(buildModel('medallion', { diameter: 50 }, mark).warnings.some((w) => w.includes('nozzle')));
  const master = markFor('seal', undefined, 'master');
  const p = suggestedParams('token', master.minDiameterMM);
  assert.ok(p.diameter >= master.minDiameterMM + 2 * p.flange);
  assert.equal(buildModel('token', p, master).warnings.length, 0);
});

test('overlapping rings in a layer are caught as self-intersection', () => {
  const sq = (x: number, y: number, s: number): [number, number][] => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
  const layers: Layer[] = [{ rings: [sq(0, 0, 10), sq(5, 5, 10)], z0: 0, z1: 1 }];
  assert.equal(validate(stack(layers), layers).ok, false);
});

test('STL and 3MF carry the validated mesh; generation is deterministic', () => {
  const mark = markOf('two-colour', 'athena')!;
  const a = modelFiles('athena', 'The Olympus — Athena', 'two-colour', defaults('two-colour'), mark, { width: 64, height: 48 });
  const b = modelFiles('athena', 'The Olympus — Athena', 'two-colour', defaults('two-colour'), mark, { width: 64, height: 48 });
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

test('the OpenSCAD source declares every parameter and reads its SVG', () => {
  for (const id of PRODUCT_IDS) {
    const mark = markOf(id, 'nike');
    const { files } = modelFiles('nike', 'The Olympus — Game Server', id, defaults(id), mark, { width: 8, height: 8 });
    const scad = files.find((f) => f.path.endsWith('.scad'))!.data as string;
    for (const p of PRODUCTS[id].params) assert.match(scad, new RegExp(`^${p.key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)} = `, 'm'), `${id}: ${p.key}`);
    if (mark) {
      assert.ok(scad.includes(`import("${mark.file}"`), id);
      assert.ok(files.some((f) => f.path === mark.file));
    }
  }
});

test('previews are grayscale renders of the mesh', () => {
  const m = buildModel('token', defaults('token'), markOf('token', 'iris')!);
  const px = renderMeshes(m.parts, { azimuth: -24, elevation: 52, width: 80, height: 60 });
  let lit = 0;
  for (let i = 0; i < px.length; i += 4) {
    assert.ok(px[i] === px[i + 1] && px[i + 1] === px[i + 2]);
    if (px[i] !== 246) lit++;
  }
  assert.ok(lit > 800, `${lit} pixels show the model`);
});
