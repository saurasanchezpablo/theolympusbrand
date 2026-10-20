import { useState } from 'react';
import { zipSync, strToU8 } from 'fflate';
import { PRODUCTS, estimate, modelVolume, type Model, type ParamKey, type ParamSpec, type PrintSettings, type ProductId } from '../../../src/manufacturing/products.ts';
import { modelImages, type ModelFile } from '../../../src/manufacturing/files.ts';
import { download } from '../exporters.ts';
import { Notes, Section, Segmented } from './ui.tsx';
import { Icon } from './Library.tsx';

export type ModelBuild = { model: Model; files: ModelFile[]; base: string };

type Props = {
  product: ProductId;
  values: Record<ParamKey, number>;
  build: ModelBuild | null;
  error: string | null;
  markMin: number | null;
  settings: PrintSettings;
  onSettings: (s: PrintSettings) => void;
  onProduct: (p: ProductId) => void;
  onParam: (k: ParamKey, v: number) => void;
  onReset: () => void;
};

async function pngOf(rgba: Uint8ClampedArray, width: number, height: number): Promise<Uint8Array> {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('The browser could not encode an image.');
  return new Uint8Array(await blob.arrayBuffer());
}

const typeOf = (path: string) => (path.endsWith('.stl') ? 'model/stl' : path.endsWith('.3mf') ? 'model/3mf' : path.endsWith('.svg') ? 'image/svg+xml' : 'text/plain');

const MATERIALS = [
  { label: 'PLA', density: 1.24 },
  { label: 'PETG', density: 1.27 },
  { label: 'ABS', density: 1.04 },
];

function Param({ p, value, onChange }: { p: ParamSpec; value: number; onChange: (v: number) => void }) {
  if (p.kind === 'toggle')
    return (
      <label className="param param--toggle" title={p.hint}>
        <input type="checkbox" checked={value === 1} onChange={(e) => onChange(e.target.checked ? 1 : 0)} />
        <span>
          <strong>{p.label}</strong>
          <span className="field__hint">{p.hint}</span>
        </span>
      </label>
    );
  if (p.kind === 'choice')
    return (
      <div className="param param--choice" title={p.hint}>
        <span className="param__label">{p.label}</span>
        <Segmented label={p.label} size="sm" value={String(value)} onChange={(v) => onChange(Number(v))} options={p.options!.map((o, i) => ({ value: String(i), label: o }))} />
      </div>
    );
  return (
    <div className="param" title={p.hint}>
      <label htmlFor={`param-${p.key}`}>{p.label}</label>
      <input type="range" min={p.min} max={p.max} step={p.step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={`${p.label} slider`} />
      <span className="param__value">
        <input id={`param-${p.key}`} className="input input--num" type="number" min={p.min} max={p.max} step={p.step} value={value} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} />
        <span className="param__unit">{p.unit}</span>
      </span>
    </div>
  );
}

