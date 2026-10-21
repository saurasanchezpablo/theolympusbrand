// What the map shows: every service and machine, with its building and where
// it stands — the owner's place when there is one, else one chosen for it —
// and only what its card shows.

import type { Service } from '../catalog/service.ts';
import type { MachineSpec } from '../catalog/machine.ts';
import type { Place, Places } from './places.ts';
import type { Terrain } from './terrain.ts';
import { autoPlace } from './placement.ts';
import { BUILDINGS, DEFAULT_BUILDING, building } from './buildings/index.ts';

export type MapEntry = {
  id: string;
  kind: 'service' | 'machine';
  name: string;
  description?: string;
  url?: string;
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
  place: Place;
  placed: 'owner' | 'auto';
};
/** `unplaced`: what found no room on the island — never left out in silence. */
export type MapData = { version: 1; items: MapEntry[]; unplaced: { id: string; kind: 'service' | 'machine'; name: string }[] };

export const ENTRY_KEYS = ['id', 'kind', 'name', 'description', 'url', 'ip', 'hostname', 'os', 'role', 'category', 'app', 'seal', 'logo', 'place', 'placed'] as const;

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
export function mapData(services: readonly Service[], machines: readonly MachineSpec[], places: Places, terrain: Terrain, logos: ReadonlySet<string> = new Set()): MapData {
  const base = [
    ...services.map((s) => ({ id: s.id, kind: 'service' as const, entry: { name: s.name, description: s.description, url: s.url, ip: s.ip, category: s.category, app: s.app, seal: `files/assets/services/${s.id}/svg/the-olympus-${s.id}-seal.svg` } })),
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
  const { places: placed, unplaced } = autoPlace(terrain, want, fixed);
  return {
    version: 1,
    unplaced: base.filter((it) => unplaced.includes(it.id)).map((it) => ({ id: it.id, kind: it.kind, name: it.entry.name })),
    items: base
      .filter((it) => placed[it.id])
      .map((it) => clean({ id: it.id, kind: it.kind, ...it.entry, logo: logos.has(it.id) ? `files/assets/map/logos/${it.id}.svg` : undefined, place: placed[it.id], placed: places[it.id] ? ('owner' as const) : ('auto' as const) }) as MapEntry),
  };
}

/** A machine as the server keeps it, read back from its entry on the map (its logo, when it shows one, is logos/<id>.svg). */
export function machineSpecOf(e: MapEntry): MachineSpec {
  const { id, name, description, ip, hostname, os, role } = e;
  return clean({ id, name, description, ip, hostname, os, role, logo: e.logo ? `logos/${id}.svg` : undefined }) as MachineSpec;
}
