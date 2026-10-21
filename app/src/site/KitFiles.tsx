// Under an application's chapter of the guide: the kit's files, to copy into
// the application by hand (shown, copied, downloaded one by one or all at
// once), and the one command that does it on the machine instead.

import { useState } from 'react';
import { download } from '../exporters.ts';
import { Command, CopyButton, siteAddress } from './Command.tsx';
import { fileUrl, filesUnder, formatSize, type FileIndex } from './files.ts';
import { zipFolder } from './zip.ts';

/** Files whose text is pasted somewhere: shown and copied, not only downloaded. */
const TEXT = /\.(sh|css|scss|hbs|ya?ml|json|toml|conf|txt|env|html|js|xml)$/i;

const texts = new Map<string, Promise<string>>();
const textOf = (path: string) => {
  if (!texts.has(path))
    texts.set(
      path,
      fetch(fileUrl(path)).then((r) => {
        if (!r.ok) throw new Error(`${path}: ${r.status}`);
        return r.text();
      }),
    );
  return texts.get(path)!;
};

function KitFile({ path, size }: { path: string; size: number }) {
  const name = path.split('/').slice(4).join('/');
  const [shown, setShown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = `kit-file-${name.replace(/[^\w-]/g, '-')}`;
  const isText = TEXT.test(name);
  return (
    <li className="kit-files__item">
      <div className="kit-files__row">
        <code className="kit-files__name">{name}</code>
        <span className="kit-files__size">{formatSize(size)}</span>
        <span className="kit-files__actions">
          {isText && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              aria-expanded={shown !== null}
              aria-controls={id}
              onClick={() => {
                if (shown !== null) return setShown(null);
                textOf(path).then(setShown, (e: Error) => setError(e.message));
              }}
            >
              {shown !== null ? 'Hide' : 'Show'}
            </button>
          )}
          {isText && <CopyButton text={() => textOf(path)} />}
          <a className="btn btn--ghost btn--sm" href={fileUrl(path)} download={name.split('/').pop()}>
            Download
          </a>
        </span>
      </div>
      {error && <p className="notes notes--error">{error}</p>}
      {shown !== null && (
        <pre id={id} className="kit-files__text" tabIndex={0} role="region" aria-label={name}>
          <code>{shown}</code>
        </pre>
      )}
    </li>
  );
}

export function KitFiles({ index, dir }: { index: FileIndex; dir: string }) {
  const folder = `assets/integrations/themes/${dir}`;
  const files = filesUnder(index, folder).filter((f) => f.path !== `${folder}/README.md`);
  const [zipping, setZipping] = useState(false);
  if (!files.length) return null;
  // Kits with a script are applied on the machine; the others are saved there in a folder, to copy from.
  const applied = files.some((f) => f.path === `${folder}/apply.sh`);
  const site = siteAddress();
  return (
    <section className="kit-files" aria-labelledby="kit-files-title">
      <h2 id="kit-files-title">The kit’s files</h2>
      <p>Show a file and copy its text into the application, or download it — one by one, or the whole folder.</p>
      <ul className="kit-files__list">
        {files.map((f) => (
          <KitFile key={f.path} path={f.path} size={f.size} />
        ))}
      </ul>
      <button
        type="button"
        className="btn btn--sm"
        disabled={zipping}
        onClick={async () => {
          setZipping(true);
          try {
            download(`the-olympus-${dir}.zip`, await zipFolder(index, folder), 'application/zip');
          } finally {
            setZipping(false);
          }
        }}
      >
        {zipping ? 'Packing the folder…' : 'Download the folder (.zip)'}
      </button>
      <h3>Or on the machine, in one command</h3>
      <p>
        {applied
          ? 'Run this where the application is: it finds it (in a container, or in its folder), applies the kit, and says how to tell it where the application is when it cannot find it.'
          : 'Run this on the machine: it saves these files and the guide in a folder there, to copy from.'}
      </p>
      <Command label="The one command, for this kit" command={`curl -fsSL ${site}/install.sh | OLYMPUS_SITE=${site} sh -s -- --only ${applied ? 'kit' : 'doc'}:${dir}`} />
    </section>
  );
}
