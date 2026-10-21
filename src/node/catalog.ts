// Node host for the catalogue: read, validate and write service files.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve as resolvePath, sep } from 'node:path';
import { validateSpec, resolve, SPEC_KEYS, type Service, type ServiceSpec } from '../catalog/service.ts';
import { importLogo } from '../geometry/logo.ts';
import { dataDir, dataLogo, dataServices, loadRemoved } from './data.ts';

export const CATALOG_DIR = new URL('../../catalog/', import.meta.url).pathname;
export const SERVICES_DIR = join(CATALOG_DIR, 'services');

export function loadCatalog(dir = SERVICES_DIR): Service[] {
  const repo = !existsSync(dir)
    ? []
    : readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => {
          const spec = validateSpec(JSON.parse(readFileSync(join(dir, f), 'utf8')), `catalog/services/${f}`);
          if (`${spec.id}.json` !== f) throw new Error(`catalog/services/${f}: "id" is "${spec.id}" but the file is named ${basename(f)}`);
          return spec;
        });
  // The server's own data is laid over the repository's catalogue (only over the real one, not a folder a tool names).
  const own = dir === SERVICES_DIR ? dataServices() : [];
  const removed = new Set(dir === SERVICES_DIR ? loadRemoved() : []);
  const byId = new Map(repo.filter((s) => !removed.has(s.id)).map((s) => [s.id, s]));
  for (const s of own) byId.set(s.id, s);
  return [...byId.values()]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((spec) => {
      if (spec.logo && !logoFile(spec)) throw new Error(`${spec.id}: logo ${spec.logo} not found in the data folder or catalog/`);
      return resolve(spec);
    });
}

/** Where a service's logo is: the data folder's own first, then the repository's. */
function logoFile(spec: Pick<ServiceSpec, 'id' | 'logo'>): string | null {
  if (!spec.logo) return null;
  const own = spec.logo === `logos/${spec.id}.svg` ? dataLogo(spec.id) : null;
  if (own) return own;
  const file = resolvePath(CATALOG_DIR, spec.logo);
  return existsSync(file) ? file : null;
}

export function writeSpec(spec: ServiceSpec, dir = SERVICES_DIR): string {
  mkdirSync(dir, { recursive: true });
  const ordered = Object.fromEntries(SPEC_KEYS.filter((k) => spec[k] !== undefined).map((k) => [k, spec[k]]));
  const file = join(dir, `${spec.id}.json`);
  writeFileSync(file, JSON.stringify(ordered, null, 2) + '\n');
  return file;
}

/** The service's imported logo (path data), if it has one. */
export function logoOf(service: Service): { d: string; warnings: string[] } | null {
  if (!service.logo) return null;
  // Only files inside the data folder's logos/ or catalog/logos/, and of a size a logo has.
  const file = logoFile(service);
  if (!file) throw new Error(`${service.id}: logo ${service.logo} not found`);
  if (!file.startsWith(resolvePath(CATALOG_DIR, 'logos') + sep) && !(dataDir() && file.startsWith(resolvePath(dataDir()!, 'logos') + sep))) throw new Error(`${service.id}: logo ${service.logo} is outside the logo folders`);
  const svg = readFileSync(file, 'utf8');
  if (svg.length > LOGO_MAX_BYTES) throw new Error(`${service.id}: logo ${service.logo} is larger than ${LOGO_MAX_BYTES / 1024} KB`);
  return importLogo(svg);
}

/** A logo is a few shapes; anything much larger is not one. */
export const LOGO_MAX_BYTES = 512 * 1024;
