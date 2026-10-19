// The service catalogue: every entry is valid, every patron prints, and new
// services — any name, any letter, an imported logo — come out buildable.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shape, inked } from './helpers.ts';
import { crest, variableParts } from '../src/geometry/crest.ts';
import { lockup } from '../src/geometry/lockup.ts';
import { importLogo } from '../src/geometry/logo.ts';
import { GODS, CATEGORIES, type GodId } from '../src/geometry/pantheon.ts';
import { flatten, union } from '../src/geometry/poly.ts';
import { isClean, minFeature, problemsAt } from '../src/print/printcheck.ts';
import { validateSpec, resolve, slugify } from '../src/catalog/service.ts';
import { loadCatalog } from '../src/node/catalog.ts';

const PRINT_MIN = 3.6;
// Strict: a letter or symbol must keep its topology, not just its area. The
// requirement is "clean at the print minimum"; the bisected minimum is reported.
const printable = (v: { cella: string; medal: string }) => {
  const G = union(flatten(v.cella + v.medal));
  return { ok: isClean(problemsAt(G, PRINT_MIN, { topology: true })), w: minFeature(G, { topology: true }).w };
};

test('catalogue: every service file is valid, with a unique id and a patron', () => {
  const services = loadCatalog();
  assert.ok(services.length >= 16);
  assert.equal(new Set(services.map((s) => s.id)).size, services.length);
  for (const s of services) assert.ok('god' in s.patron || 'monogram' in s.patron, s.id);
});

test('every category has a default patron, and every god but Zeus has a symbol', () => {
  for (const c of Object.keys(CATEGORIES)) {
    const s = resolve({ id: 'x', name: 'Example', category: c as keyof typeof CATEGORIES });
    assert.ok(c === 'other' ? 'monogram' in s.patron : 'god' in s.patron, c);
  }
  for (const g of Object.values(GODS)) if (g.id !== 'zeus') assert.ok(g.symbol, g.id);
});

for (const god of Object.keys(GODS).filter((g) => g !== 'zeus') as GodId[]) {
  test(`print: ${god}'s bold symbol and slot clear ${PRINT_MIN} units`, () => {
    const { ok, w } = printable(variableParts({ detail: 'print', patron: { god } }));
    assert.ok(ok, `${god}: ${w.toFixed(2)} u`);
  });
}

test(`print: every monogram letter and digit clears ${PRINT_MIN} units`, () => {
  const failures: string[] = [];
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
    const { ok, w } = printable(variableParts({ detail: 'print', patron: { monogram: ch } }));
    if (!ok) failures.push(`${ch} ${w.toFixed(2)}`);
  }
  assert.deepEqual(failures, []);
});

test('service specs: helpful validation', () => {
  assert.equal(slugify('Home Assistant'), 'home-assistant');
  assert.equal(slugify('Élan  Vital!'), 'elan-vital');
  assert.throws(() => validateSpec({ id: 'Bad Id', name: '', category: 'nope', god: 'zeus', extra: 1 }), (e: Error) =>
    ['kebab-case', '"name"', '"category"', 'reserved', 'unknown field'].every((m) => e.message.includes(m)),
  );
  const s = resolve(validateSpec({ id: 'gitea', name: 'gitea', category: 'other' }));
  assert.deepEqual(s.patron, { monogram: 'G' });
  assert.equal(s.caption, 'The Olympus');
  assert.equal(resolve({ id: 'j', name: 'Jellyfin', category: 'media' }).caption, 'The Olympus · APOLLO');
});

test('logo import: shapes, transforms and fill rules become one path; unsupported features are reported', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs><circle id="c" cx="0" cy="0" r="5"/></defs>
    <g transform="translate(10 10)"><rect width="30" height="30" rx="4"/></g>
    <circle cx="70" cy="25" r="15"/>
    <path fill-rule="evenodd" d="M10 60H90V90H10Z M30 70H70V80H30Z"/>
    <circle cx="70" cy="25" r="5" fill="#FFFFFF"/>
    <text x="0" y="0">x</text>
    <use href="#c"/>
  </svg>`;
  const { d, warnings } = importLogo(svg);
  const g = shape(d);
  assert.ok(inked(g, [25, 25]), 'rect inside the translated group');
  assert.ok(inked(g, [70, 15]) && !inked(g, [70, 25]), 'circle, with a white knockout painted over it');
  assert.ok(inked(g, [15, 65]) && !inked(g, [50, 75]), 'even-odd hole');
  assert.ok(!inked(g, [0, 0]), 'defs are not drawn');
  assert.ok(warnings.some((w) => w.includes('text')) && warnings.some((w) => w.includes('use')), warnings.join('; '));
});

test('a logo in the fine slot sits inside the medallion; the crest is otherwise unchanged', () => {
  const plain = shape(crest({ patron: { god: 'apollo' } }).d);
  const logo = importLogo('<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>').d;
  const withLogo = shape(crest({ patron: { god: 'apollo' }, logo }).d);
  assert.throws(() => crest({ logo: 'M0 0H10V10H0Z' }), /unsupported path command H/);
  const ys = flatten(variableParts({ medal: 'slot' }).medal).flat().map((p) => p[1]);
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  assert.ok(inked(withLogo, [256, cy]), 'logo at the medallion centre');
  assert.ok(inked(plain, [256, 120]) === inked(withLogo, [256, 120]));
});

test('lockups: width grows with the name, height stays one crest', () => {
  const c = crest({ patron: { god: 'apollo' } });
  const short = lockup(c, { name: 'Web', caption: 'The Olympus · ARACHNE', layout: 'horizontal' });
  const long = lockup(c, { name: 'Home Assistant', caption: 'The Olympus · HESTIA', layout: 'horizontal' });
  assert.ok(long.width! > short.width!);
  assert.equal(short.height, long.height);
  const v = lockup(c, { name: 'Jellyfin', caption: 'The Olympus · APOLLO', layout: 'vertical' });
  assert.ok(v.height! > 512);
});
