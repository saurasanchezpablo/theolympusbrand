// The variant library: the house catalogue (read-only, bundled from catalog/)
// and the designs saved in this browser (localStorage, with JSON export/import
// so nothing is ever trapped here).

import { useEffect, useState } from 'react';
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
/* The server's own catalogue, when the map's edit service runs: the  */
/* services added on the map join the house here too.                 */
/* ---------------------------------------------------------------- */

const houseListeners = new Set<() => void>();
let serverHouse: Promise<void> | null = null;

function loadServerHouse(): Promise<void> {
  serverHouse ??= fetch('api/catalog', { cache: 'no-store', signal: AbortSignal.timeout(4000) })
    .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
    .then((c: { services?: unknown[]; logos?: Record<string, string> } | null) => {
      if (!c?.services) return;
      const designs: Design[] = [];
      for (const raw of c.services) {
        try {
          const spec = validateSpec(raw, 'the server');
          designs.push({ spec, logoSvg: spec.logo ? c.logos?.[spec.id] : undefined, version: 1, created: '', updated: '' });
        } catch {
          /* one damaged entry does not hide the rest */
        }
      }
      HOUSE.splice(0, HOUSE.length, ...designs.sort((a, b) => a.spec.name.localeCompare(b.spec.name)));
      for (const f of houseListeners) f();
    })
    .catch(() => undefined);
  return serverHouse;
}

/** The house catalogue, refreshed from the server when it has one. */
export function useHouse(): Design[] {
  const [house, setHouse] = useState<Design[]>(() => [...HOUSE]);
  useEffect(() => {
    const f = () => setHouse([...HOUSE]);
    houseListeners.add(f);
    void loadServerHouse().then(f);
    return () => {
      houseListeners.delete(f);
    };
  }, []);
  return house;
}

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
