import { useMemo, useState } from 'react';
import { productionSvg } from '../../../src/render/svg.ts';
import { resolve } from '../../../src/catalog/service.ts';
import type { Design } from '../../../src/catalog/design.ts';
import { GODS } from '../../../src/geometry/pantheon.ts';
import { CATEGORY_LIST, MASTER, sealFor, title } from '../model.ts';
import { Segmented, SvgImage } from './ui.tsx';

export type Entry = { kind: 'house'; id: string; design: Design } | { kind: 'mine'; key: string; design: Design };
export type Current = { kind: 'master' } | { kind: 'house'; id: string } | { kind: 'mine'; key: string } | { kind: 'new' };

type Props = {
  house: Design[];
  mine: Record<string, Design>;
  current: Current;
  storageAvailable: boolean;
  onOpenMaster: () => void;
  onOpen: (e: Entry) => void;
  onDuplicate: (e: Entry) => void;
  onExport: (e: Entry) => void;
  onDelete: (key: string) => void;
};

const masterSeal = () => productionSvg(MASTER.marks().seal, { ground: 'transparent' });

export function Library({ house, mine, current, storageAvailable, onOpenMaster, onOpen, onDuplicate, onExport, onDelete }: Props) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'house' | 'mine'>('all');
  const [category, setCategory] = useState('');

  const entries = useMemo<Entry[]>(() => {
    const m: Entry[] = Object.entries(mine)
      .sort(([, a], [, b]) => b.updated.localeCompare(a.updated))
      .map(([key, design]) => ({ kind: 'mine', key, design }));
    const h: Entry[] = house.map((design) => ({ kind: 'house', id: design.spec.id, design }));
    return [...(scope !== 'house' ? m : []), ...(scope !== 'mine' ? h : [])];
  }, [house, mine, scope]);

  const q = query.trim().toLowerCase();
  const shown = entries.filter((e) => {
    const s = resolve(e.design.spec);
    if (category && s.category !== category) return false;
    if (!q) return true;
    const patron = 'god' in s.patron ? GODS[s.patron.god].name : `monogram ${s.letter}`;
    return [s.name, s.id, s.category, patron, s.description ?? '', s.caption].join(' ').toLowerCase().includes(q);
  });

  const isCurrent = (e: Entry) => (e.kind === 'house' ? current.kind === 'house' && current.id === e.id : current.kind === 'mine' && current.key === e.key);

  return (
    <aside className="library" aria-label="Variant library">
      <div className="library__tools">
        <input className="search" type="search" placeholder="Search name, god, category…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the library" />
        <Segmented
          label="Show"
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'All' },
            { value: 'mine', label: `Mine · ${Object.keys(mine).length}` },
            { value: 'house', label: `House · ${house.length}` },
          ]}
        />
        <select className="select select--sm" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {CATEGORY_LIST.map(([c]) => (
            <option key={c} value={c}>
              {title(c.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      <ol className="library__list">
        {!q && !category && scope !== 'mine' && (
          <li>
            <button type="button" className={`item item--master${current.kind === 'master' ? ' is-current' : ''}`} onClick={onOpenMaster}>
              <SvgImage className="item__thumb" svg={masterSeal()} alt="" />
              <span className="item__text">
                <span className="item__name">The Olympus</span>
                <span className="item__meta">Master · Zeus · fixed</span>
              </span>
            </button>
          </li>
        )}
        {shown.map((e) => {
          const s = resolve(e.design.spec);
          const key = e.kind === 'house' ? `h:${e.id}` : `m:${e.key}`;
          return (
            <li key={key} className="library__row">
              <button type="button" className={`item${isCurrent(e) ? ' is-current' : ''}`} onClick={() => onOpen(e)}>
                <SvgImage className="item__thumb" svg={productionSvg(sealFor(s.patron), { ground: 'transparent' })} alt="" />
                <span className="item__text">
                  <span className="item__name">{s.name}</span>
                  <span className="item__meta">
                    {'god' in s.patron ? title(GODS[s.patron.god].name) : `Monogram ${s.letter}`} · {s.category}
                    {e.kind === 'mine' ? ` · v${e.design.version}` : ''}
                  </span>
                </span>
                <span className={`badge badge--${e.kind}`}>{e.kind === 'house' ? 'House' : 'Mine'}</span>
              </button>
              <span className="item__actions">
                <button type="button" className="icon-btn" onClick={() => onDuplicate(e)} title="Duplicate into my designs" aria-label={`Duplicate ${s.name}`}>
                  <Icon name="copy" />
                </button>
                <button type="button" className="icon-btn" onClick={() => onExport(e)} title="Download the design file (.json)" aria-label={`Export ${s.name}`}>
                  <Icon name="download" />
                </button>
                {e.kind === 'mine' && (
                  <button type="button" className="icon-btn icon-btn--danger" onClick={() => onDelete(e.key)} title="Delete from my designs" aria-label={`Delete ${s.name}`}>
                    <Icon name="trash" />
                  </button>
                )}
              </span>
            </li>
          );
        })}
        {!shown.length && <li className="library__empty">{scope === 'mine' && !Object.keys(mine).length ? 'No saved designs yet. Make one and press Save.' : 'Nothing matches.'}</li>}
      </ol>

      <p className="library__foot">
        {storageAvailable
          ? 'Your designs are saved in this browser only. Use Export library to keep a copy or move them to another machine.'
          : 'This browser is not allowing local storage (private window or blocked site data): designs will not survive a reload. Export them to keep them.'}
      </p>
    </aside>
  );
}

export function Icon({ name }: { name: 'copy' | 'download' | 'trash' | 'plus' | 'upload' }) {
  const paths: Record<typeof name, string> = {
    copy: 'M8 8h11v11H8zM5 16V5h11',
    download: 'M12 4v11m-5-5 5 5 5-5M5 20h14',
    trash: 'M5 7h14M10 7V4h4v3m-7 0 1 13h8l1-13',
    plus: 'M12 5v14M5 12h14',
    upload: 'M12 20V9m-5 5 5-5 5 5M5 4h14',
  };
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}
