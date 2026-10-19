import { useState } from 'react';
import { zipSync, strToU8 } from 'fflate';
import { PRODUCTS, type ParamKey, type ProductId, type Model } from '../../../src/manufacturing/products.ts';
import { modelVolume } from '../../../src/manufacturing/products.ts';
import { previewOf, type ModelFile } from '../../../src/manufacturing/files.ts';
import { download } from '../exporters.ts';
import { Notes, Section } from './ui.tsx';
import { Icon } from './Library.tsx';

export type ModelBuild = { model: Model; files: ModelFile[]; base: string };

type Props = {
  product: ProductId;
  values: Record<ParamKey, number>;
  build: ModelBuild | null;
  error: string | null;
  markMin: number | null;
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
  if (!blob) throw new Error('The browser could not encode the preview.');
  return new Uint8Array(await blob.arrayBuffer());
}

const typeOf = (path: string) => (path.endsWith('.stl') ? 'model/stl' : path.endsWith('.3mf') ? 'model/3mf' : path.endsWith('.svg') ? 'image/svg+xml' : 'text/plain');

export function ModelPanel({ product, values, build, error, markMin, onProduct, onParam, onReset }: Props) {
  const spec = PRODUCTS[product];
  const [busy, setBusy] = useState(false);
  const ok = build?.model.parts.every((p) => p.report.ok);

  async function pack() {
    if (!build) return;
    setBusy(true);
    try {
      const files: Record<string, Uint8Array> = {};
      for (const f of build.files) files[`${build.base}/${f.path}`] = typeof f.data === 'string' ? strToU8(f.data) : f.data;
      const preview = previewOf(build.model, build.base, { width: 1200, height: 900 });
      files[`${build.base}/${preview.path}`] = await pngOf(preview.rgba, preview.width, preview.height);
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
          {spec.params.map((p) => (
            <div className="param" key={p.key} title={p.hint}>
              <label htmlFor={`param-${p.key}`}>{p.label}</label>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={values[p.key]}
                onChange={(e) => onParam(p.key, Number(e.target.value))}
                aria-label={`${p.label} slider`}
              />
              <span className="param__value">
                <input id={`param-${p.key}`} className="input input--num" type="number" min={p.min} max={p.max} step={p.step} value={values[p.key]} onChange={(e) => e.target.value !== '' && onParam(p.key, Number(e.target.value))} />
                <span className="param__unit">{p.unit}</span>
              </span>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onReset}>
          Reset to suggested values
        </button>
        {markMin !== null && <p className="field__hint">The design prints cleanly from Ø {markMin} mm on a 0.4 mm nozzle (plus the flange).</p>}
      </Section>

      <Section title="Model">
        {error && <Notes items={[error]} tone="error" />}
        {build && (
          <>
            <dl className="facts">
              <dt>Size</dt>
              <dd>
                {build.model.size[0]} × {build.model.size[1]} × {build.model.size[2]} mm
              </dd>
              <dt>Volume</dt>
              <dd>
                {modelVolume(build.model).toFixed(1)} cm³ · ≤ {Math.ceil(modelVolume(build.model) * 1.24)} g PLA solid
              </dd>
              <dt>Mesh</dt>
              <dd className={ok ? '' : 'is-bad'}>
                {ok ? 'Valid' : 'Invalid'} · {build.model.parts.reduce((s, p) => s + p.report.triangles, 0).toLocaleString('en')} triangles
                {build.model.parts.length > 1 ? ` · ${build.model.parts.length} parts` : ''}
              </dd>
            </dl>
            <p className="field__hint">
              Closed and manifold, no self-intersection, volume as designed — checked on every build. The preview is drawn from these same triangles.
            </p>
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
          <Icon name="download" /> {busy ? 'Packing…' : 'Model pack (.zip)'}
        </button>
        <p className="field__hint">STL and 3MF for the slicer, the OpenSCAD source with its SVG, the preview, and a sheet with dimensions and printing notes.</p>
      </Section>
    </div>
  );
}
