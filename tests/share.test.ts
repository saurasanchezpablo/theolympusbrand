// Designs in links, and the history a design keeps: a link gives back exactly
// the design, refuses what is damaged, foreign or oversized, and validates
// what it carries; saves stack up as versions that survive export and import.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, strToU8 } from 'fflate';
import { readShareCode, shareCode, SHARE_MAX_BYTES } from '../src/catalog/share.ts';
import { designFile, libraryFile, nextVersion, parseDesigns, HISTORY_LIMIT, type Design } from '../src/catalog/design.ts';
import type { ServiceSpec } from '../src/catalog/service.ts';

const spec: ServiceSpec = { id: 'vaultwarden', name: 'Vaultwarden', category: 'security', god: 'hades', caption: 'The Olympus · Vault', url: 'https://vaultwarden.theolympus.cloud', description: 'Passwords — “ünïcode” & more' };
const logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 1h8v8H1z"/></svg>';
const pack = (json: string) => '1.' + Buffer.from(deflateSync(strToU8(json))).toString('base64url');

test('a link gives back the design, with its logo', () => {
  const code = shareCode({ spec });
  assert.match(code, /^1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(readShareCode(code), { spec });
  const withLogo = readShareCode(shareCode({ spec: { ...spec, logo: 'logos/old-name.svg' }, logoSvg: logo }));
  assert.equal(withLogo.logoSvg, logo);
  assert.equal(withLogo.spec.logo, 'logos/vaultwarden.svg');
  // Short enough to send: a design without a logo is a few hundred characters.
  assert.ok(code.length < 400, `${code.length}`);
});

test('a link is read as untrusted input', () => {
  assert.throws(() => readShareCode('2.abc'), /different version/);
  assert.throws(() => readShareCode('1.ab$c'), /damaged/);
  assert.throws(() => readShareCode('1.' + 'A'.repeat(40)), /damaged/);
  assert.throws(() => readShareCode(pack('not json')), /not a design/);
  assert.throws(() => readShareCode(pack('null')), /not a design/);
  assert.throws(() => readShareCode(pack(JSON.stringify({ spec: { ...spec, url: 'javascript:alert(1)' } }))), /url/);
  assert.throws(() => readShareCode(pack(JSON.stringify({ spec: { ...spec, category: 'nope' } }))), /category/);
  assert.throws(() => readShareCode(pack(JSON.stringify({ spec, logoSvg: 42 }))), /logo/);
  // A small link that would unpack to a lot is stopped at the ceiling.
  const bomb = pack(JSON.stringify({ spec, logoSvg: 'x'.repeat(SHARE_MAX_BYTES * 4) }));
  assert.ok(bomb.length < 4000);
  assert.throws(() => readShareCode(bomb), /more than a design/);
});

test('saves become versions; the oldest fall away', () => {
  let d: Design | undefined;
  for (let i = 1; i <= HISTORY_LIMIT + 5; i++) d = nextVersion({ spec: { ...spec, caption: `Caption ${i}` } }, d, `2026-10-20T10:${String(i).padStart(2, '0')}:00.000Z`);
  assert.equal(d!.version, HISTORY_LIMIT + 5);
  assert.equal(d!.history!.length, HISTORY_LIMIT);
  assert.deepEqual(d!.history!.map((h) => h.version), Array.from({ length: HISTORY_LIMIT }, (_, i) => i + 5));
  assert.equal(d!.history!.at(-1)!.spec.caption, `Caption ${HISTORY_LIMIT + 4}`);
  assert.equal(d!.created, '2026-10-20T10:01:00.000Z');
  assert.equal(nextVersion({ spec }, undefined, 'now').history, undefined);
});

test('history survives the design and library files, and damaged entries are dropped', () => {
  const v1 = nextVersion({ spec, logoSvg: logo }, undefined, 't1');
  const v2 = nextVersion({ spec: { ...spec, name: 'Vault' } }, v1, 't2');
  const v3 = nextVersion({ spec: { ...spec, name: 'Vault', god: 'athena' } }, v2, 't3');
  const back = parseDesigns(designFile(v3), 'now')[0];
  assert.deepEqual(back, v3);
  assert.equal(back.history![0].logoSvg, logo);
  assert.deepEqual(parseDesigns(libraryFile([v3], 'now'), 'now')[0], v3);

  const raw = JSON.parse(designFile(v3));
  raw.design.history.push({ version: 9, updated: 'x', spec }); // not older than the design
  raw.design.history.push({ version: 2, updated: 'x', spec: { ...spec, category: 'nope' } }); // invalid
  raw.design.history.push({ version: 1, updated: 'x', spec, logoSvg: 7 }); // logo not text
  const cleaned = parseDesigns(JSON.stringify(raw), 'now')[0];
  assert.deepEqual(cleaned.history, v3.history);
});
