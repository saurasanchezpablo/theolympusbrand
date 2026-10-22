// The screens' marble grounds, made once: drawn in bands on every core, and
// kept in .cache/marble/ under a fingerprint of the code that draws them —
// the master's screens and every service's use the same grounds, so after
// the first they come from the cache. The pixels are the ones marbleScreen
// draws, byte for byte (each depends on its place alone).

import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScreenTone } from '../../src/render/wallpaper.ts';
import { closure, hashFiles } from './fingerprint.ts';

const ROOT = new URL('../..', import.meta.url).pathname;
export const CACHE = join(process.env.OLYMPUS_CACHE || join(ROOT, '.cache'), 'marble');
let key: string | null = null;
/** The fingerprint of the drawing code: a change to it draws every ground again. */
const codeKey = () => (key ??= hashFiles(ROOT, closure([join(ROOT, 'src/render/wallpaper.ts')])).slice(0, 16));

async function draw(w: number, h: number, tone: ScreenTone): Promise<Uint8Array> {
  const n = Math.max(1, Math.min(8, availableParallelism() - 1, Math.ceil(h / 64)));
  const out = new Uint8Array(w * h);
  await Promise.all(
    Array.from({ length: n }, (_, i) => {
      const y0 = Math.floor((h * i) / n),
        y1 = Math.floor((h * (i + 1)) / n);
      return new Promise<void>((ok, fail) => {
        const worker = new Worker(new URL('./marble-worker.ts', import.meta.url), { workerData: { w, h, tone, y0, y1 } });
        worker.once('message', (rows: Uint8Array) => {
          out.set(rows, y0 * w);
          ok();
        });
        worker.once('error', fail);
      });
    }),
  );
  return out;
}

/** A marble ground, w × h pixels: from the cache when this code has drawn it before. */
export async function marbleGround(w: number, h: number, tone: ScreenTone): Promise<Uint8Array> {
  const dir = join(CACHE, codeKey());
  const file = join(dir, `${w}x${h}-${tone}.gray`);
  if (existsSync(file)) {
    const b = readFileSync(file);
    if (b.length === w * h) return new Uint8Array(b.buffer, b.byteOffset, b.length);
  }
  const g = await draw(w, h, tone);
  mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, g);
  renameSync(tmp, file);
  return g;
}
