// What the map shows: every service and machine, with its building and where
// it stands — the owner's place when there is one, else one chosen for it —
// and only what its card shows.

import type { Service } from '../catalog/service.ts';
import type { MachineSpec } from '../catalog/machine.ts';
import type { Place, Places } from './places.ts';
import type { CityPlan } from './city.ts';
import { autoPlace } from './placement.ts';
import { BUILDINGS, DEFAULT_BUILDING, building, buildingInfo } from './buildings/index.ts';
import { extentFor, ownedLots } from './world.ts';
import type { Terrain } from './terrain.ts';

export type MapEntry = {
  id: string;
  kind: 'service' | 'machine';
  name: string;
  description?: string;
  url?: string;
  /** A machine's network address and host name, shown in its panel. */
  ip?: string;
  hostname?: string;
  os?: string;
  role?: string;
  category?: string;
  app?: string;
  /** The service's seal, a path on the site. */
  seal?: string;
  /** Its own logo, a path on the site. */
  logo?: string;
  /** A service's Atelier design, when one is linked ("<key>@<version>"). */
  design?: string;
  place: Place;
  /** The plot it stands on. */
  lot: string;
  placed: 'owner' | 'auto';
};
/** `unplaced`: what found no room on the island — never left out in silence. */
export type MapData = { version: 1; items: MapEntry[]; unplaced: { id: string; kind: 'service' | 'machine'; name: string }[] };

/** Where a service's seal is on the site. */
export const sealPath = (id: string) => `files/assets/services/${id}/svg/the-olympus-${id}-seal.svg`;

export const ENTRY_KEYS = ['id', 'kind', 'name', 'description', 'url', 'ip', 'hostname', 'os', 'role', 'category', 'app', 'seal', 'logo', 'design', 'place', 'lot', 'placed'] as const;

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

/** The building a service is given until the owner chooses: one that suits its category first, varied by its id. */
export function suggestedBuilding(kind: 'service' | 'machine', id: string, category?: string): string {
  if (kind === 'machine') return DEFAULT_BUILDING.machine;
  const best = BUILDINGS.filter((k) => k.kind === 'service' && k.suggests[0] === category);
  return best.length ? best[hash(id) % best.length].id : DEFAULT_BUILDING.service;
}

const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;

/** Everything on the map. `logos` names which items have a logo published for the map (assets/map/logos/<id>.svg). */
/** `sealed`: whether a service's seal is on the site yet (a service just added has none until the site is rebuilt); every one by default. */
export function mapData(services: readonly Service[], machines: readonly MachineSpec[], places: Places, plan: CityPlan, logos: ReadonlySet<string> = new Set(), sealed: (id: string) => boolean = () => true): MapData {
  const { base, want, fixed } = wanted(services, machines, places, sealed);
  const { places: placed, lots, unplaced } = autoPlace(plan, want, fixed, buildingInfo);
  return {
    version: 1,
    unplaced: base.filter((it) => unplaced.includes(it.id)).map((it) => ({ id: it.id, kind: it.kind, name: it.entry.name })),
    items: base
      .filter((it) => placed[it.id])
      .map((it) => clean({ id: it.id, kind: it.kind, ...it.entry, logo: logos.has(it.id) ? `files/assets/map/logos/${it.id}.svg` : undefined, place: placed[it.id], lot: lots[it.id], placed: places[it.id] ? ('owner' as const) : ('auto' as const) }) as MapEntry),
  };
}

/** What each item asks of the map: its building (the owner's, else one that suits it), and the owner's places that still stand. */
function wanted(services: readonly Service[], machines: readonly MachineSpec[], places: Places, sealed: (id: string) => boolean = () => true) {
  const base = [
    ...services.map((s) => ({ id: s.id, kind: 'service' as const, entry: { name: s.name, description: s.description, url: s.url, category: s.category, app: s.app, design: s.design, seal: sealed(s.id) ? sealPath(s.id) : undefined } })),
    ...machines.map((m) => ({ id: m.id, kind: 'machine' as const, entry: { name: m.name, description: m.description, ip: m.ip, hostname: m.hostname, os: m.os, role: m.role } })),
  ].sort((a, b) => (a.id < b.id ? -1 : 1));
  // The owner's places, where their building still exists.
  const fixed: Places = {};
  for (const it of base) {
    const p = places[it.id];
    if (p && building(p.building)) fixed[it.id] = p;
  }
  const want = base.map((it) => ({ id: it.id, kind: it.kind, building: places[it.id] && building(places[it.id].building) ? places[it.id].building : suggestedBuilding(it.kind, it.id, 'category' in it.entry ? it.entry.category : undefined) }));
  // A place whose building is gone keeps its spot with the suggested building.
  for (const it of base) if (places[it.id] && !fixed[it.id]) fixed[it.id] = { ...places[it.id], building: want.find((w) => w.id === it.id)!.building };
  return { base, want, fixed };
}

/** How many blocks of the town these items call for (world.ts): the city the map is drawn with. */
export function townExtent(land: Terrain, services: readonly Service[], machines: readonly MachineSpec[], places: Places): number {
  const { want, fixed } = wanted(services, machines, places);
  return extentFor(land, want, fixed, buildingInfo, ownedLots(land, want, fixed, buildingInfo));
}

/** A machine as the server keeps it, read back from its entry on the map (its logo, when it shows one, is logos/<id>.svg). */
export function machineSpecOf(e: MapEntry): MachineSpec {
  const { id, name, description, ip, hostname, os, role } = e;
  return clean({ id, name, description, ip, hostname, os, role, logo: e.logo ? `logos/${id}.svg` : undefined }) as MachineSpec;
}
