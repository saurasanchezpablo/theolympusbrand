// A still picture of the map, seen from straight above: the island lit by a
// low sun, its engraved contours, the sea's rings, and a marble mark for each
// building. For phones, slow connections and browsers without WebGL. One grey
// channel; the same picture for the same island and items.

import { MAP, heightAt, type Terrain } from './terrain.ts';
import type { MapData } from './items.ts';

/** The part of the map the picture covers, square, centred: the island and a margin of sea. */
export const STILL_SPAN = 0.78;

export function stillImage(t: Terrain, data: MapData, px: number): Uint8Array {
  const out = new Uint8Array(px * px);
  const span = t.size * STILL_SPAN;
  const unit = span / px;
  const sun = [-0.62, 0.66, 0.35];
  const norm = Math.hypot(sun[0], sun[1], sun[2]);
  const L = sun.map((v) => v / norm);
  for (let j = 0; j < px; j++)
    for (let i = 0; i < px; i++) {
      const x = -span / 2 + (i + 0.5) * unit,
        z = -span / 2 + (j + 0.5) * unit;
      const h = heightAt(t, x, z);
      let v: number;
      if (h <= MAP.sea) {
        // The dark sea, with engraved swell rings.
        const r = Math.hypot(x, z);
        const ring = Math.abs(((r / 8) % 1) - 0.5) < 0.04 ? 1 : 0;
        v = 14 + ring * 18;
      } else {
        const dx = heightAt(t, x + unit, z) - heightAt(t, x - unit, z),
          dz = heightAt(t, x, z + unit) - heightAt(t, x, z - unit);
        const n = [-dx, 2 * unit, -dz];
        const nl = Math.hypot(n[0], n[1], n[2]);
        const light = Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl);
        const slope = 1 - (2 * unit) / nl;
        let tone = 0.13 - slope * 0.06 + Math.min(1, Math.max(0, (h - 55) / 20)) * 0.19;
        // Engraved contours: every 4 units, a stronger one every 20.
        const minor = Math.abs(((h / 4) % 1) - 0.5) > 0.5 - (unit * 0.6) / 4 ? 0.45 : 0;
        const major = Math.abs(((h / 20) % 1) - 0.5) > 0.5 - (unit * 1.0) / 20 ? 1 : 0;
        tone = tone * (0.55 + 0.9 * light);
        tone = tone + (0.42 - tone) * Math.min(1, minor + major);
        v = Math.round(Math.min(1, tone) * 255 * 1.6);
      }
      out[j * px + i] = Math.min(255, Math.max(0, v));
    }
  // A marble mark for each building: a disc with a dark rim.
  for (const e of data.items) {
    const cx = (e.place.x + span / 2) / unit,
      cz = (e.place.z + span / 2) / unit;
    const r = Math.max(2, (e.kind === 'machine' ? 3.2 : 4) / unit);
    for (let j = Math.floor(cz - r - 1); j <= Math.ceil(cz + r + 1); j++)
      for (let i = Math.floor(cx - r - 1); i <= Math.ceil(cx + r + 1); i++) {
        if (i < 0 || j < 0 || i >= px || j >= px) continue;
        const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cz);
        if (d <= r) out[j * px + i] = e.kind === 'machine' ? 170 : 236;
        else if (d <= r + 1) out[j * px + i] = 20;
      }
  }
  return out;
}
