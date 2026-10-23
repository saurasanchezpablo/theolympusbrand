// Editing the map, with the house's password: add a building for a service or
// a machine, set it down where it may stand, fill in its card, give a service
// one of this browser's Atelier designs as its identity; move, turn, change or
// remove what is there; undo. Every change is saved on the server
// at once, and the page says when the house has been rebuilt for it.

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import type { MapData, MapEntry } from '../../../../src/map/items.ts';
import type { Place } from '../../../../src/map/places.ts';
import { DESIGN_LINK, type ServiceSpec } from '../../../../src/catalog/service.ts';
import type { Design } from '../../../../src/catalog/design.ts';
import { loadLibrary } from '../../designs.ts';
import type { MachineSpec } from '../../../../src/catalog/machine.ts';
import { CATEGORIES } from '../../../../src/catalog/categories.ts';
import { building } from '../../../../src/map/buildings/index.ts';
import { machineSpecOf } from '../../../../src/map/items.ts';
import { BuildingPicker } from './BuildingPicker.tsx';
import * as api from './map-api.ts';
import type { MapScene } from './map-scene.ts';

const WHY: Record<string, string> = { 'no-plot': 'Choose a plot beside a street', taken: 'Another building stands here', 'too-big': 'Too big for this plot — try a whole block' };
// A building turns a quarter at a time: to its street, or to the streets beside.
const TURN = Math.PI / 2;
const slug = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const norm = (r: number) => ((r % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

/** The service a design makes for a building: the design's identity, under the building's id; an address and notes the design lacks are kept. */
export function linkedSpec(id: string, key: string, d: Design, old: ServiceSpec | null): ServiceSpec {
  const ds = d.spec;
  const spec: Record<string, unknown> = {
    id,
    name: ds.name,
    category: ds.category,
    god: ds.god,
    monogram: ds.monogram,
    caption: ds.caption,
    logo: d.logoSvg ? `logos/${id}.svg` : undefined,
    url: ds.url ?? old?.url,
    app: ds.app ?? old?.app,
    description: ds.description || old?.description,
    design: `${key}@${d.version}`,
  };
  return Object.fromEntries(Object.entries(spec).filter(([, v]) => v !== undefined && v !== '')) as ServiceSpec;
}

/** What this browser knows of a service's linked design: none, one it does not have, or one it has (newer or not). */
function linkState(e: MapEntry): { key: string; version: number; design: Design | null } | null {
  const m = e.design?.match(DESIGN_LINK);
  if (!m) return null;
  return { key: m[1], version: Number(m[2]), design: loadLibrary().designs[m[1]] ?? null };
}

type Draft = { kind: 'service' | 'machine'; id?: string; place: Place; fields: Record<string, string>; logoSvg?: string; logoName?: string };
type Step = { label: string; undo: () => Promise<unknown>; redo: () => Promise<unknown> };

type ServerCatalog = { services: ServiceSpec[]; logos: Record<string, string> };
let catalogCache: Promise<ServerCatalog> | null = null;
const serverCatalog = (): Promise<ServerCatalog> => (catalogCache ??= fetch('api/catalog', { cache: 'no-store' }).then((r) => r.json() as Promise<ServerCatalog>));

export type MapEditor = {
  tools: ReactNode;
  overlay: ReactNode;
  cardActions: (e: MapEntry) => ReactNode;
  pointerDown: (e: React.PointerEvent) => void;
  pointerMove: (e: React.PointerEvent) => void;
  /** True when the editor took the click. */
  pointerUp: (e: React.PointerEvent) => boolean;
  busy: boolean;
};

export function useMapEditor({ live, data, scene, selected, onSelect, reload }: { live: boolean; data: MapData | null; scene: MutableRefObject<MapScene | null>; selected: MapEntry | null; onSelect: (id: string | null) => void; reload: () => Promise<MapData> }): MapEditor {
  const [session, setSession] = useState<api.Session | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [picking, setPicking] = useState<null | { mode: 'add' | 'swap'; kind: 'service' | 'machine' }>(null);
  const [placing, setPlacing] = useState<null | { type: string; kind: 'service' | 'machine'; rotation: number }>(null);
  const [verdict, setVerdict] = useState<string>('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [linking, setLinking] = useState<MapEntry | null>(null);
  const [rebuild, setRebuild] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const undo = useRef<Step[]>([]);
  const redo = useRef<Step[]>([]);
  const drag = useRef<null | { id: string; type: string; rotation: number; ok: boolean; at: { x: number; z: number; rotation?: number } | null }>(null);
  const placeAt = useRef<{ x: number; z: number } | null>(null);
  const editing = !!session?.editing;

  useEffect(() => {
    if (live) api.session().then(setSession, () => setSession(null));
  }, [live]);

  /** A saved change is on the server at once; the site shows it when a build that includes it is published. Say which, truthfully. */
  const watchBuild = useCallback((what: string, change: number) => {
    const since = Date.now();
    setRebuild(`${what}: saved on the server, publishing…`);
    const look = async () => {
      const b = await api.buildState();
      if (!b || b.state === 'static' || typeof b.published !== 'number') return setRebuild(`${what}: saved.`);
      if (b.published >= change) return setRebuild(`${what}: saved and published.`);
      if (b.state === 'failed')
        return setRebuild(`${what}: saved on the server, but the site could not be rebuilt (${b.error?.split('\n')[0] ?? 'see the server’s log'}). The published site is unchanged.`);
      if (Date.now() - since < 10 * 60_000) window.setTimeout(look, 1500);
      else setRebuild(`${what}: saved on the server; the site is still being rebuilt.`);
    };
    window.setTimeout(look, 1000);
  }, []);

  const run = useCallback(
    async (step: Step, what: string) => {
      setBusy(true);
      setMessage(null);
      const before = api.lastChange();
      try {
        await step.redo();
        undo.current.push(step);
        redo.current = [];
        catalogCache = null;
        await reload();
        if (api.lastChange() > before) watchBuild(what, api.lastChange());
        else setRebuild(`${what}.`);
      } catch (e) {
        setMessage((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [reload, watchBuild],
  );

  const back = useCallback(async () => {
    const step = undo.current.pop();
    if (!step) return;
    setBusy(true);
    const before = api.lastChange();
    try {
      await step.undo();
      redo.current.push(step);
      catalogCache = null;
      await reload();
      if (api.lastChange() > before) watchBuild(`Undone: ${step.label}`, api.lastChange());
      else setRebuild(`Undone: ${step.label}.`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [reload, watchBuild]);
  const forward = useCallback(async () => {
    const step = redo.current.pop();
    if (!step) return;
    setBusy(true);
    const before = api.lastChange();
    try {
      await step.redo();
      undo.current.push(step);
      catalogCache = null;
      await reload();
      if (api.lastChange() > before) watchBuild(`Done again: ${step.label}`, api.lastChange());
      else setRebuild(`Done again: ${step.label}.`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [reload, watchBuild]);

  // Keys: Escape stops placing; R turns what is being placed; Ctrl+Z / Ctrl+Shift+Z outside text fields.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName);
      if (e.key === 'Escape' && placing) {
        setPlacing(null);
        scene.current?.ghost(null);
      } else if ((e.key === 'r' || e.key === 'R') && placing && !inField) {
        setPlacing({ ...placing, rotation: norm(placing.rotation + (e.shiftKey ? -TURN : TURN)) });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inField) {
        e.preventDefault();
        void (e.shiftKey ? forward() : back());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, placing, back, forward, scene]);

  const placeStep = (id: string, before: Place | null, after: Place | null, label: string): Step => ({ label, redo: () => api.savePlace(id, after), undo: () => api.savePlace(id, before) });

  /** The full spec of an item as the server keeps it (a service's from the catalogue, a machine's from the map). */
  const specOf = async (e: MapEntry): Promise<{ spec: ServiceSpec | MachineSpec; logoSvg?: string }> => {
    if (e.kind === 'machine') {
      const logoSvg = e.logo ? await fetch(e.logo).then((r) => (r.ok ? r.text() : undefined)) : undefined;
      return { spec: machineSpecOf(e), logoSvg };
    }
    const cat = await serverCatalog();
    const spec = cat.services.find((s: ServiceSpec) => s.id === e.id);
    if (!spec) throw new Error(`${e.name} is not in the catalogue any more`);
    return { spec, logoSvg: cat.logos[e.id] };
  };

  const save = async () => {
    if (!draft || !data) return;
    const f = draft.fields;
    const name = (f.name ?? '').trim();
    if (!name) return setMessage('Give it a name.');
    let id = draft.id;
    if (!id) {
      const root = slug(name) || draft.kind;
      id = root;
      for (let n = 2; data.items.some((x) => x.id === id); n++) id = `${root}-${n}`;
    }
    const pick = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, f[k]?.trim()]).filter(([, v]) => v));
    let spec: ServiceSpec | MachineSpec;
    let previous: { spec: ServiceSpec | MachineSpec; logoSvg?: string } | null = null;
    if (draft.id) previous = await specOf(data.items.find((x) => x.id === draft.id)!);
    if (draft.kind === 'service') {
      const old = (previous?.spec ?? {}) as ServiceSpec;
      const rest = Object.fromEntries(Object.entries(old).filter(([k]) => !['name', 'category', 'url', 'description'].includes(k)));
      spec = { ...rest, id, ...pick(['name', 'category', 'url', 'description']) } as ServiceSpec;
    } else {
      spec = { ...((previous?.spec as MachineSpec)?.logo ? { logo: (previous!.spec as MachineSpec).logo } : {}), id, ...pick(['name', 'ip', 'hostname', 'os', 'role', 'description']) } as MachineSpec;
    }
    const kind = draft.kind;
    const writeSpec = (s: ServiceSpec | MachineSpec, logo?: string) => (kind === 'service' ? api.saveService(s as ServiceSpec, logo) : api.saveMachine(s as MachineSpec, logo));
    const isNew = !draft.id;
    const place = draft.place;
    const theId = id;
    const step: Step = {
      label: isNew ? `${name} added` : `${name} changed`,
      redo: async () => {
        await writeSpec(spec, draft.logoSvg);
        if (isNew) await api.savePlace(theId, place);
      },
      undo: async () => {
        if (isNew) {
          await api.removeItem(kind, theId);
        } else if (previous) await writeSpec(previous.spec, previous.logoSvg);
      },
    };
    await run(step, isNew ? `${name} is on the map` : `${name} is saved`);
    setDraft(null);
    onSelect(theId);
  };

  /** Give a service a design from this browser's Atelier: its name, patron, logo and caption become the service's, and the house is rebuilt for it. */
  const link = async (e: MapEntry, key: string, d: Design) => {
    let before: { spec: ServiceSpec | MachineSpec; logoSvg?: string };
    try {
      before = await specOf(e);
    } catch (err) {
      return setMessage((err as Error).message);
    }
    const spec = linkedSpec(e.id, key, d, before.spec as ServiceSpec);
    setLinking(null);
    await run(
      { label: `${e.name} given the design ${d.spec.name}`, redo: () => api.saveService(spec, d.logoSvg), undo: () => api.saveService(before.spec as ServiceSpec, before.logoSvg) },
      `${spec.name} wears its design (version ${d.version})`,
    );
  };

  const remove = async (e: MapEntry) => {
    if (!window.confirm(`Take ${e.name} off the map? Its files go with it (Undo brings it back).`)) return;
    const before = await specOf(e);
    const place = e.placed === 'owner' ? e.place : null;
    onSelect(null);
    await run(
      {
        label: `${e.name} removed`,
        redo: () => api.removeItem(e.kind, e.id),
        undo: async () => {
          if (e.kind === 'service') await api.saveService(before.spec as ServiceSpec, before.logoSvg);
          else await api.saveMachine(before.spec as MachineSpec, before.logoSvg);
          if (place) await api.savePlace(e.id, place);
        },
      },
      `${e.name} is off the map`,
    );
  };

  const turn = (e: MapEntry, by: number) => {
    const after = { ...e.place, rotation: norm(e.place.rotation + by) };
    void run(placeStep(e.id, e.placed === 'owner' ? e.place : null, after, `${e.name} turned`), `${e.name} is turned`);
  };

  // ---- the pointer on the map ----
  const pointerDown = (ev: React.PointerEvent) => {
    if (!editing || placing || ev.button !== 0 || !selected) return;
    const id = scene.current?.pick(ev.clientX, ev.clientY);
    if (id !== selected.id) return;
    drag.current = { id, type: selected.place.building, rotation: selected.place.rotation, ok: false, at: null };
    scene.current?.setPanning(false);
  };
  const pointerMove = (ev: React.PointerEvent) => {
    const s = scene.current;
    if (!s) return;
    const ghostAt = (type: string, rotation: number, except?: string) => {
      const at = s.groundAt(ev.clientX, ev.clientY);
      if (!at) {
        s.ghost(null);
        setVerdict('Off the island');
        return { ok: false, at: null, pointer: null };
      }
      const v = s.ghost(type, { ...at, rotation }, except);
      setVerdict(v && !v.ok ? WHY[v.why] : '');
      // Where it would stand: snapped to the plot, turned to its street.
      return { ok: !!v?.ok, at: v?.ok ? v.place : null, pointer: at };
    };
    if (placing) placeAt.current = ghostAt(placing.type, placing.rotation).pointer;
    else if (drag.current) {
      const r = ghostAt(drag.current.type, drag.current.rotation, drag.current.id);
      drag.current.ok = r.ok;
      drag.current.at = r.at;
    }
  };
  const pointerUp = (ev: React.PointerEvent) => {
    const s = scene.current;
    if (placing) {
      const at = s?.groundAt(ev.clientX, ev.clientY);
      const v = at && s?.ghost(placing.type, { ...at, rotation: placing.rotation });
      if (!at || !v || !v.ok) return true;
      s?.ghost(null);
      setDraft({ kind: placing.kind, place: { building: placing.type, ...v.place }, fields: placing.kind === 'service' ? { category: 'other' } : {} });
      setPlacing(null);
      setVerdict('');
      return true;
    }
    if (drag.current) {
      const d = drag.current;
      drag.current = null;
      s?.setPanning(true);
      s?.ghost(null);
      setVerdict('');
      const e = data?.items.find((x) => x.id === d.id);
      if (e && d.ok && d.at) {
        const after = { ...e.place, ...d.at };
        void run(placeStep(e.id, e.placed === 'owner' ? e.place : null, after, `${e.name} moved`), `${e.name} is moved`);
      }
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (placing) scene.current?.ghost(placing.type, { ...(placeAt.current ?? { x: 0, z: 0 }), rotation: placing.rotation });
  }, [placing, scene]);

  // ---- what the editor shows ----
  const tools: ReactNode = !live ? (
    <span className="map-edit map-edit--off">
      <button type="button" className="btn btn--sm" disabled aria-describedby="map-edit-why">
        Edit
      </button>
      <span id="map-edit-why" className="map-edit__why">
        Saving needs the house’s own server (npm start), which this copy of the site is not on — <a href="#/guide/13-the-map">see the guide</a>.
      </span>
    </span>
  ) : !editing ? (
    <button type="button" className="btn btn--sm" onClick={() => setSignIn(true)}>
      Edit
    </button>
  ) : (
    <span className="map-edit">
      <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setPicking({ mode: 'add', kind: 'service' })}>
        Add
      </button>
      <button type="button" className="btn btn--ghost btn--sm" disabled={busy || !undo.current.length} onClick={() => void back()}>
        Undo
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => {
          void api.logout().finally(() => setSession({ editing: false }));
          setPlacing(null);
          setDraft(null);
        }}
      >
        Done
      </button>
    </span>
  );

  const field = (key: string, label: string, opts: { type?: string; hint?: string; required?: boolean } = {}) => (
    <label className="map-form__field">
      <span>
        {label}
        {opts.hint && <small> — {opts.hint}</small>}
      </span>
      <input
        type={opts.type ?? 'text'}
        required={opts.required}
        value={draft?.fields[key] ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          setDraft((d) => (d ? { ...d, fields: { ...d.fields, [key]: v } } : d));
        }}
      />
    </label>
  );

  const overlay: ReactNode = (
    <>
      {signIn && (
        <div className="map-dialog" role="dialog" aria-modal="true" aria-labelledby="map-signin-title">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setMessage(null);
              try {
                await api.login(password);
                setPassword('');
                setSignIn(false);
                setSession(await api.session());
              } catch (err) {
                setMessage((err as Error).message === 'wrong password' ? 'That is not the house’s password.' : (err as Error).message);
              }
            }}
          >
            <h2 id="map-signin-title">Edit the map</h2>
            <label className="map-form__field">
              <span>The house’s password</span>
              <input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {message && <p className="notes notes--error">{message}</p>}
            <div className="map-form__actions">
              <button type="submit" className="btn btn--sm">
                Sign in
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSignIn(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      {picking && (
        <BuildingPicker
          title={picking.mode === 'add' ? 'Add a building' : 'Change the building'}
          kind={picking.kind}
          category={picking.mode === 'swap' ? selected?.category : undefined}
          onKind={picking.mode === 'add' ? (k) => setPicking({ ...picking, kind: k }) : undefined}
          onClose={() => setPicking(null)}
          onPick={(type) => {
            const p = picking;
            setPicking(null);
            if (p.mode === 'add') {
              setPlacing({ type, kind: p.kind, rotation: 0 });
              onSelect(null);
            } else if (selected) {
              const after = { ...selected.place, building: type };
              void run(
                placeStep(selected.id, selected.placed === 'owner' ? selected.place : null, after, `${selected.name} rebuilt`),
                `${selected.name} stands in a ${building(type)?.name.toLowerCase()}`,
              );
            }
          }}
        />
      )}
      {placing && (
        <div className="map-placing" role="status">
          <strong>{building(placing.type)?.name}</strong>: click on the island to set it down · R turns it · Esc stops
          {verdict && <span className="map-placing__why"> · {verdict}</span>}
        </div>
      )}
      {linking && (
        <div className="map__panel map__panel--card">
          <section className="map-card map-form" aria-labelledby="map-link-title">
            <h2 id="map-link-title">A design for {linking.name}</h2>
            <p className="map-card__kind">Its name, patron, logo and caption become the service’s, here and in everything the house makes for it.</p>
            {(() => {
              const lib = loadLibrary();
              const designs = Object.entries(lib.designs).sort(([, a], [, b]) => (a.updated < b.updated ? 1 : -1));
              if (!lib.available) return <p className="notes notes--error">This browser does not let the site read its saved designs.</p>;
              if (!designs.length)
                return (
                  <p className="notes">
                    No designs are saved in this browser yet. <a href="#/atelier">Make one in the Atelier</a>, save it, and come back.
                  </p>
                );
              const current = linkState(linking);
              return (
                <ul className="map-designs">
                  {designs.map(([key, d]) => (
                    <li key={key}>
                      <button type="button" className="map-designs__pick" disabled={busy} aria-current={current?.key === key ? 'true' : undefined} onClick={() => void link(linking, key, d)}>
                        <span className="map-designs__name">{d.spec.name}</span>
                        <span className="map-designs__meta">
                          version {d.version} · {d.spec.category}
                          {current?.key === key ? ' · linked now' : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              );
            })()}
            <div className="map-form__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLinking(null)}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
      {draft && (
        <div className="map__panel map__panel--card">
          <section className="map-card map-form" aria-labelledby="map-form-title">
            <h2 id="map-form-title">{draft.id ? 'Change its card' : draft.kind === 'service' ? 'A new service' : 'A new machine'}</h2>
            <p className="map-card__kind">Standing in a {building(draft.place.building)?.name.toLowerCase()}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {field('name', 'Name', { required: true })}
              {draft.kind === 'service' ? (
                <>
                  <label className="map-form__field">
                    <span>Kind of service</span>
                    <select value={draft.fields.category ?? 'other'} onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, category: e.target.value } })}>
                      {Object.entries(CATEGORIES).map(([k, hint]) => (
                        <option key={k} value={k} title={hint}>
                          {k[0].toUpperCase() + k.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {field('url', 'Address', { type: 'url', hint: 'https://…' })}
                </>
              ) : (
                <>
                  {field('ip', 'Network address')}
                  {field('hostname', 'Host name')}
                  {field('os', 'System')}
                  {field('role', 'Role', { hint: 'a node, the NAS…' })}
                </>
              )}
              {field('description', 'About it')}
              <label className="map-form__field">
                <span>Logo{draft.logoName ? ` — ${draft.logoName}` : ''}</span>
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    setDraft((d) => (d ? { ...d, logoSvg: text, logoName: file.name } : d));
                  }}
                />
              </label>
              {message && <p className="notes notes--error">{message}</p>}
              <div className="map-form__actions">
                <button type="submit" className="btn btn--sm" disabled={busy}>
                  Save
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setDraft(null);
                    setMessage(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {(rebuild || (message && !draft && !signIn)) && (
        <p className={`map-notice${message ? ' map-notice--error' : ''}`} role="status">
          {message ?? rebuild}
          <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => (setRebuild(null), setMessage(null))}>
            ×
          </button>
        </p>
      )}
    </>
  );

  const cardActions = (e: MapEntry): ReactNode =>
    editing ? (
      <div className="map-card__actions">
        <button
          type="button"
          className="btn btn--sm"
          disabled={busy}
          onClick={async () => {
            try {
              const { spec } = await specOf(e);
              const fields = Object.fromEntries(Object.entries(spec).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
              setLinking(null);
              setDraft({ kind: e.kind, id: e.id, place: e.place, fields });
            } catch (err) {
              setMessage((err as Error).message);
            }
          }}
        >
          Change its card
        </button>
        {e.kind === 'service' && (
          <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => (setDraft(null), setLinking(e))}>
            {e.design ? 'Change its design' : 'Link a design'}
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setPicking({ mode: 'swap', kind: e.kind })}>
          Change the building
        </button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={busy} aria-label="Turn it left" onClick={() => turn(e, TURN)}>
          ⟲
        </button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={busy} aria-label="Turn it right" onClick={() => turn(e, -TURN)}>
          ⟳
        </button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void remove(e)}>
          Delete
        </button>
        <p className="map-card__hint">Drag the building to move it.</p>
        {e.kind === 'service' &&
          (() => {
            const l = linkState(e);
            if (!l) return null;
            if (!l.design) return <p className="map-card__hint">Its design was linked from another browser.</p>;
            const d = l.design;
            return d.version > l.version ? (
              <p className="map-card__hint">
                Its design, {d.spec.name}, has changed since (version {l.version} → {d.version}).{' '}
                <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void link(e, l.key, d)}>
                  Update from the design
                </button>
              </p>
            ) : (
              <p className="map-card__hint">
                Its design: {d.spec.name}, version {l.version}.
              </p>
            );
          })()}
      </div>
    ) : null;

  return { tools, overlay, cardActions, pointerDown, pointerMove, pointerUp, busy };
}
