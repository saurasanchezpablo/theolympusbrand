// Where a building may stand: on a plot of the city, turned to its street.
// Plots nest — a block whole, its halves, their quarters — so a building on
// a half takes its quarters too and leaves the other half free. The map puts
// the items the owner has not placed on the plots that suit them: temples in
// the sanctuary, the machines in the works quarter, the rest round the agora.
// Pure and deterministic: the same items always land on the same plots.

import type { CityPlan, District, Lot, Part } from './city.ts';
import type { Family } from './buildings/types.ts';
import type { Place } from './places.ts';

export type MapItem = { id: string; kind: 'service' | 'machine'; place: Place };
/** A building's ground at map scale, in its own axes (front towards +z): width, depth, and the centre of its box. */
export type Extent = { w: number; d: number; cx: number; cz: number };
export type Refusal = 'no-plot' | 'taken' | 'too-big';
/** Room kept between a building and its plot's edge: its precinct wall and a path round it. */
export const MARGIN = 0.45;

const TURN = Math.PI * 2;
const norm = (r: number) => ((r % TURN) + TURN) % TURN;
const same = (a: number, b: number) => Math.abs(norm(a - b + Math.PI) - Math.PI) < 0.01;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The turns a building may take on a plot, the ones that face its street first. */
export function turnsOn(lot: Lot): number[] {
  return [lot.facing, lot.facing + Math.PI / 2, lot.facing - Math.PI / 2, lot.facing + Math.PI].map((r) => r3(norm(r)));
}

/** Where a building stands on a plot at a turn — centred on it — or null when it does not fit that way. */
export function standOn(lot: Lot, e: Extent, rotation: number): { x: number; z: number; rotation: number } | null {
  const quarter = Math.round(norm(rotation) / (Math.PI / 2)) % 2 === 1;
  const ew = quarter ? e.d : e.w,
    ed = quarter ? e.w : e.d;
  const [x0, z0, x1, z1] = lot.rect;
  if (ew + 2 * MARGIN > x1 - x0 + 1e-6 || ed + 2 * MARGIN > z1 - z0 + 1e-6) return null;
  // The box's centre, turned with the building, lands on the plot's centre.
  const c = Math.cos(rotation),
    s = Math.sin(rotation);
  const ox = e.cx * c + e.cz * s,
    oz = -e.cx * s + e.cz * c;
  return { x: r2((x0 + x1) / 2 - ox), z: r2((z0 + z1) / 2 - oz), rotation: r3(norm(rotation)) };
}

/** A building on a plot: at the turn asked for when it fits so, else the first turn that fits. */
export function fitOnLot(lot: Lot, e: Extent, prefer?: number): { x: number; z: number; rotation: number } | null {
  if (prefer !== undefined) {
    const at = turnsOn(lot).find((r) => same(r, prefer));
    if (at !== undefined) {
      const p = standOn(lot, e, at);
      if (p) return p;
    }
  }
  // Facing the street, else sideways to it; never with its back to the street unless nothing else fits.
  for (const r of turnsOn(lot)) {
    const p = standOn(lot, e, r);
    if (p) return p;
  }
  return null;
}

/** The plan's plots with their nesting, looked up fast. */
export type Plots = { plan: CityPlan; byId: Map<string, Lot>; children: Map<string, string[]> };
const cache = new WeakMap<CityPlan, Plots>();
export function plotsOf(plan: CityPlan): Plots {
  let p = cache.get(plan);
  if (!p) {
    const byId = new Map(plan.lots.map((l) => [l.id, l]));
    const children = new Map<string, string[]>();
    for (const l of plan.lots) if (l.parent) children.set(l.parent, [...(children.get(l.parent) ?? []), l.id]);
    p = { plan, byId, children };
    cache.set(plan, p);
  }
  return p;
}

/** Is a plot free: neither it, nor a plot it is part of, nor one of its parts taken (by another than `except`)? */
export function isFree(plots: Plots, id: string, taken: ReadonlyMap<string, string>, except?: string): boolean {
  const by = (k: string) => {
    const who = taken.get(k);
    return who !== undefined && who !== except;
  };
  for (let l: Lot | undefined = plots.byId.get(id); l; l = l.parent ? plots.byId.get(l.parent) : undefined) if (by(l.id)) return false;
  const down = [...(plots.children.get(id) ?? [])];
  while (down.length) {
    const k = down.pop()!;
    if (by(k)) return false;
    down.push(...(plots.children.get(k) ?? []));
  }
  return true;
}

const PART_ORDER: Record<Part, number> = { quarter: 0, half: 1, precinct: 2, whole: 3, field: 4 };
const contains = (l: Lot, x: number, z: number) => x >= l.rect[0] && x <= l.rect[2] && z >= l.rect[1] && z <= l.rect[3];

