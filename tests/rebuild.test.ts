// The server's rebuilds: changes coalesced into one build, a release published
// in one step only when it is good and different, the request numbers the page
// waits on, and the last good release kept when a build fails.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRebuilder, type RebuilderOptions } from '../scripts/lib/rebuilder.ts';
import { toReset } from '../scripts/lib/pull.ts';
import { services } from '../scripts/lib/sources.ts';

/** A rebuilder on a scratch folder whose "build" writes a page saying `site.text` (or fails), counting its runs. */
function scratch(extra: Partial<RebuilderOptions> = {}, out = mkdtempSync(join(tmpdir(), 'olympus-releases-'))) {
  const root = mkdtempSync(join(tmpdir(), 'olympus-root-'));
  mkdirSync(join(root, 'catalog', 'services'), { recursive: true });
  const site = { text: 'one', fail: false, builds: 0, gate: null as Promise<void> | null };
  const r = createRebuilder({
    root,
    out,
    settle: 30,
    log: () => {},
    build: async (dir) => {
      site.builds++;
      if (site.gate) await site.gate;
      if (site.fail) throw new Error('the build broke');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'index.html'), site.text);
      writeFileSync(join(dir, '.manifest.json'), JSON.stringify({ 'index.html': site.text }));
      return { steps: [] };
    },
    ...extra,
  });
  const page = () => readFileSync(join(r.current()!, 'index.html'), 'utf8');
  return { r, site, out, page };
}

test('changes in quick succession are one build; the published number covers them all', async () => {
  const { r, site, page } = scratch();
  const numbers = [r.request('a'), r.request('b'), r.request('c')];
  assert.deepEqual(numbers, [1, 2, 3]);
  await r.idle();
  assert.equal(site.builds, 1);
  assert.equal(r.status().state, 'ok');
  assert.equal(r.status().published, 3);
  assert.equal(page(), 'one');
});

test('a change during a build is built after it, never lost and never claimed early', async () => {
  const { r, site, page } = scratch();
  let open!: () => void;
  site.gate = new Promise((ok) => (open = ok));
  const first = r.request('first');
  await new Promise((ok) => setTimeout(ok, 80));
  assert.equal(r.status().state, 'building');
  site.text = 'two';
  const second = r.request('second');
  // The running build started before the second change: it may publish only the first.
  site.gate = null;
  open();
  await new Promise((ok) => setTimeout(ok, 10));
  assert.ok(r.status().published < second, 'the second change is not said to be published by the first build');
  await r.idle();
  assert.equal(site.builds, 2);
  assert.ok(r.status().published >= second && second > first);
  assert.equal(page(), 'two');
});

test('a failed build leaves the last good release served and says why; the next good one publishes', async () => {
  const { r, site, page } = scratch();
  r.request('good');
  await r.idle();
  const good = r.current();
  site.fail = true;
  site.text = 'broken';
  const n = r.request('bad');
  await r.idle();
  assert.equal(r.status().state, 'failed');
  assert.match(r.status().error ?? '', /the build broke/);
  assert.equal(r.current(), good, 'still the good release');
  assert.equal(page(), 'one');
  assert.ok(r.status().published < n, 'the failed change is not published');
  site.fail = false;
  site.text = 'fixed';
  const m = r.request('fixed');
  await r.idle();
  assert.equal(r.status().state, 'ok');
  assert.ok(r.status().published >= m);
  assert.equal(page(), 'fixed');
});

test('a build that changes nothing the site shows publishes no new release', async () => {
  const { r, out } = scratch();
  r.request('first');
  await r.idle();
  const before = readdirSync(join(out, 'releases'));
  const current = r.current();
  const n = r.request('nothing new');
  await r.idle();
  assert.deepEqual(readdirSync(join(out, 'releases')), before);
  assert.equal(r.current(), current);
  assert.equal(r.status().published, n, 'the change is in the release already served');
});

test('old releases go; the served one and the one before stay', async () => {
  const { r, site, out } = scratch({ keep: 2 });
  for (const text of ['a', 'b', 'c', 'd']) {
    site.text = text;
    r.request(text);
    await r.idle();
    await new Promise((ok) => setTimeout(ok, 1100)); // release names are by the second
  }
  const left = readdirSync(join(out, 'releases'));
  assert.equal(left.length, 2);
  assert.ok(left.includes(r.current()!.split('/').pop()!));
});

