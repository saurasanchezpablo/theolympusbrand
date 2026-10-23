// A place, opened: the building on its own, its name, what it is, where it
// is, whether it answers, and the way to the next place or back to the
// island. A marble panel beside the map on a desktop, a sheet from the bottom
// on a phone. Everything shown as text: names come from the server's data.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MapEntry } from '../../../../src/map/items.ts';
import { building } from '../../../../src/map/buildings/index.ts';
import { copyText } from '../Command.tsx';

const label = (category: string | undefined) => (category ? category[0].toUpperCase() + category.slice(1) : '');

export function LocationPanel({
  entry,
  index,
  count,
  portrait,
  onPrev,
  onNext,
  onBack,
  children,
}: {
  entry: MapEntry;
  index: number;
  count: number;
  portrait: string | null;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  children?: ReactNode;
}) {
  const kind = building(entry.place.building);
  const address = entry.url ?? entry.ip ?? entry.hostname;
  const [copied, setCopied] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  // Arriving at a place moves the keyboard's focus to its name.
  useEffect(() => title.current?.focus({ preventScroll: true }), [entry.id]);
  return (
    <section className="place" aria-labelledby="place-title" key={entry.id}>
      <header className="place__bar">
        <span>
          {entry.kind === 'machine' ? 'Machine' : label(entry.category) || 'Service'} · {index + 1} of {count}
        </span>
        <button type="button" className="place__close" onClick={onBack} aria-label="Back to the island">
          ×
        </button>
      </header>
      <div className="place__body">
        <figure className="place__portrait">
          {portrait ? <img src={portrait} alt="" width="720" height="440" /> : (entry.logo || entry.seal) && <img className="place__seal" src={entry.logo ?? entry.seal} alt="" width="120" height="120" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />}
          {kind && <figcaption>{kind.name}, as it stands on the island</figcaption>}
        </figure>
        <h2 id="place-title" ref={title} tabIndex={-1}>
          {entry.name}
        </h2>
        {entry.description && <p className="place__about">{entry.description}</p>}
        <dl className="place__facts">
          {entry.url && (
            <>
              <dt>Address</dt>
              <dd className="place__mono">{entry.url}</dd>
            </>
          )}
          {entry.ip && (
            <>
              <dt>Network address</dt>
              <dd className="place__mono">{entry.ip}</dd>
            </>
          )}
          {entry.hostname && (
            <>
              <dt>Host name</dt>
              <dd className="place__mono">{entry.hostname}</dd>
            </>
          )}
          {entry.os && (
            <>
              <dt>System</dt>
              <dd>{entry.os}</dd>
            </>
          )}
          {entry.role && (
            <>
              <dt>Role</dt>
              <dd>{entry.role}</dd>
            </>
          )}
        </dl>
        <div className="place__actions">
          {entry.url && /^https?:\/\//.test(entry.url) && (
            <a className="place__primary" href={entry.url} target="_blank" rel="noreferrer">
              Open {entry.name}
            </a>
          )}
          {address && (
            <button
              type="button"
              className="place__secondary"
              onClick={async () => {
                if (await copyText(address)) {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                }
              }}
            >
              {copied ? 'Copied' : 'Copy the address'}
            </button>
          )}
        </div>
        {children}
      </div>
      <nav className="place__nav" aria-label="Places">
        <button type="button" onClick={onPrev} aria-label="Previous place">
          ‹ <span>Previous</span>
        </button>
        <button type="button" onClick={onBack}>
          The island
        </button>
        <button type="button" onClick={onNext} aria-label="Next place">
          <span>Next</span> ›
        </button>
      </nav>
    </section>
  );
}
