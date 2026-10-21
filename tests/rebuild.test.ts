// The automatic rebuild's plan: what it rebuilds for each kind of change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, command, type Snapshot } from '../scripts/lib/rebuild-plan.ts';

const base: Snapshot = { deps: 'd1', code: 'c1', content: 'h1', services: { jellyfin: 'j1', nextcloud: 'n1' }, map: 'm1' };
const kinds = (s: Snapshot | null, n: Snapshot) => plan(s, n).steps.map((x) => ('ids' in x ? `${x.kind}:${x.ids.join(',')}` : x.kind));

test('nothing changed: nothing to do', () => {
  assert.deepEqual(kinds(base, structuredClone(base)), []);
});

test('a first start installs and builds everything', () => {
  assert.deepEqual(kinds(null, base), ['install', 'build-all', 'screens:jellyfin,nextcloud', 'site']);
});

test('code or dependencies changed: everything is rebuilt', () => {
  assert.deepEqual(kinds(base, { ...base, code: 'c2' }), ['build-all', 'screens:jellyfin,nextcloud', 'site']);
  assert.deepEqual(kinds(base, { ...base, deps: 'd2', code: 'c2' }), ['install', 'build-all', 'screens:jellyfin,nextcloud', 'site']);
});

test('a service added, changed or renamed: only it — its files and its screens — then what lists every service, then the site', () => {
  assert.deepEqual(kinds(base, { ...base, services: { ...base.services, vault: 'v1' } }), ['build-services:vault', 'integrations', 'screens:vault', 'installer', 'map', 'site']);
  assert.deepEqual(kinds(base, { ...base, services: { ...base.services, jellyfin: 'j2' } }), ['build-services:jellyfin', 'integrations', 'screens:jellyfin', 'installer', 'map', 'site']);
});

test('a service removed: its files go, the lists are rebuilt without it', () => {
  assert.deepEqual(kinds(base, { ...base, services: { nextcloud: 'n1' } }), ['remove-services:jellyfin', 'index', 'integrations', 'installer', 'map', 'site']);
  // Removed and another changed at once: the build of the changed one rebuilds the index too.
  assert.deepEqual(kinds(base, { ...base, services: { nextcloud: 'n2' } }), ['remove-services:jellyfin', 'build-services:nextcloud', 'integrations', 'screens:nextcloud', 'installer', 'map', 'site']);
});

test('moving a building rebuilds only the map and the site', () => {
  assert.deepEqual(kinds(base, { ...base, map: 'm2' }), ['map', 'site']);
  assert.deepEqual(plan(base, { ...base, map: 'm2' }).why, ['the map changed']);
  assert.deepEqual(command({ kind: 'map' }, '/x'), ['node', 'scripts/map.ts']);
});

