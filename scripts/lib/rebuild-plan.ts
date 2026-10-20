// What the automatic rebuild must do, decided from two snapshots of the
// repository: the one the running site was built from, and the one there is
// now. Pure: no files, no processes — the runner (scripts/autobuild.ts) takes
// the snapshots and runs the steps.

/** Fingerprints of what the outputs are made from. */
export type Snapshot = {
  /** package-lock.json: the dependencies. */
  deps: string;
  /** The code that draws and builds: src/, scripts/, app/ (not its build) and package.json. */
  code: string;
  /** Everything else the site publishes: docs, committed assets, models, stickers (by git commit or by content). */
  content: string;
  /** Each service's catalogue file and logo, by id. */
  services: Record<string, string>;
};

export type Step =
  | { kind: 'install' }
  | { kind: 'build-all' }
  | { kind: 'build-services'; ids: string[] }
  | { kind: 'remove-services'; ids: string[] }
  | { kind: 'index' }
  | { kind: 'integrations' }
  | { kind: 'site' };

export type Plan = { steps: Step[]; why: string[] };

/**
 * The steps from `before` to `now`, in order. No `before` (a first start)
 * builds everything. Code changes rebuild everything, since any output may
 * differ; catalogue changes rebuild only the services that changed, then
 * what lists them all; anything at all rebuilds the site.
 */
export function plan(before: Snapshot | null, now: Snapshot): Plan {
  const why: string[] = [];
  const steps: Step[] = [];
  if (!before || before.deps !== now.deps) {
    steps.push({ kind: 'install' });
    why.push(before ? 'the dependencies changed' : 'first build');
  }
  if (!before || before.code !== now.code) {
    if (before) why.push('the code changed');
    steps.push({ kind: 'build-all' }, { kind: 'site' });
    return { steps, why };
  }
  const changed = Object.keys(now.services).filter((id) => before.services[id] !== now.services[id]).sort();
  const removed = Object.keys(before.services).filter((id) => !(id in now.services)).sort();
  if (removed.length) {
    steps.push({ kind: 'remove-services', ids: removed });
    why.push(`removed: ${removed.join(', ')}`);
  }
  if (changed.length) {
    steps.push({ kind: 'build-services', ids: changed });
    why.push(`${changed.filter((id) => !(id in before.services)).length ? 'added or changed' : 'changed'}: ${changed.join(', ')}`);
  } else if (removed.length) steps.push({ kind: 'index' });
  if (changed.length || removed.length) steps.push({ kind: 'integrations' });
  if (before.content !== now.content) why.push('the published content changed');
  if (steps.length || before.content !== now.content) steps.push({ kind: 'site' });
  return { steps, why };
}

/** The command line for a step (run from the repository). `out` is where the site is built to. */
export function command(step: Step, out: string): string[] {
  switch (step.kind) {
    case 'install':
      return ['npm', 'ci', '--no-audit', '--no-fund'];
    case 'build-all':
      return ['npm', 'run', 'build'];
    case 'build-services':
      return ['node', 'scripts/service.ts', 'build', ...step.ids, '--warn-only'];
    case 'remove-services':
      return ['node', '-e', `for (const id of ${JSON.stringify(step.ids)}) require('node:fs').rmSync('assets/services/' + id, { recursive: true, force: true })`];
    case 'index':
      return ['node', 'scripts/service.ts', 'index'];
    case 'integrations':
      return ['node', 'scripts/integrations.ts'];
    case 'site':
      return ['node_modules/.bin/vite', 'build', '--config', 'app/vite.config.ts', '--outDir', out, '--emptyOutDir'];
  }
}
