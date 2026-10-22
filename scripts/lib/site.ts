// The site put together: the page's bundle (Vite's build, made once for each
// version of the code) and the repository's published files (/files/, with
// their index, the web manifest and /install.sh). Each text file also gets
// its gzip and brotli copies, made once per content (.cache/compressed/), so
// the server sends them as they are.
//
// Into a new release (the server's), every file unchanged since the release
// before is linked from it, not copied: a moved building makes a release in a
// moment. Into app/dist, only what changed is written. Every release carries
// .manifest.json — each file and its checksum — which is how the next one
// knows what changed.

import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { brotliCompress, constants as z, gzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);
import { dirname, extname, join, relative, sep } from 'node:path';
import { LAUNCHER, publishedFiles, siteManifest } from '../../app/files-plugin.ts';

const ROOT = new URL('../..', import.meta.url).pathname;
const CACHE = join(process.env.OLYMPUS_CACHE || join(ROOT, '.cache'), 'compressed');
export const MANIFEST = '.manifest.json';

/** What compresses well: text, scripts, styles, vector images, the map's land and the models. */
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.md', '.txt', '.csv', '.yaml', '.yml', '.sh', '.scad', '.stl', '.bin', '.ico', '.xml', '.toml', '.conf', '.dconf', '.palette', '.itermcolors', '.terminal', '.fish', '.bash', '.lua', '.hbs', '.scss', '.ts']);
export const compressible = (path: string) => COMPRESSIBLE.has(extname(path).toLowerCase());

type Manifest = Record<string, string>;
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

function walk(dir: string, base = dir, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir).sort()) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, base, out);
    else out.push(relative(base, f).split(sep).join('/'));
  }
  return out;
}

/** Where a content's compressed copies are kept, and whether they are there (or known not to pay). */
function cached(hash: string): { gz: string; br: string; none: string; ready: boolean; skip: boolean } {
  const dir = join(CACHE, hash.slice(0, 2));
  const c = { gz: join(dir, `${hash}.gz`), br: join(dir, `${hash}.br`), none: join(dir, `${hash}.none`) };
  return { ...c, skip: existsSync(c.none), ready: existsSync(c.gz) && existsSync(c.br) };
}

/** Make the compressed copies of a content not yet in the cache (on zlib's threads, many at once). */
async function compress1(content: Buffer, hash: string): Promise<void> {
  const c = cached(hash);
  if (content.length < 1024 || c.skip || c.ready) return;
  mkdirSync(dirname(c.gz), { recursive: true });
  const g = await gzipAsync(content, { level: 9 });
  if (g.length > content.length * 0.9) {
    writeFileSync(c.none, '');
    return;
  }
  // The best brotli for what the page loads first (scripts, styles, data); quicker settings for the large downloads.
  const quality = content.length <= 256 * 1024 ? 11 : content.length <= 4_000_000 ? 9 : 6;
  const b = await brotliAsync(content, { params: { [z.BROTLI_PARAM_QUALITY]: quality, [z.BROTLI_PARAM_SIZE_HINT]: content.length } });
  for (const [file, data] of [
    [c.gz, g],
    [c.br, b],
  ] as const) {
    writeFileSync(`${file}.${process.pid}.tmp`, data);
    renameSync(`${file}.${process.pid}.tmp`, file);
  }
}

/** The gzip and brotli copies of a file's content, from the cache; null when compressing does not pay. */
function compressed(content: Buffer, hash: string): { gz: string; br: string } | null {
  if (content.length < 1024) return null;
  const c = cached(hash);
  return c.ready && !c.skip ? { gz: c.gz, br: c.br } : null;
}

/** Link if the file system allows it, else copy (a release on another disk than its cache). */
function place(from: string, to: string, link: boolean): void {
  mkdirSync(dirname(to), { recursive: true });
  rmSync(to, { force: true });
  if (link)
    try {
      linkSync(from, to);
      return;
    } catch {
      /* not linkable here: copied */
    }
  copyFileSync(from, to, constants.COPYFILE_FICLONE);
}

export type Assembled = { files: number; written: number; reused: number; removed: number; bytes: number };

