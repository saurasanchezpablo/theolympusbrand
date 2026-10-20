// The automatic rebuild's plan: what it rebuilds for each kind of change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, command, type Snapshot } from '../scripts/lib/rebuild-plan.ts';

const base: Snapshot = { deps: 'd1', code: 'c1', content: 'h1', services: { jellyfin: 'j1', nextcloud: 'n1' } };
const kinds = (s: Snapshot | null, n: Snapshot) => plan(s, n).steps.map((x) => ('ids' in x ? `${x.kind}:${x.ids.join(',')}` : x.kind));

test('nothing changed: nothing to do', () => {
  assert.deepEqual(kinds(base, structuredClone(base)), []);
});

test('a first start installs and builds everything', () => {
  assert.deepEqual(kinds(null, base), ['install', 'build-all', 'site']);
});

test('code or dependencies changed: everything is rebuilt', () => {
  assert.deepEqual(kinds(base, { ...base, code: 'c2' }), ['build-all', 'site']);
  assert.deepEqual(kinds(base, { ...base, deps: 'd2', code: 'c2' }), ['install', 'build-all', 'site']);
});

test('a service added or changed: only it, then what lists every service, then the site', () => {
  assert.deepEqual(kinds(base, { ...base, services: { ...base.services, vault: 'v1' } }), ['build-services:vault', 'integrations', 'site']);
  assert.deepEqual(kinds(base, { ...base, services: { ...base.services, jellyfin: 'j2' } }), ['build-services:jellyfin', 'integrations', 'site']);
});

test('a service removed: its files go, the lists are rebuilt without it', () => {
  assert.deepEqual(kinds(base, { ...base, services: { nextcloud: 'n1' } }), ['remove-services:jellyfin', 'index', 'integrations', 'site']);
  // Removed and another changed at once: the build of the changed one rebuilds the index too.
  assert.deepEqual(kinds(base, { ...base, services: { nextcloud: 'n2' } }), ['remove-services:jellyfin', 'build-services:nextcloud', 'integrations', 'site']);
});

test('only the published content changed (a pulled commit): just the site', () => {
  assert.deepEqual(kinds(base, { ...base, content: 'h2' }), ['site']);
  assert.deepEqual(plan(base, { ...base, content: 'h2' }).why, ['the published content changed']);
});

test('the commands: service builds never fail on a print warning; the site goes to the release folder', () => {
  assert.deepEqual(command({ kind: 'build-services', ids: ['vault'] }, '/x'), ['node', 'scripts/service.ts', 'build', 'vault', '--warn-only']);
  assert.deepEqual(command({ kind: 'site' }, '/site/releases/r1').slice(-3), ['--outDir', '/site/releases/r1', '--emptyOutDir']);
  // Removal names only ids, quoted as JSON inside the script.
  assert.match(command({ kind: 'remove-services', ids: ['a-b'] }, '/x')[2], /\["a-b"\]/);
});

test('the automatic deployment: two containers sharing the releases, the web server serving the current one', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const { parse } = await import('yaml');
  const deploy = new URL('../deploy/', import.meta.url).pathname;
  const compose = parse(readFileSync(`${deploy}docker-compose.auto.yml`, 'utf8'));
  for (const svc of Object.values(compose.services) as { build: { dockerfile: string } }[]) assert.ok(existsSync(`${deploy}${svc.build.dockerfile}`), svc.build.dockerfile);
  assert.ok(compose.services.builder.volumes.includes('site:/site') && compose.services.web.volumes.includes('site:/site:ro'));
  assert.ok(compose.services.builder.volumes.includes('..:/repo'), 'the builder works in the repository on the server');
  const builder = readFileSync(`${deploy}Dockerfile.builder`, 'utf8');
  assert.match(builder, /CMD \["node", "scripts\/autobuild\.ts"\]/);
  assert.ok(existsSync(new URL('../scripts/autobuild.ts', import.meta.url)));
  assert.match(readFileSync(`${deploy}Dockerfile.web`, 'utf8'), /ln -s \/site\/current \/usr\/share\/nginx\/html/);
  // The placeholder status every build ships, so the page never asks for a file that is not there.
  assert.equal(JSON.parse(readFileSync(new URL('../app/public/build.json', import.meta.url), 'utf8')).state, 'static');
});
