import { useEffect, useMemo, useRef, useState } from 'react';
import { renderMeshes } from '../../../src/render/mesh-render.ts';
import { backlit } from '../../../src/manufacturing/lithophane.ts';
import type { Model } from '../../../src/manufacturing/products.ts';
import type { Layer } from '../../../src/manufacturing/mesh.ts';
import { Segmented } from './ui.tsx';

type Mode = 'model' | 'layers' | 'backlit';
const FRONT = { azimuth: -24, elevation: 52 };
const BACK = { azimuth: 204, elevation: -58 };

/** The printable model, drawn from its own triangles — turned by dragging, sliced layer by layer, or held to the light. */
export function ModelView({ model, busy, layer }: { model: Model | null; busy: boolean; layer: number }) {
  const [mode, setMode] = useState<Mode>('model');
  const [angle, setAngle] = useState(FRONT);
  const litho = Boolean(model?.lithophane);
  const sliceable = Boolean(model?.parts.every((p) => p.layers));
  const current: Mode = mode === 'backlit' && !litho ? 'model' : mode === 'layers' && !sliceable ? 'model' : mode;
  const back = angle.elevation < 0;

  return (
    <div className="modelview-wrap">
      <div className="modelview__modes">
        <Segmented
          label="Model view"
          size="sm"
          value={current === 'model' ? (back ? 'back' : 'front') : current}
          onChange={(v) => {
            if (v === 'front' || v === 'back') {
              setMode('model');
              setAngle(v === 'front' ? FRONT : BACK);
            } else setMode(v as Mode);
          }}
          options={[
            { value: 'front', label: '3D' },
            { value: 'back', label: 'Back' },
            { value: 'layers', label: 'Layers', disabled: !sliceable, hint: sliceable ? 'Step through the printed layers' : 'The lithophane is one continuous surface' },
            ...(litho ? [{ value: 'backlit', label: 'Backlit', hint: 'Simulated: held to the light' }] : []),
          ]}
        />
      </div>
      {current === 'model' && <Turntable model={model} busy={busy} angle={angle} onAngle={setAngle} />}
      {current === 'layers' && model && <Layers model={model} layer={layer} />}
      {current === 'backlit' && model?.lithophane && <Backlit model={model} />}
      {busy && <span className="modelview__busy">Building the mesh…</span>}
    </div>
  );
}

function useSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(200, Math.floor(e.contentRect.width)), h: Math.max(200, Math.floor(e.contentRect.height)) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function Turntable({ model, busy, angle, onAngle }: { model: Model | null; busy: boolean; angle: { azimuth: number; elevation: number }; onAngle: (a: { azimuth: number; elevation: number }) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const size = useSize(wrap);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; azimuth: number; elevation: number } | null>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !model) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Full quality at rest; lighter while turning (the lithophane has 180 000 triangles).
    const scale = dragging ? Math.min(1, dpr) * (model.lithophane ? 0.5 : 0.75) : dpr;
    const width = Math.round(size.w * scale);
    const height = Math.round(size.h * scale);
    const raf = requestAnimationFrame(() => {
      const px = renderMeshes(model.parts, { ...angle, width, height, background: 239, supersample: dragging ? 1 : 2 });
      c.width = width;
      c.height = height;
      c.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(px), width, height), 0, 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [model, angle, size, dragging]);
  return (
    <div
      ref={wrap}
      className={`modelview${busy ? ' is-busy' : ''}`}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, ...angle };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const el = Math.max(-89, Math.min(89, d.elevation + (e.clientY - d.y) * 0.3));
        onAngle({ azimuth: d.azimuth - (e.clientX - d.x) * 0.4, elevation: Math.abs(el) < 8 ? Math.sign(el || 1) * 8 : el });
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      onDoubleClick={() => onAngle(FRONT)}
      role="img"
      aria-label="Preview of the printable model, rendered from its mesh. Drag to turn it; double-click to reset."
    >
      <canvas ref={canvas} style={{ width: size.w, height: size.h }} />
      <span className="modelview__hint">Drag to turn · double-click to reset</span>
    </div>
  );
}

/** What the printer lays down at one layer: the cross-section, with what changes there. */
function Layers({ model, layer }: { model: Model; layer: number }) {
  const top = model.size[2];
  const count = Math.max(1, Math.round(top / layer));
  const [n, setN] = useState(1);
  const k = Math.min(n, count);
  const z = (k - 0.5) * layer;
  const section = model.parts.flatMap((p) => (p.layers ?? []).filter((L: Layer) => L.z0 <= z && z < L.z1).map((L) => ({ L, tone: p.tone, name: p.name })));
  const all = model.parts.flatMap((p) => (p.layers ?? []).flatMap((L) => L.rings)).flat();
  const xs = all.map((q) => q[0]);
  const ys = all.map((q) => q[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = Math.max(x1 - x0, y1 - y0) * 0.04;
  const path = (L: Layer) => L.rings.map((r) => `M${r.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join('L')}Z`).join('');
  const events = useMemo(() => {
    const zs = new Set<number>();
    for (const p of model.parts) for (const L of p.layers ?? []) zs.add(Math.round(L.z0 / layer) + 1);
    return [...zs].filter((x) => x > 1).sort((a, b) => a - b);
  }, [model, layer]);
  const what = section.map((s) => s.name).filter((v, i, a) => a.indexOf(v) === i).join(' + ');
  const holes = section.some((s) => s.L.rings.some((r) => r.reduce((acc, [x, y], i) => acc + x * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * y, 0) < 0));
  return (
    <div className="layers">
      <svg viewBox={`${x0 - pad} ${-y1 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`} className="layers__svg" role="img" aria-label={`Cross-section at layer ${k}`}>
        {section.map(({ L, tone }, i) => (
          <path key={i} d={path(L)} fill={tone === 'dark' ? '#3A3A3A' : '#1C1C1C'} fillRule="nonzero" />
        ))}
      </svg>
      <div className="layers__bar">
        <input type="range" min={1} max={count} value={k} onChange={(e) => setN(Number(e.target.value))} aria-label="Layer" />
        <span className="layers__info">
          Layer <strong>{k}</strong> of {count} · z {(k * layer).toFixed(2)} mm · {what || 'nothing'}
          {holes && k * layer <= 4.5 ? ' · with the back’s pockets' : ''}
        </span>
        <span className="layers__marks">
          {events.map((e) => (
            <button key={e} type="button" className="layers__mark" onClick={() => setN(e)} title={`Layer ${e}: the stack changes here`}>
              {e}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}

function Backlit({ model }: { model: Model }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !model.lithophane) return;
    const size = 720;
    const px = backlit(model.lithophane.spec, model.lithophane.raster, size, 18);
    c.width = size;
    c.height = size;
    c.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(px), size, size), 0, 0);
  }, [model]);
  return (
    <div className="backlit">
      <canvas ref={canvas} aria-label="Simulation of the lithophane held to the light" />
      <span className="modelview__hint">Simulated: the disc held to a light — thick plastic stays dark, thin plastic glows</span>
    </div>
  );
}
