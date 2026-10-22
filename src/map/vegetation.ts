// The island's forests: rounded broadleaf trees low down, layered pines
// higher up, none on cliffs, on the summit, in the sea or in the town. They
// grow in patches, from seeded noise — the same forest every time.

import { MAP, heightAt, type Terrain } from './terrain.ts';
import { gradientNoise, seeded } from './noise.ts';

export type Forest = {
  /** [x, y, z, scale, turn] for each tree. */
  broad: Float32Array;
  pine: Float32Array;
  /** The olive groves round the town: rows on the gentler ground beyond its wall. */
  olive: Float32Array;
};

/**
 * `avoid`: where no tree may grow (the town and a margin round it); `belt`:
 * where the town's olive groves are (near it, beyond its wall).
 */
export function scatterTrees(t: Terrain, avoid: (x: number, z: number) => boolean, belt: (x: number, z: number) => boolean = () => false): Forest {
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
      if (avoid(x, z) || inGrove(x, z)) continue;
      out.push(x, y - 0.1, z, s, turn);
    }
    return Float32Array.from(out);
  };
  // The groves first: rows on a 4-unit grid, gently sloping ground only; the forest keeps off them.
  const groves: number[] = [];
  const taken = new Set<string>();
  for (let z = -MAP.size / 2; z < MAP.size / 2; z += 4)
    for (let x = -MAP.size / 2; x < MAP.size / 2; x += 4) {
      if (!belt(x, z) || avoid(x, z)) continue;
      const y = heightAt(t, x, z);
      const slope = Math.abs(heightAt(t, x + 1, z) - y) + Math.abs(heightAt(t, x, z + 1) - y);
      if (y < MAP.sea + 1 || slope > 0.9 || n.fbm(x * 0.02 + 9, z * 0.02 - 4, 3) < -0.25) continue;
      groves.push(x + (rnd() - 0.5) * 0.6, y - 0.05, z + (rnd() - 0.5) * 0.6, 0.8 + rnd() * 0.25, rnd() * Math.PI * 2);
      taken.add(`${Math.round(x / 4)}:${Math.round(z / 4)}`);
    }
  const inGrove = (x: number, z: number) => taken.has(`${Math.round(x / 4)}:${Math.round(z / 4)}`);
  const broad = grow(14_000, (y, sl, d) => y > MAP.sea + 1.2 && y < 30 && sl < 1.4 && d > -0.05, 0.7);
  // Pines hold on to steep ground: the mountain's flanks are forested to the rock.
  const pine = grow(11_000, (y, sl, d) => y > 14 && y < 62 && sl < 3.4 && d > -0.2, 0.8);
  return { broad, pine, olive: Float32Array.from(groves) };
}
