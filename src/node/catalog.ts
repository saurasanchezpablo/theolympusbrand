// Node host for the catalogue: read, validate and write service files.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve as resolvePath, sep } from 'node:path';
import { validateSpec, resolve, SPEC_KEYS, type Service, type ServiceSpec } from '../catalog/service.ts';
import { importLogo } from '../geometry/logo.ts';

export const CATALOG_DIR = new URL('../../catalog/', import.meta.url).pathname;
export const SERVICES_DIR = join(CATALOG_DIR, 'services');

export function loadCatalog(dir = SERVICES_DIR): Service[] {
  if (!existsSync(dir)) return [];
  const services = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const spec = validateSpec(JSON.parse(readFileSync(join(dir, f), 'utf8')), `catalog/services/${f}`);
      if (`${spec.id}.json` !== f) throw new Error(`catalog/services/${f}: "id" is "${spec.id}" but the file is named ${basename(f)}`);
      if (spec.logo && !existsSync(join(CATALOG_DIR, spec.logo))) throw new Error(`catalog/services/${f}: logo ${spec.logo} not found in catalog/`);
      return resolve(spec);
    });
  return services;
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
  // Only files inside catalog/logos/, and of a size a logo has.
  const file = resolvePath(CATALOG_DIR, service.logo);
  if (!file.startsWith(resolvePath(CATALOG_DIR, 'logos') + sep)) throw new Error(`${service.id}: logo ${service.logo} is outside catalog/logos/`);
  const svg = readFileSync(file, 'utf8');
  if (svg.length > LOGO_MAX_BYTES) throw new Error(`${service.id}: logo ${service.logo} is larger than ${LOGO_MAX_BYTES / 1024} KB`);
  return importLogo(svg);
}

/** A logo is a few shapes; anything much larger is not one. */
export const LOGO_MAX_BYTES = 512 * 1024;
