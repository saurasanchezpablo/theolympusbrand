// The island for the tools on the server (the map's build, the edit service):
// made once per extent of the town and kept in .cache/island/ under a
// fingerprint of the code that makes it, so a map rebuilt for a moved building
// does not plan and grade the city again. The same island either way.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { MAP, type Terrain } from '../map/terrain.ts';
import type { CityPlan } from '../map/city.ts';
import { island as make, roughLand as makeRough } from '../map/island.ts';

const ROOT = new URL('../../', import.meta.url).pathname;
const CACHE = join(process.env.OLYMPUS_CACHE || join(ROOT, '.cache'), 'island');

/** Every file the island's code imports, followed through relative imports. */
function codeKey(): string {
  const h = createHash('sha256');
  const seen = new Set<string>();
  const todo = [join(ROOT, 'src/map/island.ts')];
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const r = resolve(dirname(f), m[1]);
      if (existsSync(r) && statSync(r).isFile()) todo.push(r);
    }
  }
  for (const f of [...seen].sort()) h.update(f.slice(ROOT.length)).update('\0').update(readFileSync(f));
  return h.update(process.version.split('.')[0]).digest('hex').slice(0, 20);
}

let rough: Terrain | null = null;
/** The land before the city is graded into it (what the town's growth is measured on): kept beside the islands. */
export function roughLand(): Terrain {
  if (rough) return rough;
  const file = join(CACHE, codeKey(), 'rough.f32');
  try {
    const b = readFileSync(file);
    if (b.length !== MAP.res * MAP.res * 4) throw new Error('damaged');
    const heights = new Float32Array(MAP.res * MAP.res);
    new Uint8Array(heights.buffer).set(b);
    rough = { size: MAP.size, res: MAP.res, heights };
    return rough;
  } catch {
    rough = makeRough();
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(`${file}.${process.pid}.tmp`, new Uint8Array(rough.heights.buffer, rough.heights.byteOffset, rough.heights.byteLength));
      renameSync(`${file}.${process.pid}.tmp`, file);
    } catch {
      /* no room to keep it */
    }
    return rough;
  }
}

const madeAt = new Map<number | 'full', { plan: CityPlan; land: Terrain }>();

/** The island and its city grown to `extent` blocks (the full town without one): from the cache when this code made them before, else made (and kept). */
export function island(extent?: number): { plan: CityPlan; land: Terrain } {
  const at = extent ?? 'full';
  let made = madeAt.get(at);
  if (made) return made;
  const dir = join(CACHE, codeKey(), String(at));
  // The heights exactly as made (32-bit floats), not the shipped file's 16-bit steps: the same island, to the last bit.
  const heightsFile = join(dir, 'heights.f32'),
    cityFile = join(dir, 'city.json');
  if (existsSync(heightsFile) && existsSync(cityFile)) {
    try {
      const { size, res, plan } = JSON.parse(readFileSync(cityFile, 'utf8')) as { size: number; res: number; plan: CityPlan };
      const b = readFileSync(heightsFile);
      if (b.length !== res * res * 4) throw new Error('damaged');
      const heights = new Float32Array(res * res);
      new Uint8Array(heights.buffer).set(b);
      made = { land: { size, res, heights }, plan };
      madeAt.set(at, made);
      return made;
    } catch {
      /* damaged: made again below */
    }
  }
  made = make(extent);
  madeAt.set(at, made);
  try {
    mkdirSync(dir, { recursive: true });
    for (const [file, data] of [
      [heightsFile, new Uint8Array(made.land.heights.buffer, made.land.heights.byteOffset, made.land.heights.byteLength)],
      [cityFile, JSON.stringify({ size: made.land.size, res: made.land.res, plan: made.plan })],
    ] as const) {
      writeFileSync(`${file}.${process.pid}.tmp`, data);
      renameSync(`${file}.${process.pid}.tmp`, file);
    }
    // Old fingerprints' islands are dropped: only the code as it is now is kept.
    for (const old of readdirSync(CACHE)) if (old !== codeKey()) rmSync(join(CACHE, old), { recursive: true, force: true });
  } catch {
    /* no room to keep it: made each time, as before */
  }
  return made;
}
