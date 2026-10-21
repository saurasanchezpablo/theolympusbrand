// Where a building may stand on the island, and where the map puts the items
// the owner has not placed yet. Pure and deterministic: the same items always
// land in the same places.

import { MAP, heightAt, type Terrain } from './terrain.ts';
import { seeded } from './noise.ts';
import type { Place } from './places.ts';

export type MapItem = { id: string; kind: 'service' | 'machine'; place: Place };
export type Refusal = 'sea' | 'cliff' | 'crowded' | 'outside';
type Other = { place: Pick<Place, 'x' | 'z'>; footprint: number };

/** The summit's foot: services gather round it, buildings face it. */
export const MASSIF = { x: 4 * 1.4, z: -6 * 1.4 } as const;

/** Can a building with this footprint stand here? If not, why. */
export function canPlace(t: Terrain, p: Pick<Place, 'x' | 'z'> & Partial<Place>, footprint: number, others: readonly Other[]): { ok: true } | { ok: false; why: Refusal } {
  if (Math.max(Math.abs(p.x), Math.abs(p.z)) + footprint > MAP.size / 2 - 4) return { ok: false, why: 'outside' };
  for (const o of others) if (Math.hypot(o.place.x - p.x, o.place.z - p.z) < footprint + o.footprint + 1.5) return { ok: false, why: 'crowded' };
  let lo = Infinity,
    hi = -Infinity;
  for (const k of [0, 0.5, 1])
    for (let i = 0; i < (k ? 8 : 1); i++) {
      const a = (i / 8) * Math.PI * 2;
      const h = heightAt(t, p.x + Math.cos(a) * footprint * k, p.z + Math.sin(a) * footprint * k);
      if (h <= MAP.sea + 1) return { ok: false, why: 'sea' };
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
  if (hi - lo > Math.max(2, footprint * 0.9)) return { ok: false, why: 'cliff' };
  return { ok: true };
}

/** A turn that faces the building's front (+z) towards the summit. */
export const facingSummit = (x: number, z: number): number => {
  const r = Math.atan2(MASSIF.x - x, MASSIF.z - z);
  return ((r % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
};

let candidateCache: { t: Terrain; list: { x: number; z: number; h: number }[] } | null = null;
/** Spots spread over the land: a jittered grid, the same every time. */
function candidates(t: Terrain): { x: number; z: number; h: number }[] {
  if (candidateCache?.t === t) return candidateCache.list;
  const rnd = seeded(4242);
  const list: { x: number; z: number; h: number }[] = [];
  const step = 4;
  for (let z = -MAP.size / 2 + step; z < MAP.size / 2 - step; z += step)
    for (let x = -MAP.size / 2 + step; x < MAP.size / 2 - step; x += step) {
      // Rounded to a hundredth, as places are stored.
      const cx = Math.round((x + (rnd() - 0.5) * step * 0.8) * 100) / 100,
        cz = Math.round((z + (rnd() - 0.5) * step * 0.8) * 100) / 100;
      const h = heightAt(t, cx, cz);
      if (h > MAP.sea + 1.5) list.push({ x: cx, z: cz, h });
    }
  candidateCache = { t, list };
  return list;
}

/**
 * Places for the items that have none: services round the massif, nearest
 * first; machines on the lower ground round the island. Items with a place
 * keep it, and the others keep clear of them.
 */
export function autoPlace(t: Terrain, items: readonly { id: string; kind: 'service' | 'machine'; building: string }[], fixed: Record<string, Place>, footprintOf: (building: string) => number = defaultFootprint): { places: Record<string, Place>; unplaced: string[] } {
  const places: Record<string, Place> = {};
  const taken: Other[] = [];
  for (const it of items)
    if (fixed[it.id]) {
      places[it.id] = fixed[it.id];
      taken.push({ place: fixed[it.id], footprint: footprintOf(fixed[it.id].building) });
    }
  const all = candidates(t);
  const toCentre = (c: { x: number; z: number }) => Math.hypot(c.x - MASSIF.x, c.z - MASSIF.z);
  const forServices = [...all].sort((a, b) => toCentre(a) - toCentre(b));
  // Machines: the lower ground first (under 16 high), nearest the massif first; then anywhere left.
  const low = (c: { h: number }) => (c.h < 16 ? 0 : 1);
  const forMachines = [...all].sort((a, b) => low(a) - low(b) || toCentre(a) - toCentre(b));
  const unplaced: string[] = [];
  for (const it of [...items].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (places[it.id]) continue;
    const fp = footprintOf(it.building);
    const list = it.kind === 'machine' ? forMachines : forServices;
    const spot = list.find((c) => canPlace(t, c, fp, taken).ok);
    if (!spot) {
      unplaced.push(it.id);
      continue;
    }
    const place = { building: it.building, x: spot.x, z: spot.z, rotation: Math.round(facingSummit(spot.x, spot.z) * 1000) / 1000 };
    places[it.id] = place;
    taken.push({ place, footprint: fp });
  }
  return { places: Object.fromEntries(Object.keys(places).sort().map((k) => [k, places[k]])), unplaced };
}

// The catalogue's footprints, looked up lazily so this module stays usable without three.js loaded first.
let footprints: Map<string, number> | null = null;
function defaultFootprint(id: string): number {
  if (!footprints) throw new Error('autoPlace needs footprints: pass footprintOf, or call setFootprints() first');
  return footprints.get(id) ?? 8;
}
/** Tell the placement how much ground each building type takes (the catalogue's footprints). */
export function setFootprints(map: Map<string, number>): void {
  footprints = map;
}
