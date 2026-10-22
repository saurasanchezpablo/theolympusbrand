// The map's building catalogue: every kind a service or a machine can be
// shown as. Adding a kind is adding it to its family's list.

import type { BuildingType } from './types.ts';
import type { Extent } from '../placement.ts';
import type { Family } from './types.ts';
import { MAP } from '../terrain.ts';
import { TEMPLES } from './temples.ts';
import { SANCTUARY } from './sanctuary.ts';
import { CIVIC } from './civic.ts';
import { SPORT } from './sport.ts';
import { WORKS } from './works.ts';
import { MONUMENTS } from './monuments.ts';
import { MACHINES } from './machines.ts';

export type { BuildingType } from './types.ts';

export const BUILDINGS: readonly BuildingType[] = [...TEMPLES, ...SANCTUARY, ...CIVIC, ...SPORT, ...WORKS, ...MONUMENTS, ...MACHINES];

export const DEFAULT_BUILDING = { service: 'temple-doric', machine: 'rack-hall' } as const;

const BY_ID = new Map(BUILDINGS.map((k) => [k.id, k]));
export const building = (id: string): BuildingType | undefined => BY_ID.get(id);

const extents = new Map<string, Extent>();
/** How much ground a building takes at the size the map draws it: its box, measured once from its far drawing. */
export function extentOf(id: string): Extent {
  let e = extents.get(id);
  if (!e) {
    const g = BY_ID.get(id)!.build('far');
    g.computeBoundingBox();
    const b = g.boundingBox!;
    const S = MAP.buildingScale;
    const r = (v: number) => Math.round(v * S * 100) / 100;
    e = { w: r(b.max.x - b.min.x), d: r(b.max.z - b.min.z), cx: r((b.max.x + b.min.x) / 2), cz: r((b.max.z + b.min.z) / 2) };
    g.dispose();
    extents.set(id, e);
  }
  return e;
}

/** What placement needs to know of a building. */
export const buildingInfo = (id: string): { extent: Extent; family: Family } => ({ extent: extentOf(id), family: BY_ID.get(id)!.family });
