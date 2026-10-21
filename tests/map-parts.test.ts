// The parts the map's buildings are made of: deterministic, lighter from
// afar, merged into one clean geometry, the three orders told apart.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, column, crepidoma, entablature, gable, peristyle, dome, arcade, wall, stair, statue, box, cylinder, type Detail } from '../src/map/buildings/parts.ts';

const made = (draw: (b: Builder) => void) => {
  const b = new Builder();
  draw(b);
  return b.finish();
};
const count = (draw: (b: Builder) => void) => made(draw).attributes.position.count;

test('every part is deterministic', () => {
  const all = (d: Detail) => (b: Builder) => {
    column(b, 0, 0, 0, 6, 0.4, 'corinthian', d);
    const y = crepidoma(b, 10, 16, 3, 0, 0, 0);
    entablature(b, 10, 16, 0, y + 6, 0, 'triglyph', d);
    gable(b, 10, 16, 0, y + 7.5, 0, 0.24, 'z', d);
    peristyle(b, 10, 16, y, 0, 0, 6, 0.4, 2, 'ionic', d);
    dome(b, 5, 8, 16, d);
    arcade(b, 3, 7, 1.5, 5, 0, 0, 0);
    wall(b, 10, 4, 1, 0, 0, 0, 0.3, true);
    stair(b, 4, 6, 0, 0, 0, 0);
    statue(b, 0, 0, 0, 3);
    box(b, 1, 2, 3, 0, 0, 0, 0.2);
    cylinder(b, 1, 1.2, 3, 0, 0, 0, 20);
  };
  const a = made(all('near')).attributes.position.array;
  const b = made(all('near')).attributes.position.array;
  assert.deepEqual(Buffer.from(a.buffer), Buffer.from(b.buffer));
});

test('far detail is lighter', () => {
  for (const [name, draw] of [
    ['column', (d: Detail) => (b: Builder) => column(b, 0, 0, 0, 6, 0.4, 'doric', d)],
    ['gable', (d: Detail) => (b: Builder) => gable(b, 10, 16, 0, 0, 0, 0.24, 'z', d)],
  ] as const) {
    const near = count(draw('near'));
    const far = count(draw('far'));
    assert.ok(far * 8 <= near, `${name}: far ${far} vs near ${near}`);
  }
});

test('merged output has only positions and normals, no NaN', () => {
  const g = made((b) => {
    column(b, 0, 0, 0, 6, 0.4, 'ionic', 'near');
    gable(b, 6, 8, 0, 6, 0, 0.25, 'x', 'near');
  });
  assert.deepEqual(Object.keys(g.attributes).sort(), ['normal', 'position']);
  assert.equal(g.index, null);
  for (const v of g.attributes.position.array) assert.ok(Number.isFinite(v));
  for (const v of g.attributes.normal.array) assert.ok(Number.isFinite(v));
  assert.ok(g.boundingBox, 'bounding box computed');
});

test('the three orders differ', () => {
  const capital = (order: 'doric' | 'ionic' | 'corinthian') => count((b) => column(b, 0, 0, 0, 6, 0.4, order, 'near'));
  assert.ok(capital('doric') < capital('ionic'), 'ionic has volutes');
  assert.ok(capital('ionic') < capital('corinthian'), 'corinthian has leaves');
});
