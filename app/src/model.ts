// What the app edits and how it is turned into marks. Everything visual comes
// from ../src — the same functions the command line uses.

import { crest, emblem, seal, type Mark } from '../../src/geometry/crest.ts';
import { importLogo } from '../../src/geometry/logo.ts';
import { missingGlyphs } from '../../src/geometry/fonts.ts';
import { GODS, CATEGORIES, type Category, type GodId, type Patron } from '../../src/geometry/pantheon.ts';
import { resolve, validateSpec, slugify, withLogo, type Service, type ServiceSpec } from '../../src/catalog/service.ts';
import { baseMarks, lockups, type MarkKey } from '../../src/catalog/fileset.ts';
import { checkPrint, type PrintReport } from '../../src/print/service.ts';
import type { Design } from '../../src/catalog/design.ts';

export type Origin = { kind: 'new' } | { kind: 'house'; id: string } | { kind: 'mine'; key: string };

/** The design being edited. `autoId` keeps the id in step with the name until it is edited by hand. */
export type Draft = { spec: ServiceSpec; logoSvg?: string; origin: Origin; autoId: boolean };

export const newDraft = (category: Category = 'cloud'): Draft => ({
  spec: { id: 'new-service', name: 'New Service', category },
  origin: { kind: 'new' },
  autoId: true,
});

export const draftOf = (d: Design, origin: Origin): Draft => ({
  spec: { ...d.spec },
  logoSvg: d.logoSvg,
  origin,
  autoId: d.spec.id === slugify(d.spec.name),
});

/** Field-level problems, worded for the form. */
export function specIssues(spec: ServiceSpec): string[] {
  try {
    validateSpec(spec, 'design');
    return [];
  } catch (e) {
    return (e as Error).message.split('\n').slice(1).map((l) => l.replace(/^\s*-\s*/, ''));
  }
}

/** A spec that always renders, even mid-edit (empty name, half-typed caption); with its logo as patron when it asks for it and has one. */
export function renderableService(spec: ServiceSpec, logoSvg?: string): Service {
  const s = resolve({ ...spec, name: spec.name.trim() || 'Untitled', caption: spec.caption?.trim() || undefined, monogram: /^[A-Za-z0-9]$/.test(spec.monogram ?? '') ? spec.monogram : undefined });
  return spec.god === 'logo' ? withLogo(s, logoPath(logoSvg)) : s;
}

const logoPaths = new Map<string, string | undefined>();
/** A logo SVG's path data, imported once per file (undefined when it has none, or cannot be read). */
export function logoPath(svg: string | undefined): string | undefined {
  if (!svg) return undefined;
  if (!logoPaths.has(svg)) {
    if (logoPaths.size > 64) logoPaths.clear();
    const l = readLogo(svg);
    logoPaths.set(svg, l && 'd' in l ? l.d : undefined);
  }
  return logoPaths.get(svg);
}

/** A short key for a logo's drawing (FNV-1a), so memoised marks are told apart without keeping the path as the key. */
const hashOf = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + s.length.toString(36);
};
export const patronKey = (p: Patron) => ('god' in p ? p.god : 'monogram' in p ? `monogram-${p.monogram}` : `logo-${hashOf(p.logo)}-${p.letter}`);
export const patronLabel = (p: Patron) => ('god' in p ? title(GODS[p.god].name) : 'monogram' in p ? `Monogram ${p.monogram}` : 'Its own logo');
export const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export type Logo = { d: string; warnings: string[] } | { error: string } | null;

export function readLogo(svg: string | undefined): Logo {
  if (!svg) return null;
  try {
    return importLogo(svg);
  } catch (e) {
    return { error: (e as Error).message.replace(/^importLogo: /, '') };
  }
}

/* ---------------------------------------------------------------- */
/* Memoised generation: crests depend only on the patron and logo,   */
/* lockups also on the name and caption.                             */
/* ---------------------------------------------------------------- */

const cache = new Map<string, unknown>();
function memo<T>(key: string, make: () => T): T {
  if (!cache.has(key)) {
    if (cache.size > 400) cache.clear();
    cache.set(key, make());
  }
  return cache.get(key) as T;
}

export function marksFor(service: Service, logoD?: string): Record<MarkKey, Mark> {
  const key = `${patronKey(service.patron)}|${logoD ?? ''}`;
  const base = memo(`base:${key}`, () => baseMarks(service.patron, logoD));
  return { ...base, ...memo(`lockups:${key}|${service.name}|${service.caption}`, () => lockups(base['crest-fine'], service)) };
}

export const printFor = (patron: Patron): PrintReport => memo(`print:${patronKey(patron)}`, () => checkPrint(patron));

export const sealFor = (patron: Patron): Mark => memo(`seal:${patronKey(patron)}`, () => seal({ patron }));

/** The master itself: Zeus, read-only. */
export const MASTER = {
  marks: () =>
    memo('master', () => ({
      'crest-fine': crest(),
      'crest-print': crest({ detail: 'print' }),
      'emblem-fine': emblem(),
      'emblem-print': emblem({ detail: 'print' }),
      seal: seal(),
    })),
};

/** Lettering the brand typefaces cannot draw. */
export function letteringIssues(service: Service): string[] {
  const out: string[] = [];
  const name = missingGlyphs(service.name.toUpperCase(), 'inscription');
  if (name.length) out.push(`The name uses characters Cinzel cannot draw: ${name.join(' ')}`);
  const cap = missingGlyphs(service.caption.toUpperCase(), 'companion');
  if (cap.length) out.push(`The caption uses characters Jost cannot draw: ${cap.join(' ')}`);
  return out;
}

export const GOD_LIST = (Object.values(GODS) as (typeof GODS)[GodId][]).filter((g) => g.id !== 'zeus');
export const CATEGORY_LIST = Object.entries(CATEGORIES) as [Category, string][];
export const defaultGodOf = (c: Category) => GOD_LIST.find((g) => g.categories.includes(c))?.id;

