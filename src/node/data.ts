// The server's own data: what is added, changed or removed from the map. It
// lives in a folder git never sees — OLYMPUS_DATA, by default data/ in the
// repository — so nothing about the owner's machines reaches the public
// repository, and pulling the repository never meets a local change.
//
//   services/<id>.json   a service added, or a default changed
//   machines/<id>.json   the house's machines
//   logos/<id>.svg       their logos
//   places.json          where each one stands on the map
//   removed.json         defaults taken away from the browser
//
// Every write goes to a temporary file first and is renamed into place, so a
// reader never sees half a file; and every path is built from a checked id.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ID, SPEC_KEYS, validateSpec, type ServiceSpec } from '../catalog/service.ts';
import { MACHINE_KEYS, validateMachine, type MachineSpec } from '../catalog/machine.ts';
import { validatePlace, validatePlaces, type Place, type Places } from '../map/places.ts';

const REPO = new URL('../../', import.meta.url).pathname;

/**
 * The data folder, or null: only where OLYMPUS_DATA names one — the server's
 * edit service and automatic rebuild set it (to data/ in the repository by
 * default). A working copy that does not set it builds the house alone, so
 * nothing from a data folder can reach the files git keeps. Read on every
 * call, so a test or a tool can point it elsewhere.
 */
export const dataDir = (): string | null => process.env.OLYMPUS_DATA || null;
/** The data folder the server's tools use when none is named. */
export const DEFAULT_DATA = join(REPO, 'data');
const writable = (): string => {
  const d = dataDir();
  if (!d) throw new Error('no data folder: set OLYMPUS_DATA (the edit service sets it for you)');
  return d;
};

const checked = (id: string): string => {
  if (!ID.test(id)) throw new Error(`"${id}" is not an id (kebab-case: a-z, 0-9, hyphens)`);
  return id;
};

function atomic(file: string, text: string): void {
  mkdirSync(join(file, '..'), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
const ordered = <T extends object>(o: T, keys: readonly string[]) => Object.fromEntries(keys.filter((k) => (o as Record<string, unknown>)[k] !== undefined).map((k) => [k, (o as Record<string, unknown>)[k]]));

/** The services saved in the data folder (validated), by id. */
export function dataServices(): ServiceSpec[] {
  const d = dataDir();
  if (!d) return [];
  const dir = join(d, 'services');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const spec = validateSpec(readJson(join(dir, f)), `data/services/${f}`);
      if (`${spec.id}.json` !== f) throw new Error(`data/services/${f}: "id" is "${spec.id}"`);
      return spec;
    });
}

export function loadMachines(): MachineSpec[] {
  const d = dataDir();
  if (!d) return [];
  const dir = join(d, 'machines');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const m = validateMachine(readJson(join(dir, f)), `data/machines/${f}`);
      if (`${m.id}.json` !== f) throw new Error(`data/machines/${f}: "id" is "${m.id}"`);
      return m;
    });
}

export function loadPlaces(): Places {
  const d = dataDir();
  const file = d && join(d, 'places.json');
  return file && existsSync(file) ? validatePlaces(readJson(file)) : {};
}

export function loadRemoved(): string[] {
  const d = dataDir();
  const file = d && join(d, 'removed.json');
  if (!file || !existsSync(file)) return [];
  const list = readJson(file);
  if (!Array.isArray(list) || !list.every((x) => typeof x === 'string' && ID.test(x))) throw new Error('data/removed.json: expected a list of ids');
  return [...list].sort();
}

/** The data folder's logo for an id, if there is one. */
export const dataLogo = (id: string): string | null => {
  const d = dataDir();
  const file = d && join(d, 'logos', `${checked(id)}.svg`);
  return file && existsSync(file) ? file : null;
};

const repoHas = (id: string) => existsSync(join(REPO, 'catalog', 'services', `${id}.json`));

function setRemoved(list: string[]): void {
  const unique = [...new Set(list)].sort();
  const file = join(writable(), 'removed.json');
  if (unique.length) atomic(file, JSON.stringify(unique, null, 2) + '\n');
  else rmSync(file, { force: true });
}

function writeLogo(id: string, svg: string | undefined): void {
  if (svg !== undefined) atomic(join(writable(), 'logos', `${id}.svg`), svg);
}

/** Save a service (new, or a default changed); its logo too when given. */
export function saveService(spec: ServiceSpec, logoSvg?: string): void {
  writable();
  const s = validateSpec(spec);
  const id = checked(s.id);
  writeLogo(id, logoSvg);
  atomic(join(writable(), 'services', `${id}.json`), JSON.stringify(ordered(s, SPEC_KEYS), null, 2) + '\n');
  setRemoved(loadRemoved().filter((x) => x !== id));
}

export function saveMachine(spec: MachineSpec, logoSvg?: string): void {
  const m = validateMachine(spec);
  const id = checked(m.id);
  writeLogo(id, logoSvg);
  atomic(join(writable(), 'machines', `${id}.json`), JSON.stringify(ordered(m, MACHINE_KEYS), null, 2) + '\n');
}

/** Take a service or machine away: its files, its logo and its place; a default service is hidden. */
export function removeItem(kind: 'service' | 'machine', id: string): void {
  checked(id);
  const d = writable();
  rmSync(join(d, kind === 'service' ? 'services' : 'machines', `${id}.json`), { force: true });
  rmSync(join(d, 'logos', `${id}.svg`), { force: true });
  savePlace(id, null);
  if (kind === 'service' && repoHas(id)) setRemoved([...loadRemoved(), id]);
}

/** Set (or, with null, forget) where an item stands. */
export function savePlace(id: string, place: Place | null): void {
  checked(id);
  const all = loadPlaces();
  if (place) all[id] = validatePlace(place, `places.${id}`);
  else delete all[id];
  const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]));
  const file = join(writable(), 'places.json');
  if (Object.keys(sorted).length || existsSync(file)) atomic(file, JSON.stringify(sorted, null, 2) + '\n');
}
