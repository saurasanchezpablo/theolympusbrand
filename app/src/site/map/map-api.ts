// The map page's link to the server: the map itself (live from the edit
// service when it runs, else the list built with the site), the session, and
// the writes — each sent with the page's token.

import type { MapData } from '../../../../src/map/items.ts';
import type { CityPlan } from '../../../../src/map/city.ts';
import type { ServiceSpec } from '../../../../src/catalog/service.ts';
import type { MachineSpec } from '../../../../src/catalog/machine.ts';
import type { Place } from '../../../../src/map/places.ts';
import { fileUrl } from '../files.ts';

export type Session = { editing: boolean; csrf?: string; setup?: string };
/** What the server's builds are doing; `published` is the last saved change the served site includes. */
export type Build = { state: 'static' | 'starting' | 'building' | 'ok' | 'failed'; at?: string; error?: string; requested?: number; published?: number };

const json = async <T>(r: Response): Promise<T> => {
  if (!r.ok) {
    let message = `${r.status}`;
    try {
      message = ((await r.json()) as { error?: string }).error ?? message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  return (await r.json()) as T;
};

/** The map: live when the edit service answers, otherwise as the site was built. */
export async function loadMap(): Promise<{ data: MapData; live: boolean }> {
  try {
    // Never wait long for a service that may not be there: the built list is always at hand.
    const r = await fetch('api/map', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) {
      const d = (await r.json()) as MapData | { editor: false };
      if ('items' in d) return { data: d, live: true };
    }
  } catch {
    /* no edit service: the built list */
  }
  return { data: await json<MapData>(await fetch(fileUrl('assets/map/items.json'), { cache: 'no-cache' })), live: false };
}

export async function loadTerrain(): Promise<ArrayBuffer> {
  const r = await fetch(fileUrl('assets/map/terrain.bin'));
  if (!r.ok) throw new Error(`the island could not be loaded (${r.status})`);
  return r.arrayBuffer();
}

/** The city planned on the island: streets, plots, squares, walkways, furniture. */
export async function loadCity(): Promise<CityPlan> {
  const r = await fetch(fileUrl('assets/map/city.json'));
  if (!r.ok) throw new Error(`the city could not be loaded (${r.status})`);
  return (await r.json()) as CityPlan;
}

export async function buildState(): Promise<Build | null> {
  try {
    const r = await fetch('build.json', { cache: 'no-store' });
    return r.ok ? ((await r.json()) as Build) : null;
  } catch {
    return null;
  }
}

let csrf = '';
export async function session(): Promise<Session> {
  const s = await json<Session & { editor?: false }>(await fetch('api/session', { cache: 'no-store', signal: AbortSignal.timeout(4000) }));
  csrf = s.csrf ?? '';
  return s.editor === false ? { editing: false } : s;
}
export async function login(password: string): Promise<void> {
  const r = await json<{ csrf: string }>(await fetch('api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) }));
  csrf = r.csrf;
}
/** A write; its answer carries the change's number when the server rebuilds the site for it (none: nothing to publish). */
const write = async (method: 'PUT' | 'DELETE' | 'POST', path: string, body?: unknown): Promise<number | undefined> => {
  const r = await json<{ change?: number }>(
    await fetch(path, { method, headers: { 'content-type': 'application/json', 'x-olympus-csrf': csrf }, body: body === undefined ? undefined : JSON.stringify(body) }),
  );
  if (typeof r.change === 'number') latest = Math.max(latest, r.change);
  return typeof r.change === 'number' ? r.change : undefined;
};
let latest = 0;
/** The number of the last change this page saved (0: none yet). */
export const lastChange = () => latest;
export const logout = async () => void (await write('POST', 'api/logout', {}));
export const saveService = (spec: ServiceSpec, logoSvg?: string) => write('PUT', `api/services/${encodeURIComponent(spec.id)}`, { spec, logoSvg });
export const saveMachine = (spec: MachineSpec, logoSvg?: string) => write('PUT', `api/machines/${encodeURIComponent(spec.id)}`, { spec, logoSvg });
export const removeItem = (kind: 'service' | 'machine', id: string) => write('DELETE', `api/${kind === 'service' ? 'services' : 'machines'}/${encodeURIComponent(id)}`);
export const savePlace = (id: string, place: Place | null) => write('PUT', `api/places/${encodeURIComponent(id)}`, { place });
