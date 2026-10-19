import { productionSvg, treatmentSvg, type Ground } from '../../../src/render/svg.ts';
import type { Mark } from '../../../src/geometry/crest.ts';
import type { MarkKey } from '../../../src/catalog/fileset.ts';
import type { PrintReport } from '../../../src/print/service.ts';
import type { ReactNode } from 'react';
import { PALETTE } from '../../../src/brand/palette.ts';
import { Segmented, SvgImage } from './ui.tsx';

export type View = 'crest' | 'emblem' | 'seal' | 'lockup-horizontal' | 'lockup-vertical' | 'sizes' | 'model';
export type Edition = 'fine' | 'print';
export type Surface = 'flat' | 'relief-white' | 'relief-black' | 'engraved';

export type CanvasState = { view: View; edition: Edition; surface: Surface; ground: Ground };

/** Which mark a view shows. */
export function markKeyOf(view: View, edition: Edition): MarkKey | null {
  if (view === 'crest' || view === 'emblem') return `${view}-${edition}`;
  if (view === 'seal' || view === 'lockup-horizontal' || view === 'lockup-vertical') return view;
  return null;
}

const square = (v: View) => v === 'crest' || v === 'emblem' || v === 'seal';

type Props = {
  /** The printable model's view, shown when the view is "model". */
  model: ReactNode;
  state: CanvasState;
  onChange: (s: CanvasState) => void;
  marks: Partial<Record<MarkKey, Mark>>;
  isMaster: boolean;
  name: string;
  print: PrintReport | null;
};

export function Canvas({ model, state, onChange, marks, isMaster, name, print }: Props) {
  const { view, edition, surface, ground } = state;
  const set = (p: Partial<CanvasState>) => onChange({ ...state, ...p });
  const key = markKeyOf(view, edition);
  const mark = key ? marks[key] : undefined;
  const treated = surface !== 'flat' && square(view);

  let stage: ReactNode = null;
  if (view === 'model') stage = model;
  else if (view === 'sizes') stage = <SizeSheet marks={marks} ground={ground} />;
  else if (mark) {
    // The stage is the ground; the mark sits on it exactly as the transparent file would.
    const svg = treated ? treatmentSvg(mark, surface, { size: 1024 }) : productionSvg(mark, { ground: 'transparent', ink: ground === 'dark' ? PALETTE.marble : undefined, size: 1024 });
    stage = <SvgImage className={`stage__mark${mark.width ? ' stage__mark--wide' : ''}`} svg={svg} alt={`${name} — ${view.replace('-', ' ')}`} />;
  }

  const flatOnly = view === 'model';
  const stageGround = view === 'model' ? 'model' : treated ? `t-${surface}` : ground;

  return (
    <main className="canvas" aria-label="Design canvas">
      <div className="canvas__bar">
        <Segmented
          label="View"
          value={view}
          onChange={(v) => set({ view: v })}
          options={[
            { value: 'crest', label: 'Crest' },
            { value: 'emblem', label: 'Emblem' },
            { value: 'seal', label: 'Seal' },
            { value: 'lockup-horizontal', label: 'Horizontal', disabled: isMaster, hint: isMaster ? 'Lockups carry a service name' : 'Crest with the service name beside it' },
            { value: 'lockup-vertical', label: 'Vertical', disabled: isMaster, hint: isMaster ? 'Lockups carry a service name' : 'Crest with the service name beneath it' },
            { value: 'sizes', label: 'Small sizes' },
            { value: 'model', label: '3D print', hint: 'Printable models: medallions, tokens, stand' },
          ]}
        />
        <div className="canvas__bar-right" hidden={flatOnly}>
          <Segmented
            label="Edition"
            size="sm"
            value={edition}
            onChange={(v) => set({ edition: v })}
            options={[
              { value: 'fine', label: 'Fine', disabled: !(view === 'crest' || view === 'emblem'), hint: 'Screens and large print' },
              { value: 'print', label: 'Print', disabled: !(view === 'crest' || view === 'emblem'), hint: 'Filament-safe: heavier details, single polygon path' },
            ]}
          />
        </div>
      </div>

      <div className={`stage stage--${stageGround}${view === 'sizes' ? ' stage--sheet' : ''}`}>{stage}</div>

      <div className="canvas__bar canvas__bar--bottom" hidden={flatOnly}>
        <Segmented
          label="Surface"
          size="sm"
          value={surface}
          onChange={(v) => set({ surface: v })}
          options={[
            { value: 'flat', label: 'Flat vector', disabled: flatOnly },
            { value: 'relief-white', label: 'White marble', disabled: !square(view) },
            { value: 'relief-black', label: 'Black marble', disabled: !square(view) },
            { value: 'engraved', label: 'Engraved', disabled: !square(view) },
          ]}
        />
        <Segmented
          label="Background"
          size="sm"
          value={ground}
          onChange={(v) => set({ ground: v })}
          options={[
            { value: 'light', label: 'Light', disabled: treated || flatOnly },
            { value: 'dark', label: 'Dark', disabled: treated || flatOnly },
            { value: 'transparent', label: 'Transparent', disabled: treated || flatOnly },
          ]}
        />
      </div>

      <p className="canvas__caption" aria-live="polite">
        {view === 'model' ? (
          <>
            <strong>Printable model.</strong> Drawn from the triangles that go into the STL — not a mockup.
          </>
        ) : treated ? (
          <>
            <strong>Presentation mockup.</strong> Marble, relief and engraving are rendered effects for previews — the production file is the flat vector.
          </>
        ) : view === 'sizes' ? (
          'Seal and emblem at the pixel sizes they are made for: favicons, tabs, app icons.'
        ) : edition === 'print' && (view === 'crest' || view === 'emblem') ? (
          print ? (
            print.ok ? (
              <>
                <strong>Print edition.</strong> Prints from Ø {print.minDiameterMM} mm on a 0.4 mm nozzle — every detail measured, not estimated.
              </>
            ) : (
              <>
                <strong>Print edition — check failed.</strong> The patron loses detail below Ø {print.minDiameterMM} mm.
              </>
            )
          ) : (
            <>
              <strong>Print edition.</strong> The master prints from Ø 67 mm on a 0.4 mm nozzle.
            </>
          )
        ) : (
          'Fine edition: screens, documents and large-format print.'
        )}
      </p>
    </main>
  );
}

function SizeSheet({ marks, ground }: { marks: Partial<Record<MarkKey, Mark>>; ground: Ground }) {
  const seal = marks.seal;
  const emblem = marks['emblem-fine'];
  const crest = marks['crest-fine'];
  const cell = (m: Mark | undefined, px: number, label: string) =>
    m && (
      <figure className="sizes__cell" key={`${label}-${px}`}>
        <SvgImage svg={productionSvg(m, { ground: 'transparent', size: px, ink: ground === 'dark' ? PALETTE.marble : undefined })} alt={`${label} at ${px} px`} className="sizes__img" />
        <figcaption>
          {label} · {px}px
        </figcaption>
      </figure>
    );
  return (
    <div className="sizes">
      <div className="sizes__row">{[16, 24, 32, 48, 64].map((px) => cell(seal, px, 'Seal'))}</div>
      <div className="sizes__row">{[96, 128].map((px) => cell(emblem, px, 'Emblem'))}{cell(crest, 192, 'Crest')}</div>
    </div>
  );
}
