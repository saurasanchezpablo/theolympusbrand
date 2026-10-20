import { useEffect, useState } from 'react';
import { download } from '../exporters.ts';
import { fileUrl, filesUnder, formatSize, useIndex, type FileIndex } from './files.ts';
import { zipFolder } from './zip.ts';

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

type Build = { state: 'static' | 'building' | 'ok' | 'failed'; at?: string; error?: string; services?: number; pull?: string | null };

const ago = (iso: string) => {
  const s = (Date.parse(iso) - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, n] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const) if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit);
  return rtf.format(Math.round(s), 'second');
};

/** On a server with the automatic rebuild: when the site was last rebuilt, or why the last attempt failed. */
function BuildStatus() {
  const [build, setBuild] = useState<Build | null>(null);
  useEffect(() => {
    fetch('build.json', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Build>) : null))
      .then(setBuild, () => setBuild(null));
  }, []);
  if (!build || build.state === 'static' || !build.at) return null;
  return (
    <p className={`dl__build${build.state === 'failed' ? ' dl__build--failed' : ''}`} role="status">
      {build.state === 'building' && <>Rebuilding now, after a change to the catalogue or the repository…</>}
      {build.state === 'ok' && <>Rebuilt automatically {ago(build.at)}{build.services ? ` · ${build.services} services` : ''}.</>}
      {build.state === 'failed' && (
        <>
          The last automatic rebuild failed ({ago(build.at)}); the site still shows the build before it. {build.error?.split('\n').find((l) => /^\s*-|Error:/.test(l))?.trim() ?? ''}
        </>
      )}
      {build.pull && <> {build.pull}.</>}
    </p>
  );
}

/** The screens' one-command install, addressed to this very site. */
function InstallCommand() {
  const from = new URL(fileUrl('assets/screens/'), location.href).href;
  const command = `curl -fsSL ${from}install.sh | sudo OLYMPUS_FROM=${from} sh`;
  const [copied, setCopied] = useState(false);
  // The clipboard is only offered to secure pages; elsewhere the command is selected by hand.
  const canCopy = typeof navigator.clipboard?.writeText === 'function' && window.isSecureContext;
  return (
    <div className="dl__install">
      <p>
        <strong>Install on a machine.</strong> Run this on a Debian, Ubuntu or Proxmox VE machine: it installs every part the machine can take — boot screens, the terminal crest, the wallpapers — and checks each file before using it. Add <code>-s -- terminal</code> after <code>sh</code> for one part, or <code>-s -- --restore</code> to undo.
      </p>
      <div className="dl__command">
        <code tabIndex={0} role="region" aria-label="Install command">
          {command}
        </code>
        {canCopy && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() =>
              navigator.clipboard.writeText(command).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              })
            }
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
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
        <BuildStatus />
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
            {g.dir === 'assets/screens' && all.some((f) => f.path === 'assets/screens/install.sh') && <InstallCommand />}
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
