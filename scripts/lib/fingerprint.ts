// Fingerprints for the incremental build: of the code a script runs (every
// file it imports, followed through the house's own modules), of folders of
// data, and of what a step wrote. Content, never dates: a file touched but
// unchanged is the same file, and a checkout anywhere gives the same prints.
//
// Node's own modules only: the automatic rebuild runs this before the
// dependencies are installed.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const SKIP = new Set(['node_modules', 'dist', '.git', '.cache']);
const CODE = /\.(ts|tsx|mts|js|mjs)$/;
// The relative specifiers a module names: static and dynamic imports, re-exports, `new URL('…', import.meta.url)`.
const SPECIFIERS = [/\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/g, /\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g, /\bimport\s+['"](\.{1,2}\/[^'"]+)['"]/g, /new URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url/g];

const fileCache = new Map<string, Buffer>();
const read = (f: string) => {
  let b = fileCache.get(f);
  if (!b) {
    b = readFileSync(f);
    fileCache.set(f, b);
  }
  return b;
};

function resolveSpecifier(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec.replace(/\?.*$/, ''));
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

/** Every file a script reaches through relative imports (itself included), sorted. Packages are left to the lockfile. */
export function closure(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const todo = entries.map((e) => resolve(e));
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f) || !existsSync(f)) continue;
    seen.add(f);
    if (!CODE.test(f)) continue;
    const text = read(f).toString('utf8');
    for (const re of SPECIFIERS)
      for (const m of text.matchAll(re)) {
        const r = resolveSpecifier(f, m[1]);
        if (r) todo.push(r);
      }
  }
  return [...seen].sort();
}

/** Files under the given paths (files or folders), sorted; missing paths count as empty. */
export function filesUnder(root: string, paths: readonly string[], skip: (rel: string) => boolean = () => false): string[] {
  const out: string[] = [];
  const walk = (p: string) => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const e of readdirSync(p).sort()) if (!SKIP.has(e)) walk(join(p, e));
    } else if (!skip(relative(root, p).split(sep).join('/'))) out.push(p);
  };
  for (const p of paths) walk(resolve(root, p));
  return out.sort();
}

/** A fingerprint of files: their paths (relative to root) and contents. */
export function hashFiles(root: string, files: readonly string[]): string {
  const h = createHash('sha256');
  for (const f of files) h.update(relative(root, f).split(sep).join('/')).update('\0').update(read(f)).update('\0');
  return h.digest('hex');
}

/** A fingerprint of outputs, read fresh from disk (outputs change under us; inputs are read once per run). */
export function hashOutputs(root: string, paths: readonly string[], skip?: (rel: string) => boolean): string {
  const h = createHash('sha256');
  for (const f of filesUnder(root, paths, skip)) h.update(relative(root, f).split(sep).join('/')).update('\0').update(readFileSync(f)).update('\0');
  return h.digest('hex');
}

/** Combine strings into one fingerprint. */
export const combine = (...parts: readonly string[]): string => createHash('sha256').update(parts.join('\0')).digest('hex');

/** Forget what was read: between runs of a long-lived process (the server) files change. */
export const forget = (): void => fileCache.clear();
