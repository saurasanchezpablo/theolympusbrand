// Small pictures of each building for the picker, drawn once in marble with
// one offscreen renderer, a few at a time so the page stays responsive.

import { ACESFilmicToneMapping, Box3, DirectionalLight, HemisphereLight, Mesh, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { building } from '../../../../src/map/buildings/index.ts';
import { marbleMaterial } from './marble.ts';

const cache = new Map<string, string>();
let renderer: WebGLRenderer | null = null;
let scene: Scene, camera: PerspectiveCamera, mesh: Mesh;

function setup() {
  renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(192, 144, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x333333, 0.9));
  const sun = new DirectionalLight(0xffffff, 2.4);
  sun.position.set(-3, 5, 4);
  scene.add(sun);
  camera = new PerspectiveCamera(30, 192 / 144, 0.1, 500);
  mesh = new Mesh(undefined, marbleMaterial());
  scene.add(mesh);
}

/** A picture of a building type, as a data URL (drawn on first ask). */
export function thumb(type: string): string | null {
  const hit = cache.get(type);
  if (hit) return hit;
  const k = building(type);
  if (!k) return null;
  if (!renderer) setup();
  const g = k.build('far');
  mesh.geometry = g;
  mesh.rotation.y = -0.6;
  const box = new Box3().setFromObject(mesh);
  const size = box.getSize(new Vector3()).length();
  const centre = box.getCenter(new Vector3());
  camera.position.copy(centre).add(new Vector3(0.75, 0.6, 1).setLength(size * 1.25));
  camera.lookAt(centre);
  renderer!.render(scene, camera);
  const url = renderer!.domElement.toDataURL('image/png');
  g.dispose();
  cache.set(type, url);
  return url;
}

/** Draw pictures for these types a few at a time, calling back as each is ready. */
export function thumbsFor(types: readonly string[], ready: (type: string, url: string) => void): () => void {
  let i = 0,
    stopped = false;
  const step = () => {
    if (stopped) return;
    const end = Math.min(types.length, i + 4);
    for (; i < end; i++) {
      const url = thumb(types[i]);
      if (url) ready(types[i], url);
    }
    if (i < types.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return () => {
    stopped = true;
  };
}

const portraits = new Map<string, string>();
let big: WebGLRenderer | null = null;

/**
 * A building on its own, for a place's panel: its full model, lit from the
 * side as on the island, framed from the front and a little above. Drawn once
 * per kind, at 720 × 440.
 */
export function portrait(type: string): string | null {
  const hit = portraits.get(type);
  if (hit) return hit;
  const k = building(type);
  if (!k) return null;
  if (!renderer) setup();
  if (!big) {
    big = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    big.setSize(720, 440, false);
    big.outputColorSpace = SRGBColorSpace;
    big.toneMapping = ACESFilmicToneMapping;
    big.toneMappingExposure = 1.1;
  }
  const g = k.build('near');
  mesh.geometry = g;
  mesh.rotation.y = -0.5;
  const box = new Box3().setFromObject(mesh);
  const size = box.getSize(new Vector3()).length();
  const centre = box.getCenter(new Vector3());
  const cam = new PerspectiveCamera(26, 720 / 440, 0.1, 800);
  cam.position.copy(centre).add(new Vector3(0.9, 0.42, 1).setLength(size * 1.32));
  cam.lookAt(centre.clone().add(new Vector3(0, -size * 0.04, 0)));
  big.render(scene, cam);
  const url = big.domElement.toDataURL('image/png');
  g.dispose();
  portraits.set(type, url);
  return url;
}
