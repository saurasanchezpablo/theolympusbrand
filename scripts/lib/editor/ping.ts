// Is an address answering? A single ping (the system's own command, never
// through a shell); a TCP connection to the usual ports only without ping. Only ever
// called for addresses the map already knows, checked as host names first.

import { execFile } from 'node:child_process';
import { connect } from 'node:net';
import { isHost } from '../../../src/catalog/service.ts';

/**
 * What ping's ending says: true (an answer), false (none), or null when ping
 * could not try at all — no command, or no right to send it (inside a
 * container ping exits with an error code and says so on stderr).
 */
export function pingVerdict(err: (Error & { code?: number | string }) | null, stderr: string): boolean | null {
  if (!err) return true;
  if (err.code === 'ENOENT' || err.code === 'EACCES' || err.code === 'EPERM') return null;
  if (/not permitted|permission denied|socket:/i.test(stderr)) return null;
  return false;
}

const ping = (host: string) =>
  new Promise<boolean | null>((done) => {
    execFile('ping', ['-c', '1', '-W', '1', '--', host], { timeout: 3000 }, (err, _out, stderr) => done(pingVerdict(err as (Error & { code?: number | string }) | null, String(stderr ?? ''))));
  });

const knock = (host: string, port: number) =>
  new Promise<boolean>((done) => {
    const s = connect({ host, port, timeout: 1000 });
    const end = (ok: boolean) => {
      s.destroy();
      done(ok);
    };
    s.once('connect', () => end(true));
    s.once('timeout', () => end(false));
    s.once('error', (e: NodeJS.ErrnoException) => end(e.code === 'ECONNREFUSED'));
  });

/**
 * Ping's answer when ping can run — some networks accept every TCP connection
 * on the way out, so a connection proves nothing there; the usual ports only
 * when there is no ping, or no right to send it.
 */
export async function reachable(host: string): Promise<boolean> {
  if (!isHost(host)) return false;
  const answer = await ping(host);
  if (answer !== null) return answer;
  for (const port of [443, 80, 22]) if (await knock(host, port)) return true;
  return false;
}
