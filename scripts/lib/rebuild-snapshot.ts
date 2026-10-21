// The automatic rebuild's snapshot of a repository: fingerprints of what the
// outputs are made from (see rebuild-plan.ts). Node's own modules only.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Snapshot } from './rebuild-plan.ts';

const SKIP = new Set(['node_modules', 'dist', '.git']);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A fingerprint of files under the given paths: names and contents. */
export function digest(root: string, paths: string[]): string {
  const h = createHash('sha256');
  const walk = (p: string) => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const e of readdirSync(p).sort()) if (!SKIP.has(e)) walk(join(p, e));
    } else {
      h.update(relative(root, p)).update('\0').update(readFileSync(p)).update('\0');
    }
  };
  for (const p of paths) walk(join(root, p));
  return h.digest('hex');
}

export function isGit(root: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** The server's data folder (see src/node/data.ts): only where OLYMPUS_DATA names one, as the automatic rebuild does. */
const dataOf = () => process.env.OLYMPUS_DATA || null;

/**
 * Each service's file and its logo, as the build sees them: the repository's
 * catalogue with the server's own data laid over it — a service of its own,
 * a default changed, a default removed.
 */
export function services(root: string): Record<string, string> {
  const data = dataOf();
  const files = new Map<string, string>();
  for (const dir of [join(root, 'catalog', 'services'), ...(data ? [join(data, 'services')] : [])]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).sort()) {
      const id = f.replace(/\.json$/, '');
      if (f.endsWith('.json') && ID.test(id)) files.set(id, join(dir, f));
    }
  }
  const removed = new Set<string>();
  try {
    if (!data) throw new Error('no data folder');
    const list = JSON.parse(readFileSync(join(data, 'removed.json'), 'utf8'));
    if (Array.isArray(list)) for (const id of list) if (typeof id === 'string') removed.add(id);
  } catch {
    /* none, or not valid: the build will say so */
  }
  const out: Record<string, string> = {};
  for (const [id, file] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) {
    // A default removed from the browser is gone, unless the server has its own again.
    if (removed.has(id) && !(data && file.startsWith(data))) continue;
    const text = readFileSync(file);
    const h = createHash('sha256').update(text);
    try {
      const logo = (JSON.parse(text.toString()) as { logo?: unknown }).logo;
      if (typeof logo === 'string') for (const base of [...(data ? [data] : []), join(root, 'catalog')]) if (existsSync(join(base, logo))) { h.update(readFileSync(join(base, logo))); break; }
    } catch {
      /* not valid JSON: the build will say so */
    }
    out[id] = h.digest('hex');
  }
  return out;
}

/** What only the map shows: where each building stands, the machines, the logos of the server's own. */
export const mapOf = (_root: string): string => {
  const data = dataOf();
  return data ? digest(data, ['places.json', 'machines', 'logos']) : '';
};

export function snapshot(root: string): Snapshot {
  return {
    deps: digest(root, ['package-lock.json']),
    code: digest(root, ['src', 'scripts', 'app/src', 'app/public', 'app/index.html', 'app/vite.config.ts', 'app/files-plugin.ts', 'app/tsconfig.json', 'package.json']),
    // With git, the commit stands for the content (hashing every committed asset each time would be slow).
    content: isGit(root) ? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() : digest(root, ['docs']),
    services: services(root),
    map: mapOf(root),
  };
}
