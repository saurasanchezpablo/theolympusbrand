import { useRef, useState } from 'react';
import { productionSvg } from '../../../src/render/svg.ts';
import { slugify, type Service, type ServiceSpec } from '../../../src/catalog/service.ts';
import { CATEGORIES, GODS, initialOf, type Category, type GodId } from '../../../src/geometry/pantheon.ts';
import { THEME_KITS } from '../../../src/integrations/themes/index.ts';
import { CATEGORY_LIST, GOD_LIST, defaultGodOf, sealFor, title, type Draft, type Logo } from '../model.ts';
import { Field, Notes, Section, SvgImage } from './ui.tsx';
import { Icon } from './Library.tsx';

type Props = {
  draft: Draft;
  service: Service;
  logo: Logo;
  issues: string[];
  warnings: string[];
  onChange: (d: Draft) => void;
};

export function Config({ draft, service, logo, issues, warnings, onChange }: Props) {
  const spec = draft.spec;
  const setSpec = (p: Partial<ServiceSpec>, extra: Partial<Draft> = {}) => {
    const next = { ...spec, ...p };
    for (const k of Object.keys(next) as (keyof ServiceSpec)[]) if (next[k] === undefined || next[k] === '') delete next[k];
    onChange({ ...draft, ...extra, spec: next as ServiceSpec });
  };
  const fileRef = useRef<HTMLInputElement>(null);

  const isMonogram = spec.god === 'monogram' || (!spec.god && !defaultGodOf(spec.category));
  const chosenGod: GodId | 'monogram' = isMonogram ? 'monogram' : ((spec.god as GodId | undefined) ?? defaultGodOf(spec.category)!);
  const defaultGod = defaultGodOf(spec.category);
  const pickPatron = (g: GodId | 'monogram') => {
    if (g === 'monogram') setSpec({ god: defaultGod ? 'monogram' : undefined });
    else setSpec({ god: g === defaultGod ? undefined : g });
  };
  const defaultCaption = 'god' in service.patron ? `The Olympus · ${GODS[service.patron.god].name}` : 'The Olympus';

  const [logoError, setLogoError] = useState<string | null>(null);
  async function onLogoFile(file: File | undefined) {
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';
    // A logo is a few shapes; a much larger file would only stall the page.
    if (file.size > 512 * 1024) {
      setLogoError(`${file.name} is ${Math.round(file.size / 1024)} KB: a logo SVG must be under 512 KB.`);
      return;
    }
    setLogoError(null);
    onChange({ ...draft, logoSvg: await file.text() });
  }

  return (
    <section className="config" aria-label="Configuration">
      <Notes items={logoError ? [...issues, logoError] : issues} tone="error" />

      <Section title="Service">
        <Field label="Name" hint="Shown in the lockups, set in Cinzel.">
          {(id) => (
            <input
              id={id}
              className="input"
              value={spec.name}
              maxLength={40}
              onChange={(e) => setSpec({ name: e.target.value, ...(draft.autoId ? { id: slugify(e.target.value) || 'service' } : {}) })}
            />
          )}
        </Field>
        <Field label="Identifier" hint="File and folder name: lowercase letters, digits and hyphens.">
          {(id) => (
            <div className="input-row">
              <input id={id} className="input input--mono" value={spec.id} onChange={(e) => setSpec({ id: e.target.value.toLowerCase() }, { autoId: false })} />
              {!draft.autoId && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSpec({ id: slugify(spec.name) || 'service' }, { autoId: true })}>
                  From name
                </button>
              )}
            </div>
          )}
        </Field>
        <Field label="Address" hint="Optional — where the service lives, e.g. https://jellyfin.theolympus.cloud. QR labels and nameplates point here.">
          {(id) => <input id={id} className="input input--mono" type="url" value={spec.url ?? ''} placeholder="https://…" maxLength={120} onChange={(e) => setSpec({ url: e.target.value.trim() })} />}
        </Field>
        <Field label="Application" hint="Optional — the app this service runs. Its theme kit (in the asset pack’s dashboards and in Downloads) is then made from this seal.">
          {(id) => (
            <select id={id} className="select" value={spec.app ?? ''} onChange={(e) => setSpec({ app: e.target.value || undefined })}>
              <option value="">None</option>
              {THEME_KITS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Description" hint="Optional — for the library and the preview board.">
          {(id) => <input id={id} className="input" value={spec.description ?? ''} maxLength={80} onChange={(e) => setSpec({ description: e.target.value })} />}
        </Field>
      </Section>

      <Section title="Patron">
        <Field label="Category" hint={CATEGORIES[spec.category]}>
          {(id) => (
            <select id={id} className="select" value={spec.category} onChange={(e) => setSpec({ category: e.target.value as Category, god: undefined })}>
              {CATEGORY_LIST.map(([c]) => {
                const g = defaultGodOf(c);
                return (
                  <option key={c} value={c}>
                    {title(c.toUpperCase())} — {g ? title(GODS[g].name) : 'monogram'}
                  </option>
                );
              })}
            </select>
          )}
        </Field>
        <div className="patrons" role="radiogroup" aria-label="Patron in the central bay">
          {GOD_LIST.map((g) => (
            <button key={g.id} type="button" role="radio" aria-checked={chosenGod === g.id} className={`patron${chosenGod === g.id ? ' is-on' : ''}`} onClick={() => pickPatron(g.id)} title={`${title(g.name)} — ${g.title}. ${g.attribute}.`}>
              <SvgImage className="patron__seal" svg={productionSvg(sealFor({ god: g.id }), { ground: 'transparent' })} alt="" />
              <span className="patron__name">{title(g.name)}</span>
              {g.id === defaultGod && <span className="patron__default">default</span>}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={chosenGod === 'monogram'} className={`patron${chosenGod === 'monogram' ? ' is-on' : ''}`} onClick={() => pickPatron('monogram')} title="The service's initial, cut in Cinzel">
            <SvgImage className="patron__seal" svg={productionSvg(sealFor({ monogram: service.letter }), { ground: 'transparent' })} alt="" />
            <span className="patron__name">Monogram</span>
            {!defaultGod && <span className="patron__default">default</span>}
          </button>
        </div>
        <p className="field__hint patron__about">
          {'god' in service.patron ? (
            <>
              <strong>{title(GODS[service.patron.god].name)}</strong>, {GODS[service.patron.god].title.charAt(0).toLowerCase() + GODS[service.patron.god].title.slice(1)}. In the bay: {GODS[service.patron.god].attribute.toLowerCase()}.
            </>
          ) : (
            <>The service’s initial stands in the bay, cut heavy enough to print.</>
          )}
        </p>
        {isMonogram && (
          <Field label="Monogram letter" hint={`Defaults to the name’s initial (${initialOf(spec.name)}).`}>
            {(id) => (
              <input
                id={id}
                className="input input--letter"
                value={spec.monogram ?? ''}
                placeholder={initialOf(spec.name)}
                maxLength={1}
                onChange={(e) => setSpec({ monogram: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') || undefined })}
              />
            )}
          </Field>
        )}
      </Section>

      <Section title="Logo slot">
        <p className="field__hint">The medallion on the clouds. Fine edition only — print editions always carry the temple glyph, since no logo keeps its shape at that size.</p>
        <div className="slot">
          <div className="slot__preview">
            {logo && 'd' in logo ? (
              <SvgImage svg={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${logoBox(logo.d)}"><path d="${logo.d}" fill="#1C1C1C"/></svg>`} alt="Imported logo" />
            ) : (
              <SvgImage svg={productionSvg(sealFor(service.patron), { ground: 'transparent' })} alt="Patron seal" />
            )}
          </div>
          <div className="slot__text">
            <strong>{logo && 'd' in logo ? 'Application logo' : 'Patron’s seal'}</strong>
            <span>{logo && 'd' in logo ? 'Reduced to one ink; white fills become cut-outs.' : 'The default: the god’s seal, as on the favicon.'}</span>
            <div className="slot__actions">
              <button type="button" className="btn btn--sm" onClick={() => fileRef.current?.click()}>
                <Icon name="upload" /> {draft.logoSvg ? 'Replace logo' : 'Use an SVG logo…'}
              </button>
              {draft.logoSvg && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange({ ...draft, logoSvg: undefined, spec: withoutLogo(spec) })}>
                  Use the seal
                </button>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => onLogoFile(e.target.files?.[0])} />
        </div>
        {logo && 'error' in logo && <Notes items={[`This SVG could not be used: ${logo.error}`]} tone="error" />}
      </Section>

      <Section title="Lockup">
        <Field label="Caption" hint={`The line under the name. Leave empty for “${defaultCaption}”.`}>
          {(id) => <input id={id} className="input" value={spec.caption ?? ''} placeholder={defaultCaption} maxLength={48} onChange={(e) => setSpec({ caption: e.target.value })} />}
        </Field>
      </Section>

      <Notes items={warnings} tone="warn" />
    </section>
  );
}

function withoutLogo(spec: ServiceSpec): ServiceSpec {
  const { logo: _, ...rest } = spec;
  return rest;
}

/** A viewBox around path data, from its numbers (good enough for a thumbnail). */
function logoBox(d: string): string {
  const n = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = Math.max(x1 - x0, y1 - y0) * 0.08;
  return `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`;
}

export function MasterCard({ onNew }: { onNew: () => void }) {
  return (
    <section className="config" aria-label="Configuration">
      <Section title="The master">
        <p className="prose">
          The master crest is fixed: rim, border, temple, thunderbolt, name plinth and clouds never change, and Zeus keeps the bay. Every service variant is built on it and changes only what the system allows — the patron in the bay, the logo slot and the lockup.
        </p>
        <button type="button" className="btn btn--primary" onClick={onNew}>
          <Icon name="plus" /> New service from the master
        </button>
      </Section>
    </section>
  );
}
