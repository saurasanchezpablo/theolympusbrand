// The catalogue of buildings, to choose one for a service or a machine: those
// that suit what is being added first, then every family; searchable.

import { useEffect, useMemo, useRef, useState } from 'react';
import { BUILDINGS, type BuildingType } from '../../../../src/map/buildings/index.ts';
import { thumbsFor } from './thumbs.ts';

const FAMILIES: [BuildingType['family'], string][] = [
  ['temples', 'Temples'],
  ['sanctuary', 'The sanctuary'],
  ['civic', 'The city'],
  ['sport', 'Theatres and games'],
  ['works', 'Walls and works'],
  ['monuments', 'Monuments and houses'],
  ['machines', 'The house’s works, for machines'],
];

export function BuildingPicker({ kind, category, onKind, onPick, onClose, title }: { kind: 'service' | 'machine'; category?: string; onKind?: (k: 'service' | 'machine') => void; onPick: (type: string) => void; onClose: () => void; title: string }) {
  const [q, setQ] = useState('');
  const [pics, setPics] = useState<Record<string, string>>({});
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => search.current?.focus(), []);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return BUILDINGS.filter((k) => k.kind === kind && (!needle || k.name.toLowerCase().includes(needle) || k.id.includes(needle)));
  }, [kind, q]);
  useEffect(() => thumbsFor(list.map((k) => k.id), (type, url) => setPics((p) => (p[type] ? p : { ...p, [type]: url }))), [list]);
  const suggested = category ? list.filter((k) => k.suggests.includes(category as never)) : [];
  const groups: [string, BuildingType[]][] = [...(suggested.length ? [['Suited to it', suggested] as [string, BuildingType[]]] : []), ...FAMILIES.map(([f, label]) => [label, list.filter((k) => k.family === f)] as [string, BuildingType[]])].filter(([, l]) => l.length);
  return (
    <div className="map-picker" role="dialog" aria-modal="true" aria-labelledby="map-picker-title" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="map-picker__head">
        <h2 id="map-picker-title">{title}</h2>
        {onKind && (
          <div className="segmented segmented--sm" role="radiogroup" aria-label="For">
            {(['service', 'machine'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'is-on' : undefined} onClick={() => onKind(k)}>
                {k === 'service' ? 'A service' : 'A machine'}
              </button>
            ))}
          </div>
        )}
        <input ref={search} type="search" aria-label="Search the buildings" placeholder="Search the buildings" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="map-picker__body">
        {groups.map(([label, l]) => (
          <section key={label} aria-label={label}>
            <h3>{label}</h3>
            <ul>
              {l.map((k) => (
                <li key={k.id}>
                  <button type="button" onClick={() => onPick(k.id)}>
                    {pics[k.id] ? <img src={pics[k.id]} alt="" width="96" height="72" /> : <span className="map-picker__blank" aria-hidden="true" />}
                    <span>{k.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!groups.length && <p>No building is called “{q}”.</p>}
      </div>
    </div>
  );
}
