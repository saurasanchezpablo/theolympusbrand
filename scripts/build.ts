// The Olympus — the build, step by step, doing only what changed.
//
//   npm run build                   everything the repository keeps (the master, the services, the
//                                   boards, the brand book, integrations, screens, installer, map)
//   npm run site                    the map, the page's bundle, and the site in app/dist
//   node scripts/build.ts map       one step (or several): master services docs brandbook
//                                   integrations screens installer map bundle
//   node scripts/build.ts release --out <dir> [--previous <dir>]
//                                   everything, every service's screens too, and the site in <dir>
//                                   (the server's releases; unchanged files linked from --previous)
//   --force      run every step even if nothing changed (a clean build)
//   --profile    print each step's time (and keep them in .cache/build/profile.json)
//   --jobs N     steps run at once (default: by cores and memory)
//   --compress   give app/dist its gzip and brotli copies too (a release always has them)
//
// Each step has a fingerprint: of the code it runs (its script and every file
// that imports, followed through the house's own modules), the dependencies
// (package-lock.json), what it reads (the catalogue, the server's data
// folder), and what the steps before it wrote. A step whose fingerprint and
// outputs are as the last time it ran is skipped; its outputs are checked,
// so one damaged or deleted is made again. Steps that do not depend on each
// other run at the same time. The steps' scripts are the ones run by hand —
// a step skipped writes exactly what it would have written.
//
// Node's own modules only (the server runs this before the dependencies may be installed).

import { spawn } from 'node:child_process';
import { availableParallelism, totalmem } from 'node:os';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { closure, combine, filesUnder, hashFiles, hashOutputs } from './lib/fingerprint.ts';
import { services as servicesOf } from './lib/sources.ts';

// zlib's thread pool (the site's compressed copies) as wide as the cores allow; read when the pool first starts.
process.env.UV_THREADPOOL_SIZE ||= String(Math.max(4, Math.min(8, availableParallelism())));
const ROOT = resolve(import.meta.dirname, '..');
const CACHE = process.env.OLYMPUS_CACHE || join(ROOT, '.cache');
const STAMPS = join(CACHE, 'build');
/** Change this when the way steps are fingerprinted changes: every step runs again. */
const VERSION = '1';
const BUNDLE = join(CACHE, 'bundle');

const args = process.argv.slice(2);
const flag = (k: string) => args.includes(`--${k}`);
const option = (k: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : undefined);
const FORCE = flag('force');
const PROFILE = flag('profile');
const OUT = option('out') && resolve(option('out')!);
const PREVIOUS = option('previous') && resolve(option('previous')!);
const JOBS = Number(option('jobs')) || Math.max(1, Math.min(4, availableParallelism() - 1, Math.floor(totalmem() / 1.5e9)));
const targets = args.filter((a, i) => !a.startsWith('--') && !['--out', '--previous', '--jobs'].includes(args[i - 1]));

const DATA = process.env.OLYMPUS_DATA || null;
const lock = () => hashFiles(ROOT, filesUnder(ROOT, ['package-lock.json']));
const code = (...entries: string[]) => hashFiles(ROOT, closure(entries.map((e) => join(ROOT, e))));
/** The catalogue as the build sees it: each service's file and logo, the server's own laid over the repository's. */
const catalogue = () => JSON.stringify(servicesOf(ROOT));
/** The server's data that only the map shows: where buildings stand, the machines, their logos. */
const mapData = () => (DATA ? hashFiles(DATA, filesUnder(DATA, ['places.json', 'machines', 'logos', 'removed.json'])) : 'no data folder');

type Ctx = { log: (s: string) => void };
type Task = {
  id: string;
  /** Tasks whose outputs this one reads. */
  after: string[];
  /** What the outputs are made from (besides the outputs of `after`). */
  key: () => string;
  outputs: string[];
  /** Paths under `outputs` that belong to another task. */
  skip?: (rel: string) => boolean;
  run: (ctx: Ctx) => Promise<void>;
};