test('after a restart, the numbers go on: a page waiting on a change from before still sees it published', async () => {
  const a = scratch();
  a.r.request('one');
  a.r.request('two');
  await a.r.idle();
  a.r.stop();
  const b = scratch({}, a.out);
  assert.ok(b.r.status().requested >= 2);
  assert.ok(b.r.current(), 'the release from before is served at once');
  const n = b.r.request('after the restart');
  assert.ok(n > 2);
  await b.r.idle();
  assert.ok(b.r.status().published >= n);
});

test('a change made but not published before a restart is not said to be published', async () => {
  const a = scratch();
  a.r.request('one');
  await a.r.idle();
  a.site.fail = true;
  const lost = a.r.request('failed before the restart');
  await a.r.idle();
  a.r.stop();
  const b = scratch({}, a.out);
  assert.ok(b.r.status().published < lost);
});

test('the server\'s own services are fingerprinted like the catalogue\'s; places are not', () => {
  const root = mkdtempSync(join(tmpdir(), 'olympus-snap-'));
  cpSync(new URL('../catalog', import.meta.url).pathname, join(root, 'catalog'), { recursive: true });
  const data = join(root, 'data');
  process.env.OLYMPUS_DATA = data;
  try {
    const before = services(root);
    mkdirSync(join(data, 'services'), { recursive: true });
    writeFileSync(join(data, 'places.json'), '{"jellyfin":{"building":"temple-doric","x":1,"z":2,"rotation":0}}');
    assert.deepEqual(services(root), before, 'a place is not a service change');
    writeFileSync(join(data, 'services', 'jellyfin.json'), '{"id":"jellyfin","name":"Cinema","category":"media"}');
    assert.notEqual(services(root).jellyfin, before.jellyfin, 'an override changes the service');
    writeFileSync(join(data, 'services', 'pihole.json'), '{"id":"pihole","name":"Pi-hole","category":"networking"}');
    assert.ok(services(root).pihole, 'a service of the server\'s own');
    writeFileSync(join(data, 'removed.json'), '["nextcloud"]');
    assert.ok(!('nextcloud' in services(root)), 'a default removed from the browser');
  } finally {
    delete process.env.OLYMPUS_DATA;
  }
});

test('before a pull, only generated files the pull also changes are put back; never a hand edit', () => {
  assert.deepEqual(toReset(['assets/services/index.json'], ['src/x.ts']), []);
  assert.deepEqual(toReset(['assets/services/index.json', 'docs/03-catalog.md', 'assets/integrations/dashboards/homepage.yaml'], ['assets/services/index.json', 'docs/03-catalog.md', 'README.md']), ['assets/services/index.json', 'docs/03-catalog.md']);
  assert.equal(toReset(['docs/07-self-hosting.md', 'assets/services/index.json'], ['docs/07-self-hosting.md', 'assets/services/index.json']), null);
  assert.equal(toReset(['catalog/services/x.json'], ['catalog/services/x.json']), null);
});

test('the deployment: one service, one port, the data and the releases in volumes, nothing proxied', async () => {
  const { parse } = await import('yaml');
  const deploy = new URL('../deploy/', import.meta.url).pathname;
  assert.deepEqual(readdirSync(deploy).sort(), ['Dockerfile', 'docker-compose.auto.yml', 'docker-compose.yml']);
  const docker = readFileSync(join(deploy, 'Dockerfile'), 'utf8');
  assert.match(docker, /CMD \["node", "scripts\/serve\.ts"\]/);
  assert.match(docker, /^USER node$/m, 'not root');
  for (const file of ['docker-compose.yml', 'docker-compose.auto.yml']) {
    const compose = parse(readFileSync(join(deploy, file), 'utf8'));
    const names = Object.keys(compose.services);
    assert.deepEqual(names, ['olympus'], `${file}: one service`);
    const svc = compose.services.olympus;
    assert.deepEqual(svc.ports, ['8080:8080']);
    assert.deepEqual(svc.cap_drop, ['ALL']);
    assert.ok(!svc.cap_add, 'no capability added');
    assert.ok(svc.security_opt.includes('no-new-privileges:true'));
    assert.ok(svc.volumes.some((v: string) => v.endsWith(':/var/lib/olympus/site')), 'the releases are kept');
    const data = svc.environment?.OLYMPUS_DATA ?? '/var/lib/olympus/data';
    assert.ok(svc.volumes.some((v: string) => v.endsWith(`:${data}`) || (v.startsWith('..:/repo') && data.startsWith('/repo/'))), `${file}: the data folder is kept`);
  }
  assert.ok(!existsSync(new URL('../scripts/lib/rebuild-plan.ts', import.meta.url)));
});
