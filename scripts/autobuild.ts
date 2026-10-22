// The Olympus — the automatic rebuild on its own, for a site served by
// another web server from <OLYMPUS_OUT>/current (the house's own server,
// npm start, runs the same rebuild inside it). It watches catalog/ and the
// server's data folder, pulls from the remote on a timer, and rebuilds only
// what changed into a new release that replaces the served one in one step
// (scripts/lib/rebuilder.ts). A failed build leaves the site as it was and
// says why in <out>/status.json and <out>/current/build.json.
//
//   npm run autobuild                    keep watching
//   npm run autobuild -- --once          one pass: rebuild if anything changed, then stop
//
// Settings (environment): OLYMPUS_OUT, OLYMPUS_GIT_INTERVAL, OLYMPUS_GIT_REMOTE,
// OLYMPUS_GIT_BRANCH, OLYMPUS_POLL, OLYMPUS_KEEP — as for scripts/serve.ts.
//
// Only Node's own modules are used here: it runs before the dependencies are installed.

import { join, resolve } from 'node:path';
import { createRebuilder } from './lib/rebuilder.ts';

const ROOT = resolve(import.meta.dirname, '..');
// The server's own data (what the map adds) is part of what it builds; every step it runs inherits this.
process.env.OLYMPUS_DATA ||= join(ROOT, 'data');
const env = (k: string, d: string) => process.env[k]?.trim() || d;
const rebuilder = createRebuilder({
  root: ROOT,
  out: resolve(ROOT, env('OLYMPUS_OUT', 'site-releases')),
  keep: Number(env('OLYMPUS_KEEP', '2')),
  gitMinutes: Number(env('OLYMPUS_GIT_INTERVAL', '0')),
  remote: env('OLYMPUS_GIT_REMOTE', 'origin'),
  branch: process.env.OLYMPUS_GIT_BRANCH?.trim() || undefined,
  pollSeconds: Number(env('OLYMPUS_POLL', '10')),
});
if (process.argv.includes('--once')) {
  rebuilder.request('once');
  await rebuilder.idle();
  process.exit(rebuilder.status().state === 'failed' ? 1 : 0);
}
rebuilder.start();
for (const sig of ['SIGTERM', 'SIGINT'] as const)
  process.on(sig, () => {
    rebuilder.stop();
    process.exit(0);
  });
