import { useMemo, useState, type ReactNode } from 'react';
import { productionSvg } from '../../../src/render/svg.ts';
import type { Design } from '../../../src/catalog/design.ts';
import { GODS } from '../../../src/geometry/pantheon.ts';
import { CATEGORY_LIST, MASTER, patronLabel, renderableService, sealFor, title } from '../model.ts';
import { Segmented, SvgImage } from './ui.tsx';
import { Icon } from './Icon.tsx';

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
  /** New, import, export — the library's own actions. */
  actions?: ReactNode;
  /** Where the library is a drawer: how to close it. */
  onClose?: () => void;
};

const masterSeal = () => productionSvg(MASTER.marks().seal, { ground: 'transparent' });

export function Library({ house, mine, current, storageAvailable, onOpenMaster, onOpen, onDuplicate, onExport, onDelete, actions, onClose }: Props) {
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
    const s = renderableService(e.design.spec, e.design.logoSvg);
    if (category && s.category !== category) return false;
    if (!q) return true;
    const patron = patronLabel(s.patron);
    return [s.name, s.id, s.category, patron, s.description ?? '', s.caption].join(' ').toLowerCase().includes(q);
  });

  const isCurrent = (e: Entry) => (e.kind === 'house' ? current.kind === 'house' && current.id === e.id : current.kind === 'mine' && current.key === e.key);

  return (
    <aside className="library" aria-label="Designs" id="atelier-library">
      <div className="library__head">
        <h2 className="library__title">Designs</h2>
        {onClose && (
          <button type="button" className="icon-btn library__close" onClick={onClose} aria-label="Close the designs">
            <Icon name="close" />
          </button>
        )}
      </div>
      {actions && <div className="library__actions">{actions}</div>}
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
          const s = renderableService(e.design.spec, e.design.logoSvg);
          const key = e.kind === 'house' ? `h:${e.id}` : `m:${e.key}`;
          return (
            <li key={key} className="library__row">
              <button type="button" className={`item${isCurrent(e) ? ' is-current' : ''}`} onClick={() => onOpen(e)}>
                <SvgImage className="item__thumb" svg={productionSvg(sealFor(s.patron), { ground: 'transparent' })} alt="" />
                <span className="item__text">
                  <span className="item__name">{s.name}</span>
                  <span className="item__meta">
                    {patronLabel(s.patron)} · {s.category}
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

export { Icon } from './Icon.tsx';