test('the server\'s own services are fingerprinted like the catalogue\'s; places are not', async () => {
  const { mkdtempSync, cpSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { services, snapshot } = await import('../scripts/lib/rebuild-snapshot.ts');
  const root = mkdtempSync(join(tmpdir(), 'olympus-snap-'));
  cpSync(new URL('../catalog', import.meta.url).pathname, join(root, 'catalog'), { recursive: true });
  const data = join(root, 'data');
  process.env.OLYMPUS_DATA = data;
  const before = services(root);
  const map0 = snapshot(root).map;
  mkdirSync(join(data, 'services'), { recursive: true });
  writeFileSync(join(data, 'places.json'), '{"jellyfin":{"building":"temple-doric","x":1,"z":2,"rotation":0}}');
  assert.deepEqual(services(root), before, 'a place is not a service change');
  assert.notEqual(snapshot(root).map, map0, 'but it is a map change');
  writeFileSync(join(data, 'services', 'jellyfin.json'), '{"id":"jellyfin","name":"Cinema","category":"media"}');
  assert.notEqual(services(root).jellyfin, before.jellyfin, 'an override changes the service');
  writeFileSync(join(data, 'services', 'pihole.json'), '{"id":"pihole","name":"Pi-hole","category":"networking"}');
  assert.ok(services(root).pihole, 'a service of the server\'s own');
  writeFileSync(join(data, 'removed.json'), '["nextcloud"]');
  assert.ok(!('nextcloud' in services(root)), 'a default removed from the browser');
  delete process.env.OLYMPUS_DATA;
});

test('only the published content changed (a pulled commit): just the site', () => {
  assert.deepEqual(kinds(base, { ...base, content: 'h2' }), ['site']);
  assert.deepEqual(plan(base, { ...base, content: 'h2' }).why, ['the published content changed']);
});

test('the commands: service builds never fail on a print warning; the site goes to the release folder', () => {
  assert.deepEqual(command({ kind: 'build-services', ids: ['vault'] }, '/x'), ['node', 'scripts/service.ts', 'build', 'vault', '--warn-only']);
  assert.deepEqual(command({ kind: 'site' }, '/site/releases/r1').slice(-3), ['--outDir', '/site/releases/r1', '--emptyOutDir']);
  // Removal names only ids, quoted as JSON inside the script, and takes the service's screens too.
  assert.match(command({ kind: 'remove-services', ids: ['a-b'] }, '/x')[2], /\["a-b"\][\s\S]*assets\/screens\/services\//);
  assert.deepEqual(command({ kind: 'screens', ids: ['a', 'b'] }, '/x'), ['node', 'scripts/screens.ts', 'a', 'b']);
  // Dependencies are installed without running any package's install script.
  assert.ok(command({ kind: 'install' }, '/x').includes('--ignore-scripts'));
});

test('the automatic deployment: two containers sharing the releases, the web server serving the current one', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const { parse } = await import('yaml');
  const deploy = new URL('../deploy/', import.meta.url).pathname;
  const compose = parse(readFileSync(`${deploy}docker-compose.auto.yml`, 'utf8'));
  for (const svc of Object.values(compose.services) as { build?: { dockerfile: string } }[]) if (svc.build) assert.ok(existsSync(`${deploy}${svc.build.dockerfile}`), svc.build.dockerfile);
  assert.ok(compose.services.builder.volumes.includes('site:/site') && compose.services.web.volumes.includes('site:/site:ro'));
  assert.ok(compose.services.builder.volumes.includes('..:/repo'), 'the builder works in the repository on the server');
  const builder = readFileSync(`${deploy}Dockerfile.builder`, 'utf8');
  assert.match(builder, /CMD \["node", "scripts\/autobuild\.ts"\]/);
  assert.ok(existsSync(new URL('../scripts/autobuild.ts', import.meta.url)));
  assert.match(readFileSync(`${deploy}Dockerfile.web`, 'utf8'), /ln -s \/site\/current \/usr\/share\/nginx\/html/);
  // The placeholder status every build ships, so the page never asks for a file that is not there.
  assert.equal(JSON.parse(readFileSync(new URL('../app/public/build.json', import.meta.url), 'utf8')).state, 'static');
});

test('the map\'s edit service: its own container with only the right to ping, reached through the web server under /api/', async () => {
  const { readFileSync } = await import('node:fs');
  const { parse } = await import('yaml');
  const deploy = new URL('../deploy/', import.meta.url).pathname;
  const compose = parse(readFileSync(`${deploy}docker-compose.auto.yml`, 'utf8'));
  const editor = compose.services.editor;
  assert.ok(editor, 'an editor service');
  assert.deepEqual(editor.command, ['node', 'scripts/editor.ts', 'serve']);
  assert.deepEqual(editor.cap_drop, ['ALL']);
  assert.deepEqual(editor.cap_add, ['NET_RAW']);
  assert.ok(editor.security_opt.includes('no-new-privileges:true'));
  assert.ok(editor.volumes.includes('..:/repo'));
  assert.equal(editor.environment.OLYMPUS_EDITOR_HOST, '0.0.0.0');
  assert.ok(!editor.ports, 'not published: only the web server reaches it');
  const nginx = readFileSync(`${deploy}nginx.conf`, 'utf8');
  const api = nginx.match(/location \/api\/ \{([\s\S]*?)\n  \}/);
  assert.ok(api, 'a location for /api/');
  assert.match(api[1], /proxy_pass \$editor;/);
  assert.match(api[1], /client_max_body_size 1m;/);
  assert.equal((nginx.match(/proxy_pass/g) ?? []).length, 1, 'nothing else is proxied');
  // The static deployment has no editor: nginx must still start (the address is looked up per request).
  assert.match(nginx, /resolver 127\.0\.0\.11/);
  assert.match(nginx, /resolver_timeout 2s;/, 'a missing editor is given up on quickly');
  assert.match(nginx, /return 200 '\{"editor":false\}'/, 'without the editor, a plain read-only answer');
  assert.ok(!parse(readFileSync(`${deploy}docker-compose.yml`, 'utf8')).services.editor, 'the static deployment stays read-only');
});

test('before a pull, only generated files the pull also changes are put back; never a hand edit', async () => {
  const { toReset } = await import('../scripts/lib/rebuild-plan.ts');
  // Nothing in the way: nothing to put back.
  assert.deepEqual(toReset(['assets/services/index.json'], ['src/x.ts']), []);
  // A generated file the server's data changed, and the pull changes too: put back, to be made again.
  assert.deepEqual(toReset(['assets/services/index.json', 'docs/03-catalog.md', 'assets/integrations/dashboards/homepage.yaml'], ['assets/services/index.json', 'docs/03-catalog.md', 'README.md']), ['assets/services/index.json', 'docs/03-catalog.md']);
  // A hand edit in the way: nothing is put back, and the pull is refused as before.
  assert.equal(toReset(['docs/07-self-hosting.md', 'assets/services/index.json'], ['docs/07-self-hosting.md', 'assets/services/index.json']), null);
  assert.equal(toReset(['catalog/services/x.json'], ['catalog/services/x.json']), null);
});
