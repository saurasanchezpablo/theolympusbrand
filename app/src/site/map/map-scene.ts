// The map's 3D scene (its own chunk, loaded only on #/map): the island of
// engraved graphite with its forests and sea, the city planned on it (its
// streets, terraces, squares and houses, city-mesh.ts), a marble building in
// its precinct for each service and machine, a layer of cloud whose shadows
// drift over the land.
//
// The camera has three poses — the intro (straight down, above the clouds),
// the overview (high above, a little tilted, the island filling the screen)
// and a place (lower, oblique, framed on one building) — and travels between
// them along an eased arc. It draws only while something moves; its shadows
// are cast once, and again only when a building is placed. Buildings and
// trees near the camera are drawn in full, far ones lighter. A light version
// serves phones.

import {
  ACESFilmicToneMapping,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MAP, decodeTerrain, heightAt, type Terrain } from '../../../../src/map/terrain.ts';
import { scatterTrees } from '../../../../src/map/vegetation.ts';
import { placeAt, plotsOf, type Refusal } from '../../../../src/map/placement.ts';
import { townArea, type CityPlan, type Lot } from '../../../../src/map/city.ts';
import { fabric } from '../../../../src/map/fabric.ts';
import { building, extentOf } from '../../../../src/map/buildings/index.ts';
import { buildCity, buildFabric, cityTrees, type Fabric } from './city-mesh.ts';
import { createPeople } from './people.ts';
import { seeded } from '../../../../src/map/noise.ts';
import type { MapEntry } from '../../../../src/map/items.ts';
import { marbleMaterial } from './marble.ts';
import { landMaterial, seaMaterial } from './land.ts';
import { WIND, windy } from './wind.ts';

export type Filter = 'all' | 'service' | 'machine';
/** Where a building is on the screen, in CSS pixels from the canvas's top left. */
export type Anchor = { id: string; x: number; y: number; visible: boolean; depth: number };
/** Room taken by the page's panel over the map: the camera frames what is left. */
export type Inset = { right: number; bottom: number };

export type MapScene = {
  setItems(items: readonly MapEntry[]): void;
  setFilter(f: Filter): void;
  /** The camera straight down above the clouds, for the introduction. */
  intro(): void;
  /** From the introduction to the overview: the clouds part, the camera comes down. */
  enter(): Promise<void>;
  /** Back to the overview. */
  overview(): Promise<void>;
  /** Travel to a place and frame it; resolves on arrival. */
  travelTo(id: string): Promise<void>;
  /** Make room for the panel (the place stays framed in what is left). */
  setInset(inset: Inset): void;
  anchors(): Anchor[];
  /** Called after each frame drawn: the view moved, the anchors with it. Returns a way to stop. */
  onView(cb: () => void): () => void;
  /** Called once when the person first drags, and once when they first zoom. */
  onLearn(cb: (what: 'move' | 'zoom') => void): void;
  /** The camera's turn from north, in radians (for the compass); and back to north. */
  heading(): number;
  north(): void;
  pick(clientX: number, clientY: number): string | null;
  groundAt(clientX: number, clientY: number): { x: number; z: number } | null;
  /** The building being placed, snapped to the plot under the point: where it would stand, or why it cannot. */
  ghost(type: string | null, at?: { x: number; z: number; rotation: number }, except?: string): { ok: true; place: { x: number; z: number; rotation: number } } | { ok: false; why: Refusal } | null;
  setPanning(on: boolean): void;
  /** What the page reports and the checks read: the last frame's work, frames drawn so far, and how long each part of the start took (ms). */
  stats(): { triangles: number; calls: number; fps: number; frames: number; people: number; peopleMs: number; startup: Record<string, number> };
  /** Test hook: put the camera at a pose (target x/z on the ground, distance, tilt from straight down, turn from north). */
  look(p: { x: number; z: number; distance: number; polar: number; azimuth: number }): void;
  /** Where the camera is, as `look` takes it: to come back to the same view in a new scene. */
  pose(): { x: number; z: number; distance: number; polar: number; azimuth: number };
  dispose(): void;
};

