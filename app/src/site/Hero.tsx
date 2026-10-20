import { useEffect, useRef, useState } from 'react';
import { fileUrl } from './files.ts';
import type { SceneHandle } from './medallion-scene.ts';

const STL = fileUrl('manufacturing/3d/master/medallion/the-olympus-master-medallion.stl');

/** Can this browser draw WebGL at all? */
function webgl(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** The house's marble, drawn in a worker, as a texture for the stone. */
function marbleTexture(): Promise<ImageBitmap | null> {
  return new Promise((resolve) => {
    try {
      const worker = new Worker(new URL('../ground-worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<Uint8Array>) => {
        worker.terminate();
        createImageBitmap(new Blob([e.data as Uint8Array<ArrayBuffer>], { type: 'image/png' })).then(resolve, () => resolve(null));
      };
      worker.onerror = () => {
        worker.terminate();
        resolve(null);
      };
      worker.postMessage({ w: 512, h: 512, tone: 'marble-light' });
    } catch {
      resolve(null);
    }
  });
}

type State = 'still' | 'loading' | 'live' | 'unavailable';

/**
 * The master medallion. On wide screens it is drawn live in WebGL from its
 * STL; on phones, on a data-saving connection or without WebGL, a still of
 * the same scene shows instead — on phones with a button to turn it live.
 */
export function Hero({ onScene }: { onScene?: (scene: SceneHandle | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(() => window.matchMedia('(min-width: 720px)').matches && !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
  const [state, setState] = useState<State>('still');
  const [stone, setStone] = useState(false);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!live) return;
    if (!webgl()) {
      setState('unavailable');
      return;
    }
    setState('loading');
    let handle: SceneHandle | null = null;
    let gone = false;
    // Once the page has settled: building the scene is heavy work that should not delay the first paint or a first tap.
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 300));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
    const ticket = idle(
      () => {
        import('./medallion-scene.ts')
          .then((m) => (gone || !canvas.current ? null : m.startScene(canvas.current, { stlUrl: STL, marble: marbleTexture(), still: reduced, onFirstFrame: () => !gone && setState('live'), onStone: () => !gone && setStone(true) })))
          .then((h) => {
            if (gone) h?.dispose();
            else {
              handle = h;
              onScene?.(h);
            }
          })
          .catch(() => !gone && setState('unavailable'));
      },
      { timeout: 1500 },
    );
    return () => {
      gone = true;
      cancelIdle(ticket);
      handle?.dispose();
      onScene?.(null);
    };
    // onScene is read once per scene; a new callback need not rebuild it.
  }, [live, reduced]);

  return (
    <figure className="hero__stage" data-state={state} data-stone={stone ? 'ready' : undefined}>
      <div className="hero__frame">
        <img
          className="hero__still"
          src="hero/medallion-720.webp"
          srcSet="hero/medallion-720.webp 720w, hero/medallion-1440.webp 1440w"
          sizes="(min-width: 960px) 46vw, 92vw"
          width={720}
          height={720}
          alt="The master medallion: the crest carved in white stone"
          fetchPriority="high"
        />
        {live && state !== 'unavailable' && <canvas ref={canvas} className="hero__canvas" role="img" aria-label="The master medallion in 3D. Drag to turn it." />}
      </div>
      <figcaption className="hero__caption">
        {state === 'live' ? <>The master medallion — the STL in Downloads, as it prints. Drag to turn it.</> : state === 'loading' ? <>Bringing the medallion into the light…</> : <>The master medallion, as it prints.</>}
        {!live && (
          <button type="button" className="hero__turn" onClick={() => setLive(true)}>
            Turn it in 3D
          </button>
        )}
      </figcaption>
    </figure>
  );
}