/**
 * Put the site together in `out` from the bundle in `bundle`.
 *  - `previous`: a release to link unchanged files from (`out` must not exist yet).
 *  - otherwise `out` is brought up to date in place: only changed files are written, files no longer published are removed.
 *  - `compress`: add each text file's .gz and .br beside it.
 */
export async function assembleSite(opts: { bundle: string; out: string; previous?: string | null; compress?: boolean; root?: string }): Promise<Assembled> {
  // Compressed copies are for the server's releases; app/dist (development, checks) goes without unless asked.
  const root = opts.root ?? ROOT;
  const { out, compress = false } = opts;
  const prevDir = opts.previous && existsSync(join(opts.previous, MANIFEST)) ? opts.previous : null;
  const inPlace = !prevDir && existsSync(join(out, MANIFEST));
  const before: Manifest = prevDir ? JSON.parse(readFileSync(join(prevDir, MANIFEST), 'utf8')) : inPlace ? JSON.parse(readFileSync(join(out, MANIFEST), 'utf8')) : {};
  if (!prevDir && !inPlace) rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  // What the site is made of: path in the site → its content.
  const sources = new Map<string, () => Buffer>();
  for (const p of walk(opts.bundle)) sources.set(p, () => readFileSync(join(opts.bundle, p)));
  const index = publishedFiles(root);
  for (const f of index.files) sources.set(`files/${f.path}`, () => readFileSync(join(root, f.path)));
  sources.set('files/index.json', () => Buffer.from(JSON.stringify(index)));
  sources.set('site.webmanifest', () => Buffer.from(siteManifest()));
  if (existsSync(join(root, LAUNCHER))) sources.set('install.sh', () => readFileSync(join(root, LAUNCHER)));

  // The compressed copies first, many at a time on zlib's threads: then the site is put together from the cache.
  if (compress) {
    const todo = [...sources].filter(([path]) => compressible(path));
    const LIMIT = 8;
    for (let i = 0; i < todo.length; i += LIMIT)
      await Promise.all(
        todo.slice(i, i + LIMIT).map(async ([, read]) => {
          const content = read();
          await compress1(content, sha(content));
        }),
      );
  }

  const manifest: Manifest = {};
  let written = 0,
    reused = 0,
    bytes = 0;
  for (const [path, read] of [...sources].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const content = read();
    const hash = sha(content);
    manifest[path] = hash;
    bytes += content.length;
    const to = join(out, path);
    const same = before[path] === hash;
    const sidecars = compress && compressible(path) ? compressed(content, hash) : null;
    if (same && prevDir) {
      // Unchanged since the release before: linked from it, with its compressed copies.
      place(join(prevDir, path), to, true);
      for (const ext of ['.gz', '.br']) if (existsSync(join(prevDir, path + ext))) place(join(prevDir, path + ext), to + ext, true);
      if (sidecars) for (const ext of ['gz', 'br'] as const) if (!existsSync(to + `.${ext}`)) place(sidecars[ext], to + `.${ext}`, true);
      reused++;
      continue;
    }
    if (same && inPlace && existsSync(to)) {
      reused++;
      if (sidecars) for (const ext of ['gz', 'br'] as const) if (!existsSync(to + `.${ext}`)) place(sidecars[ext], to + `.${ext}`, false);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    const tmp = `${to}.${process.pid}.tmp`;
    writeFileSync(tmp, content);
    renameSync(tmp, to);
    for (const ext of ['gz', 'br'] as const) {
      rmSync(to + `.${ext}`, { force: true });
      // Links from the cache into a release (never changed in place); copies into app/dist.
      if (sidecars) place(sidecars[ext], to + `.${ext}`, !!prevDir);
    }
    written++;
  }
  // In place: what is no longer part of the site goes.
  let removed = 0;
  if (inPlace)
    for (const path of Object.keys(before))
      if (!(path in manifest)) {
        for (const f of [path, `${path}.gz`, `${path}.br`]) rmSync(join(out, f), { force: true });
        removed++;
      }
  writeFileSync(join(out, MANIFEST), JSON.stringify(manifest));
  return { files: Object.keys(manifest).length, written, reused, removed, bytes };
}
