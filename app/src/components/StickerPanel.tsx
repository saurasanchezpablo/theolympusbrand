import { useState } from 'react';
import { zipSync, strToU8 } from 'fflate';
import { PAPERS, STICKER_ARTS, STICKER_DEFAULTS, STICKER_STYLES, type Paper, type Sticker, type StickerArt, type StickerSpec, type StickerStyle } from '../../../src/manufacturing/stickers.ts';
import type { ModelFile } from '../../../src/manufacturing/files.ts';
import { download, svgToPng } from '../exporters.ts';
import { Notes, Section, Segmented } from './ui.tsx';
import { Icon } from './Library.tsx';

export type StickerBuild = { sticker: Sticker; files: ModelFile[]; base: string; perSheet: number; previews: Record<'flat' | 'laptop' | 'server' | 'sheet', string> };

type Props = {
  spec: StickerSpec;
  paper: Paper;
  build: StickerBuild | null;
  error: string | null;
  onSpec: (s: StickerSpec) => void;
  onPaper: (p: Paper) => void;
};

const SWATCH: Record<StickerStyle, { ground: string; ink: string }> = {
  white: { ground: '#FFFFFF', ink: '#1C1C1C' },
  dark: { ground: '#0E0E0E', ink: '#EDEDED' },
  'clear-dark': { ground: 'transparent', ink: '#1C1C1C' },
  'clear-light': { ground: 'transparent', ink: '#EDEDED' },
  'marble-light': { ground: 'marble-light', ink: '#1C1C1C' },
  'marble-dark': { ground: 'marble-dark', ink: '#EDEDED' },
};

