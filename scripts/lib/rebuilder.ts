// Keeping the published site in step with the repository and the server's
// data: the house's own rebuild, run inside the site's server (scripts/serve.ts)
// or on its own (scripts/autobuild.ts).
//
// A change — told by the edit API, seen in catalog/ or the data folder, or
// pulled from the remote — is a request with a number. Requests that come
// close together share one build; builds never overlap; a build is the
// incremental build (scripts/build.ts release), so only what changed is made,
// into a new release folder that links every unchanged file from the one
// before. It is published by turning the `current` link in one step, and only
// if it differs; a failed build leaves the site as it was and says why. The
// status says which request the published site includes, so the page knows
// when its change is live.
//
// Node's own modules only: it runs before the dependencies may be installed.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, symlinkSync, watch, writeFileSync, type FSWatcher } from 'node:fs';
import { join } from 'node:path';
import { toReset } from './pull.ts';
import { services as servicesOf, isGit as isGitAt } from './sources.ts';
import { filesUnder, hashFiles } from './fingerprint.ts';

export type RebuildStatus = {
  state: 'starting' | 'building' | 'ok' | 'failed';
  at: string;
  /** The last request made (each change is one). */
  requested: number;
  /** The last request the published site includes. */
  published: number;
  release?: string;
  commit?: string | null;
  /** Why the current or last build ran. */
  why?: string[];
  steps?: { step: string; ran: boolean; seconds: number }[];
  error?: string;
  pull?: string | null;
  seconds?: number;
};

export type RebuilderOptions = {
  root: string;
  out: string;
  /** Releases kept, the published one included. */
  keep?: number;
  /** Minutes between pulls from the remote (0: never). */
  gitMinutes?: number;
  remote?: string;
  branch?: string;
  /** Seconds between looks at catalog/ and the data folder (besides the system's own notices). */
  pollSeconds?: number;
  /** How long to wait for more changes before building (ms). */
  settle?: number;
  log?: (msg: string) => void;
  /** Also write the status as build.json into the published site, for a site served by another web server (the house's own server answers /build.json itself). */
  siteStatus?: boolean;
  /** Run the build itself (tests replace it). */
  build?: (out: string, previous: string | null) => Promise<{ steps: RebuildStatus['steps'] }>;
};

export type Rebuilder = {
  /** Ask for a build; the number is the request's, for the page to wait on. */
  request(reason: string): number;
  status(): RebuildStatus;
  /** The published release's folder, or null before the first. */
  current(): string | null;
  /** Watch catalog/ and the data folder, pull on a timer, and build now if anything changed since the published release. */
  start(): void;
  /** Resolves when nothing is building or waiting. */
  idle(): Promise<void>;
  stop(): void;
};

/**
 * Are the installed dependencies the lockfile's? npm keeps its own record of
 * what it installed (node_modules/.package-lock.json): every package the
 * lockfile names must be there, at its version.
 */
