// The map: the house seen from above, and the way to every service and
// machine in it. One page, a few states drawn by the same scene:
//
//   intro ──Explore──▶ overview ──a place──▶ travelling ──▶ place
//                        ▲                                   │
//                        └──────── back to the island ◀──────┘
//   loading, before the island is ready · still, a picture (no WebGL, or saving data)
//
// The address follows: #/map is the island, #/map/<id> a place — the
// browser's back button returns, and a link opens a place. The chosen place
// is one value read by the camera, the rings, the directory and the panel.
// With the house's password the map is also where places are added and
// changed (useMapEditor).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapData } from '../../../../src/map/items.ts';
import { fileUrl } from '../files.ts';
import { useMapEditor } from './MapEditor.tsx';
import { Hotspots } from './Hotspots.tsx';
import { LocationPanel } from './LocationPanel.tsx';
import { Compass, Directory, MapBar } from './MapNav.tsx';
import { portrait } from './thumbs.ts';
import * as api from './map-api.ts';
import type { MapScene, Filter } from './map-scene.ts';
import './map.css';

type Phase = 'loading' | 'intro' | 'entering' | 'overview' | 'travelling' | 'place' | 'still';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = () => window.innerWidth < 720;
const savesData = () => !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
const hasWebGL = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};
const SEEN = 'olympus-map-seen';
const seen = () => {
  try {
    return !!sessionStorage.getItem(SEEN);
  } catch {
    return true;
  }
};
const markSeen = () => {
  try {
    sessionStorage.setItem(SEEN, '1');
  } catch {
    /* private window */
  }
};
const plural = (n: number, word: string) => (n ? `${n} ${word}${n === 1 ? '' : 's'}` : '');
const go = (id: string | null) => {
  const next = id ? `#/map/${encodeURIComponent(id)}` : '#/map';
  if (location.hash !== next) location.hash = next;
};

