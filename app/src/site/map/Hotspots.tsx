// The places on the map: a marble ring over each building (round for a
// service, square for a machine), its name on hover and focus, the chosen one
// larger and dark. They are buttons — reachable by the keyboard, named for
// screen readers — moved with the view on each frame the scene draws.

import { useEffect, useRef } from 'react';
import type { MapEntry } from '../../../../src/map/items.ts';
import type { MapScene } from './map-scene.ts';

export function Hotspots({ items, scene, selected, hidden, onChoose }: { items: readonly MapEntry[]; scene: MapScene | null; selected: string | null; hidden: boolean; onChoose: (id: string) => void }) {
  const els = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    if (!scene) return;
    const place = () => {
      for (const a of scene.anchors()) {
        const el = els.current.get(a.id);
        if (!el) continue;
        // Nearer places a little larger; those off the screen or behind the camera hidden.
        const k = Math.max(0.7, Math.min(1.15, 1.25 - a.depth / 1400));
        el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0) scale(${k.toFixed(3)})`;
        el.dataset.off = a.visible ? '' : 'true';
      }
      const shown = new Set(scene.anchors().map((a) => a.id));
      for (const [id, el] of els.current) if (!shown.has(id)) el.dataset.off = 'true';
    };
    const stop = scene.onView(place);
    place();
    return () => void stop();
  }, [scene, items]);
  return (
    <div className="hotspots" data-hidden={hidden ? 'true' : undefined} aria-hidden={hidden ? 'true' : undefined}>
      {items.map((e) => {
        return (
          <button
            key={e.id}
            ref={(el) => {
              if (el) els.current.set(e.id, el);
              else els.current.delete(e.id);
            }}
            type="button"
            className={`hotspot hotspot--${e.kind}${selected === e.id ? ' is-selected' : ''}`}
            data-id={e.id}
            data-off="true"
            tabIndex={hidden ? -1 : 0}
            aria-label={`${e.name}, ${e.kind === 'machine' ? 'machine' : 'service'}`}
            aria-pressed={selected === e.id}
            onClick={() => onChoose(e.id)}
          >
            <span className="hotspot__ring" aria-hidden="true">
              <span className="hotspot__dot" />
            </span>
            <span className="hotspot__label" aria-hidden="true">
              {e.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
