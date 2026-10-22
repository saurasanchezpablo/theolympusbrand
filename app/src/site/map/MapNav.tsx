// The map's quiet controls: a bar at the bottom — back to the island, and the
// directory of every place, which opens upward — and a compass in the corner.
// The directory is also the way to every place without the map.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapEntry } from '../../../../src/map/items.ts';
import type { Filter, MapScene } from './map-scene.ts';

const label = (c: string) => c[0].toUpperCase() + c.slice(1);

export function Directory({
  items,
  unplaced,
  status,
  selected,
  filter,
  onFilter,
  onChoose,
  onClose,
}: {
  items: readonly MapEntry[];
  unplaced: readonly { id: string; name: string }[];
  status: Record<string, 'up' | 'down' | 'unknown'>;
  selected: string | null;
  filter: Filter;
  onFilter: (f: Filter) => void;
  onChoose: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => search.current?.focus(), []);
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const shown = items.filter((e) => (filter === 'all' || e.kind === filter) && (!needle || [e.name, e.id, e.url, e.ip, e.hostname, e.role, e.os, e.category].some((v) => v?.toLowerCase().includes(needle))));
    const by = new Map<string, MapEntry[]>();
    for (const e of shown) {
      const key = e.kind === 'machine' ? 'Machines' : label(e.category ?? 'other');
      by.set(key, [...(by.get(key) ?? []), e]);
    }
    return [...by.entries()].sort(([a], [b]) => (a === 'Machines' ? 1 : b === 'Machines' ? -1 : a.localeCompare(b)));
  }, [items, filter, q]);
  return (
    <div className="directory" id="map-directory" role="dialog" aria-modal="false" aria-label="Every place on the island" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="directory__head">
        <input ref={search} type="search" aria-label="Search the places" placeholder="Search by name or address" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="directory__filter" role="radiogroup" aria-label="Show">
          {(
            [
              ['all', 'All'],
              ['service', 'Services'],
              ['machine', 'Machines'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={filter === v} className={filter === v ? 'is-on' : undefined} onClick={() => onFilter(v)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="directory__body">
        {groups.map(([group, list]) => (
          <section key={group} aria-label={group}>
            <h2>{group}</h2>
            <ul>
              {list.map((e) => (
                <li key={e.id}>
                  <button type="button" aria-current={selected === e.id ? 'true' : undefined} onClick={() => onChoose(e.id)}>
                    <span className={`directory__mark directory__mark--${e.kind} is-${status[e.id] ?? 'unknown'}`} aria-hidden="true" />
                    <span className="directory__name">{e.name}</span>
                    <span className="directory__meta">{e.url?.replace(/^https?:\/\//, '') ?? e.ip ?? e.hostname ?? ''}</span>
                    {status[e.id] && status[e.id] !== 'unknown' && <span className="visually-hidden">{status[e.id] === 'up' ? ', online' : ', offline'}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!groups.length && <p className="directory__empty">Nothing on the island matches “{q}”.</p>}
        {unplaced.length > 0 && <p className="directory__empty">No room on the island for {unplaced.map((u) => u.name).join(', ')}.</p>}
      </div>
    </div>
  );
}

export function MapBar({ current, open, onHome, onToggle, atHome }: { current: string; open: boolean; onHome: () => void; onToggle: () => void; atHome: boolean }) {
  return (
    <div className="mapbar">
      <button type="button" className="mapbar__home" onClick={onHome} aria-label="Back to the whole island" disabled={atHome}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 20V10L12 4l8 6v10h-5v-6H9v6z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <button type="button" className="mapbar__select" aria-expanded={open} aria-controls="map-directory" onClick={onToggle}>
        <span>{current}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={open ? 'is-open' : undefined}>
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </div>
  );
}

/** The compass: turns with the view; a click faces north again. */
export function Compass({ scene }: { scene: MapScene | null }) {
  const needle = useRef<SVGGElement>(null);
  useEffect(() => {
    if (!scene) return;
    const turn = () => needle.current?.setAttribute('transform', `rotate(${((scene.heading() * 180) / Math.PI).toFixed(1)} 30 30)`);
    const stop = scene.onView(turn);
    turn();
    return () => void stop();
  }, [scene]);
  return (
    <button type="button" className="compass" onClick={() => scene?.north()} aria-label="Face north">
      <svg viewBox="0 0 60 60" width="60" height="60" aria-hidden="true">
        <circle cx="30" cy="30" r="25" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        {Array.from({ length: 36 }, (_, i) => (
          <line key={i} x1="30" y1="6" x2="30" y2={i % 9 === 0 ? '10' : '8'} stroke="currentColor" strokeWidth="1" opacity="0.6" transform={`rotate(${i * 10} 30 30)`} />
        ))}
        <g ref={needle}>
          <path d="M30 14 L35 34 L30 30 L25 34 Z" fill="currentColor" />
          <text x="30" y="5" textAnchor="middle" fontSize="7" fill="currentColor" fontFamily="var(--display)">
            N
          </text>
        </g>
      </svg>
    </button>
  );
}