export function dependenciesCurrent(root: string): boolean {
  try {
    const want = (JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')) as { packages: Record<string, { version?: string; optional?: boolean }> }).packages;
    const have = (JSON.parse(readFileSync(join(root, 'node_modules', '.package-lock.json'), 'utf8')) as { packages: Record<string, { version?: string }> }).packages;
    // Packages for other systems (optional, not installed here) do not count.
    return Object.entries(want).every(([path, p]) => path === '' || p.optional || have[path]?.version === p.version);
  } catch {
    return false;
  }
}

export function createRebuilder(opts: RebuilderOptions): Rebuilder {
  const { root, out } = opts;
  const keep = Math.max(1, opts.keep ?? 2);
  const settle = opts.settle ?? 1500;
  const log = opts.log ?? ((m: string) => console.log(`${new Date().toISOString().slice(0, 19).replace('T', ' ')}  ${m}`));
  const STATUS = join(out, 'status.json');
  const isGit = isGitAt(root);
  mkdirSync(join(out, 'releases'), { recursive: true });

  const previous: Partial<RebuildStatus> = existsSync(STATUS) ? JSON.parse(readFileSync(STATUS, 'utf8')) : {};
  // The request numbers go on from the last run, so a page that saved before a restart still sees its number published (by the first build here).
  const counted = Math.max(previous.requested ?? 0, previous.published ?? 0);
  let current: RebuildStatus = { state: 'starting', at: new Date().toISOString(), requested: counted, published: Math.min(previous.published ?? 0, counted), pull: previous.pull ?? null };
  const reasons: string[] = [];
  const status = (patch: Partial<RebuildStatus>) => {
    current = { ...current, ...patch };
    const text = JSON.stringify(current, null, 2) + '\n';
    try {
      writeFileSync(`${STATUS}.tmp`, text);
      renameSync(`${STATUS}.tmp`, STATUS);
      // A copy in the published site, for a site served by another web server (a new file, never one linked between releases).
      const site = join(out, 'current');
      if (opts.siteStatus !== false && existsSync(site)) {
        writeFileSync(join(site, 'build.json.tmp'), text);
        renameSync(join(site, 'build.json.tmp'), join(site, 'build.json'));
      }
    } catch {
      /* a full disk: the status in memory still answers */
    }
  };

  const currentDir = () => {
    const link = join(out, 'current');
    try {
      return join(out, readlinkSync(link));
    } catch {
      return null;
    }
  };

  /* -------------------------------- building -------------------------------- */

  const run = (argv: string[], env: Record<string, string> = {}) =>
    new Promise<string>((ok, fail) => {
      const p = spawn(argv[0], argv.slice(1), { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
      let said = '';
      p.stdout.on('data', (d: Buffer) => (said += d));
      p.stderr.on('data', (d: Buffer) => (said += d));
      p.on('error', fail);
      p.on('exit', (code) =>
        code === 0
          ? ok(said)
          : fail(
              new Error(
                said
                  .split('\n')
                  .filter((l) => l.trim() && !/^\s+at |^Node\.js v/.test(l))
                  .slice(-10)
                  .join('\n') || `${argv.join(' ')} exited with ${code}`,
              ),
            ),
      );
    });

  const build =
    opts.build ??
    (async (dir: string, prev: string | null) => {
      // The dependencies first, when what is installed is not what the lockfile names.
      if (!dependenciesCurrent(root)) {
        log('→ installing the dependencies');
        // No package's install script runs: none of the house's dependencies needs one.
        await run(['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund']);
      }
      const said = await run(['node', 'scripts/build.ts', 'release', '--out', dir, ...(prev ? ['--previous', prev] : []), '--profile']);
      const steps = [...said.matchAll(/^ {3}(\S+)\s+([\d.]+) s ?(\(skipped\))?$/gm)].map((m) => ({ step: m[1], ran: !m[3], seconds: Number(m[2]) }));
      return { steps };
    });

  const sameSite = (a: string, b: string | null) => {
    if (!b) return false;
    try {
      return readFileSync(join(a, '.manifest.json'), 'utf8') === readFileSync(join(b, '.manifest.json'), 'utf8');
    } catch {
      return false;
    }
  };

  /** Turn `current` to the release in one step; drop the oldest releases. */
  const publish = (release: string) => {
    const link = join(out, 'current');
    const tmp = join(out, `current.${process.pid}`);
    rmSync(tmp, { force: true });
    symlinkSync(join('releases', release), tmp);
    renameSync(tmp, link);
    const all = readdirSync(join(out, 'releases')).sort();
    for (const old of all.slice(0, Math.max(0, all.length - keep))) if (old !== release) rmSync(join(out, 'releases', old), { recursive: true, force: true });
  };

  let building = false;
  let timer: NodeJS.Timeout | undefined;
  let waiters: (() => void)[] = [];
  const settled = () => {
    if (building || timer) return;
    const w = waiters;
    waiters = [];
    for (const f of w) f();
  };

  async function rebuild(): Promise<void> {
    timer = undefined;
    if (building) return;
    building = true;
    // What this build includes: every request made until now.
    const includes = current.requested;
    // Each reason once, however many changes gave it.
    const why = [...new Set(reasons.splice(0))];
    const t0 = Date.now();
    const release = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-') + `-${includes}`;
    const dir = join(out, 'releases', release);
    const prev = currentDir();
    status({ state: 'building', at: new Date().toISOString(), why, error: undefined });
    log(`rebuilding: ${why.join('; ') || 'changes'}`);
    try {
      rmSync(dir, { recursive: true, force: true });
      const { steps } = await build(dir, prev && existsSync(prev) ? prev : null);
      if (sameSite(dir, prev)) {
        // Nothing the site shows changed: the release in place already includes these requests.
        rmSync(dir, { recursive: true, force: true });
        log('✔ the site is as it was');
        status({ state: 'ok', at: new Date().toISOString(), published: Math.max(current.published, includes), steps, seconds: (Date.now() - t0) / 1000 });
      } else {
        publish(release);
        log(`✔ published ${release}`);
        status({
          state: 'ok',
          at: new Date().toISOString(),
          published: Math.max(current.published, includes),
          release,
          steps,
          commit: isGit ? git('rev-parse', 'HEAD') : null,
          seconds: (Date.now() - t0) / 1000,
        });
      }
    } catch (e) {
      rmSync(dir, { recursive: true, force: true });
      const msg = (e as Error).message;
      log(`✖ ${msg.split('\n')[0]} — the site stays as it was`);
      status({ state: 'failed', at: new Date().toISOString(), error: msg, seconds: (Date.now() - t0) / 1000 });
    } finally {
      building = false;
      // Requests that came during the build: one more build, for all of them.
      if (current.requested > includes && !timer) timer = setTimeout(() => void rebuild(), settle);
      settled();
    }
  }

  function request(reason: string): number {
    const n = current.requested + 1;
    reasons.push(reason);
    status({ requested: n });
    clearTimeout(timer);
    // Wait for the changes to settle (a service and its logo are often written one after the other); a build running now is followed by another.
    timer = setTimeout(() => void rebuild(), settle);
    return n;
  }

  /* -------------------------------- watching -------------------------------- */

  const DATA = process.env.OLYMPUS_DATA || null;
  const watched = () => JSON.stringify([servicesOf(root), DATA ? hashFiles(DATA, filesUnder(DATA, ['places.json', 'machines', 'logos', 'services', 'removed.json'])) : '']);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

  /** Fast-forward to the remote branch; generated files the pull also changes are put back first (never a hand edit). */
  function pull(): boolean {
    try {
      const branch = opts.branch || git('rev-parse', '--abbrev-ref', 'HEAD');
      git('fetch', '--quiet', opts.remote ?? 'origin', branch);
      const here = git('rev-parse', 'HEAD'),
        there = git('rev-parse', 'FETCH_HEAD');
      if (current.pull) status({ pull: null });
      if (here === there) return false;
      const lines = (s: string) => s.split('\n').filter(Boolean);
      const reset = toReset(lines(git('diff', '--name-only')), lines(git('diff', '--name-only', 'HEAD', there)));
      if (reset?.length) {
        git('checkout', '--', ...reset);
        log(`put back ${reset.length} generated file(s) the pull changes; they are made again next`);
      }
      git('merge', '--ff-only', '--quiet', 'FETCH_HEAD');
      log(`pulled ${branch}: ${here.slice(0, 7)} → ${there.slice(0, 7)}`);
      return true;
    } catch (e) {
      const msg = ((e as { stderr?: string }).stderr || (e as Error).message).trim().split('\n')[0];
      log(`⚠ could not pull: ${msg}`);
      status({ pull: `could not pull: ${msg}` });
      return false;
    }
  }

  const stops: (() => void)[] = [];
  return {
    request,
    status: () => current,
    current: currentDir,
    idle: () => new Promise((r) => (building || timer ? waiters.push(r) : r())),
    start() {
      let last = watched();
      const look = () => {
        const now = watched();
        if (now === last) return;
        last = now;
        request('catalog/ or the data folder changed');
      };
      for (const dir of [join(root, 'catalog'), ...(DATA ? [DATA] : [])]) {
        try {
          mkdirSync(dir, { recursive: true });
          const w: FSWatcher = watch(dir, { recursive: true }, look);
          stops.push(() => w.close());
        } catch {
          /* recursive watching is not available here: looking is enough */
        }
      }
      const poll = setInterval(look, Math.max(2, opts.pollSeconds ?? 10) * 1000);
      stops.push(() => clearInterval(poll));
      if (isGit && (opts.gitMinutes ?? 0) > 0) {
        pull();
        const t = setInterval(() => pull() && request('pulled from the remote'), opts.gitMinutes! * 60_000);
        stops.push(() => clearInterval(t));
      }
      // At start: build, so the site includes whatever changed while the server was down (a no-op build when nothing did).
      request(currentDir() ? 'started' : 'first build');
    },
    stop() {
      clearTimeout(timer);
      for (const s of stops) s();
    },
  };
}
