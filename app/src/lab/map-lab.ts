// Dev only: every building of a family on the graphite table, to look at
// (map-lab.html?family=temples&detail=near). Not part of the site's build.

import { ACESFilmicToneMapping, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PCFShadowMap, PerspectiveCamera, PlaneGeometry, Scene, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BUILDINGS } from '../../../src/map/buildings/index.ts';
import { marbleMaterial } from '../site/map/marble.ts';

const q = new URLSearchParams(location.search);
const family = q.get('family') ?? 'temples';
const detail = (q.get('detail') ?? 'near') as 'near' | 'far';
const list = BUILDINGS.filter((k) => family === 'all' || k.family === family);
const cols = Math.ceil(Math.sqrt(list.length * 1.6));
const cell = 34;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
renderer.toneMapping = ACESFilmicToneMapping;
document.body.append(renderer.domElement);
const scene = new Scene();
scene.background = new Color(0x0e0e0e);
const rows = Math.ceil(list.length / cols);
const W = cols * cell,
  D = rows * cell;
const camera = new PerspectiveCamera(30, innerWidth / innerHeight, 1, 2000);
camera.position.set(0, Math.max(W, D) * 1.05, Math.max(W, D) * 1.0);
const controls = new OrbitControls(camera, renderer.domElement);
const table = new Mesh(new PlaneGeometry(W + 20, D + 20), new MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.9 }));
table.rotation.x = -Math.PI / 2;
table.receiveShadow = true;
scene.add(table);
const marble = marbleMaterial();
const labels: [HTMLElement, Vector3][] = [];
let tris = 0;
list.forEach((k, i) => {
  const g = k.build(detail);
  tris += g.attributes.position.count / 3;
  const m = new Mesh(g, marble);
  m.castShadow = m.receiveShadow = true;
  m.position.set(-W / 2 + cell / 2 + (i % cols) * cell, 0, -D / 2 + cell / 2 + Math.floor(i / cols) * cell);
  m.rotation.y = -0.45;
  scene.add(m);
  const el = document.createElement('div');
  el.className = 'label';
  el.innerHTML = `<b>${k.name}</b>${k.id} · ${(g.attributes.position.count / 3) | 0}`;
  document.body.append(el);
  labels.push([el, new Vector3(m.position.x, 0, m.position.z + 12)]);
});
scene.add(new HemisphereLight(0xffffff, 0x222222, 0.7));
const sun = new DirectionalLight(0xffffff, 2.8);
sun.position.set(-W, W * 1.2, W * 0.7);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -W, right: W, top: D, bottom: -D, near: 1, far: W * 4 });
sun.shadow.bias = -0.0004;
scene.add(sun);
const draw = () => {
  controls.update();
  renderer.render(scene, camera);
  for (const [el, p] of labels) {
    const v = p.clone().project(camera);
    el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
  }
  document.body.dataset.ready = `${list.length} buildings, ${Math.round(tris / 1000)}k triangles`;
};
controls.addEventListener('change', draw);
draw();