export function MapPage({ arg }: { arg?: string }) {
  const chosen = arg ? decodeURIComponent(arg) : null;
  const [data, setData] = useState<MapData | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [want3d, setWant3d] = useState(() => hasWebGL() && !savesData());
  const [phase, setPhase] = useState<Phase>(() => (hasWebGL() && !savesData() ? 'loading' : 'still'));
  const [scene, setScene] = useState<MapScene | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [directory, setDirectory] = useState(false);
  const [lesson, setLesson] = useState<'move' | 'zoom' | null>(null);
  const [pictured, setPictured] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MapScene | null>(null);
  sceneRef.current = scene;

  const reload = useCallback(async () => {
    const m = await api.loadMap();
    setData(m.data);
    setLive(m.live);
    return m.data;
  }, []);
  useEffect(() => {
    reload().catch((e: Error) => setError(e.message));
  }, [reload]);

  // The scene, in its own chunk, only when the 3D map is wanted.
  useEffect(() => {
    if (!want3d || !data || !canvas.current || scene) return;
    let gone = false;
    Promise.all([import('./map-scene.ts'), api.loadTerrain(), api.loadCity()])
      .then(([m, terrain, city]) => {
        if (gone || !canvas.current) return;
        const s = m.createMapScene(canvas.current, terrain, city, { reducedMotion: reducedMotion(), lite: phone() });
        s.setItems(data.items);
        s.onLearn((what) => setLesson((l) => (what === 'move' && l === 'move' ? 'zoom' : what === 'zoom' && l === 'zoom' ? null : l)));
        (window as Window & { olympusMapStats?: () => ReturnType<MapScene['stats']> }).olympusMapStats = () => s.stats();
        (window as Window & { olympusMapLook?: MapScene['look'] }).olympusMapLook = (p) => s.look(p);
        const firstVisit = !seen() && !chosen;
        if (firstVisit) s.intro();
        setScene(s);
        setPhase(firstVisit ? 'intro' : chosen ? 'travelling' : 'overview');
      })
      .catch((e: Error) => {
        console.warn('the 3D map could not start:', e.message);
        setWant3d(false);
        setPhase('still');
      });
    return () => {
      gone = true;
    };
  }, [want3d, data !== null]);
  useEffect(() => () => sceneRef.current?.dispose(), []);
  useEffect(() => {
    if (data) scene?.setItems(data.items);
  }, [data, scene]);
  useEffect(() => scene?.setFilter(filter), [filter, scene]);

  // The chosen place drives the camera and the panel.
  const placeEntry = useMemo(() => data?.items.find((e) => e.id === chosen) ?? null, [data, chosen]);
  // The camera is the intro's until the entrance has finished.
  const waiting = phase === 'intro' || phase === 'entering' || phase === 'loading' || phase === 'still';
  useEffect(() => {
    if (!scene || waiting) return;
    let current = true;
    if (placeEntry) {
      setPhase('travelling');
      setDirectory(false);
      const wide = window.innerWidth >= 900;
      scene.setInset(wide ? { right: Math.min(460, window.innerWidth * 0.38), bottom: 0 } : { right: 0, bottom: window.innerHeight * 0.5 });
      void scene.travelTo(placeEntry.id).then(() => current && setPhase('place'));
    } else {
      scene.setInset({ right: 0, bottom: 0 });
      void scene.overview().then(() => current && setPhase('overview'));
    }
    return () => {
      current = false;
    };
  }, [scene, placeEntry?.id, placeEntry?.place.x, placeEntry?.place.z, waiting]);

  // The building's portrait for the panel, drawn when the place opens.
  useEffect(() => {
    if (!placeEntry || !want3d) return setPictured(null);
    const t = window.setTimeout(() => setPictured(portrait(placeEntry.place.building)), 30);
    return () => window.clearTimeout(t);
  }, [placeEntry?.place.building, want3d]);


  const enter = async (thenDirectory = false) => {
    markSeen();
    setPhase('entering');
    await scene?.enter();
    setPhase('overview');
    if (thenDirectory) setDirectory(true);
    else if (!reducedMotion()) setLesson('move');
  };
  // The lessons leave on their own after a while.
  useEffect(() => {
    if (!lesson) return;
    const t = window.setTimeout(() => setLesson(null), 9000);
    return () => window.clearTimeout(t);
  }, [lesson]);

  // Escape closes the directory first, then the place.
  useEffect(() => {
    if (!placeEntry) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || directory) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, .map__panel, [role="dialog"]')) return;
      go(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [placeEntry?.id, directory]);

  const editor = useMapEditor({ live, data, scene: sceneRef, selected: placeEntry, onSelect: go, reload });
  const items = data?.items ?? [];
  const ordered = useMemo(() => [...items].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'service' ? -1 : 1)), [items]);
  const index = placeEntry ? ordered.findIndex((e) => e.id === placeEntry.id) : -1;
  const step = (by: number) => ordered.length && go(ordered[(index + by + ordered.length) % ordered.length].id);

  const down = useRef<{ x: number; y: number } | null>(null);
  const counts = { services: items.filter((e) => e.kind === 'service').length, machines: items.filter((e) => e.kind === 'machine').length };
  const inScene = phase !== 'still';
  const showUi = phase !== 'intro' && phase !== 'entering' && phase !== 'loading';

  return (
    <div className="map" data-map={phase === 'still' ? 'still' : phase === 'loading' ? 'loading' : 'ready'} data-phase={phase}>
      {inScene ? (
        <canvas
          ref={canvas}
          className="map__canvas"
          aria-label="The island in 3D. Every place on it is in the directory at the bottom."
          onPointerDown={(e) => {
            down.current = { x: e.clientX, y: e.clientY };
            editor.pointerDown(e);
          }}
          onPointerMove={editor.pointerMove}
          onPointerUp={(e) => {
            const d = down.current;
            down.current = null;
            if (editor.pointerUp(e)) return;
            if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
            const id = scene?.pick(e.clientX, e.clientY);
            if (id) go(id);
          }}
        />
      ) : (
        <div className="map__still">
          <img src={fileUrl('assets/map/still.png')} alt="The island from above, a marble mark for each place." width="1600" height="1600" />
          {hasWebGL() && (
            <button type="button" className="map__to3d" onClick={() => (setWant3d(true), setPhase('loading'))}>
              Turn it in 3D
            </button>
          )}
        </div>
      )}
      <div className="map__veil" aria-hidden="true" />

      {inScene && <Hotspots items={items} scene={scene} selected={chosen} hidden={!showUi} onChoose={go} />}

      {phase === 'loading' && (
        <p className="map__loading" role="status">
          Raising the island…
        </p>
      )}

      {phase === 'intro' && (
        <div className="map-intro">
          <p className="map-intro__over">Above the clouds</p>
          <h1>The Olympus</h1>
          <p className="map-intro__line">
            Every service and every machine of the house, on one island — {[plural(counts.services, 'service'), plural(counts.machines, 'machine')].filter(Boolean).join(' and ')}.
          </p>
          <div className="map-intro__actions">
            <button type="button" className="map-intro__go" onClick={() => void enter()}>
              Explore the map
            </button>
            <button type="button" className="map-intro__all" onClick={() => void enter(true)}>
              All places
            </button>
          </div>
        </div>
      )}
      {phase !== 'intro' && <h1 className="visually-hidden">The map</h1>}

      {lesson && phase === 'overview' && (
        <p className="map-lesson" role="status">
          <span>{lesson === 'move' ? (phone() ? 'Swipe' : 'Drag') : phone() ? 'Pinch' : 'Scroll'}</span>
          <span>{lesson === 'move' ? 'to move' : 'to come closer'}</span>
          <small>{lesson === 'move' ? 'Explore the island by holding and dragging' : 'Dive into the island, then choose a place'}</small>
        </p>
      )}

      {showUi && (
        <>
          {inScene && <Compass scene={scene} />}
          <MapBar current={placeEntry ? placeEntry.name : 'The island'} open={directory} atHome={!placeEntry && phase === 'overview'} onHome={() => (setDirectory(false), go(null))} onToggle={() => setDirectory((o) => !o)} />
          <div className="map__tools">{editor.tools}</div>
          {directory && data && <Directory items={items} unplaced={data.unplaced ?? []} selected={chosen} filter={filter} onFilter={setFilter} onChoose={(id) => (setDirectory(false), go(id))} onClose={() => setDirectory(false)} />}
        </>
      )}

      {placeEntry && showUi && (
        <div className="map__place">
          <LocationPanel entry={placeEntry} index={index} count={ordered.length} portrait={pictured} onPrev={() => step(-1)} onNext={() => step(1)} onBack={() => go(null)}>
            {editor.cardActions(placeEntry)}
          </LocationPanel>
        </div>
      )}

      {editor.overlay}
      {data && (data.unplaced?.length ?? 0) > 0 && showUi && (
        <p className="map-notice map-notice--error map__unplaced" role="status">
          No room on the island for {data.unplaced.map((u) => u.name).join(', ')}: move or remove a building to make some.
        </p>
      )}
      {error && <p className="notes notes--error map__error">{error}</p>}
    </div>
  );
}