export function ModelPanel({ product, values, build, error, markMin, settings, onSettings, onProduct, onParam, onReset }: Props) {
  const spec = PRODUCTS[product];
  const [busy, setBusy] = useState(false);
  const ok = build?.model.parts.every((p) => p.report.ok);
  const shape = spec.params.filter((p) => p.group === 'shape');
  const back = spec.params.filter((p) => p.group === 'back');
  const magnetsOn = values.magnets > 0;
  const est = build ? estimate(build.model, settings) : null;

  async function pack() {
    if (!build) return;
    setBusy(true);
    try {
      // Rendering the previews takes a moment; let the button update first.
      await new Promise((r) => setTimeout(r, 30));
      const files: Record<string, Uint8Array> = {};
      for (const f of build.files) files[`${build.base}/${f.path}`] = typeof f.data === 'string' ? strToU8(f.data) : f.data;
      for (const img of modelImages(build.model, build.base)) files[`${build.base}/${img.path}`] = await pngOf(img.rgba, img.width, img.height);
      download(`${build.base}.zip`, zipSync(files, { level: 6 }), 'application/zip');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modelpanel">
      <Section title="3D print">
        <div className="products" role="radiogroup" aria-label="Product">
          {(Object.keys(PRODUCTS) as ProductId[]).map((id) => (
            <button key={id} type="button" role="radio" aria-checked={id === product} className={`product${id === product ? ' is-on' : ''}`} onClick={() => onProduct(id)}>
              {PRODUCTS[id].name}
            </button>
          ))}
        </div>
        <p className="field__hint">{spec.summary}</p>
        <div className="params">
          {shape.map((p) => (
            <Param key={p.key} p={p} value={values[p.key]} onChange={(v) => onParam(p.key, v)} />
          ))}
        </div>
        {markMin !== null && <p className="field__hint">The design prints cleanly from Ø {markMin} mm on a 0.4 mm nozzle.</p>}
      </Section>

      {back.length > 0 && (
        <Section title="Back of the plate">
          <div className="params">
            {back
              .filter((p) => magnetsOn || (p.key !== 'magnetDiameter' && p.key !== 'magnetDepth'))
              .map((p) => (
                <Param key={p.key} p={p} value={values[p.key]} onChange={(v) => onParam(p.key, v)} />
              ))}
          </div>
        </Section>
      )}
      <button type="button" className="btn btn--ghost btn--sm modelpanel__reset" onClick={onReset}>
        Reset to suggested values
      </button>

      <Section title="Print settings">
        <div className="settings">
          <label>
            Layer height
            <select className="select select--sm" value={settings.layer} onChange={(e) => onSettings({ ...settings, layer: Number(e.target.value) })}>
              {[0.08, 0.12, 0.15, 0.16, 0.2, 0.24, 0.28].map((l) => (
                <option key={l} value={l}>
                  {l.toFixed(2)} mm
                </option>
              ))}
            </select>
          </label>
          <label>
            Infill
            <select className="select select--sm" value={settings.infill} onChange={(e) => onSettings({ ...settings, infill: Number(e.target.value) })}>
              {[10, 15, 20, 30, 50, 100].map((v) => (
                <option key={v} value={v}>
                  {v} %
                </option>
              ))}
            </select>
          </label>
          <label>
            Filament
            <select className="select select--sm" value={settings.filament} onChange={(e) => onSettings({ ...settings, filament: Number(e.target.value) })}>
              <option value={1.75}>1.75 mm</option>
              <option value={2.85}>2.85 mm</option>
            </select>
          </label>
          <label>
            Material
            <select className="select select--sm" value={settings.density} onChange={(e) => onSettings({ ...settings, density: Number(e.target.value) })}>
              {MATERIALS.map((m) => (
                <option key={m.label} value={m.density}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <Section title="Model">
        {error && <Notes items={[error]} tone="error" />}
        {build && est && (
          <>
            <dl className="facts">
              <dt>Size</dt>
              <dd>
                {build.model.size[0]} × {build.model.size[1]} × {build.model.size[2]} mm
              </dd>
              <dt>Filament</dt>
              <dd>
                ≈ {Math.round(est.grams)} g · {est.metres.toFixed(1)} m <span className="facts__note">({modelVolume(build.model).toFixed(1)} cm³, estimate)</span>
              </dd>
              <dt>Mesh</dt>
              <dd className={ok ? '' : 'is-bad'}>
                {ok ? 'Valid' : 'Invalid'} · {build.model.parts.reduce((s, p) => s + p.report.triangles, 0).toLocaleString('en')} triangles
                {build.model.parts.length > 1 ? ` · ${build.model.parts.length} parts` : ''}
              </dd>
              {build.model.back.length > 0 && (
                <>
                  <dt>Back</dt>
                  <dd>{build.model.back.map((f) => (f.kind === 'magnets' ? `${f.centres.length} magnet${f.centres.length > 1 ? 's' : ''}` : f.kind === 'keyhole' ? 'keyhole' : f.kind === 'recess' ? 'pad recess' : 'inscription')).join(' · ')}</dd>
                </>
              )}
            </dl>
            <p className="field__hint">Closed and manifold, no self-intersection, volume as designed — checked on every build. The views are drawn from these same triangles.</p>
            <Notes items={build.model.warnings} tone="warn" />
            <ul className="printnotes">
              {build.model.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="Download">
        <div className="downloads">
          {build?.files
            .filter((f) => /\.(stl|3mf|scad)$/.test(f.path))
            .map((f) => (
              <button key={f.path} type="button" className="btn btn--sm" disabled={!ok} onClick={() => download(f.path, f.data, typeOf(f.path))}>
                {f.path.split('.').pop()!.toUpperCase()}
                {f.path.endsWith('.stl') && build.model.parts.length > 1 ? ` · ${f.path.replace(/^.*-(\w+)\.stl$/, '$1')}` : ''}
              </button>
            ))}
        </div>
        <button type="button" className="btn btn--primary" disabled={!build || !ok || busy} onClick={pack}>
          <Icon name="download" /> {busy ? 'Rendering and packing…' : 'Model pack (.zip)'}
        </button>
        <p className="field__hint">STL and 3MF for the slicer, the OpenSCAD source with what it reads, previews (front, back{build?.model.lithophane ? ', backlit' : ''}), and a sheet with dimensions, estimates and printing notes.</p>
      </Section>
    </div>
  );
}
