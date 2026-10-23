// The designs saved in this browser (localStorage): read by the Atelier and by
// the map, which links a service to one of them. Kept apart from library.ts so
// the map does not carry the house's catalogue to read them.

import { validateSpec } from '../../src/catalog/service.ts';
import type { Design } from '../../src/catalog/design.ts';

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

