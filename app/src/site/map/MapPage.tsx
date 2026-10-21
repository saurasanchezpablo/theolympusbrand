// The map: the house seen from above. Anyone can explore it and open a
// building's card; with the house's password it is also where services and
// machines are added, placed, changed and removed. On phones, slow
// connections and browsers without WebGL it is a picture of the island, with
// the same list and cards.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapData, MapEntry } from '../../../../src/map/items.ts';
import { Segmented } from '../../components/ui.tsx';
import { fileUrl } from '../files.ts';
import { MapCard } from './MapCard.tsx';
import { MapList } from './MapList.tsx';
import { useMapEditor } from './MapEditor.tsx';
import * as api from './map-api.ts';
import type { MapScene, Filter } from './map-scene.ts';
import './map.css';

type View = 'loading' | 'ready' | 'still' | 'unavailable';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const prefersStill = () => {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return window.innerWidth < 720 || !!c?.saveData;
};
const hasWebGL = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};

export function MapPage() {
  const [data, setData] = useState<MapData | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(() => (prefersStill() || !hasWebGL() ? 'still' : 'loading'));
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [listOpen, setListOpen] = useState(false);
  const [status, setStatus] = useState<api.Status | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<MapScene | null>(null);

  const reload = useCallback(async () => {
    const m = await api.loadMap();
    setData(m.data);
    setLive(m.live);
    return m.data;
  }, []);

  useEffect(() => {
    reload().catch((e: Error) => setError(e.message));
  }, [reload]);

  // The scene: loaded on its own, only when the 3D map is wanted.
  useEffect(() => {
    if (view !== 'loading' || !data || !canvas.current) return;
    let gone = false;
    const intro = !sessionStorage.getItem('olympus-map-seen');
    Promise.all([import('./map-scene.ts'), api.loadTerrain()])
      .then(([m, terrain]) => {
        if (gone || !canvas.current) return;
        const s = m.createMapScene(canvas.current, terrain, { reducedMotion: reduced(), intro });
        s.setItems(data.items);
        s.onHover((id) => setHover(id ? { id, x: 0, y: 0 } : null));
        scene.current = s;
        // For the checks: what the scene drew last.
        (window as Window & { olympusMapStats?: () => ReturnType<MapScene['stats']> }).olympusMapStats = () => s.stats();
        try {
          sessionStorage.setItem('olympus-map-seen', '1');
        } catch {
          /* private window */
        }
        setView('ready');
      })
      .catch((e: Error) => {
        console.warn('the 3D map could not start:', e.message);
        setView('unavailable');
      });
    return () => {
      gone = true;
    };
  }, [view, data !== null]);

  useEffect(() => () => scene.current?.dispose(), []);
  useEffect(() => {
    if (data) scene.current?.setItems(data.items);
  }, [data]);
  useEffect(() => scene.current?.setFilter(filter), [filter, view]);
  useEffect(() => scene.current?.select(selected), [selected, view]);
  useEffect(() => {
    if (status) scene.current?.setStatus(status.items);
  }, [status, view]);

  // Online marks: once on arrival, then every 15 s while a card is open (a minute otherwise).
  useEffect(() => {
    if (!live) return;
    let stop = false;
    const look = () => api.loadStatus().then((s) => !stop && s && setStatus(s));
    look();
    const t = window.setInterval(() => !document.hidden && look(), selected ? 15_000 : 60_000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [live, selected]);

  const entry = useMemo(() => data?.items.find((e) => e.id === selected) ?? null, [data, selected]);
  const editor = useMapEditor({ live, data, scene, selected: entry, onSelect: setSelected, reload });
  const open = (id: string) => {
    setSelected(id);
    scene.current?.focus(id);
  };

  // Clicks on the map: a building opens its card (or, while placing, the editor takes the click).
  const down = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY };
    editor.pointerDown(e);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    editor.pointerMove(e);
    if (hover) setHover({ ...hover, x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (editor.pointerUp(e)) return;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const id = scene.current?.pick(e.clientX, e.clientY) ?? null;
    if (id) setSelected(id);
    else setSelected(null);
  };

  const counts = data ? { services: data.items.filter((e) => e.kind === 'service').length, machines: data.items.filter((e) => e.kind === 'machine').length } : null;
  const hoverName = hover && data?.items.find((e) => e.id === hover.id)?.name;

  return (
    <div className="map" data-map={view}>
      <div className="map__title">
        <h1>The map</h1>
        {counts && (
          <p>
            {counts.services} service{counts.services === 1 ? '' : 's'} · {counts.machines} machine{counts.machines === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {view === 'still' || view === 'unavailable' ? (
        <div className="map__still">
          <img src={fileUrl('assets/map/still.png')} alt="The island from above: a marble mark for each building on the map." width="1600" height="1600" />
          {view === 'still' && hasWebGL() && (
            <button type="button" className="btn map__to3d" onClick={() => setView('loading')}>
              Turn it in 3D
            </button>
          )}
          {view === 'unavailable' && <p className="map__note">The 3D map could not start in this browser; here it is from above.</p>}
        </div>
      ) : (
        <canvas ref={canvas} className="map__canvas" aria-label="The island in 3D: drag to move, scroll to come closer, right-drag to tilt. The list beside it has every building." onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => setHover(null)} />
      )}
      {view === 'loading' && (
        <p className="map__loading" role="status">
          Raising the island…
        </p>
      )}
      {hover && hoverName && hover.x > 0 && (
        <div className="map__hover" style={{ left: hover.x + 14, top: hover.y + 14 }} aria-hidden="true">
          {hoverName}
        </div>
      )}

      <div className="map__tools">
        <Segmented<Filter>
          label="Show"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'service', label: 'Services' },
            { value: 'machine', label: 'Machines' },
          ]}
        />
        <button type="button" className="btn btn--sm" aria-expanded={listOpen} aria-controls="map-list" onClick={() => setListOpen((o) => !o)}>
          List
        </button>
        {editor.tools}
      </div>

      <div className="map__key" aria-label="Key">
        <span>
          <span className="map__key-glyph map__key-glyph--service" aria-hidden="true" /> Services: temples, halls and monuments
        </span>
        <span>
          <span className="map__key-glyph map__key-glyph--machine" aria-hidden="true" /> Machines: the house’s works
        </span>
        {live && (
          <span>
            <span className="map-dot map-dot--up" aria-hidden="true" /> online <span className="map-dot map-dot--down" aria-hidden="true" /> offline
          </span>
        )}
      </div>

      {listOpen && data && (
        <div id="map-list" className="map__panel map__panel--list">
          <MapList items={data.items.filter((e) => filter === 'all' || e.kind === filter)} status={status?.items ?? {}} onOpen={open} />
        </div>
      )}
      {entry && (
        <div className="map__panel map__panel--card">
          <MapCard entry={entry} state={status?.items[entry.id]} checked={status?.checked} onClose={() => setSelected(null)}>
            {editor.cardActions(entry)}
          </MapCard>
        </div>
      )}
      {editor.overlay}
      {data && data.unplaced?.length > 0 && (
        <p className="map-notice map-notice--error map__unplaced" role="status">
          No room on the island for {data.unplaced.map((u) => u.name).join(', ')}: move or remove a building to make some.
        </p>
      )}
      {error && <p className="notes notes--error map__error">{error}</p>}
    </div>
  );
}
