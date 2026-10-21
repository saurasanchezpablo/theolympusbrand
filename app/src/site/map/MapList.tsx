// Every building as a list — services, then machines — with a search box:
// the way to the cards from the keyboard and for screen readers.

import { useMemo, useState } from 'react';
import type { MapEntry } from '../../../../src/map/items.ts';

export function MapList({ items, status, onOpen }: { items: readonly MapEntry[]; status: Record<string, 'up' | 'down' | 'unknown'>; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((e) => !needle || [e.name, e.id, e.url, e.ip, e.hostname, e.role, e.os].some((v) => v?.toLowerCase().includes(needle)));
  }, [items, q]);
  const groups = [
    ['service', 'Services'],
    ['machine', 'Machines'],
  ] as const;
  return (
    <section className="map-list" aria-label="Every building">
      <label className="map-list__search">
        <span className="visually-hidden">Search the map</span>
        <input type="search" placeholder="Search by name or address" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {groups.map(([kind, label]) => {
        const list = shown.filter((e) => e.kind === kind);
        if (!list.length) return null;
        return (
          <div key={kind} className="map-list__group">
            <h2>{label}</h2>
            <ul>
              {list.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => onOpen(e.id)}>
                    <span className={`map-dot map-dot--${status[e.id] ?? 'unknown'}`} aria-hidden="true" />
                    <span className="map-list__name">{e.name}</span>
                    <span className="map-list__meta">{e.url?.replace(/^https?:\/\//, '') ?? e.ip ?? e.hostname ?? ''}</span>
                    {status[e.id] && status[e.id] !== 'unknown' && <span className="visually-hidden">{status[e.id] === 'up' ? ', online' : ', offline'}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {!shown.length && <p className="map-list__empty">Nothing on the map matches “{q}”.</p>}
    </section>
  );
}
