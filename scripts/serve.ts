// The Olympus — the site's server: one process, one port. It serves the
// published site, answers the map's edit API under /api/ (same origin, the
// house's password), and keeps the site built: every change saved through the
// API, every change to catalog/ or the data folder, every commit pulled, is
// rebuilt incrementally into a new release that replaces the served one in a
// single step (scripts/lib/rebuilder.ts). /build.json says what it is doing.
//
//   npm start                      (node scripts/serve.ts)
//   npm run editor -- password     set the password for editing the map, once
//
// Settings (environment):
//   PORT / HOST              where to listen                                  (8080 / 127.0.0.1; 0.0.0.0 in the container)
//   OLYMPUS_DATA             the server's own data: what the map adds         (data/ in the repository)
//   OLYMPUS_OUT              the published releases                           (site-releases/ in the repository)
//   OLYMPUS_CACHE            what the build keeps between runs                (.cache/ in the repository)
//   OLYMPUS_GIT_INTERVAL     minutes between pulls from the remote; 0: never  (0)
//   OLYMPUS_GIT_REMOTE / OLYMPUS_GIT_BRANCH                                   (origin / the current one)
//   OLYMPUS_POLL             seconds between looks at catalog/ and the data   (10)
//   OLYMPUS_KEEP             releases kept, the served one included           (2)
//   OLYMPUS_SITE             serve this built folder as it is, never rebuilt  (unset; the checks use app/dist)
//
// Only Node's own modules and the house's: there is no other service to run.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { DEFAULT_DATA, dataDir } from '../src/node/data.ts';

const ROOT = resolve(import.meta.dirname, '..');
// The server always works with a data folder: data/ in the repository unless OLYMPUS_DATA names another.
process.env.OLYMPUS_DATA ||= DEFAULT_DATA;
const env = (k: string, d: string) => process.env[k]?.trim() || d;
const OUT = resolve(ROOT, env('OLYMPUS_OUT', 'site-releases'));
const PORT = Number(env('PORT', '8080'));
const HOST = env('HOST', '127.0.0.1');

const { createRebuilder } = await import('./lib/rebuilder.ts');
const { serveStatic, COMMON_HEADERS, CONTENT_POLICY } = await import('./lib/static.ts');
const { createEditorApi, hasPassword } = await import('./lib/editor/server.ts');

// A fixed folder (OLYMPUS_SITE): served as it is; the map's changes are saved and never published.
const FIXED = process.env.OLYMPUS_SITE?.trim() ? resolve(ROOT, process.env.OLYMPUS_SITE.trim()) : null;
const rebuilder = FIXED
  ? null
  : createRebuilder({
      root: ROOT,
      out: OUT,
      keep: Number(env('OLYMPUS_KEEP', '2')),
      gitMinutes: Number(env('OLYMPUS_GIT_INTERVAL', '0')),
      remote: env('OLYMPUS_GIT_REMOTE', 'origin'),
      branch: process.env.OLYMPUS_GIT_BRANCH?.trim() || undefined,
      pollSeconds: Number(env('OLYMPUS_POLL', '10')),
      siteStatus: false,
    });
const api = createEditorApi({
  site: () => FIXED ?? rebuilder?.current(),
  // A saved change is published by the next build; the page is told its number and waits for it.
  onChange: (what) => rebuilder?.request(`${what === 'place' ? 'a building moved' : what === 'removed' ? 'something removed' : `a ${what} saved`} on the map`),
});

const plain = (res: ServerResponse, status: number, html: string, headers: Record<string, string> = {}) => {
  res.writeHead(status, { ...COMMON_HEADERS, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': CONTENT_POLICY, ...headers });
  res.end(html);
};
const page = (title: string, text: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{font:16px/1.5 system-ui,sans-serif;background:#0e0e0e;color:#ededed;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:32rem;padding:2rem}</style><main><h1>${title}</h1><p>${text}</p></main>`;

async function handle(req: IncomingMessage, res: ServerResponse) {
  const path = new URL(req.url ?? '/', 'http://site').pathname;
  if (path === '/api' || path.startsWith('/api/')) return api.handle(req, res);
  if (path === '/build.json') {
    res.writeHead(200, { ...COMMON_HEADERS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify(rebuilder?.status() ?? { state: 'static' }));
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return plain(res, 405, page('Not allowed', 'This address is only read.'), { allow: 'GET, HEAD' });
  const site = FIXED ?? rebuilder?.current();
  if (!site) {
    const s = rebuilder!.status();
    return plain(
      res,
      503,
      page(
        'The Olympus is being built',
        s.state === 'failed'
          ? `The first build failed: ${s.error?.split('\n')[0] ?? 'see the server’s log'}.`
          : 'The first build of the site is under way: a few minutes. This page will be the site when it is done — reload it then.',
      ),
      { 'retry-after': '30' },
    );
  }
  if (!serveStatic(site, req, res)) plain(res, 404, page('Not here', 'There is nothing at this address. <a href="./">The Olympus</a>.'));
}

const server = createServer((req, res) => {
  handle(req, res).catch((e: unknown) => {
    console.error(e);
    if (!res.headersSent) plain(res, 500, page('Something went wrong', 'The server could not answer; its log says why.'));
    else res.destroy();
  });
});
// Slow or half-open connections do not hold the server.
server.headersTimeout = 20_000;
server.requestTimeout = 120_000;
server.listen(PORT, HOST, () => {
  console.log(
    `The Olympus on http://${HOST}:${PORT}/ · data in ${dataDir()} · ${FIXED ? `serving ${FIXED} as it is` : `releases in ${OUT}`}${hasPassword() ? '' : ' · no password for editing the map yet: npm run editor -- password'}`,
  );
  rebuilder?.start();
});
for (const sig of ['SIGTERM', 'SIGINT'] as const)
  process.on(sig, () => {
    rebuilder?.stop();
    server.close();
    process.exit(0);
  });
