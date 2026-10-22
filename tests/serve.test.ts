// The house's own server (scripts/serve.ts) on a fixed folder: the headers,
// the compressed copies, revalidation and ranges, nothing outside the site,
// the map's edit API on the same origin, and what is saved kept across a
// restart.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { setPassword } from '../scripts/lib/editor/auth.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const PASSWORD = 'serve-test-password';

const freePort = () =>
  new Promise<number>((ok) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
  });

/** A tiny built site: a page with its compressed copies, a hashed script, a download, a hidden file. */
function site(): string {
  const dir = mkdtempSync(join(tmpdir(), 'olympus-site-'));
  const html = `<!doctype html><title>The Olympus</title>${'<p>marble</p>'.repeat(200)}`;
  writeFileSync(join(dir, 'index.html'), html);
  writeFileSync(join(dir, 'index.html.gz'), gzipSync(html));
  writeFileSync(join(dir, 'index.html.br'), brotliCompressSync(html));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'index-abc123.js'), 'console.log(1)');
  mkdirSync(join(dir, 'files'));
  writeFileSync(join(dir, 'files', 'model.stl'), Buffer.alloc(4096, 7));
  writeFileSync(join(dir, '.manifest.json'), '{}');
  return dir;
}

async function start(dir: string, data: string, port: number): Promise<ChildProcess> {
  const p = spawn('node', ['scripts/serve.ts'], { cwd: ROOT, env: { ...process.env, OLYMPUS_SITE: dir, OLYMPUS_DATA: data, PORT: String(port), HOST: '127.0.0.1' }, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/build.json`)).ok) return p;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  p.kill();
  throw new Error('the server did not start');
}
const stopped = (p: ChildProcess) => new Promise<void>((ok) => (p.exitCode !== null ? ok() : (p.on('exit', () => ok()), p.kill())));

test('the server: the site with its headers, the edit API beside it, and what is saved kept across a restart', async () => {
  const dir = site();
  const data = mkdtempSync(join(tmpdir(), 'olympus-data-'));
  process.env.OLYMPUS_DATA = data;
  setPassword(PASSWORD);
  delete process.env.OLYMPUS_DATA;
  const port = await freePort();
  const at = (p: string) => `http://127.0.0.1:${port}${p}`;
  let server = await start(dir, data, port);
  try {
    // The page: the brotli copy, the content policy, checked back each visit.
    let r = await fetch(at('/'), { headers: { 'accept-encoding': 'br' } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-encoding'), 'br');
    assert.match(r.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    assert.equal(r.headers.get('cache-control'), 'no-cache');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await r.text(), /<title>The Olympus<\/title>/);
    r = await fetch(at('/'), { headers: { 'accept-encoding': 'gzip' } });
    assert.equal(r.headers.get('content-encoding'), 'gzip');
    // Revalidated: 304 for the same ETag.
    const etag = r.headers.get('etag')!;
    r = await fetch(at('/'), { headers: { 'accept-encoding': 'gzip', 'if-none-match': etag } });
    assert.equal(r.status, 304);
    // The hashed scripts: cached for good.
    r = await fetch(at('/assets/index-abc123.js'));
    assert.match(r.headers.get('cache-control') ?? '', /immutable/);
    // A range of a download; the brand's files are shown, never run.
    r = await fetch(at('/files/model.stl'), { headers: { range: 'bytes=10-19' } });
    assert.equal(r.status, 206);
    assert.equal(r.headers.get('content-range'), 'bytes 10-19/4096');
    assert.equal((await r.arrayBuffer()).byteLength, 10);
    assert.match(r.headers.get('content-security-policy') ?? '', /sandbox/);
    // Nothing outside the site, nothing hidden, nothing written.
    for (const p of ['/%2e%2e/package.json', '/..%2fpackage.json', '/.manifest.json', '/files/%2e%2e/%2e%2e/etc/passwd', '/nothing'])
      assert.equal((await fetch(at(p))).status, 404, p);
    assert.equal((await fetch(at('/'), { method: 'POST' })).status, 405);
    // A fixed folder: nothing is rebuilt, and the status says so.
    assert.deepEqual(await (await fetch(at('/build.json'))).json(), { state: 'static' });

    // The edit API, on the same origin.
    assert.equal((await (await fetch(at('/api/session'))).json()).editing, false);
    const spec = { id: 'kept', name: 'Kept', category: 'other' };
    r = await fetch(at('/api/services/kept'), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spec }) });
    assert.equal(r.status, 401, 'no session: refused');
    r = await fetch(at('/api/login'), { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://elsewhere.example' }, body: JSON.stringify({ password: PASSWORD }) });
    assert.equal(r.status, 403, 'from another site: refused');
    r = await fetch(at('/api/login'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'wrong-password' }) });
    assert.equal(r.status, 401);
    r = await fetch(at('/api/login'), { method: 'POST', headers: { 'content-type': 'application/json', origin: at('') }, body: JSON.stringify({ password: PASSWORD }) });
    assert.equal(r.status, 200);
    const cookie = (r.headers.get('set-cookie') ?? '').split(';')[0];
    const { csrf } = (await r.json()) as { csrf: string };
    r = await fetch(at('/api/services/kept'), { method: 'PUT', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ spec }) });
    assert.equal(r.status, 403, 'no token: refused');
    r = await fetch(at('/api/services/kept'), { method: 'PUT', headers: { 'content-type': 'application/json', cookie, 'x-olympus-csrf': csrf }, body: JSON.stringify({ spec }) });
    assert.equal(r.status, 200);
    // Saved, and never said to be published: this server does not rebuild.
    assert.deepEqual(await r.json(), { ok: true });
    r = await fetch(at('/api/services/kept'), { method: 'PUT', headers: { 'content-type': 'application/json', cookie, 'x-olympus-csrf': csrf }, body: 'x'.repeat(3_000_000) });
    assert.ok(r.status === 413 || r.status === 400, `an oversized body is refused (${r.status})`);
    r = await fetch(at('/api/services/..%2f..%2fescape'), { method: 'PUT', headers: { 'content-type': 'application/json', cookie, 'x-olympus-csrf': csrf }, body: JSON.stringify({ spec }) });
    assert.ok(r.status >= 400 && r.status < 500, 'an id that is a path: refused');

    // A restart, the same data folder: the service is still there.
    await stopped(server);
    server = await start(dir, data, port);
    const map = (await (await fetch(at('/api/map'))).json()) as { items: { id: string; name: string; seal?: string }[] };
    assert.equal(map.items.find((e) => e.id === 'kept')?.name, 'Kept');
    // Its seal is not on the site yet (nothing was rebuilt): none is offered, so the page never asks for a file that is not there.
    assert.equal(map.items.find((e) => e.id === 'kept')?.seal, undefined);
  } finally {
    await stopped(server);
  }
});