const S = MAP.buildingScale;
const NEAR_BUILDINGS = 170;
const NEAR_TREES = 140;
const TILES = 6;
const FOV = 32;
const ISLAND = 380; // the width the overview shows: the island's heart, its shores at the edges
const footprintOf = (type: string) => (building(type)?.footprint ?? 8) * S;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** The trees: full crowns near the camera, single shapes far away. */
function treeGeometries() {
  const clean = (g: BufferGeometry) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    n.computeVertexNormals();
    return n;
  };
  const merge = (parts: BufferGeometry[]) => mergeGeometries(parts.map(clean))!;
  const broadNear = merge(
    [[0, 1.6, 0, 1.05], [0.55, 1.25, 0.2, 0.75], [-0.5, 1.3, -0.25, 0.8], [0.1, 2.2, -0.1, 0.7]]
      .map(([x, y, z, r]): BufferGeometry => new IcosahedronGeometry(r, 0).translate(x, y, z))
      .concat([new CylinderGeometry(0.12, 0.16, 1.2, 5).translate(0, 0.6, 0)]),
  );
  const pineNear = merge([0, 1, 2, 3].map((i): BufferGeometry => new ConeGeometry(1.0 - i * 0.2, 1.3, 7).translate(0, 1.0 + i * 0.75, 0)).concat([new CylinderGeometry(0.1, 0.13, 1.0, 5).translate(0, 0.5, 0)]));
  const broadFar = clean(new IcosahedronGeometry(1.15, 0).scale(1, 1.1, 1).translate(0, 1.7, 0));
  const pineFar = clean(new ConeGeometry(0.95, 3.6, 5).translate(0, 2.2, 0));
  // An olive of the groves: a short trunk, a low open crown.
  const oliveFar = merge([new CylinderGeometry(0.1, 0.15, 0.9, 5).translate(0, 0.45, 0), new IcosahedronGeometry(0.85, 0).scale(1.15, 0.7, 1.15).translate(0, 1.35, 0)]);
  return { broadNear, broadFar, pineNear, pineFar, oliveFar };
}

