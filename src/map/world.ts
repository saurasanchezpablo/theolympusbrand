// How much of the town the buildings on the map call for. The town grows in
// a fixed order (city.ts, growthOf): a town of n blocks is the first n, so a
// larger town only adds blocks and every plot keeps its id. This decides n:
// enough plots for the buildings, with the town round them; never fewer
// blocks than hold a building the owner placed; and more, a few at a time,
// while a building still finds no plot. Pure: the same buildings, the same
// town.

import { growthOf, planCity, fullExtent, type CityPlan, type Lot } from './city.ts';
import { autoPlace, fitOnLot, type Extent } from './placement.ts';
import type { Terrain } from './terrain.ts';
import type { Places, Place } from './places.ts';
import type { Family } from './buildings/types.ts';

/** The smallest town (grid cells, squares included): the core and a ring of streets round it, so a city with few buildings still reads as a town. */
export const MIN_EXTENT = 36;
/** Blocks of town for each quarter plot the buildings need: the houses and streets round them. */
export const ROOM = 0.6;
/** How many blocks the town takes at a time when a building still finds no plot. */
const STEP = 4;

export type Wanted = { id: string; kind: 'service' | 'machine'; building: string };

/** The quarter plots a building needs: 1 for a quarter, 2 for a half, 4 for a whole block or a field. */
export function quartersOf(e: Extent, plan: CityPlan): number {
  const lots = reference(plan);
  for (const [part, n] of [['quarter', 1], ['half', 2], ['whole', 4]] as const) if (lots[part] && fitOnLot(lots[part]!, e)) return n;
  return 4;
}

const refs = new WeakMap<CityPlan, Partial<Record<'quarter' | 'half' | 'whole', Lot>>>();
/** A block's own plots (the one beside the agora), to measure buildings against. */
function reference(plan: CityPlan): Partial<Record<'quarter' | 'half' | 'whole', Lot>> {
  let r = refs.get(plan);
  if (!r) {
    r = {};
    for (const part of ['quarter', 'half', 'whole'] as const) r[part] = plan.lots.find((l) => l.part === part && l.district === 'town');
    refs.set(plan, r);
  }
  return r;
}

/** The grid cells a plot stands on (a block's, a field's), by its id; none for the core's (the sanctuary's). */
function cellsOfLot(id: string, growth: ReturnType<typeof growthOf>): string[] {
  const b = id.match(/^b(-?\d+):(-?\d+)/);
  if (b) return [`${b[1]}:${b[2]}`];
  const f = id.match(/^f([01])/);
  if (f) {
    const side = f[1] === '0' ? -1 : 1;
    return growth.squares.find((q) => q.kind === 'field' && q.side === side)?.cells.map(([i, j]) => `${i}:${j}`) ?? [];
  }
  return [];
}

/**
 * The town's extent for these buildings: how many of the growth order's
 * blocks. `owned`: the plot each owner-placed building stands on.
 */
export function extentFor(land: Terrain, items: readonly Wanted[], fixed: Record<string, Place>, info: (building: string) => { extent: Extent; family: Family }, owned: Record<string, string> = {}): number {
  const growth = growthOf(land);
  const full = fullExtent(land);
  const rank = new Map(growth.order.map((k, n) => [k, n]));
  // Measured against the full town's plots (the same sizes at every extent).
  const ruler = planCity(land);
  const demand = items.reduce((sum, it) => sum + quartersOf(info(it.building).extent, ruler), 0);
  let n = Math.max(MIN_EXTENT, growth.core + Math.ceil(demand * ROOM));
  // Never short of a block that holds a building the owner placed.
  for (const lot of Object.values(owned)) for (const c of cellsOfLot(lot, growth)) n = Math.max(n, (rank.get(c) ?? -1) + 1);
  n = Math.min(n, full);
  // Every building on a plot: a few more blocks at a time until each has one, or the land runs out.
  while (n < full && autoPlace(planCity(land, n), items, fixed, info).unplaced.length) n = Math.min(full, n + STEP);
  return n;
}

/** The plots the owner's places stand on in the full town (where they would be kept), for `extentFor`. */
export function ownedLots(land: Terrain, items: readonly Wanted[], places: Places, info: (building: string) => { extent: Extent; family: Family }): Record<string, string> {
  const fixed = Object.fromEntries(items.filter((it) => places[it.id]).map((it) => [it.id, places[it.id]]));
  if (!Object.keys(fixed).length) return {};
  return autoPlace(planCity(land), items.filter((it) => fixed[it.id]), fixed, info).lots;
}
