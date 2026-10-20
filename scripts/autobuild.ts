// The Olympus — automatic rebuild: keeps the site in step with the repository
// on the server. It watches catalog/ (a service added, changed or removed by
// hand, by `npm run service`, or dropped in from the Atelier), and can pull
// from the remote on a timer. Whatever changed is rebuilt — only the services
// that changed, unless the code did — into a new release of the site, which
// replaces the served one in a single step. A failed build leaves the site as
// it was and says why in status.json.
//
//   npm run autobuild                    keep watching (the builder container runs this)
//   npm run autobuild -- --once          one pass: rebuild if anything changed, then stop
//
// Settings (environment):
//   OLYMPUS_OUT            where releases go; the site is served from <out>/current   (./site-releases)
//   OLYMPUS_GIT_INTERVAL   minutes between pulls from the remote; 0 = never                (0)
//   OLYMPUS_GIT_REMOTE     the remote to pull from                                          (origin)
//   OLYMPUS_GIT_BRANCH     the branch to follow                                             (the current one)
//   OLYMPUS_POLL           seconds between looks at catalog/                                (10)
//   OLYMPUS_KEEP           releases kept, the served one included                           (2)
//
// Only Node's own modules are used here: it runs before the dependencies are installed.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync, watch } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { plan, command, type Snapshot, type Step } from './lib/rebuild-plan.ts';
import { snapshot as snapshotOf, services as servicesOf, isGit as isGitAt } from './lib/rebuild-snapshot.ts';

const ROOT = resolve(import.meta.dirname, '..');
const env = (k: string, d: string) => process.env[k]?.trim() || d;
const OUT = resolve(ROOT, env('OLYMPUS_OUT', 'site-releases'));
const GIT_MINUTES = Number(env('OLYMPUS_GIT_INTERVAL', '0'));
const REMOTE = env('OLYMPUS_GIT_REMOTE', 'origin');
const POLL = Math.max(2, Number(env('OLYMPUS_POLL', '10'))) * 1000;
const KEEP = Math.max(1, Number(env('OLYMPUS_KEEP', '2')));
const ONCE = process.argv.includes('--once');
const STATE = join(OUT, 'state.json');
const STATUS = join(OUT, 'status.json');

const isGit = isGitAt(ROOT);
const snapshot = () => snapshotOf(ROOT);
const services = () => servicesOf(ROOT);
const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const log = (msg: string) => console.log(`${new Date().toISOString().slice(0, 19).replace('T', ' ')}  ${msg}`);

/* ---------------------------------------------------------------- */
/* Pulling                                                            */
/* ---------------------------------------------------------------- */

/** Fast-forward to the remote branch, if it moved. Local edits are never discarded: git refuses, and that is reported. */
function pull(): void {
  try {
    const branch = env('OLYMPUS_GIT_BRANCH', git('rev-parse', '--abbrev-ref', 'HEAD'));
    git('fetch', '--quiet', REMOTE, branch);
    const here = git('rev-parse', 'HEAD');
    const there = git('rev-parse', 'FETCH_HEAD');
    if (here !== there) {
      git('merge', '--ff-only', '--quiet', 'FETCH_HEAD');
      log(`pulled ${REMOTE}/${branch}: ${here.slice(0, 7)} → ${there.slice(0, 7)}`);
    }
    if (current.pull) status({ pull: null });
  } catch (e) {
    const msg = ((e as { stderr?: string }).stderr || (e as Error).message).trim().split('\n')[0];
    log(`⚠ could not pull: ${msg}`);
    status({ pull: `could not pull: ${msg}` });
  }
}

/* ---------------------------------------------------------------- */
/* Building                                                           */
/* ---------------------------------------------------------------- */

type Status = { state?: 'building' | 'ok' | 'failed'; at?: string; commit?: string | null; release?: string; why?: string[]; steps?: { step: string; ok: boolean; seconds: number }[]; error?: string; pull?: string | null; services?: number };
let current: Status = existsSync(STATUS) ? JSON.parse(readFileSync(STATUS, 'utf8')) : {};
/** Record what the builder is doing: in <out>/status.json, and as build.json in the served site (the Downloads page shows it). */
function status(patch: Status) {
  current = { ...current, ...patch };
  const text = JSON.stringify(current, null, 2) + '\n';
  for (const file of [STATUS, join(OUT, 'current', 'build.json')]) {
    if (file !== STATUS && !existsSync(join(OUT, 'current'))) continue;
    writeFileSync(`${file}.tmp`, text);
    renameSync(`${file}.tmp`, file);
  }
}

