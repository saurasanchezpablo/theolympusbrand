import { useState } from 'react';
import { download } from '../exporters.ts';
import { fileUrl, filesUnder, formatSize, useIndex, zipFolder, type FileIndex } from './files.ts';

/** Sub-folders one level below a published folder, with their sizes. */
function folders(index: FileIndex, dir: string) {
  const seen = new Map<string, { count: number; size: number }>();
  const loose: { path: string; size: number }[] = [];
  for (const f of filesUnder(index, dir)) {
    const rest = f.path.slice(dir.length + 1);
    const slash = rest.indexOf('/');
    if (slash < 0) loose.push(f);
    else {
      const key = `${dir}/${rest.slice(0, slash)}`;
      const s = seen.get(key) ?? { count: 0, size: 0 };
      seen.set(key, { count: s.count + 1, size: s.size + f.size });
    }
  }
  return { sub: [...seen.entries()].map(([path, s]) => ({ path, ...s })), loose };
}

export function DownloadsPage() {
  const { index, error } = useIndex();
  const [busy, setBusy] = useState<{ path: string; progress: number } | null>(null);

  async function zip(prefix: string) {
    if (!index) return;
    setBusy({ path: prefix, progress: 0 });
    try {
      const bytes = await zipFolder(index, prefix, (d, t) => setBusy({ path: prefix, progress: d / t }));
      download(`the-olympus-${prefix.replace(/\//g, '-')}.zip`, bytes, 'application/zip');
    } finally {
      setBusy(null);
    }
  }
  const label = (prefix: string) => (busy?.path === prefix ? `Zipping… ${Math.round(busy.progress * 100)} %` : 'Download (.zip)');

  return (
    <div className="page downloads-page">
      <header className="page__head">
        <h1>Downloads</h1>
        <p>Everything the house has made, straight from its repository. Folders are zipped in your browser.</p>
      </header>
      {error && <p className="notes notes--error">{error}</p>}
      {index?.groups.map((g) => {
        const all = filesUnder(index, g.dir);
        if (!all.length) return null;
        const { sub, loose } = folders(index, g.dir);
        return (
          <section key={g.dir} className="dl">
            <header className="dl__head">
              <div>
                <h2>{g.label}</h2>
                <p className="mono">
                  {g.dir}/ · {all.length} files · {formatSize(all.reduce((n, f) => n + f.size, 0))}
                </p>
              </div>
              <button type="button" className="btn btn--sm" disabled={busy !== null} onClick={() => zip(g.dir)}>
                {label(g.dir)}
              </button>
            </header>
            {sub.length > 0 && (
              <ul className="dl__list">
                {sub.map((s) => (
                  <li key={s.path}>
                    <span className="dl__name">{s.path.slice(g.dir.length + 1)}/</span>
                    <span className="dl__size">
                      {s.count} files · {formatSize(s.size)}
                    </span>
                    <button type="button" className="btn btn--ghost btn--sm" disabled={busy !== null} onClick={() => zip(s.path)}>
                      {label(s.path)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {loose.length > 0 && (
              <ul className="dl__list">
                {loose.map((f) => (
                  <li key={f.path}>
                    <a className="dl__name" href={fileUrl(f.path)} download>
                      {f.path.slice(g.dir.length + 1)}
                    </a>
                    <span className="dl__size">{formatSize(f.size)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
