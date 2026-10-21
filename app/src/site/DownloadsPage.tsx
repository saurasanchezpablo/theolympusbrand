import { useEffect, useState } from 'react';
import { download } from '../exporters.ts';
import { fileUrl, filesUnder, formatSize, useIndex, type FileIndex } from './files.ts';
import { zipFolder } from './zip.ts';
import { Command, siteAddress } from './Command.tsx';

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

/** An installer's two commands: straight through, or saved and checked against its checksum before it runs. */
function Installer({ label, folder, sha256, sudo }: { label: string; folder: string; sha256?: string; sudo: boolean }) {
  const from = new URL(fileUrl(folder), location.href).href;
  const as = sudo ? 'sudo ' : '';
  return (
    <>
      <Command label={label} command={`curl -fsSL ${from}install.sh | ${as}OLYMPUS_FROM=${from} sh`} />
      {sha256 && (
        <details className="dl__verify">
          <summary>Check it before it runs</summary>
          <p>
            The script’s SHA-256 is <code>{sha256}</code>. This saves it, checks it, and only then runs it:
          </p>
          <Command label={`${label}, checked first`} command={`f=$(mktemp) && curl -fsSLo "$f" ${from}install.sh && echo "${sha256}  $f" | sha256sum -c && ${as}OLYMPUS_FROM=${from} sh "$f"`} />
        </details>
      )}
    </>
  );
}

/** The one command: a menu of everything the house can install on a machine. */
function Launcher({ index }: { index: FileIndex }) {
  const entry = index.files.find((f) => f.path === 'assets/install.sh');
  if (!entry) return null;
  const site = siteAddress();
  return (
    <section className="dl dl--launcher" aria-labelledby="launcher-title">
      <h2 id="launcher-title">One command for a machine</h2>
      <p>
        Run it on any Linux machine, a Mac, or WSL: a menu shows everything the house can install there — the boot screens and the crest at login, your own terminal, the themes of the applications it finds (Proxmox VE, Nextcloud, Home Assistant, Vaultwarden) — and installs what you choose, or undoes it. Every file is checked against its SHA-256 before it is used. <a href="#/guide/12-one-command">How it works</a>.
      </p>
      <Command label="One command" command={`curl -fsSL ${site}/install.sh | OLYMPUS_SITE=${site} sh`} />
      {entry.sha256 && (
        <details className="dl__verify">
          <summary>Check it before it runs</summary>
          <p>
            The script’s SHA-256 is <code>{entry.sha256}</code>. This saves it, checks it, and only then runs it:
          </p>
          <Command label="One command, checked first" command={`f=$(mktemp) && curl -fsSLo "$f" ${site}/install.sh && echo "${entry.sha256}  $f" | sha256sum -c && OLYMPUS_SITE=${site} sh "$f"`} />
        </details>
      )}
    </section>
  );
}

/** The screens' one-command installs, addressed to this very site. */
function InstallCommand({ index }: { index: FileIndex }) {
  const sum = (path: string) => index.files.find((f) => f.path === path)?.sha256;
  const shell = index.files.some((f) => f.path === 'assets/screens/shell/install.sh');
  return (
    <div className="dl__install">
      {!window.isSecureContext && (
        <p className="dl__warn" role="note">
          <strong>This page is not served over HTTPS.</strong> Anyone on the network between you and the server could change a script on its way — and the checksums inside it with it. Serve the site over HTTPS (see the guide’s <a href="#/guide/07-self-hosting">The site on your server</a>), or check each script against a copy you trust before running it.
        </p>
      )}
      <p>
        <strong>Install on a machine.</strong> Run this on a Debian, Ubuntu, Proxmox VE, Arch or CachyOS machine: it installs every part the machine can take — boot screens, the terminal crest, the wallpapers — and checks each file it fetches against the checksum in the script. Add <code>-s -- terminal</code> after <code>sh</code> for one part, or <code>-s -- --restore</code> to undo.
      </p>
      <Installer label="Install command" folder="assets/screens/" sha256={sum('assets/screens/install.sh')} sudo />
      {shell && (
        <>
          <p className="dl__install-next">
            <strong>Your own terminal.</strong> As yourself, without sudo, on Linux or macOS: the prompt for bash and fish, fastfetch with the seal, tmux, the house’s colours for your terminal app, and an Omarchy theme (<a href="#/guide/screens/terminal">the guide</a>).
          </p>
          <Installer label="Terminal install command" folder="assets/screens/shell/" sha256={sum('assets/screens/shell/install.sh')} sudo={false} />
        </>
      )}
      {index.files.some((f) => f.path === 'assets/screens/arch/PKGBUILD') && (
        <>
          <p className="dl__install-next">
            <strong>Arch, CachyOS, Omarchy.</strong> The same, as a pacman package: makepkg fetches every file and checks it against the checksum pinned in the PKGBUILD; then <code>sudo the-olympus</code> and <code>the-olympus-terminal</code>. Removing the package undoes it.
          </p>
          <Command
            label="Arch package commands"
            command={`mkdir the-olympus && cd the-olympus && for f in PKGBUILD the-olympus the-olympus-terminal the-olympus.install; do curl -fsSLO ${new URL(fileUrl('assets/screens/arch/'), location.href).href}$f; done && OLYMPUS_SITE=${location.href.replace(/#.*$/, '').replace(/\/$/, '')} makepkg -si`}
          />
        </>
      )}
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
      {index && <Launcher index={index} />}
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
            {g.dir === 'assets/screens' && all.some((f) => f.path === 'assets/screens/install.sh') && <InstallCommand index={index} />}
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
