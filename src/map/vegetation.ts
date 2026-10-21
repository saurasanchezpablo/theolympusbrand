// The island's forests: rounded broadleaf trees low down, layered pines
// higher up, none on cliffs, on the summit, in the sea or on a terrace. They
// grow in patches, from seeded noise — the same forest every time.

import { MAP, heightAt, type Terrain } from './terrain.ts';
import { gradientNoise, seeded } from './noise.ts';

export type Forest = {
  /** [x, y, z, scale, turn] for each tree. */
  broad: Float32Array;
  pine: Float32Array;
};

export function scatterTrees(t: Terrain, sites: readonly { x: number; z: number; r: number }[]): Forest {
  const rnd = seeded(99);
  const n = gradientNoise(MAP.seed + 1);
  const grow = (count: number, ok: (y: number, slope: number, patch: number) => boolean, scale: number) => {
    const out: number[] = [];
    let tries = 0;
    while (out.length / 5 < count && tries < count * 30) {
      tries++;
      const x = (rnd() - 0.5) * MAP.size * 0.9,
        z = (rnd() - 0.5) * MAP.size * 0.9;
      const y = heightAt(t, x, z);
      const slope = Math.abs(heightAt(t, x + 1, z) - y) + Math.abs(heightAt(t, x, z + 1) - y);
      const patch = n.fbm(x * 0.03 + 50, z * 0.03 + 50, 3);
      const s = scale * (0.75 + rnd() * 0.6),
        turn = rnd() * Math.PI * 2;
      if (!ok(y, slope, patch)) continue;
      if (sites.some((site) => Math.hypot(x - site.x, z - site.z) < site.r * 1.6)) continue;
      out.push(x, y - 0.1, z, s, turn);
    }
    return Float32Array.from(out);
  };
  const broad = grow(14_000, (y, sl, d) => y > MAP.sea + 1.2 && y < 30 && sl < 1.4 && d > -0.05, 0.7);
  const pine = grow(11_000, (y, sl, d) => y > 18 && y < 58 && sl < 2.2 && d > -0.15, 0.8);
  return { broad, pine };
}
