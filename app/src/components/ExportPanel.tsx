import { useState } from 'react';
import { GROUNDS, type MarkKey } from '../../../src/catalog/fileset.ts';
import type { Mark } from '../../../src/geometry/crest.ts';
import { download, fileName, markSvg, presentationSvg, svgToPng } from '../exporters.ts';
import { markKeyOf, type CanvasState } from './Canvas.tsx';
import { Section } from './ui.tsx';
import { Icon } from './Library.tsx';

const VARIANTS = [
  { suffix: '', label: 'Transparent · dark ink' },
  { suffix: '-white', label: 'Transparent · white ink' },
  { suffix: '-on-light', label: 'On light ground' },
  { suffix: '-on-dark', label: 'On dark ground' },
];

type Props = {
  canvas: CanvasState;
  marks: Partial<Record<MarkKey, Mark>>;
  id: string;
  name: string;
  /** Null for the master, whose full set already lives in assets/master. */
  onPack: (() => Promise<void>) | null;
  onDesignFile: (() => void) | null;
  packProgress: number | null;
  disabledReason: string | null;
};

export function ExportPanel({ canvas, marks, id, name, onPack, onDesignFile, packProgress, disabledReason }: Props) {
  const key = markKeyOf(canvas.view, canvas.edition);
  const mark = key ? marks[key] : undefined;
  const [variant, setVariant] = useState('');
  const [width, setWidth] = useState(1024);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const treated = canvas.surface !== 'flat' && ['crest', 'emblem', 'seal'].includes(canvas.view);
  const wide = Boolean(mark?.width);
  const g = GROUNDS.find((x) => x.suffix === variant)!;
  const titleOf = (k: string) => `The Olympus — ${name} — ${k.replace('-', ' ')}`;

  async function run(job: () => Promise<void> | void) {
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="export">
      <Section title="Export">
        {mark && key ? (
          <div className="export__view">
            <p className="export__what">
              This view · <span className="mono">{fileName(id, key, variant)}</span>
            </p>
            <div className="input-row">
              <select className="select select--sm" value={variant} onChange={(e) => setVariant(e.target.value)} aria-label="File ground">
                {VARIANTS.map((v) => (
                  <option key={v.suffix} value={v.suffix}>
                    {v.label}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn--sm" disabled={busy} onClick={() => run(() => download(fileName(id, key, variant), markSvg(mark, g, titleOf(key)), 'image/svg+xml'))}>
                SVG
              </button>
            </div>
            <div className="input-row">
              <select className="select select--sm" value={width} onChange={(e) => setWidth(Number(e.target.value))} aria-label="PNG width">
                {(wide ? [800, 1600, 3200] : [64, 128, 256, 512, 1024, 2048]).map((w) => (
                  <option key={w} value={w}>
                    {w} px wide
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn--sm" disabled={busy} onClick={() => run(async () => download(fileName(id, key, `${variant}-${width}`, 'png'), await svgToPng(markSvg(mark, g, titleOf(key)), width), 'image/png'))}>
                PNG
              </button>
            </div>
            {treated && (
              <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => run(async () => download(fileName(id, key, `-${canvas.surface}-mockup`, 'png'), await svgToPng(presentationSvg(mark, canvas.surface as never), 2048), 'image/png'))}>
                Presentation render (PNG mockup)
              </button>
            )}
          </div>
        ) : (
          <p className="field__hint">Choose the crest, emblem, seal or a lockup to export a single file.</p>
        )}

        {onPack && (
          <div className="export__all">
            <button type="button" className="btn btn--primary" disabled={busy || packProgress !== null || Boolean(disabledReason)} onClick={() => run(onPack)} title={disabledReason ?? undefined}>
              <Icon name="download" /> {packProgress !== null ? `Building… ${Math.round(packProgress * 100)}%` : 'Asset pack (.zip)'}
            </button>
            <p className="field__hint">
              Every SVG on four grounds, PNGs, favicon.ico, manifest — the same set as <span className="mono">npm run service</span> — plus the catalogue file to drop into the repository.
            </p>
            {onDesignFile && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={onDesignFile}>
                Design file (.json)
              </button>
            )}
          </div>
        )}
        {(error || disabledReason) && <p className="notes notes--error">{error ?? disabledReason}</p>}
      </Section>
    </div>
  );
}
