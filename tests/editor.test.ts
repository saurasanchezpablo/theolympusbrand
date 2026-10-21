// The map's edit service: reading is open, writing needs the password and the
// page's token; whatever it is given is checked as the command line checks
// it; it writes only into the data folder, one write at a time; and it pings
// only what is on the map.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const DATA = mkdtempSync(join(tmpdir(), 'olympus-editor-'));
process.env.OLYMPUS_DATA = DATA;
const { createEditor, setPassword } = await import('../scripts/lib/editor/server.ts');
const { loadPlaces, loadMachines } = await import('../src/node/data.ts');

let base = '';
let close: () => Promise<void>;
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 1H9V9H1Z"/></svg>';

before(async () => {
  setPassword('olympus-test-password');
  const ed = await createEditor({ port: 0, host: '127.0.0.1', delayScale: 0.001, statusTtl: 0 });
  base = ed.url;
  close = ed.close;
});
after(async () => close());

const login = async (password = 'olympus-test-password') => {
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
  const cookie = (r.headers.get('set-cookie') ?? '').split(';')[0];
  return { status: r.status, cookie, csrf: r.ok ? ((await r.json()) as { csrf: string }).csrf : '' };
};
const write = (method: string, path: string, body: unknown, s?: { cookie: string; csrf: string }) =>
  fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', ...(s ? { cookie: s.cookie, 'x-olympus-csrf': s.csrf } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

test('reading needs no password', async () => {
  const map = (await (await fetch(`${base}/api/map`)).json()) as { items: unknown[] };
  assert.equal(map.items.length, 16);
  const cat = (await (await fetch(`${base}/api/catalog`)).json()) as { services: { id: string }[] };
  assert.equal(cat.services.length, 16);
  assert.equal((await fetch(`${base}/api/status`)).status, 200);
  assert.deepEqual(await (await fetch(`${base}/api/session`)).json(), { editing: false });
});

test('writing needs the password and the token', async () => {
  const place = { place: { building: 'theatre', x: 10, z: 12, rotation: 1 } };
  assert.equal((await write('PUT', '/api/places/jellyfin', place)).status, 401);
  const s = await login();
  assert.equal(s.status, 200);
  assert.match(s.cookie, /^olympus_session=[0-9a-f]{64}$/);
  assert.equal((await write('PUT', '/api/places/jellyfin', place, { cookie: s.cookie, csrf: 'wrong' })).status, 403);
  assert.equal((await write('PUT', '/api/places/jellyfin', place, s)).status, 200);
  assert.equal(loadPlaces().jellyfin.building, 'theatre');
  assert.equal(((await (await fetch(`${base}/api/session`, { headers: { cookie: s.cookie } })).json()) as { editing: boolean }).editing, true);
  await write('POST', '/api/logout', {}, s);
  assert.equal((await write('PUT', '/api/places/jellyfin', place, s)).status, 401, 'logged out');
});

test('a wrong password is refused, and slowed', async () => {
  const a = await login('nope');
  assert.equal(a.status, 401);
  const t0 = Date.now();
  assert.equal((await login('nope')).status, 401);
  assert.ok(Date.now() - t0 >= 2, 'the second try waits (2 s, scaled down here)');
  assert.equal((await login()).status, 200, 'the right one still works');
});

