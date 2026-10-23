// A service's own logo as its patron: in the temple's bay, in the logo slot
// and in its seal — in the print editions too, thickened as the nozzle needs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import './helpers.ts';
import { variableParts, seal } from '../src/geometry/crest.ts';
import { importLogo } from '../src/geometry/logo.ts';
import { resolve, validateSpec, withLogo } from '../src/catalog/service.ts';
import { checkPrint, patronPrintsAsLogo } from '../src/print/service.ts';

const BOLD = importLogo('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10H90V90H10Z"/></svg>').d;
const MEDIUM = importLogo('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0H100V1.5H0Z M0 49H100V50.5H0Z M0 98.5H100V100H0Z"/></svg>').d;
const FINE = importLogo('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0H100V0.6H0Z M0 20H100V20.6H0Z M0 40H100V40.6H0Z M0 60H100V60.6H0Z M0 80H100V80.6H0Z M0 99.4H100V100H0Z"/></svg>').d;

test('the logo stands in the bay of the fine crest, and in its logo slot', () => {
  const logo = variableParts({ patron: { logo: BOLD, letter: 'Q' } });
  const letter = variableParts({ patron: { monogram: 'Q' } });
  assert.ok(logo.cella.length > 0);
  assert.notEqual(logo.cella, letter.cella, 'not the initial');
  assert.notEqual(logo.medal, letter.medal, 'the slot carries the logo too');
});

test('in print, the logo stays the logo: thickened only as much as the nozzle needs, never the initial', () => {
  const letter = variableParts({ detail: 'print', patron: { monogram: 'Q' } });
  const bold = variableParts({ detail: 'print', patron: { logo: BOLD, letter: 'Q' } });
  const fine = variableParts({ detail: 'print', patron: { logo: FINE, letter: 'Q' } });
  for (const v of [bold, fine]) {
    assert.notEqual(v.cella, letter.cella, 'the bay is not the initial');
    assert.notEqual(v.medal, letter.medal, 'the slot carries the logo, not the temple glyph');
  }
  // A logo heavy enough is cut as drawn; a thin one is thickened until it holds.
  assert.equal(patronPrintsAsLogo({ logo: BOLD, letter: 'Q' }), true);
  assert.equal(patronPrintsAsLogo({ logo: MEDIUM, letter: 'Q' }), true);
  assert.ok(checkPrint({ logo: MEDIUM, letter: 'Q' }).ok, 'thickened, its print edition passes the gate');
  // Hairlines this close cannot both thicken and stay apart: still the logo, and the gate asks for a larger print.
  assert.equal(patronPrintsAsLogo({ logo: FINE, letter: 'Q' }), false);
  const fineReport = checkPrint({ logo: FINE, letter: 'Q' });
  assert.ok(!fineReport.ok && fineReport.minDiameterMM > checkPrint({ logo: BOLD, letter: 'Q' }).minDiameterMM);
});

test('the seal carries the logo', () => {
  assert.notEqual(seal({ patron: { logo: BOLD, letter: 'Q' } }).d, seal({ patron: { monogram: 'Q' } }).d);
});

test('a spec asks for its logo as patron only when it has a logo; the logo is given where it is read', () => {
  const base = { id: 'qube', name: 'Qube', category: 'other' };
  assert.throws(() => validateSpec({ ...base, god: 'logo' }), /logo/);
  const spec = validateSpec({ ...base, god: 'logo', logo: 'logos/qube.svg' });
  const s = resolve(spec);
  assert.deepEqual(s.patron, { monogram: 'Q' }, 'without the logo read: the initial');
  assert.deepEqual(withLogo(s, BOLD).patron, { logo: BOLD, letter: 'Q' });
  assert.deepEqual(withLogo(resolve(validateSpec({ ...base, logo: 'logos/qube.svg' })), BOLD).patron, resolve(validateSpec(base)).patron, 'a logo in the slot alone does not change the patron');
});

test('the catalogue gives a service its logo as patron when its file asks for it', async () => {
  const data = mkdtempSync(join(tmpdir(), 'olympus-logo-patron-'));
  mkdirSync(join(data, 'services'));
  mkdirSync(join(data, 'logos'));
  writeFileSync(join(data, 'services', 'qube.json'), JSON.stringify({ id: 'qube', name: 'Qube', category: 'other', god: 'logo', logo: 'logos/qube.svg' }));
  writeFileSync(join(data, 'logos', 'qube.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10H90V90H10Z"/></svg>');
  process.env.OLYMPUS_DATA = data;
  try {
    const { loadCatalog } = await import('../src/node/catalog.ts');
    const s = loadCatalog().find((x) => x.id === 'qube');
    assert.ok(s && 'logo' in s.patron, 'its patron is its logo');
  } finally {
    delete process.env.OLYMPUS_DATA;
  }
});

test('a design keeps its logo as patron only while it has the logo', async () => {
  const { withLogoField, parseDesigns, nextVersion } = await import('../src/catalog/design.ts');
  const spec = { id: 'qube', name: 'Qube', category: 'other' as const, god: 'logo' as const, logo: 'logos/qube.svg' };
  const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 1H9V9H1Z"/></svg>';
  assert.deepEqual(withLogoField(spec, SVG), spec);
  assert.deepEqual(withLogoField(spec, undefined), { id: 'qube', name: 'Qube', category: 'other' }, 'no logo: no logo as patron');
  assert.equal(nextVersion({ spec, logoSvg: undefined }, undefined, '2026-10-23T00:00:00Z').spec.god, undefined);
  // A design file whose logo is missing still loads, with the category's patron.
  const [d] = parseDesigns(JSON.stringify({ format: 'the-olympus/design', formatVersion: 1, design: { spec, version: 2, created: 'x', updated: 'x' } }), '2026-10-23T00:00:00Z');
  assert.equal(d.spec.god, undefined);
  assert.equal(d.spec.logo, undefined);
});
