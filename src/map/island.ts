// The island as the site ships it: the land, the city planned on it — grown to
// as many blocks as the map's buildings call for (world.ts), the full town
// without an extent — and the land graded to the city. Made once per process
// and extent.

import { makeTerrain, type Terrain } from './terrain.ts';
import { gradeCity, planCity, type CityPlan } from './city.ts';

let rough: Terrain | null = null;
/** The land as the island's noise makes it, before the city is graded into it. */
export const roughLand = (): Terrain => (rough ??= makeTerrain());

const made = new Map<number | 'full', { plan: CityPlan; land: Terrain }>();

export function island(extent?: number): { plan: CityPlan; land: Terrain } {
  const k = extent ?? 'full';
  let m = made.get(k);
  if (!m) {
    const plan = planCity(roughLand(), extent);
    m = { plan, land: gradeCity(roughLand(), plan) };
    made.set(k, m);
  }
  return m;
}
