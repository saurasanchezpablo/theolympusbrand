// A saved design: a service definition plus what the catalogue keeps beside it
// (the logo's SVG source) and its history. This is what the web app stores and
// what its .json files contain; a plain catalogue file (catalog/services/*.json)
// is accepted too, so designs move freely between the app and the repository.

import { validateSpec, SPEC_KEYS, type ServiceSpec } from './service.ts';

export type Design = {
  spec: ServiceSpec;
  /** SVG source of the app logo for the fine logo slot, if any. */
  logoSvg?: string;
  /** Increments on every save. */
  version: number;
  created: string;
  updated: string;
};

export const DESIGN_FORMAT = 'the-olympus/design';
export const LIBRARY_FORMAT = 'the-olympus/library';
const FORMAT_VERSION = 1;

/** A design's spec as it is stored: `logo` points at the catalogue's copy of the logo. */
function storedSpec(d: Design): ServiceSpec {
  const { logo: _, ...spec } = d.spec;
  return d.logoSvg ? { ...spec, logo: `logos/${spec.id}.svg` } : spec;
}

export function designFile(d: Design): string {
  return JSON.stringify({ format: DESIGN_FORMAT, formatVersion: FORMAT_VERSION, design: { ...d, spec: storedSpec(d) } }, null, 2) + '\n';
}

export function libraryFile(designs: Design[], exported: string): string {
  return JSON.stringify({ format: LIBRARY_FORMAT, formatVersion: FORMAT_VERSION, exported, designs: designs.map((d) => ({ ...d, spec: storedSpec(d) })) }, null, 2) + '\n';
}

/** The catalogue file for the repository (catalog/services/<id>.json), keys in the CLI's order. */
export function catalogFile(d: Design): string {
  const spec = storedSpec(d);
  return JSON.stringify(Object.fromEntries(SPEC_KEYS.filter((k) => spec[k] !== undefined).map((k) => [k, spec[k]])), null, 2) + '\n';
}

function asDesign(raw: unknown, where: string, now: string): Design {
  const o = (raw ?? {}) as Partial<Design> & Record<string, unknown>;
  if (typeof o !== 'object' || !('spec' in o)) throw new Error(`${where}: not a design`);
  const spec = validateSpec(o.spec, where);
  if (o.logoSvg !== undefined && typeof o.logoSvg !== 'string') throw new Error(`${where}: "logoSvg" must be SVG text`);
  // A logo path without its SVG cannot be used here; keep the design, drop the reference.
  const { logo: _, ...rest } = spec;
  return {
    spec: o.logoSvg ? { ...rest, logo: `logos/${spec.id}.svg` } : rest,
    logoSvg: o.logoSvg,
    version: Number.isInteger(o.version) && (o.version as number) > 0 ? (o.version as number) : 1,
    created: typeof o.created === 'string' ? o.created : now,
    updated: typeof o.updated === 'string' ? o.updated : now,
  };
}

/**
 * Read any of: a design file, a library file, a catalogue service file, or a
 * JSON array of catalogue service files. Throws with a readable message.
 */
export function parseDesigns(text: string, now: string): Design[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const o = raw as Record<string, unknown>;
  if (o && o.format === DESIGN_FORMAT) return [asDesign(o.design, 'design', now)];
  if (o && o.format === LIBRARY_FORMAT) {
    if (!Array.isArray(o.designs)) throw new Error('library: "designs" must be a list');
    return o.designs.map((d, i) => asDesign(d, `design ${i + 1}`, now));
  }
  const specs = Array.isArray(raw) ? raw : [raw];
  return specs.map((s, i) => asDesign({ spec: s }, specs.length > 1 ? `service ${i + 1}` : 'service', now));
}
