// The variant library: the house catalogue (read-only, bundled from catalog/)
// and the designs saved in this browser (localStorage, with JSON export/import
// so nothing is ever trapped here).

import { validateSpec, type ServiceSpec } from '../../src/catalog/service.ts';
import type { Design } from '../../src/catalog/design.ts';

/* ---------------------------------------------------------------- */
/* House catalogue — the repository's catalog/, bundled at build      */
/* ---------------------------------------------------------------- */

const specFiles = import.meta.glob<ServiceSpec>('../../catalog/services/*.json', { eager: true, import: 'default' });
const logoFiles = import.meta.glob<string>('../../catalog/logos/*.svg', { eager: true, query: '?raw', import: 'default' });

export const HOUSE: Design[] = Object.entries(specFiles)
  .map(([path, raw]) => {
    const spec = validateSpec(raw, path);
    const logoSvg = spec.logo ? logoFiles[`../../catalog/${spec.logo}`] : undefined;
    return { spec, logoSvg, version: 1, created: '', updated: '' };
  })
  .sort((a, b) => a.spec.name.localeCompare(b.spec.name));

/* ---------------------------------------------------------------- */
/* My designs — this browser only                                     */
/* ---------------------------------------------------------------- */

const KEY = 'the-olympus/library/v1';

export type Saved = Record<string, Design>;

export type Storage = { designs: Saved; available: boolean };

/** Read the saved library. Storage can be unavailable (private windows, blocked site data). */
export function loadLibrary(): Storage {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as { designs?: Saved }) : {};
    const designs: Saved = {};
    for (const [k, d] of Object.entries(parsed.designs ?? {})) {
      try {
        designs[k] = { ...d, spec: validateSpec(d.spec, k) };
      } catch {
        /* skip a damaged entry rather than lose the whole library */
      }
    }
    return { designs, available: true };
  } catch {
    return { designs: {}, available: false };
  }
}

/** Persist the library; returns false when the browser refuses (quota, privacy mode). */
export function saveLibrary(designs: Saved): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ designs }));
    return true;
  } catch {
    return false;
  }
}

export const newKey = (): string => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export const nowIso = (): string => new Date().toISOString();