test('services and machines are saved, checked as the command line checks them', async () => {
  const s = await login();
  const ok = await write('PUT', '/api/services/pihole', { spec: { id: 'pihole', name: 'Pi-hole', category: 'networking', ip: '10.0.0.53' }, logoSvg: LOGO }, s);
  assert.equal(ok.status, 200, await ok.text());
  const map = (await (await fetch(`${base}/api/map`)).json()) as { items: { id: string; logo?: string }[] };
  assert.ok(map.items.some((e) => e.id === 'pihole'));
  assert.equal(readFileSync(join(DATA, 'logos/pihole.svg'), 'utf8'), LOGO);
  assert.equal((await write('PUT', '/api/machines/node-1', { spec: { id: 'node-1', name: 'Node 1', ip: '10.0.0.11', os: 'Proxmox VE 9' } }, s)).status, 200);
  assert.deepEqual(loadMachines().map((m) => m.id), ['node-1']);
  assert.equal((await write('DELETE', '/api/machines/node-1', undefined, s)).status, 200);
  assert.deepEqual(loadMachines(), []);
  // A default deleted from the browser is hidden, the repository untouched.
  assert.equal((await write('DELETE', '/api/services/web', undefined, s)).status, 200);
  assert.ok(!((await (await fetch(`${base}/api/catalog`)).json()) as { services: { id: string }[] }).services.some((x) => x.id === 'web'));
  assert.equal(execFileSync('git', ['status', '--porcelain', 'catalog/'], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' }), '');
});

test('hostile text and logos are refused, or kept as plain text', async () => {
  const s = await login();
  const put = (spec: Record<string, unknown>, logoSvg?: string) => write('PUT', `/api/services/${spec.id}`, { spec, logoSvg }, s);
  // Kept verbatim: the page shows it as text.
  assert.equal((await put({ id: 'odd', name: '<script>x</script>', category: 'other' })).status, 200);
  const odd = ((await (await fetch(`${base}/api/map`)).json()) as { items: { id: string; name: string }[] }).items.find((e) => e.id === 'odd')!;
  assert.equal(odd.name, '<script>x</script>');
  assert.equal((await put({ id: 'odd', name: 'two\nlines', category: 'other' })).status, 400);
  assert.equal((await put({ id: 'odd', name: 'Odd', category: 'other', description: 'x'.repeat(10_000) })).status, 400);
  for (const svg of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0H1V1Z"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="http://evil.example/x.png"/><path d="M0 0H1V1Z"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><path d="M0 0H1V1Z"/></svg>',
    'not an svg at all',
  ])
    assert.equal((await put({ id: 'odd', name: 'Odd', category: 'other' }, svg)).status, 400, svg);
  // The id in the address must be the one in the file, and an id.
  assert.equal((await write('PUT', '/api/services/other-id', { spec: { id: 'odd', name: 'Odd', category: 'other' } }, s)).status, 400);
  assert.ok([400, 404].includes((await write('PUT', '/api/services/..%2Fx', { spec: { id: '../x', name: 'X', category: 'other' } }, s)).status));
  const big = await write('PUT', '/api/services/odd', { spec: { id: 'odd', name: 'Odd', category: 'other' }, logoSvg: 'x'.repeat(700_000) }, s);
  assert.equal(big.status, 413);
});

test('two saves at once both land', async () => {
  const s = await login();
  const ids = ['backup', 'community', 'containers', 'game-server', 'home-assistant', 'minecraft', 'monitoring', 'multiplayer', 'network', 'nextcloud', 'proxmox', 'reverse-proxy', 'storage', 'vpn', 'jellyfin', 'pihole', 'odd'];
  const rs = await Promise.all(ids.map((id, i) => write('PUT', `/api/places/${id}`, { place: { building: 'tholos', x: -100 + i * 10, z: 50, rotation: 0 } }, s)));
  for (const r of rs) assert.equal(r.status, 200);
  const places = JSON.parse(readFileSync(join(DATA, 'places.json'), 'utf8'));
  for (const id of ids) assert.equal(places[id].building, 'tholos', id);
});

test('ping is only for what is on the map', async () => {
  const s = await login();
  await write('PUT', '/api/machines/here', { spec: { id: 'here', name: 'Here', ip: '127.0.0.1' } }, s);
  await write('PUT', '/api/machines/nowhere', { spec: { id: 'nowhere', name: 'Nowhere', ip: '192.0.2.1' } }, s);
  const t0 = Date.now();
  const st = (await (await fetch(`${base}/api/status?host=127.0.0.1`)).json()) as { items: Record<string, string> };
  assert.equal(st.items.here, 'up');
  assert.equal(st.items.nowhere, 'down');
  assert.ok(Date.now() - t0 < 8000);
  assert.ok(!('127.0.0.1' in st.items), 'no host parameter is honoured');
  assert.equal(st.items.web, undefined, 'items without an address are not checked');
});

test('guesses sent all at once still wait their turn, and the service keeps answering meanwhile', async () => {
  const ed = await createEditor({ port: 0, host: '127.0.0.1', delayScale: 0.01, statusTtl: 0 });
  try {
    const guess = () => fetch(`${ed.url}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'nope' }) });
    const t0 = Date.now();
    const all = Promise.all(Array.from({ length: 6 }, guess));
    // Reading is not held up by the guesses.
    const r0 = Date.now();
    assert.equal((await fetch(`${ed.url}/api/session`)).status, 200);
    assert.ok(Date.now() - r0 < 400, 'reads answer while logins wait');
    for (const r of await all) assert.equal(r.status, 401);
    // 0 + 2 + 4 + 8 + 16 + 32 seconds, scaled by 0.01: the six guesses took their turns.
    assert.ok(Date.now() - t0 >= 550, `${Date.now() - t0} ms`);
  } finally {
    await ed.close();
  }
});

test('buildings placed for the owner stay where they are when a service is added', async () => {
  const s = await login();
  const first = (await (await fetch(`${base}/api/map`)).json()) as { items: { id: string; place: { x: number; z: number } }[] };
  // Read once: every spot chosen for the owner is kept from now on.
  for (const e of first.items) assert.ok(loadPlaces()[e.id], `${e.id} pinned`);
  assert.equal((await write('PUT', '/api/services/aaa-first', { spec: { id: 'aaa-first', name: 'Comes first', category: 'virtualization' } }, s)).status, 200);
  const after = (await (await fetch(`${base}/api/map`)).json()) as { items: { id: string; place: { x: number; z: number } }[] };
  for (const e of first.items) {
    const now = after.items.find((x) => x.id === e.id)!;
    assert.deepEqual([now.place.x, now.place.z], [e.place.x, e.place.z], `${e.id} did not move`);
  }
});

test('a logo is always the item’s own file, and may not reach out through styles', async () => {
  const { checkLogo } = await import('../scripts/lib/editor/server.ts');
  const s = await login();
  // Pointing at another item's logo would break the whole catalogue: refused.
  const r = await write('PUT', '/api/services/pihole', { spec: { id: 'pihole', name: 'Pi-hole', category: 'networking', logo: 'logos/odd.svg' } }, s);
  assert.equal(r.status, 400);
  assert.equal((await fetch(`${base}/api/catalog`)).status, 200, 'the catalogue still loads');
  for (const svg of [
    '<svg xmlns="http://www.w3.org/2000/svg"><path fill="url(https://evil.example/p)" d="M0 0H1V1Z"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path style="fill:url(http://evil.example/p)" d="M0 0H1V1Z"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example/x.css);</style><path d="M0 0H1V1Z"/></svg>',
  ])
    assert.throws(() => checkLogo(svg), svg);
  // A gradient referenced inside the file is fine.
  checkLogo('<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"/></defs><path fill="url(#g)" d="M0 0H1V1Z"/></svg>');
});

test('status checks asked for at the same time share one round of pings', async () => {
  let pings = 0;
  const ed = await createEditor({ port: 0, host: '127.0.0.1', statusTtl: 0, reachable: async () => (pings++, await new Promise((r) => setTimeout(r, 200)), true) });
  try {
    const hosts = ((await (await fetch(`${ed.url}/api/map`)).json()) as { items: { ip?: string; url?: string; hostname?: string }[] }).items.filter((e) => e.ip || e.url || e.hostname).length;
    await Promise.all(Array.from({ length: 5 }, () => fetch(`${ed.url}/api/status`)));
    assert.equal(pings, hosts, `${pings} pings for ${hosts} addresses`);
  } finally {
    await ed.close();
  }
});

test('a ping that is not allowed to run means "ask the ports", not "offline"', async () => {
  const { pingVerdict } = await import('../scripts/lib/editor/ping.ts');
  assert.equal(pingVerdict(null, ''), true);
  assert.equal(pingVerdict(Object.assign(new Error('x'), { code: 1 }), ''), false, 'no answer');
  assert.equal(pingVerdict(Object.assign(new Error('x'), { code: 'ENOENT' }), ''), null, 'no ping command');
  assert.equal(pingVerdict(Object.assign(new Error('x'), { code: 2 }), 'ping: socket: Operation not permitted'), null, 'no right to ping');
  assert.equal(pingVerdict(Object.assign(new Error('x'), { code: 2 }), 'ping: nas.lan: Name or service not known'), false, 'a name that does not resolve');
});
