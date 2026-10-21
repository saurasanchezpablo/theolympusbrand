// The edit service's password and sessions. One password for the house, kept
// as an scrypt hash in the data folder; a session is a random token in an
// HttpOnly cookie, with a second token the page sends back with every write.

import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_DATA, dataDir } from '../../../src/node/data.ts';

const folder = () => dataDir() ?? DEFAULT_DATA;
const passwordFile = () => join(folder(), 'editor.json');
const PARAMS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function setPassword(password: string): void {
  if (password.length < 8) throw new Error('the password must have at least 8 characters');
  const salt = randomBytes(32);
  const hash = scryptSync(password, salt, 32, PARAMS);
  mkdirSync(folder(), { recursive: true });
  const tmp = `${passwordFile()}.tmp`;
  writeFileSync(tmp, JSON.stringify({ hash: `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${hash.toString('base64')}` }) + '\n', { mode: 0o600 });
  renameSync(tmp, passwordFile());
}

export const hasPassword = (): boolean => existsSync(passwordFile());

/** Checked without holding up the service: the hashing runs off the main thread. */
export async function checkPassword(password: string): Promise<boolean> {
  if (!hasPassword()) return false;
  const [kind, N, r, p, salt, hash] = (JSON.parse(readFileSync(passwordFile(), 'utf8')) as { hash: string }).hash.split('$');
  if (kind !== 'scrypt') return false;
  const want = Buffer.from(hash, 'base64');
  const got = await new Promise<Buffer>((done, fail) => scrypt(password, Buffer.from(salt, 'base64'), want.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem }, (e, key) => (e ? fail(e) : done(key))));
  return timingSafeEqual(want, got);
}

export type Session = { csrf: string; expires: number };
const HOURS = 12;

export class Sessions {
  private all = new Map<string, Session>();
  open(): { token: string; session: Session } {
    const token = randomBytes(32).toString('hex');
    const session = { csrf: randomBytes(24).toString('hex'), expires: Date.now() + HOURS * 3600_000 };
    this.all.set(token, session);
    return { token, session };
  }
  get(token: string | undefined): Session | null {
    if (!token) return null;
    const s = this.all.get(token);
    if (!s) return null;
    if (s.expires < Date.now()) {
      this.all.delete(token);
      return null;
    }
    return s;
  }
  close(token: string | undefined): void {
    if (token) this.all.delete(token);
  }
  static readonly maxAge = HOURS * 3600;
}

/**
 * Sign-ins take turns, one at a time for the whole house (behind the web
 * server every visitor has the same address), and after each wrong password
 * the next waits longer: 2^failures seconds, at most 30. Guesses sent all at
 * once queue behind each other.
 */
export class Throttle {
  private fails = 0;
  private turn: Promise<unknown> = Promise.resolve();
  private scale: number;
  constructor(scale = 1) {
    this.scale = scale;
  }
  /** Run a sign-in check in its turn, after the wait the failures so far have earned. */
  attempt(check: () => Promise<boolean>): Promise<boolean> {
    const run = async () => {
      if (this.fails) await new Promise((r) => setTimeout(r, Math.min(2 ** this.fails, 30) * 1000 * this.scale));
      const ok = await check();
      this.fails = ok ? 0 : this.fails + 1;
      return ok;
    };
    const next = this.turn.then(run, run);
    this.turn = next.catch(() => undefined);
    return next;
  }
}