/** Run a script; its output kept, and shown if it fails. */
function sh(argv: string[], env: Record<string, string> = {}): (ctx: Ctx) => Promise<void> {
  return (ctx) =>
    new Promise((ok, fail) => {
      const p = spawn(argv[0], argv.slice(1), { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
      let said = '';
      p.stdout.on('data', (d: Buffer) => (said += d));
      p.stderr.on('data', (d: Buffer) => (said += d));
      p.on('error', fail);
      p.on('exit', (code) => {
        if (code === 0) {
          for (const line of said.split('\n').filter((l) => /^[✔⚠✖→]/.test(l.trim()))) ctx.log(`   ${line.trim()}`);
          return ok();
        }
        fail(new Error(`${argv.slice(0, 4).join(' ')} exited with ${code}:\n${said.split('\n').filter((l) => l.trim() && !/^\s+at /.test(l)).slice(-12).join('\n')}`));
      });
    });
}

const node = (script: string, ...rest: string[]) => ['node', script, ...rest];
const vite = join(ROOT, 'node_modules/.bin/vite');

/* ---------------------------------------------------------------- */
/* The steps                                                          */
/* ---------------------------------------------------------------- */

/** The services' own steps: each service by itself, then what lists them all. */
function servicesTask(): Task {
  const stampFile = join(STAMPS, 'services-each.json');
  return {
    id: 'services',
    after: [],
    key: () => combine(code('scripts/service.ts'), lock(), catalogue()),
    outputs: ['assets/services', 'docs/03-catalog.md', 'docs/catalog'],
    async run(ctx) {
      const base = combine(code('scripts/service.ts'), lock());
      const now = servicesOf(ROOT);
      const done: Record<string, string> = !FORCE && existsSync(stampFile) ? JSON.parse(readFileSync(stampFile, 'utf8')) : {};
      // A service is made again when it, its logo or the code changed, or its folder is not as it was left.
      const stale = Object.keys(now).filter((id) => done[id] !== combine(base, now[id], hashOutputs(ROOT, [`assets/services/${id}`])));
      const gone = existsSync(join(ROOT, 'assets/services')) ? readdirSync(join(ROOT, 'assets/services')).filter((d) => !d.includes('.') && !(d in now)) : [];
      for (const id of gone) rmSync(join(ROOT, 'assets/services', id), { recursive: true, force: true });
      if (stale.length) await sh(node('scripts/service.ts', 'build', ...stale, ...(DATA ? ['--warn-only'] : [])))(ctx);
      else await sh(node('scripts/service.ts', 'index'))(ctx);
      ctx.log(`   ${stale.length ? `${stale.length} of ${Object.keys(now).length} services made` : 'every service as it was'}${gone.length ? `; ${gone.length} removed` : ''}`);
      const record: Record<string, string> = {};
      for (const id of Object.keys(now)) record[id] = combine(base, now[id], hashOutputs(ROOT, [`assets/services/${id}`]));
      mkdirSync(STAMPS, { recursive: true });
      writeFileSync(stampFile, JSON.stringify(record, null, 2));
    },
  };
}

/** Every service's screens (the server's releases carry them; the repository does not keep them). */
function serviceScreensTask(): Task {
  const stampFile = join(STAMPS, 'screens-each.json');
  return {
    id: 'service-screens',
    after: [],
    key: () => combine(code('scripts/screens.ts'), lock(), catalogue()),
    outputs: ['assets/screens/services'],
    async run(ctx) {
      const base = combine(code('scripts/screens.ts'), lock());
      const now = servicesOf(ROOT);
      const done: Record<string, string> = !FORCE && existsSync(stampFile) ? JSON.parse(readFileSync(stampFile, 'utf8')) : {};
      const stale = Object.keys(now).filter((id) => done[id] !== combine(base, now[id], hashOutputs(ROOT, [`assets/screens/services/${id}`])));
      const dir = join(ROOT, 'assets/screens/services');
      const gone = existsSync(dir) ? readdirSync(dir).filter((d) => !(d in now)) : [];
      for (const id of gone) rmSync(join(dir, id), { recursive: true, force: true });
      // Each process draws its share (resvg works on one thread): as many at once as the build runs steps.
      const groups = Array.from({ length: Math.min(JOBS, stale.length) }, (_, i) => stale.filter((_, k) => k % Math.min(JOBS, stale.length) === i));
      await Promise.all(groups.map((ids) => sh(node('scripts/screens.ts', ...ids))(ctx)));
      ctx.log(`   ${stale.length ? `${stale.length} services' screens made` : "every service's screens as they were"}`);
      const record: Record<string, string> = {};
      for (const id of Object.keys(now)) record[id] = combine(base, now[id], hashOutputs(ROOT, [`assets/screens/services/${id}`]));
      mkdirSync(STAMPS, { recursive: true });
      writeFileSync(stampFile, JSON.stringify(record, null, 2));
    },
  };
}

const TASKS: Task[] = [
  { id: 'master', after: [], key: () => combine(code('scripts/build-master.ts'), lock()), outputs: ['assets/master'], run: sh(node('scripts/build-master.ts')) },
  servicesTask(),
  { id: 'docs', after: [], key: () => combine(code('scripts/build-docs.ts'), lock()), outputs: ['docs/design-system'], run: sh(node('scripts/build-docs.ts')) },
  { id: 'brandbook', after: [], key: () => combine(code('scripts/brandbook.ts'), lock()), outputs: ['docs/the-olympus-brand-book.pdf'], run: sh(node('scripts/brandbook.ts')) },
  { id: 'integrations', after: [], key: () => combine(code('scripts/integrations.ts'), lock(), catalogue()), outputs: ['assets/integrations', 'docs/integrations'], run: sh(node('scripts/integrations.ts')) },
  {
    id: 'screens',
    after: [],
    key: () => combine(code('scripts/screens.ts'), lock()),
    outputs: ['assets/screens', 'docs/screens'],
    skip: (rel) => rel.startsWith('assets/screens/services/'),
    run: sh(node('scripts/screens.ts')),
  },
  serviceScreensTask(),
  // The installer pins every kit file's checksum: it follows the screens and the integrations.
  { id: 'installer', after: ['screens', 'integrations'], key: () => combine(code('scripts/installer.ts'), lock(), catalogue()), outputs: ['assets/install.sh'], run: sh(node('scripts/installer.ts')) },
  { id: 'map', after: [], key: () => combine(code('scripts/map.ts'), lock(), catalogue(), mapData()), outputs: ['assets/map'], run: sh(node('scripts/map.ts')) },
  {
    // The page itself: everything Vite builds from — the app, the brand code it imports, the catalogue it bundles.
    id: 'bundle',
    after: [],
    key: () => combine(code('app/src/main.tsx', 'app/vite.config.ts', 'app/files-plugin.ts'), hashFiles(ROOT, filesUnder(ROOT, ['app/index.html', 'app/public', 'app/tsconfig.json', 'tsconfig.json', 'catalog', 'package.json'])), lock()),
    outputs: [relativeToRoot(BUNDLE)],
    async run(ctx) {
      const tmp = `${BUNDLE}.${process.pid}`;
      rmSync(tmp, { recursive: true, force: true });
      await sh([vite, 'build', '--config', 'app/vite.config.ts', '--outDir', tmp, '--emptyOutDir', '--logLevel', 'warn'], { OLYMPUS_BUNDLE_ONLY: '1' })(ctx);
      rmSync(BUNDLE, { recursive: true, force: true });
      renameSync(tmp, BUNDLE);
    },
  },
];

function relativeToRoot(p: string): string {
  return resolve(p).startsWith(ROOT + '/') ? resolve(p).slice(ROOT.length + 1) : resolve(p);
}

/** The steps each target runs (with what they need first). */
const TARGETS: Record<string, string[]> = {
  all: ['master', 'services', 'docs', 'brandbook', 'integrations', 'screens', 'installer', 'map'],
  site: ['map', 'bundle'],
  release: ['master', 'services', 'docs', 'brandbook', 'integrations', 'screens', 'service-screens', 'installer', 'map', 'bundle'],
};

/* ---------------------------------------------------------------- */
/* Running                                                            */
/* ---------------------------------------------------------------- */

type Stamp = { key: string; outputs: string };
const stampOf = (t: Task): Stamp | null => {
  const f = join(STAMPS, `${t.id}.json`);
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};
const outputsOf = (t: Task) => hashOutputs(ROOT, t.outputs.map((o) => (o.startsWith('/') ? o : join(ROOT, o))), t.skip);

const wanted = new Set<string>();
const want = (id: string) => {
  const t = TASKS.find((x) => x.id === id);
  if (!t) throw new Error(`no step "${id}" (steps: ${TASKS.map((x) => x.id).join(', ')}; targets: ${Object.keys(TARGETS).join(', ')})`);
  if (wanted.has(id)) return;
  wanted.add(id);
  for (const a of t.after) want(a);
};
const asked = targets.length ? targets : ['all'];
for (const a of asked) for (const id of TARGETS[a] ?? [a]) want(id);
const site = asked.some((a) => a === 'site' || a === 'release');
if (asked.includes('release') && !OUT) throw new Error('release needs --out <dir>');

const started = Date.now();
const timings: { step: string; ran: boolean; seconds: number }[] = [];
const keys = new Map<string, string>();
const finished = new Set<string>();
const log = (s: string) => console.log(s);

async function runTask(t: Task): Promise<void> {
  const t0 = Date.now();
  // What it is made from: its own inputs, and the outputs of the steps it follows (as they are now).
  const key = combine(VERSION, process.version.split('.')[0], t.id, t.key(), ...t.after.map((a) => keys.get(a) ?? ''));
  const stamp = stampOf(t);
  const fresh = !FORCE && stamp?.key === key && stamp.outputs === outputsOf(t);
  if (!fresh) {
    log(`→ ${t.id}`);
    await t.run({ log });
    mkdirSync(STAMPS, { recursive: true });
    writeFileSync(join(STAMPS, `${t.id}.json`), JSON.stringify({ key, outputs: outputsOf(t) }));
  }
  keys.set(t.id, combine(key, outputsOf(t)));
  const seconds = (Date.now() - t0) / 1000;
  timings.push({ step: t.id, ran: !fresh, seconds });
  log(`${fresh ? '·' : '✔'} ${t.id.padEnd(16)} ${fresh ? 'as it was' : `${seconds.toFixed(1)} s`}`);
}

// Run whatever is ready, up to JOBS at once.
await new Promise<void>((done, fail) => {
  const running = new Set<string>();
  let failed = false;
  const next = () => {
    if (failed) return;
    if (finished.size === wanted.size) return done();
    for (const t of TASKS) {
      if (running.size >= JOBS) break;
      if (!wanted.has(t.id) || finished.has(t.id) || running.has(t.id)) continue;
      if (!t.after.every((a) => !wanted.has(a) || finished.has(a))) continue;
      running.add(t.id);
      runTask(t).then(
        () => {
          running.delete(t.id);
          finished.add(t.id);
          next();
        },
        (e: Error) => {
          failed = true;
          fail(new Error(`✖ ${t.id}: ${e.message}`));
        },
      );
    }
  };
  next();
}).catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});

// The site: the bundle and the published files, in app/dist or in a release.
if (site) {
  const t0 = Date.now();
  const { assembleSite } = await import('./lib/site.ts');
  const out = OUT ?? join(ROOT, 'app/dist');
  const r = await assembleSite({ bundle: BUNDLE, out, previous: PREVIOUS ?? null, compress: !!OUT || flag('compress') });
  const seconds = (Date.now() - t0) / 1000;
  timings.push({ step: 'site', ran: true, seconds });
  log(`✔ ${'site'.padEnd(16)} ${seconds.toFixed(1)} s · ${r.files} files (${r.written} written, ${r.reused} as they were${r.removed ? `, ${r.removed} removed` : ''}) → ${relativeToRoot(out)}`);
}

const total = (Date.now() - started) / 1000;
log(`done in ${total.toFixed(1)} s (${timings.filter((t) => t.ran).length} of ${timings.length} steps ran${JOBS > 1 ? `, up to ${JOBS} at once` : ''})`);
if (PROFILE) {
  for (const t of [...timings].sort((a, b) => b.seconds - a.seconds)) log(`   ${t.step.padEnd(16)} ${t.seconds.toFixed(1).padStart(6)} s ${t.ran ? '' : '(skipped)'}`);
  mkdirSync(STAMPS, { recursive: true });
  writeFileSync(join(STAMPS, 'profile.json'), JSON.stringify({ at: new Date().toISOString(), jobs: JOBS, total, steps: timings }, null, 2) + '\n');
}
