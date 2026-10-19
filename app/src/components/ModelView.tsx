import { useEffect, useRef, useState } from 'react';
import { renderMeshes, type RenderPart } from '../../../src/render/mesh-render.ts';

/** The printable model, drawn from its own triangles. Drag to turn it. */
export function ModelView({ parts, busy }: { parts: RenderPart[] | null; busy: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [angle, setAngle] = useState({ azimuth: -24, elevation: 52 });
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const drag = useRef<{ x: number; y: number; azimuth: number; elevation: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(200, Math.floor(e.contentRect.width)), h: Math.max(200, Math.floor(e.contentRect.height)) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !parts) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Full quality at rest; lighter while turning.
    const scale = dragging ? Math.min(1, dpr) * 0.75 : dpr;
    const width = Math.round(size.w * scale);
    const height = Math.round(size.h * scale);
    const raf = requestAnimationFrame(() => {
      const px = renderMeshes(parts, { ...angle, width, height, background: 239, supersample: dragging ? 1 : 2 });
      c.width = width;
      c.height = height;
      c.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(px), width, height), 0, 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [parts, angle, size, dragging]);

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
        setAngle({ azimuth: d.azimuth - (e.clientX - d.x) * 0.4, elevation: Math.max(8, Math.min(89, d.elevation + (e.clientY - d.y) * 0.3)) });
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      onDoubleClick={() => setAngle({ azimuth: -24, elevation: 52 })}
      role="img"
      aria-label="Preview of the printable model, rendered from its mesh. Drag to turn it; double-click to reset."
    >
      <canvas ref={canvas} style={{ width: size.w, height: size.h }} />
      {busy && <span className="modelview__busy">Building the mesh…</span>}
      <span className="modelview__hint">Drag to turn · double-click to reset</span>
    </div>
  );
}