/** The plot under a point that takes this building: the smallest that fits, and why not when none does. */
export function placeAt(plots: Plots, x: number, z: number, e: Extent, taken: ReadonlyMap<string, string>, opts: { except?: string; rotation?: number } = {}): { ok: true; lot: Lot; place: { x: number; z: number; rotation: number } } | { ok: false; why: Refusal } {
  const under = plots.plan.lots.filter((l) => contains(l, x, z)).sort((a, b) => PART_ORDER[a.part] - PART_ORDER[b.part]);
  if (!under.length) return { ok: false, why: 'no-plot' };
  let why: Refusal = 'too-big';
  for (const lot of under) {
    const at = fitOnLot(lot, e, opts.rotation);
    if (!at) continue;
    if (!isFree(plots, lot.id, taken, opts.except)) {
      why = 'taken';
      continue;
    }
    return { ok: true, lot, place: at };
  }
  return { ok: false, why };
}

/** Which districts suit which family of building, best first. */
const SUITS: Record<Family, District[]> = {
  temples: ['sanctuary', 'town', 'works', 'field'],
  sanctuary: ['sanctuary', 'town', 'works', 'field'],
  civic: ['town', 'works', 'field', 'sanctuary'],
  sport: ['town', 'works', 'field', 'sanctuary'],
  works: ['town', 'works', 'field', 'sanctuary'],
  monuments: ['town', 'works', 'field', 'sanctuary'],
  machines: ['works', 'town', 'field', 'sanctuary'],
};

/**
 * Plots for every item: the owner's places first (each kept on the plot under
 * it, or the nearest free plot that takes it), then the others on the plots
 * that suit them — near the agora first, the smallest plot that fits.
 */
export function autoPlace(
  plan: CityPlan,
  items: readonly { id: string; kind: 'service' | 'machine'; building: string }[],
  fixed: Record<string, Place>,
  info: (building: string) => { extent: Extent; family: Family },
): { places: Record<string, Place>; lots: Record<string, string>; unplaced: string[] } {
  const plots = plotsOf(plan);
  const taken = new Map<string, string>();
  const places: Record<string, Place> = {};
  const lots: Record<string, string> = {};
  const unplaced: string[] = [];
  const agora = plan.squares.find((s) => s.kind === 'agora')?.rect ?? [0, 0, 0, 0];
  const ax = (agora[0] + agora[2]) / 2,
    az = (agora[1] + agora[3]) / 2;
  const centre = (l: Lot) => [(l.rect[0] + l.rect[2]) / 2, (l.rect[1] + l.rect[3]) / 2];
  const settle = (id: string, building: string, lot: Lot, at: { x: number; z: number; rotation: number }) => {
    taken.set(lot.id, id);
    lots[id] = lot.id;
    places[id] = { building, ...at };
  };
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : 1));
  // The owner's places: the plot under each, else the nearest that takes it.
  for (const it of sorted) {
    const p = fixed[it.id];
    if (!p) continue;
    const { extent } = info(p.building);
    // Exactly where a plot would stand it (as the editor saves it): kept on that plot.
    const exact = plan.lots.find((l) => {
      const at = contains(l, p.x, p.z) ? standOn(l, extent, p.rotation) : null;
      return at && Math.abs(at.x - p.x) < 0.05 && Math.abs(at.z - p.z) < 0.05 && isFree(plots, l.id, taken);
    });
    if (exact) {
      settle(it.id, p.building, exact, standOn(exact, extent, p.rotation)!);
      continue;
    }
    const here = placeAt(plots, p.x, p.z, extent, taken, { rotation: p.rotation });
    if (here.ok) {
      settle(it.id, p.building, here.lot, here.place);
      continue;
    }
    const near = plan.lots
      .map((l) => ({ l, d: Math.hypot(centre(l)[0] - p.x, centre(l)[1] - p.z) }))
      .sort((a, b) => a.d - b.d || PART_ORDER[a.l.part] - PART_ORDER[b.l.part])
      .find(({ l }) => isFree(plots, l.id, taken) && fitOnLot(l, extent, p.rotation));
    if (near) settle(it.id, p.building, near.l, fitOnLot(near.l, extent, p.rotation)!);
    else unplaced.push(it.id);
  }
  // The rest, where they suit.
  for (const it of sorted) {
    if (fixed[it.id]) continue;
    const { extent, family } = info(it.building);
    const suits = SUITS[family];
    const candidates = plan.lots
      .filter((l) => suits.includes(l.district))
      .map((l) => ({ l, at: fitOnLot(l, extent) }))
      .filter((c) => c.at)
      .sort((a, b) => suits.indexOf(a.l.district) - suits.indexOf(b.l.district) || PART_ORDER[a.l.part] - PART_ORDER[b.l.part] || Math.hypot(centre(a.l)[0] - ax, centre(a.l)[1] - az) - Math.hypot(centre(b.l)[0] - ax, centre(b.l)[1] - az) || (a.l.id < b.l.id ? -1 : 1));
    const spot = candidates.find((c) => isFree(plots, c.l.id, taken));
    if (spot) settle(it.id, it.building, spot.l, spot.at!);
    else unplaced.push(it.id);
  }
  const order = Object.keys(places).sort();
  return { places: Object.fromEntries(order.map((k) => [k, places[k]])), lots: Object.fromEntries(order.map((k) => [k, lots[k]])), unplaced: unplaced.sort() };
}
