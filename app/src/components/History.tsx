import { productionSvg } from '../../../src/render/svg.ts';
import { SPEC_KEYS, type ServiceSpec } from '../../../src/catalog/service.ts';
import type { Design, DesignVersion } from '../../../src/catalog/design.ts';
import { renderableService, sealFor } from '../model.ts';
import { Section, SvgImage } from './ui.tsx';

type Props = {
  design: Design;
  /** Open an earlier version as unsaved changes. */
  onRestore: (v: DesignVersion) => void;
};

const LABELS: Record<string, string> = { id: 'identifier', name: 'name', category: 'category', god: 'patron', monogram: 'monogram', caption: 'caption', url: 'address', description: 'description', logo: 'logo' };

/** What changed from one version to the next, in words. */
function changes(from: DesignVersion, to: DesignVersion): string {
  const keys = SPEC_KEYS.filter((k) => k !== 'logo' && (from.spec as Partial<ServiceSpec>)[k] !== (to.spec as Partial<ServiceSpec>)[k]).map((k) => LABELS[k]);
  if ((from.logoSvg ?? '') !== (to.logoSvg ?? '')) keys.push(LABELS.logo);
  return keys.length ? `Changed: ${keys.join(', ')}` : 'No changes';
}

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

/** The saved versions of a design, newest first, each one restorable. */
export function History({ design, onRestore }: Props) {
  const current: DesignVersion = { version: design.version, updated: design.updated, spec: design.spec, logoSvg: design.logoSvg };
  const all = [...(design.history ?? []), current];
  const rows = all.map((v, i) => ({ v, note: i === 0 ? 'First saved' : changes(all[i - 1], v) })).reverse();
  if (rows.length < 2) return null;
  return (
    <div className="versions">
      <Section title="History">
        <ol className="history" aria-label="Saved versions">
          {rows.map(({ v, note }) => {
            const s = renderableService(v.spec);
            const isCurrent = v.version === design.version;
            return (
              <li key={v.version} className={`history__row${isCurrent ? ' is-current' : ''}`}>
                <SvgImage className="history__seal" svg={productionSvg(sealFor(s.patron), { ground: 'transparent' })} alt="" />
                <span className="history__text">
                  <strong>
                    Version {v.version}
                    {isCurrent ? ' · saved' : ''}
                  </strong>
                  <span>{when(v.updated)}</span>
                  <span className="history__note">
                    {s.name} — {note}
                  </span>
                </span>
                {!isCurrent && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onRestore(v)} aria-label={`Restore version ${v.version}`}>
                    Restore
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        <p className="field__hint">Restoring opens that version as unsaved changes; saving it makes a new version, so nothing is lost. The last 15 versions are kept.</p>
      </Section>
    </div>
  );
}
