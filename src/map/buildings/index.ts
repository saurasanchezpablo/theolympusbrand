// The map's building catalogue: every kind a service or a machine can be
// shown as. Adding a kind is adding it to its family's list.

import type { BuildingType } from './types.ts';
import { setFootprints } from '../placement.ts';
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

// Placement measures buildings by their footprints, at the size the map draws them.
setFootprints(new Map(BUILDINGS.map((k) => [k.id, k.footprint * MAP.buildingScale])));
