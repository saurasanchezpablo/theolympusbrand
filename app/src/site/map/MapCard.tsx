// A building's card: what the service or machine is, where it is, and whether
// it answers. Everything shown as text — names come from the server's data.

import type { MapEntry } from '../../../../src/map/items.ts';
import { building } from '../../../../src/map/buildings/index.ts';

const ago = (iso: string | undefined) => {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`;
};

export function MapCard({ entry, state, checked, onClose, children }: { entry: MapEntry; state?: 'up' | 'down' | 'unknown'; checked?: string; onClose: () => void; children?: React.ReactNode }) {
  const kind = building(entry.place.building);
  const address = entry.ip ?? entry.hostname;
  return (
    <section className="map-card" aria-labelledby="map-card-title">
      <header className="map-card__head">
        {(entry.logo || entry.seal) && (
          // A service added a moment ago has no seal until the house is rebuilt for it.
          <img key={entry.logo ?? entry.seal} className="map-card__seal" src={entry.logo ?? entry.seal} alt="" width="56" height="56" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
        )}
        <div>
          <h2 id="map-card-title">{entry.name}</h2>
          <p className="map-card__kind">
            {entry.kind === 'machine' ? 'Machine' : 'Service'}
            {kind ? ` · ${kind.name}` : ''}
          </p>
        </div>
        <button type="button" className="icon-btn map-card__close" onClick={onClose} aria-label="Close the card">
          ×
        </button>
      </header>
      {entry.description && <p className="map-card__about">{entry.description}</p>}
      <dl className="map-card__facts">
        {entry.url && (
          <>
            <dt>Address</dt>
            <dd>
              <span className="map-card__mono">{entry.url}</span>
              {/^https?:\/\//.test(entry.url) && (
                <a className="btn btn--sm" href={entry.url} target="_blank" rel="noreferrer">
                  Open
                </a>
              )}
            </dd>
          </>
        )}
        {entry.ip && (
          <>
            <dt>Network address</dt>
            <dd className="map-card__mono">{entry.ip}</dd>
          </>
        )}
        {entry.hostname && (
          <>
            <dt>Host name</dt>
            <dd className="map-card__mono">{entry.hostname}</dd>
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
        {(address || entry.url) && (
          <>
            <dt>Answers</dt>
            <dd>
              <span className={`map-dot map-dot--${state ?? 'unknown'}`} aria-hidden="true" />
              {state === 'up' ? 'Online' : state === 'down' ? 'Offline' : 'Not checked'}
              {checked && state && state !== 'unknown' && <span className="map-card__when"> · checked {ago(checked)}</span>}
            </dd>
          </>
        )}
      </dl>
      {children}
    </section>
  );
}
