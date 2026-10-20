// The home page's centrepiece: the master medallion — the very STL offered in
// Downloads, printed by the house's printer — lit like carved stone. A low
// light sweeps across the relief once when it appears; then the medallion
// sways slowly and turns under the pointer. It draws only while visible, and
// holds still for visitors who ask for reduced motion.

import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from 'three';
import { readStl } from '../../../src/export/stl.ts';

/** `ascend(p)`: how far the page has scrolled through the opening scene (0–1); the medallion tips back as it rises. */
export type SceneHandle = { dispose: () => void; ascend: (p: number) => void };

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Planar marble mapping: the stone's grain runs across the face as it would in a cut slab. */
function withUv(geometry: BufferGeometry, diameter: number) {
  const p = geometry.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[2 * i] = p.getX(i) / diameter + 0.5;
    uv[2 * i + 1] = p.getY(i) / diameter + 0.5;
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
}

export async function startScene(canvas: HTMLCanvasElement, { stlUrl, marble, still, onFirstFrame, onStone }: { stlUrl: string; marble: Promise<ImageBitmap | null>; still: boolean; onFirstFrame: () => void; onStone?: () => void }): Promise<SceneHandle> {
  const res = await fetch(stlUrl);
  if (!res.ok) throw new Error(`medallion: ${res.status}`);
  const { coords } = readStl(new Uint8Array(await res.arrayBuffer()));

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  // The relief's shadows on the field are what make it read as carved.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap; // r186 folded the soft variant into this one

  const scene = new Scene();
  const camera = new PerspectiveCamera(26, 1, 10, 2000);
  camera.position.set(0, 0, 255);

  // The solid as printed, faceted normals so the relief's edges stay crisp.
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(coords, 3));
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  geometry.translate(-(box.max.x + box.min.x) / 2, -(box.max.y + box.min.y) / 2, -(box.max.z + box.min.z) / 2);
  geometry.computeVertexNormals();
  withUv(geometry, box.max.x - box.min.x);
  const material = new MeshStandardMaterial({ color: 0xe9e9e9, roughness: 0.46, metalness: 0 });
  const medallion = new Mesh(geometry, material);
  medallion.castShadow = true;
  medallion.receiveShadow = true;
  const turn = new Group();
  turn.add(medallion);
  scene.add(turn);
  marble.then((bitmap) => {
    if (!bitmap) return onStone?.();
    const map = new Texture(bitmap);
    map.colorSpace = SRGBColorSpace;
    map.needsUpdate = true;
    material.map = map;
    material.color.set(0xffffff);
    material.needsUpdate = true;
    draw();
    onStone?.();
  });

  // A low raking key light that reveals the carving, a soft sky, a cool rim from behind.
  const key = new DirectionalLight(0xffffff, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -62;
  key.shadow.camera.right = key.shadow.camera.top = 62;
  key.shadow.camera.near = 50;
  key.shadow.camera.far = 420;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.15;
  key.shadow.radius = 3;
  const sky = new HemisphereLight(0xffffff, 0x2a2a2a, 0.5);
  // A soft fill from the viewer's side keeps the shadowed field readable.
  const fill = new DirectionalLight(0xffffff, 0.55);
  fill.position.set(-40, -60, 220);
  const rim = new DirectionalLight(0xffffff, 1.2);
  rim.position.set(160, 120, -160);
  scene.add(key, sky, rim, fill);
  const placeKey = (azimuth: number) => {
    const a = (azimuth * Math.PI) / 180;
    // Low over the face: a raking light.
    key.position.set(Math.cos(a) * 200, Math.sin(a) * 200, 120);
  };

  // Pointer: drag to turn; released, it settles back.
  let dragX = 0;
  let dragY = 0;
  let pointer: { x: number; y: number; dx: number; dy: number } | null = null;
  const down = (e: PointerEvent) => {
    pointer = { x: e.clientX, y: e.clientY, dx: dragX, dy: dragY };
    canvas.setPointerCapture(e.pointerId);
    wake();
  };
  const move = (e: PointerEvent) => {
    if (!pointer) return;
    dragX = pointer.dx + (e.clientX - pointer.x) * 0.008;
    dragY = Math.max(-0.9, Math.min(0.9, pointer.dy + (e.clientY - pointer.y) * 0.008));
    wake();
  };
  const up = () => {
    pointer = null;
    wake();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  const size = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const resize = new ResizeObserver(() => {
    size();
    draw();
  });
  resize.observe(canvas);
  size();

  // Time runs only while the medallion is on screen and the tab is visible.
  let visible = true;
  let running = false;
  let frame = 0;
  let last = performance.now();
  let t = 0;
  const born = performance.now();
  let first = true;
  let lift = 0;

  const pose = () => {
    const sweep = still ? 1 : ease((performance.now() - born) / 2600);
    placeKey(-150 + 95 * sweep);
    const sway = still ? 0 : 1;
    if (!pointer) {
      // Settle the drag back towards rest.
      dragX *= 0.94;
      dragY *= 0.94;
    }
    turn.rotation.y = sway * Math.sin(t * 0.22) * 0.32 + dragX + lift * 0.5;
    turn.rotation.x = -0.26 + sway * Math.sin(t * 0.15) * 0.05 + dragY - lift * 0.85;
  };
  function draw() {
    pose();
    renderer.render(scene, camera);
    if (first) {
      first = false;
      onFirstFrame();
    }
  }
  const tick = (now: number) => {
    t += Math.min(0.05, (now - last) / 1000);
    last = now;
    draw();
    const settling = Math.abs(dragX) > 0.001 || Math.abs(dragY) > 0.001;
    if (visible && (!still || pointer || settling)) frame = requestAnimationFrame(tick);
    else running = false;
  };
  function wake() {
    if (running || !visible) return;
    running = true;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }
  const seen = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && document.visibilityState === 'visible';
    if (visible) wake();
  });
  seen.observe(canvas);
  const onVisibility = () => {
    visible = document.visibilityState === 'visible';
    if (visible) wake();
  };
  document.addEventListener('visibilitychange', onVisibility);
  draw();
  wake();

  return {
    ascend(p: number) {
      lift = Math.min(1, Math.max(0, p));
      if (!running) draw();
    },
    dispose() {
      cancelAnimationFrame(frame);
      seen.disconnect();
      resize.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