/** Run a step, its output shown as it comes; a failure carries the last lines it wrote to stderr. */
function run(argv: string[]): Promise<void> {
  return new Promise((ok, fail) => {
    const p = spawn(argv[0], argv.slice(1), { cwd: ROOT, stdio: ['ignore', 'inherit', 'pipe'] });
    let tail = '';
    p.stderr!.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
      tail = (tail + chunk.toString()).slice(-2000);
    });
    p.on('error', fail);
    p.on('exit', (code) => {
      if (code === 0) return ok();
      // What it said, without the stack trace.
      const said = tail.split('\n').filter((l) => l.trim() && !/^\s+at |^Node\.js v|^\s*\^$/.test(l)).slice(-8).join('\n');
      fail(new Error(`${argv.slice(0, 4).join(' ')} … exited with ${code}${said ? `:\n${said}` : ''}`));
    });
  });
}

const label = (s: Step) => ('ids' in s ? `${s.kind} ${s.ids.join(' ')}` : s.kind);

/** Point <out>/current at a release in one step, then drop the oldest releases. */
function publish(release: string) {
  const link = join(OUT, 'current');
  const tmp = join(OUT, `current.${process.pid}`);
  rmSync(tmp, { force: true });
  symlinkSync(join('releases', release), tmp);
  renameSync(tmp, link);
  const all = readdirSync(join(OUT, 'releases')).sort();
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) if (old !== release) rmSync(join(OUT, 'releases', old), { recursive: true, force: true });
}

let building = false;
let again = false;

async function rebuild(reason: string): Promise<void> {
  if (building) {
    again = true;
    return;
  }
  building = true;
  try {
    const before: Snapshot | null = existsSync(STATE) && existsSync(join(OUT, 'current')) ? JSON.parse(readFileSync(STATE, 'utf8')) : null;
    const now = snapshot();
    const { steps, why } = plan(before, now);
    if (!steps.length) return;
    const release = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
    const dir = join(OUT, 'releases', release);
    log(`rebuilding (${reason}): ${why.join('; ') || 'changes'}`);
    status({ state: 'building', at: new Date().toISOString(), why, steps: [], error: undefined });
    const done: NonNullable<Status['steps']> = [];
    for (const step of steps) {
      const t0 = Date.now();
      try {
        log(`→ ${label(step)}`);
        await run(command(step, dir));
        done.push({ step: label(step), ok: true, seconds: Math.round((Date.now() - t0) / 1000) });
      } catch (e) {
        done.push({ step: label(step), ok: false, seconds: Math.round((Date.now() - t0) / 1000) });
        rmSync(dir, { recursive: true, force: true });
        log(`✖ ${(e as Error).message.split('\n')[0]} — the site stays as it was`);
        status({ state: 'failed', at: new Date().toISOString(), steps: done, error: (e as Error).message });
        // Keep the old snapshot for what was not rebuilt, so the next change tries again.
        return;
      }
    }
    publish(release);
    // What was built: the code and content as they are now (the build itself rewrites generated docs),
    // the services as they were read (an edit made during the build is still to come).
    writeFileSync(STATE, JSON.stringify({ ...snapshot(), services: now.services }, null, 2) + '\n');
    status({ state: 'ok', at: new Date().toISOString(), commit: isGit ? now.content : null, release, steps: done, services: Object.keys(now.services).length, error: undefined });
    log(`✔ published release ${release}`);
  } finally {
    building = false;
    if (again) {
      again = false;
      void rebuild('more changes arrived during the build');
    }
  }
}

/* ---------------------------------------------------------------- */
/* Watching                                                           */
/* ---------------------------------------------------------------- */

mkdirSync(join(OUT, 'releases'), { recursive: true });
log(`watching ${relative(process.cwd(), join(ROOT, 'catalog')) || 'catalog'}; releases in ${OUT}${isGit && GIT_MINUTES > 0 ? `; pulling ${REMOTE} every ${GIT_MINUTES} min` : ''}`);
if (isGit && GIT_MINUTES > 0) pull();
await rebuild('start');
if (ONCE) process.exit(current.state === 'failed' ? 1 : 0);

// A change in catalog/ is noticed at once where the system reports it, and by looking every few seconds everywhere.
let last = JSON.stringify(services());
let settle: NodeJS.Timeout | undefined;
const look = () => {
  const now = JSON.stringify(services());
  if (now === last) return;
  last = now;
  clearTimeout(settle);
  // Wait for the edits to settle: a service and its logo are often written one after the other.
  settle = setTimeout(() => void rebuild('catalog changed'), 2000);
};
try {
  watch(join(ROOT, 'catalog'), { recursive: true }, look);
} catch {
  /* recursive watching is not available here: looking is enough */
}
setInterval(look, POLL);
if (isGit && GIT_MINUTES > 0)
  setInterval(() => {
    pull();
    void rebuild('pulled');
  }, GIT_MINUTES * 60_000);
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => process.exit(0));