function Slider({ label, unit, min, max, step, value, onChange, hint }: { label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; hint: string }) {
  const id = `sticker-${label.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <div className="param" title={hint}>
      <label htmlFor={id}>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={`${label} slider`} />
      <span className="param__value">
        <input id={id} className="input input--num" type="number" min={min} max={max} step={step} value={value} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} />
        <span className="param__unit">{unit}</span>
      </span>
    </div>
  );
}

const typeOf = (path: string) => (path.endsWith('.pdf') ? 'application/pdf' : path.endsWith('.svg') ? 'image/svg+xml' : 'text/plain');

export function StickerPanel({ spec, paper, build, error, onSpec, onPaper }: Props) {
  const set = (p: Partial<StickerSpec>) => onSpec({ ...spec, ...p });
  const [busy, setBusy] = useState(false);
  const st = build?.sticker;

  async function pack() {
    if (!build) return;
    setBusy(true);
    try {
      const files: Record<string, Uint8Array> = {};
      for (const f of build.files) files[`${build.base}/${f.path}`] = typeof f.data === 'string' ? strToU8(f.data) : f.data;
      files[`${build.base}/${build.base}-preview.png`] = await svgToPng(build.previews.flat, 1200);
      files[`${build.base}/${build.base}-mockup-laptop.png`] = await svgToPng(build.previews.laptop, 1600);
      files[`${build.base}/${build.base}-mockup-server.png`] = await svgToPng(build.previews.server, 1600);
      download(`${build.base}.zip`, zipSync(files, { level: 6 }), 'application/zip');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modelpanel">
      <Section title="Sticker">
        <div className="param param--choice">
          <span className="param__label">Design</span>
          <select className="select select--sm" value={spec.art} onChange={(e) => set({ art: e.target.value as StickerArt })} aria-label="Design">
            {(Object.keys(STICKER_ARTS) as StickerArt[]).map((a) => (
              <option key={a} value={a}>
                {STICKER_ARTS[a]}
              </option>
            ))}
          </select>
        </div>
        <div className="styles" role="radiogroup" aria-label="Colourway">
          {(Object.keys(STICKER_STYLES) as StickerStyle[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={spec.style === k} className={`stylechip${spec.style === k ? ' is-on' : ''}`} onClick={() => set({ style: k })} title={STICKER_STYLES[k].hint}>
              <span className={`stylechip__swatch stylechip__swatch--${SWATCH[k].ground === 'transparent' ? 'clear' : SWATCH[k].ground.startsWith('marble') ? SWATCH[k].ground : 'solid'}`} style={SWATCH[k].ground.startsWith('#') ? { background: SWATCH[k].ground } : undefined}>
                <span style={{ background: SWATCH[k].ink }} />
              </span>
              <span>{STICKER_STYLES[k].label}</span>
            </button>
          ))}
        </div>
        <p className="field__hint">{STICKER_STYLES[spec.style].hint}</p>
        <div className="params">
          <Slider label="Size" unit="mm" min={20} max={300} step={1} value={spec.size} onChange={(v) => set({ size: v })} hint="Longest side of the cut shape." />
          <Slider label="Border" unit="mm" min={0} max={10} step={0.5} value={spec.border} onChange={(v) => set({ border: v })} hint="Margin between the design and the cut." />
          <Slider label="Bleed" unit="mm" min={0} max={5} step={0.5} value={spec.bleed} onChange={(v) => set({ bleed: v })} hint="Ground printed past the cut — usually 2 mm; ask your provider." />
          <Slider label="Finest line" unit="mm" min={0.08} max={0.4} step={0.01} value={spec.finest} onChange={(v) => set({ finest: v })} hint="The finest line your provider prints reliably; it decides the edition and warns when too small." />
          <div className="param param--choice">
            <span className="param__label">Cut</span>
            <Segmented label="Cut shape" size="sm" value={spec.shape} onChange={(v) => set({ shape: v })} options={[{ value: 'contour', label: 'Contour' }, { value: 'rounded', label: 'Rounded' }]} />
          </div>
          <div className="param param--choice">
            <span className="param__label">Sheet paper</span>
            <select className="select select--sm" value={paper} onChange={(e) => onPaper(e.target.value as Paper)} aria-label="Sheet paper">
              {(Object.keys(PAPERS) as Paper[]).map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="btn btn--ghost btn--sm modelpanel__reset" onClick={() => onSpec(STICKER_DEFAULTS)}>
          Reset
        </button>
      </Section>

      <Section title="Production">
        {error && <Notes items={[error]} tone="error" />}
        {st && build && (
          <>
            <dl className="facts">
              <dt>File</dt>
              <dd>
                {st.width.toFixed(1)} × {st.height.toFixed(1)} mm <span className="facts__note">(with {st.spec.bleed} mm bleed)</span>
              </dd>
              <dt>Edition</dt>
              <dd>{st.spec.art === 'seal' ? 'Seal' : st.edition === 'fine' ? 'Fine' : 'Print'}</dd>
              <dt>Substrate</dt>
              <dd>{STICKER_STYLES[st.spec.style].substrate}</dd>
              <dt>Per sheet</dt>
              <dd>
                {build.perSheet} on {paper.toUpperCase()}
              </dd>
            </dl>
            <Notes items={st.warnings} tone="warn" />
            <ul className="printnotes">
              {st.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="Download">
        <div className="downloads">
          {build?.files
            .filter((f) => /\.(pdf|svg)$/.test(f.path))
            .map((f) => (
              <button key={f.path} type="button" className="btn btn--sm" onClick={() => download(f.path, f.data, typeOf(f.path))}>
                {f.path.endsWith('-cutline.svg') ? 'Cut path SVG' : f.path.endsWith('-sheet.pdf') ? `${paper.toUpperCase()} sheet PDF` : f.path.split('.').pop()!.toUpperCase()}
              </button>
            ))}
        </div>
        <button type="button" className="btn btn--primary" disabled={!build || busy} onClick={pack}>
          <Icon name="download" /> {busy ? 'Packing…' : 'Sticker pack (.zip)'}
        </button>
        <p className="field__hint">PDF and SVG with the layers a print shop expects (Bleed, Artwork, White, CutContour), the cut path alone, a sheet, previews and mockups.</p>
      </Section>
    </div>
  );
}
