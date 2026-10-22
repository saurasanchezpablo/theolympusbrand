// What the build reads from the catalogue: each service's file and logo, the
// repository's catalogue with the server's own data laid over it, and whether
// the repository is a git clone. Node's own modules only.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
