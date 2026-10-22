// Following the remote: before a pull, which generated files to put back so
// the pull can go on. Pure.

/** Files a build writes from the catalogue (with the server's own data, they differ here from the repository's). */
const GENERATED = [/^assets\/services\//, /^assets\/integrations\//, /^assets\/screens\//, /^assets\/install\.sh$/, /^assets\/map\//, /^docs\/03-catalog\.md$/, /^docs\/catalog\//, /^docs\/integrations\//, /^docs\/screens\//];
const generated = (path: string) => GENERATED.some((r) => r.test(path));

/**
 * Before a pull: which locally changed files to put back so the pull can go
 * on — those the pull changes as well, and only if every one of them is a
 * file the build makes (it makes them again after). Null when a change made
 * by hand is in the way: then nothing is touched and the pull is refused.
 */
export function toReset(localChanged: readonly string[], upstreamChanged: readonly string[]): string[] | null {
  const incoming = new Set(upstreamChanged);
  const inTheWay = localChanged.filter((f) => incoming.has(f));
  if (inTheWay.some((f) => !generated(f))) return null;
  return inTheWay;
}
