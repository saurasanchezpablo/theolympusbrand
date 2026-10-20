import { useMemo, useState } from 'react';
import { productionSvg } from '../../../src/render/svg.ts';
import { resolve } from '../../../src/catalog/service.ts';
import { GODS } from '../../../src/geometry/pantheon.ts';
import type { Design } from '../../../src/catalog/design.ts';
import { CATEGORY_LIST, marksFor, readLogo, title } from '../model.ts';
import { HOUSE, loadLibrary } from '../library.ts';
import { requestOpen } from '../bus.ts';
import { download } from '../exporters.ts';
import { SvgImage, Segmented } from '../components/ui.tsx';
import type { Entry } from '../components/Library.tsx';
import { fileUrl, filesUnder, formatSize, useIndex } from './files.ts';
import { zipFolder } from './zip.ts';

/** Open a design in the Atelier (which loads if it has not yet). */
function onOpen(e: Entry) {
  requestOpen(e.kind === 'house' ? { kind: 'house', id: e.id } : { kind: 'mine', key: e.key });
  location.hash = '#/atelier';
}

export function CataloguePage() {
  // Read fresh on each visit: designs saved in the Atelier since show up here.
  const mine = useMemo<Record<string, Design>>(() => loadLibrary().designs, []);
  const { index } = useIndex();
  const [category, setCategory] = useState('');
  const [scope, setScope] = useState<'all' | 'house' | 'mine'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const entries = useMemo<Entry[]>(
    () => [
      ...(scope !== 'mine' ? HOUSE.map((design): Entry => ({ kind: 'house', id: design.spec.id, design })) : []),
      ...(scope !== 'house' ? Object.entries(mine).map(([key, design]): Entry => ({ kind: 'mine', key, design })) : []),
    ],
    [mine, scope],
  );
  const shown = entries.filter((e) => !category || e.design.spec.category === category);

  async function zip(prefix: string, name: string) {
    if (!index) return;
    setBusy(prefix);
    try {
      download(name, await zipFolder(index, prefix), 'application/zip');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page catalogue">
      <header className="page__head">
        <h1>Catalogue</h1>
        <p>Every service in the house has its god in the temple’s central bay. Open one in the Atelier to change it, or take its files.</p>
        <div className="page__tools">
          <Segmented label="Show" size="sm" value={scope} onChange={setScope} options={[{ value: 'all', label: 'All' }, { value: 'house', label: `House · ${HOUSE.length}` }, { value: 'mine', label: `Mine · ${Object.keys(mine).length}` }]} />
          <select className="select select--sm" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {CATEGORY_LIST.map(([c]) => (
              <option key={c} value={c}>
                {title(c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className="cards">
        {shown.map((e) => {
          const s = resolve(e.design.spec);
          const house = e.kind === 'house';
          const folder = `assets/services/${s.id}`;
          const files = index && house ? filesUnder(index, folder) : [];
          const size = files.reduce((n, f) => n + f.size, 0);
          // House crests come ready-made; your own are drawn here.
          const logo = readLogo(e.design.logoSvg);
          const art = house ? null : productionSvg(marksFor(s, logo && 'd' in logo ? logo.d : undefined)['crest-fine'], { ground: 'transparent' });
          return (
            <article key={house ? `h:${s.id}` : `m:${e.key}`} className="card">
              {house ? <img className="card__crest" src={fileUrl(`${folder}/png/the-olympus-${s.id}-crest-fine-512.png`)} alt={`${s.name} crest`} loading="lazy" /> : <SvgImage className="card__crest" svg={art!} alt={`${s.name} crest`} />}
              <div className="card__body">
                <h2>{s.name}</h2>
                <p className="card__meta">
                  {'god' in s.patron ? title(GODS[s.patron.god].name) : `Monogram ${s.letter}`} · {s.category}
                  {house ? '' : ` · mine, v${e.design.version}`}
                </p>
                {s.description && <p className="card__desc">{s.description}</p>}
              </div>
              <div className="card__actions">
                <button type="button" className="btn btn--sm" onClick={() => onOpen(e)}>
                  Open in Atelier
                </button>
                {house && files.length > 0 && (
                  <>
                    <button type="button" className="btn btn--ghost btn--sm" disabled={busy !== null} onClick={() => zip(folder, `the-olympus-${s.id}.zip`)}>
                      {busy === folder ? 'Zipping…' : `All files · ${formatSize(size)}`}
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" disabled={busy !== null} onClick={() => zip(`${folder}/web`, `the-olympus-${s.id}-web-icons.zip`)}>
                      {busy === `${folder}/web` ? 'Zipping…' : 'Web icons'}
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {!shown.length && <p className="page__empty">Nothing here yet.</p>}
      </div>
    </div>
  );
}