/** Soft puffs of cloud, grey, drawn once. */
function cloudTexture(): CanvasTexture {
  const W = 256;
  const c = document.createElement('canvas');
  c.width = c.height = W;
  const g = c.getContext('2d')!;
  const rnd = seeded(31);
  for (let i = 0; i < 80; i++) {
    const x = W / 2 + (rnd() - 0.5) * W * 0.55,
      y = W / 2 + (rnd() - 0.5) * W * 0.45,
      r = 14 + rnd() * 38;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(232,232,232,0.24)');
    gr.addColorStop(0.6, 'rgba(232,232,232,0.12)');
    gr.addColorStop(1, 'rgba(232,232,232,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, W);
  }
  return new CanvasTexture(c);
}

/** A camera pose: where it looks, how far, how tilted (from straight down), which way it faces. */
type Pose = { target: Vector3; distance: number; polar: number; azimuth: number };

export function createMapScene(canvas: HTMLCanvasElement, terrainBytes: ArrayBuffer, plan: CityPlan, opts: { reducedMotion: boolean; lite: boolean }): MapScene {
  // How long each part of the start takes, for stats() (a handful of numbers, kept for the page's checks).
  const startup: Record<string, number> = {};
  let mark = performance.now();
  const lap = (what: string) => {
    const now = performance.now();
    startup[what] = Math.round((startup[what] ?? 0) + now - mark);
    mark = now;
  };
  const base = decodeTerrain(new Uint8Array(terrainBytes));
  const land: Terrain = base;
  const plots = plotsOf(plan);
  const lotOf = (id: string): Lot | undefined => plots.byId.get(id);
  const still = opts.reducedMotion;

  const renderer = new WebGLRenderer({ canvas, antialias: !opts.lite, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lite ? 1 : 1.5));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new Scene();
  const STONE = 0x0d0d0d;
  scene.background = new Color(STONE);
  // Distance fog, set from the camera's height each frame: the far land fades into the stone.
  const fog = new Fog(STONE, 500, 1300);
  scene.fog = fog;
  const camera = new PerspectiveCamera(FOV, 1, 1, 3000);
  const controls = new MapControls(camera, canvas);
  controls.enableDamping = !still;
  controls.dampingFactor = 0.08;
  controls.minDistance = 22;
  controls.maxDistance = 900;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = 1.15;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;

  // ---- light: a low sun for long shadows, cast once ----
  scene.add(new HemisphereLight(0xffffff, 0x2a2a2a, 0.6));
  const sun = new DirectionalLight(0xffffff, 2.7);
  sun.position.set(-210, 240, 130);
  sun.castShadow = true;
  sun.shadow.mapSize.set(opts.lite ? 2048 : 4096, opts.lite ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -270, right: 270, top: 270, bottom: -270, near: 10, far: 800 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);

  // ---- the land and the sea; the clouds' shadows drift over the land ----
  const landGeo = new PlaneGeometry(base.size, base.size, base.res - 1, base.res - 1);
  landGeo.rotateX(-Math.PI / 2);
  const landMat = landMaterial();
  const landMesh = new Mesh(landGeo, landMat);
  landMesh.receiveShadow = true;
  landMesh.castShadow = true;
  scene.add(landMesh);
  lap('setup');
  {
    const p = landGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(land, p.getX(i), p.getZ(i)));
    p.needsUpdate = true;
    landGeo.computeVertexNormals();
    // The sea is opaque: a cell wholly beneath it is never seen and shades nothing above it. Most of the grid is sea, so only
    // the cells that reach the surface are drawn (the normals above were taken with all of them, so the coast is lit the same).
    const n = base.res,
      keep: number[] = [];
    for (let z = 0; z < n - 1; z++)
      for (let x = 0; x < n - 1; x++) {
        const a = z * n + x,
          b = a + n,
          c = b + 1,
          d = a + 1;
        if (Math.max(p.getY(a), p.getY(b), p.getY(c), p.getY(d)) >= MAP.sea - 0.05) keep.push(a, b, d, b, c, d);
      }
    landGeo.setIndex(keep);
    landGeo.computeBoundingSphere();
  }
  const sea = new Mesh(new PlaneGeometry(3000, 3000), seaMaterial());
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = MAP.sea;
  sea.receiveShadow = true;
  scene.add(sea);

  // ---- forests ----
  const treeGeo = treeGeometries();
  const broadMat = windy(new MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.95, flatShading: true }));
  const pineMat = windy(new MeshStandardMaterial({ color: 0x383838, roughness: 0.95, flatShading: true }));
  type Tile = { centre: Vector3; near: InstancedMesh[]; far: InstancedMesh[] };
  let tiles: Tile[] = [];
  const forest = new Group();
  scene.add(forest);
  const inTown = townArea(plan);
  const oliveMat = windy(new MeshStandardMaterial({ color: 0x8c8c8c, roughness: 0.95, flatShading: true }));
  const plant = () => {
    const m = new Matrix4(),
      q = new Quaternion(),
      v = new Vector3(),
      s = new Vector3(),
      up = new Vector3(0, 1, 0);
    for (const t of tiles) for (const m of [...t.near, ...t.far]) m.dispose();
    forest.clear();
    tiles = [];
    // The forests keep out of the town, with a margin of open ground round it; olive groves ring it beyond its wall.
    const [bx0, bz0, bx1, bz1] = plan.bounds;
    const belt = (x: number, z: number) => Math.hypot(Math.max(bx0 - x, 0, x - bx1), Math.max(bz0 - z, 0, z - bz1)) < 34;
    const { broad, pine, olive } = scatterTrees(land, (x, z) => inTown(x, z, 4), belt);
    if (olive.length) {
      const mesh = new InstancedMesh(treeGeo.oliveFar, oliveMat, olive.length / 5);
      for (let i = 0, k = 0; i < olive.length; i += 5, k++) mesh.setMatrixAt(k, m.compose(v.set(olive[i], olive[i + 1], olive[i + 2]), q.setFromAxisAngle(up, olive[i + 4]), s.setScalar(olive[i + 3])));
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      forest.add(mesh);
    }
    const size = MAP.size / TILES;
    const buckets = Array.from({ length: TILES * TILES }, () => ({ broad: [] as number[], pine: [] as number[] }));
    const into = (arr: Float32Array, key: 'broad' | 'pine') => {
      for (let i = 0; i < arr.length; i += 5) {
        const tx = Math.min(TILES - 1, Math.max(0, Math.floor((arr[i] + MAP.size / 2) / size)));
        const tz = Math.min(TILES - 1, Math.max(0, Math.floor((arr[i + 2] + MAP.size / 2) / size)));
        buckets[tz * TILES + tx][key].push(i);
      }
    };
    into(broad, 'broad');
    into(pine, 'pine');
    buckets.forEach((b, k) => {
      const tile: Tile = { centre: new Vector3(-MAP.size / 2 + ((k % TILES) + 0.5) * size, 0, -MAP.size / 2 + (Math.floor(k / TILES) + 0.5) * size), near: [], far: [] };
      for (const [arr, idx, near, far, mat] of [
        [broad, b.broad, treeGeo.broadNear, treeGeo.broadFar, broadMat],
        [pine, b.pine, treeGeo.pineNear, treeGeo.pineFar, pineMat],
      ] as const) {
        if (!idx.length) continue;
        for (const [geo, list] of opts.lite ? ([[far, tile.far]] as const) : ([[near, tile.near], [far, tile.far]] as const)) {
          const mesh = new InstancedMesh(geo, mat, idx.length);
          idx.forEach((i, n) => {
            q.setFromAxisAngle(up, arr[i + 4]);
            v.set(arr[i], arr[i + 1], arr[i + 2]);
            s.setScalar(arr[i + 3]);
            mesh.setMatrixAt(n, m.compose(v, q, s));
          });
          mesh.castShadow = true;
          mesh.receiveShadow = geo === near;
          mesh.computeBoundingSphere();
          list.push(mesh);
          forest.add(mesh);
        }
      }
      tiles.push(tile);
    });
  };

  lap('land');
  plant();
  lap('forest');

  // ---- buildings ----
  const marble = marbleMaterial();
  const geoCache = new Map<string, BufferGeometry>();
  const geometryOf = (type: string, detail: 'near' | 'far') => {
    const key = `${type}:${detail}`;
    let g = geoCache.get(key);
    if (!g) {
      g = building(type)!.build(detail);
      g.computeBoundingSphere();
      geoCache.set(key, g);
    }
    return g;
  };
  // ---- the city: its stone built once; its houses and precincts with the items ----
  const trees = cityTrees();
  const city = buildCity(plan, (type) => geometryOf(type, 'near'), S, trees, (x, z) => heightAt(land, x, z));
  lap('city');
  scene.add(city.group);
  let houses: Fabric | null = null;

  // The people: as many as the town is large (four or so to a block), fewer on a phone. (How long their step takes, for the page's numbers.)
  let peopleMs = 0;
  const blocks = plan.lots.filter((l) => l.part === 'whole').length;
  const people = createPeople(plan, { count: Math.round(Math.min(420, Math.max(60, blocks * 4)) * (opts.lite ? 0.4 : 1)), still: opts.reducedMotion });
  lap('people');
  scene.add(people.group);

  /** Which plot each item stands on: plot id → item id. */
  let taken = new Map<string, string>();
  type Placed = { entry: MapEntry; type: string; matrix: Matrix4; pos: Vector3; top: Vector3 };
  let placed: Placed[] = [];
  let groups = new Map<string, { near: InstancedMesh; far: InstancedMesh; members: Placed[] }>();
  const town = new Group();
  scene.add(town);
  let filter: Filter = 'all';
  const visible = (p: Placed) => filter === 'all' || p.entry.kind === filter;
  const pickable: InstancedMesh[] = [];
  const pickIds = new Map<InstancedMesh, string[]>();

  const lodFrom = new Vector3(Infinity, 0, 0);
  const groundCam = new Vector3();
  /** Which buildings and trees are drawn in full: those near the camera. */
  const relod = () => {
    if (lodFrom.distanceTo(camera.position) < 8) return;
    lodFrom.copy(camera.position);
    pickable.length = 0;
    pickIds.clear();
    for (const g of groups.values()) {
      let n = 0,
        f = 0;
      const nearIds: string[] = [],
        farIds: string[] = [];
      for (const p of g.members) {
        if (!visible(p)) continue;
        if (!opts.lite && p.pos.distanceTo(camera.position) < NEAR_BUILDINGS) {
          g.near.setMatrixAt(n++, p.matrix);
          nearIds.push(p.entry.id);
        } else {
          g.far.setMatrixAt(f++, p.matrix);
          farIds.push(p.entry.id);
        }
      }
      g.near.count = n;
      g.far.count = f;
      g.near.instanceMatrix.needsUpdate = g.far.instanceMatrix.needsUpdate = true;
      g.near.computeBoundingSphere();
      g.far.computeBoundingSphere();
      for (const [mesh, ids] of [
        [g.near, nearIds],
        [g.far, farIds],
      ] as const)
        if (ids.length) {
          pickable.push(mesh);
          pickIds.set(mesh, ids);
        }
    }
    groundCam.set(camera.position.x, 0, camera.position.z);
    const close = camera.position.distanceTo(controls.target) < 260;
    for (const t of tiles) {
      const near = close && t.centre.distanceTo(groundCam) < NEAR_TREES + MAP.size / TILES / 2;
      for (const m of t.near) m.visible = near;
      for (const m of t.far) m.visible = !near || !t.near.length;
    }
  };

  const setItems = (items: readonly MapEntry[]) => {
    mark = performance.now();
    const kept = items.filter((e) => building(e.place.building));
    // The houses fill every plot no item takes; each item stands in its precinct.
    taken = new Map(kept.map((e) => [e.lot, e.id]));
    // A sports ground with a building on it is no longer a running track.
    for (const [id, g] of city.fields) g.visible = !kept.some((e) => e.lot === id || e.lot.startsWith(`${id}:`));
    houses?.dispose();
    if (houses) scene.remove(houses.group);
    houses = buildFabric(fabric(plan, taken), kept.map((e) => lotOf(e.lot)).filter((l): l is Lot => !!l), trees.olive);
    scene.add(houses.group);
    // The people go to the buildings' doors.
    people.setItems(kept);
    for (const g of groups.values()) {
      g.near.dispose();
      g.far.dispose();
    }
    town.clear();
    groups = new Map();
    placed = kept.map((entry) => {
      const pos = new Vector3(entry.place.x, lotOf(entry.lot)?.ground ?? heightAt(land, entry.place.x, entry.place.z), entry.place.z);
      const matrix = new Matrix4().compose(pos, new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), entry.place.rotation), new Vector3(S, S, S));
      const geo = geometryOf(entry.place.building, 'far');
      geo.computeBoundingBox();
      const top = pos.clone().add(new Vector3(0, (geo.boundingBox?.max.y ?? 8) * S + 1.5, 0));
      return { entry, type: entry.place.building, matrix, pos, top };
    });
    for (const p of placed) {
      let g = groups.get(p.type);
      if (!g) {
        const near = new InstancedMesh(geometryOf(p.type, 'near'), marble, 64);
        const far = new InstancedMesh(geometryOf(p.type, 'far'), marble, 64);
        for (const m of [near, far]) {
          m.castShadow = m.receiveShadow = true;
          town.add(m);
        }
        g = { near, far, members: [] };
        groups.set(p.type, g);
      }
      g.members.push(p);
    }
    lodFrom.set(Infinity, 0, 0);
    relod();
    renderer.shadowMap.needsUpdate = true;
    wake();
    lap('items');
  };

  // ---- the cloud layer: parted round the island, drawn over it at the start ----
  const cloudTex = cloudTexture();
  const rnd = seeded(7);
  const clouds = Array.from({ length: opts.lite ? 16 : 34 }, () => {
    const sp = new Sprite(new SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.4 + rnd() * 0.3, fog: false }));
    const a = rnd() * Math.PI * 2;
    // They frame the island beyond its shores (over the land, only their shadows pass).
    const r = 290 + rnd() * 170;
    const home = new Vector3(Math.cos(a) * r, 40 + rnd() * 50, Math.sin(a) * r);
    const sc = 170 + rnd() * 120;
    sp.scale.set(sc, sc * 0.68, 1);
    // In the introduction every cloud closes over the island, under the camera.
    const cover = new Vector3(Math.cos(a) * r * 0.32, 240 + rnd() * 80, Math.sin(a) * r * 0.32);
    sp.position.copy(home);
    scene.add(sp);
    return { sp, home, cover, base: sp.material.opacity };
  });

  // ---- the loop: draw only when something changed ----
  let dirty = true,
    running = true,
    lastInput = performance.now(),
    lastDraw = 0,
    time = 0;
  const frames: number[] = [];
  const viewCbs = new Set<() => void>();
  let learnCb: (w: 'move' | 'zoom') => void = () => {};
  const learned = new Set<string>();
  const wake = () => {
    dirty = true;
    lastInput = performance.now();
  };
  let tween: { start: number; duration: number; step: (k: number) => void; done: () => void } | null = null;
  let orbit = false;
  controls.addEventListener('change', wake);
  controls.addEventListener('start', () => {
    wake();
    orbit = false;
    tween = null;
  });
  // What the person has learned: dragging, and zooming.
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons && !learned.has('move')) {
      learned.add('move');
      learnCb('move');
    }
  });
  canvas.addEventListener(
    'wheel',
    () => {
      if (!learned.has('zoom')) {
        learned.add('zoom');
        learnCb('zoom');
      }
    },
    { passive: true },
  );
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1 && !learned.has('zoom')) {
      learned.add('zoom');
      learnCb('zoom');
    }
  });

  let inset: Inset = { right: 0, bottom: 0 };
  const size = { w: 1, h: 1 };
  const applyView = () => {
    // The panel's room is taken out of the frame: the camera centres on what is left.
    if (inset.right || inset.bottom) camera.setViewOffset(size.w, size.h, inset.right / 2, inset.bottom / 2, size.w, size.h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  const resize = () => {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (!w || !h) return;
    size.w = w;
    size.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    applyView();
    wake();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ---- poses ----
  const vfov = (FOV * Math.PI) / 180;
  /** The overview: high above, a little tilted, the island covering the screen (on a phone, its height). */
  const overviewPose = (): Pose => {
    const aspect = size.w / size.h;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const fitW = ISLAND / 2 / Math.tan(hfov / 2);
    const fitH = (ISLAND * 0.92) / 2 / Math.tan(vfov / 2);
    const distance = aspect >= 1 ? Math.min(fitW, fitH) * 1.02 : fitH * 0.9;
    return { target: new Vector3(0, 0, 0), distance, polar: 0.4, azimuth: 0 };
  };
  const introPose = (): Pose => ({ ...overviewPose(), distance: overviewPose().distance * 1.55, polar: 0.001 });
  const poseOf = (): Pose => {
    const off = camera.position.clone().sub(controls.target);
    const distance = off.length();
    return { target: controls.target.clone(), distance, polar: Math.acos(Math.min(1, off.y / distance)), azimuth: Math.atan2(off.x, off.z) };
  };
  const place = (p: Pose) => {
    controls.target.copy(p.target);
    camera.position.set(p.target.x + p.distance * Math.sin(p.polar) * Math.sin(p.azimuth), p.target.y + p.distance * Math.cos(p.polar), p.target.z + p.distance * Math.sin(p.polar) * Math.cos(p.azimuth));
    camera.lookAt(p.target);
  };
  const shortAngle = (from: number, to: number) => from + ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  /** Glide from where the camera is to a pose, rising a little on the way when the journey is long. */
  const glide = (to: Pose, duration: number, extra?: (k: number) => void) =>
    new Promise<void>((done) => {
      const from = poseOf();
      const az = shortAngle(from.azimuth, to.azimuth);
      const far = from.target.distanceTo(to.target);
      if (still || duration <= 0) {
        place({ ...to, azimuth: az });
        extra?.(1);
        wake();
        return done();
      }
      tween = {
        start: performance.now(),
        duration,
        step: (k) => {
          const e = ease(k);
          const lift = Math.sin(Math.PI * e) * Math.min(1, far / 160) * Math.max(from.distance, to.distance) * 0.35;
          place({ target: from.target.clone().lerp(to.target, e), distance: from.distance + (to.distance - from.distance) * e + lift, polar: from.polar + (to.polar - from.polar) * e, azimuth: from.azimuth + (az - from.azimuth) * e });
          extra?.(k);
        },
        done,
      };
      wake();
    });

  const tick = (now: number) => {
    if (!running || document.hidden) return;
    const dt = Math.min(0.1, (now - (lastDraw || now)) / 1000);
    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.duration);
      tween.step(k);
      dirty = true;
      if (k >= 1) {
        const t = tween;
        tween = null;
        t.done();
      }
    } else controls.update();
    // A slow turn round the place while nothing else happens.
    if (orbit && !tween && !still && now - lastInput < 45_000) {
      const p = poseOf();
      place({ ...p, azimuth: p.azimuth + dt * 0.05 });
      dirty = true;
    }
    // The clouds and their shadows drift while the map is looked at; after a minute's stillness they rest.
    if (!still && now - lastInput < 60_000 && now - lastDraw > 45) {
      time += dt;
      for (const c of clouds) {
        c.sp.position.x += dt * 2.4;
        c.home.x += dt * 2.4;
        if (c.sp.position.x > 480) {
          c.sp.position.x -= 960;
          c.home.x -= 960;
        }
      }
      dirty = true;
    }
    // The people walk while they can be seen — the camera close enough — for three minutes after the last touch.
    const near = camera.position.distanceTo(controls.target) < 340;
    if (people.group.visible !== near) {
      people.setVisible(near);
      dirty = true;
    }
    if (near && !still && now - lastInput < 180_000 && now - lastDraw > 33) {
      const t0 = performance.now();
      people.update(dt);
      // The breeze in the trees moves while the people do.
      WIND.value += dt;
      peopleMs = peopleMs * 0.9 + (performance.now() - t0) * 0.1;
      dirty = true;
    }
    if (!dirty) return;
    dirty = false;
    const d = camera.position.distanceTo(controls.target);
    fog.near = d * 0.9;
    fog.far = d * 2.6;
    const u = (landMat.userData as { time?: { value: number } }).time;
    if (u) u.value = time;
    relod();
    const first = !frames.length && !startup.firstFrame;
    if (first) mark = performance.now();
    renderer.render(scene, camera);
    if (first) lap('firstFrame');
    frames.push(now);
    while (frames.length && now - frames[0] > 1000) frames.shift();
    lastDraw = now;
    for (const cb of viewCbs) cb();
  };
  renderer.setAnimationLoop(tick);

  // ---- picking and the ground under the pointer ----
  const ray = new Raycaster();
  const ndc = new Vector2();
  const aim = (x: number, y: number) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  const pick = (x: number, y: number) => {
    aim(x, y);
    for (const h of ray.intersectObjects(pickable, false)) {
      const ids = pickIds.get(h.object as InstancedMesh);
      if (ids && h.instanceId !== undefined) return ids[h.instanceId] ?? null;
    }
    return null;
  };
  const groundAt = (x: number, y: number) => {
    aim(x, y);
    const o = ray.ray.origin,
      dir = ray.ray.direction;
    let t = 0,
      step = 4;
    for (let i = 0; i < 800; i++) {
      const p = o.clone().addScaledVector(dir, t);
      if (p.y < -60) return null;
      if (p.y <= Math.max(MAP.sea, heightAt(land, p.x, p.z))) {
        if (step < 0.05) return Math.abs(p.x) > MAP.size / 2 || Math.abs(p.z) > MAP.size / 2 ? null : { x: p.x, z: p.z };
        t -= step;
        step /= 2;
      }
      t += step;
    }
    return null;
  };

  // ---- the building being placed ----
  let ghostMesh: Mesh | null = null;
  const ghostMat = marbleMaterial();
  ghostMat.transparent = true;
  ghostMat.opacity = 0.6;
  ghostMat.depthWrite = false;

  const v = new Vector3();
  place(overviewPose());

  return {
    setItems,
    setFilter(f) {
      filter = f;
      lodFrom.set(Infinity, 0, 0);
      renderer.shadowMap.needsUpdate = true;
      wake();
    },
    intro() {
      orbit = false;
      place(introPose());
      for (const c of clouds) {
        c.sp.position.copy(c.cover);
        c.sp.material.opacity = Math.min(0.85, c.base * 1.6);
      }
      wake();
    },
    enter() {
      const from = clouds.map((c) => ({ p: c.sp.position.clone(), o: c.sp.material.opacity }));
      return glide(overviewPose(), 2600, (k) => {
        const e = ease(Math.min(1, k * 1.25));
        clouds.forEach((c, i) => {
          c.sp.position.lerpVectors(from[i].p, c.home, e);
          c.sp.material.opacity = from[i].o + (c.base - from[i].o) * e;
        });
      });
    },
    overview() {
      orbit = false;
      return glide(overviewPose(), 1500);
    },
    async travelTo(id) {
      const p = placed.find((x) => x.entry.id === id);
      if (!p) return;
      orbit = false;
      const fp = footprintOf(p.type);
      // Face the building's front, a little to one side, looking down at it.
      const to: Pose = { target: p.pos.clone().add(new Vector3(0, fp * 0.3, 0)), distance: Math.max(70, fp * 10), polar: 0.78, azimuth: p.entry.place.rotation + 0.45 };
      await glide(to, 1700);
      orbit = true;
      lastInput = performance.now();
    },
    setInset(next) {
      inset = next;
      applyView();
      wake();
    },
    anchors() {
      const out: Anchor[] = [];
      for (const p of placed) {
        if (!visible(p)) continue;
        v.copy(p.top).project(camera);
        const onScreen = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        out.push({ id: p.entry.id, x: (v.x * 0.5 + 0.5) * size.w, y: (-v.y * 0.5 + 0.5) * size.h, visible: onScreen, depth: camera.position.distanceTo(p.top) });
      }
      return out;
    },
    onView(cb) {
      viewCbs.add(cb);
      return () => viewCbs.delete(cb);
    },
    onLearn(cb) {
      learnCb = cb;
    },
    heading() {
      return poseOf().azimuth;
    },
    north() {
      void glide({ ...poseOf(), azimuth: 0 }, 700);
    },
    pick,
    groundAt,
    ghost(type, at, except) {
      if (!type || !at || !building(type)) {
        if (ghostMesh) {
          scene.remove(ghostMesh);
          ghostMesh = null;
          wake();
        }
        return null;
      }
      const geo = geometryOf(type, 'near');
      if (!ghostMesh || ghostMesh.geometry !== geo) {
        if (ghostMesh) scene.remove(ghostMesh);
        ghostMesh = new Mesh(geo, ghostMat);
        ghostMesh.scale.setScalar(S);
        scene.add(ghostMesh);
      }
      // Snapped to the plot under the pointer, turned to its street.
      const verdict = placeAt(plots, at.x, at.z, extentOf(type), taken, { except, rotation: at.rotation });
      if (verdict.ok) {
        ghostMesh.position.set(verdict.place.x, verdict.lot.ground, verdict.place.z);
        ghostMesh.rotation.y = verdict.place.rotation;
      } else {
        ghostMesh.position.set(at.x, heightAt(land, at.x, at.z), at.z);
        ghostMesh.rotation.y = at.rotation;
      }
      ghostMat.opacity = verdict.ok ? 0.75 : 0.3;
      ghostMat.color.setScalar(verdict.ok ? 1 : 0.35);
      wake();
      return verdict.ok ? { ok: true, place: verdict.place } : verdict;
    },
    setPanning(on) {
      controls.enabled = on;
    },
    look(p) {
      orbit = false;
      tween = null;
      place({ target: new Vector3(p.x, heightAt(land, p.x, p.z), p.z), distance: p.distance, polar: p.polar, azimuth: p.azimuth });
      wake();
    },
    pose() {
      const p = poseOf();
      return { x: p.target.x, z: p.target.z, distance: p.distance, polar: p.polar, azimuth: p.azimuth };
    },
    stats() {
      return { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, fps: frames.length, frames: renderer.info.render.frame, people: people.group.visible ? people.count : 0, peopleMs: Math.round(peopleMs * 100) / 100, startup: { ...startup } };
    },
    dispose() {
      running = false;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      for (const g of geoCache.values()) g.dispose();
      city.dispose();
      people.dispose();
      houses?.dispose();
      landGeo.dispose();
      renderer.dispose();
    },
  };
}
