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

/** Each service's catalogue file, and its logo if it names one. */
export function services(root: string): Record<string, string> {
  const dir = join(root, 'catalog', 'services');
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).sort()) {
    const id = f.replace(/\.json$/, '');
    if (!f.endsWith('.json') || !ID.test(id)) continue;
    const text = readFileSync(join(dir, f));
    const h = createHash('sha256').update(text);
    try {
      const logo = (JSON.parse(text.toString()) as { logo?: unknown }).logo;
      if (typeof logo === 'string' && existsSync(join(root, 'catalog', logo))) h.update(readFileSync(join(root, 'catalog', logo)));
    } catch {
      /* not valid JSON: the build will say so */
    }
    out[id] = h.digest('hex');
  }
  return out;
}

export function snapshot(root: string): Snapshot {
  return {
    deps: digest(root, ['package-lock.json']),
    code: digest(root, ['src', 'scripts', 'app/src', 'app/public', 'app/index.html', 'app/vite.config.ts', 'app/files-plugin.ts', 'app/tsconfig.json', 'package.json']),
    // With git, the commit stands for the content (hashing every committed asset each time would be slow).
    content: isGit(root) ? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() : digest(root, ['docs']),
    services: services(root),
  };
}
