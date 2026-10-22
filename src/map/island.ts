// The island as the site ships it: the land, the city planned on it, and the
// land graded to the city. Made once per process.

import { makeTerrain, type Terrain } from './terrain.ts';
import { gradeCity, planCity, type CityPlan } from './city.ts';

let made: { plan: CityPlan; land: Terrain } | null = null;

export function island(): { plan: CityPlan; land: Terrain } {
  if (!made) {
    const rough = makeTerrain();
    const plan = planCity(rough);
    made = { plan, land: gradeCity(rough, plan) };
  }
  return made;
}
