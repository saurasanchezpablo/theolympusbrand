// The map's 3D scene (its own chunk, loaded only on #/map): the island of
// engraved graphite with its forests and sea, a marble building for each
// service and machine, clouds at the edges. It draws only while something
// moves — the camera, a dragged building, a drifting cloud — and its shadows
// are cast once, again only when a building is placed. Buildings and trees
// near the camera are drawn in full, far ones lighter.

import {
  ACESFilmicToneMapping,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
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
  RingGeometry,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  CylinderGeometry,
} from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MAP, decodeTerrain, heightAt, withTerraces, type Terrain } from '../../../../src/map/terrain.ts';
import { scatterTrees } from '../../../../src/map/vegetation.ts';
import { canPlace, type Refusal } from '../../../../src/map/placement.ts';
import { building } from '../../../../src/map/buildings/index.ts';
import { seeded } from '../../../../src/map/noise.ts';
import type { MapEntry } from '../../../../src/map/items.ts';
import { marbleMaterial } from './marble.ts';
import { landMaterial, seaMaterial } from './land.ts';

export type Status = Record<string, 'up' | 'down' | 'unknown'>;
export type Filter = 'all' | 'service' | 'machine';

export type MapScene = {
  setItems(items: readonly MapEntry[]): void;
  setFilter(f: Filter): void;
  setStatus(s: Status): void;
  select(id: string | null): void;
  focus(id: string): void;
  pick(clientX: number, clientY: number): string | null;
  groundAt(clientX: number, clientY: number): { x: number; z: number } | null;
  /** Show (or with null, hide) a building being placed; says whether it may stand there, and if not why. */
  ghost(type: string | null, at?: { x: number; z: number; rotation: number }, except?: string): { ok: true } | { ok: false; why: Refusal } | null;
  /** While dragging: let the pointer move buildings instead of the view. */
  setPanning(on: boolean): void;
  onHover(cb: (id: string | null) => void): void;
  stats(): { triangles: number; calls: number; fps: number };
  dispose(): void;
};

const S = MAP.buildingScale;
const NEAR_BUILDINGS = 160; // units from the camera within which buildings are drawn in full
const NEAR_TREES = 150;
const TILES = 6;

const footprintOf = (type: string) => (building(type)?.footprint ?? 8) * S;

/** The trees: full crowns near the camera, single cones far away. */
function treeGeometries() {
  const nonIndexed = (g: BufferGeometry) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    n.computeVertexNormals();
    return n;
  };
  const merge = (parts: BufferGeometry[]) => mergeGeometries(parts.map(nonIndexed))!;
  const broadNear = merge(
    [[0, 1.6, 0, 1.05], [0.55, 1.25, 0.2, 0.75], [-0.5, 1.3, -0.25, 0.8], [0.1, 2.2, -0.1, 0.7]]
      .map(([x, y, z, r]): BufferGeometry => new IcosahedronGeometry(r, 0).translate(x, y, z))
      .concat([new CylinderGeometry(0.12, 0.16, 1.2, 5).translate(0, 0.6, 0)]),
  );
  const pineNear = merge([0, 1, 2, 3].map((i): BufferGeometry => new ConeGeometry(1.0 - i * 0.2, 1.3, 7).translate(0, 1.0 + i * 0.75, 0)).concat([new CylinderGeometry(0.1, 0.13, 1.0, 5).translate(0, 0.5, 0)]));
  const broadFar = nonIndexed(new IcosahedronGeometry(1.15, 0).scale(1, 1.1, 1).translate(0, 1.7, 0));
  const pineFar = nonIndexed(new ConeGeometry(0.95, 3.6, 5).translate(0, 2.2, 0));
  return { broadNear, broadFar, pineNear, pineFar };
}

/** Soft puffs of cloud, grey, drawn once. */
function cloudTexture(): CanvasTexture {
  const W = 256;
  const c = document.createElement('canvas');
  c.width = c.height = W;
  const g = c.getContext('2d')!;
  const rnd = seeded(31);
  for (let i = 0; i < 70; i++) {
    const x = W / 2 + (rnd() - 0.5) * W * 0.5,
      y = W / 2 + (rnd() - 0.5) * W * 0.4,
      r = 14 + rnd() * 34;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(235,235,235,0.22)');
    gr.addColorStop(0.6, 'rgba(235,235,235,0.12)');
    gr.addColorStop(1, 'rgba(235,235,235,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, W);
  }
  return new CanvasTexture(c);
}

export function createMapScene(canvas: HTMLCanvasElement, terrainBytes: ArrayBuffer, opts: { reducedMotion: boolean; intro: boolean }): MapScene {
  const base = decodeTerrain(new Uint8Array(terrainBytes));
  let land: Terrain = base;

  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new Scene();
  scene.background = new Color(0x0e0e0e);
  scene.fog = new Fog(0x0e0e0e, 520, 1000);
  const camera = new PerspectiveCamera(32, 1, 1, 2000);
  const HOME = new Vector3(0, 520, 400);
  camera.position.copy(opts.intro && !opts.reducedMotion ? new Vector3(0, 900, 520) : HOME);
  const controls = new MapControls(camera, canvas);
  controls.enableDamping = !opts.reducedMotion;
  controls.dampingFactor = 0.08;
  controls.minDistance = 30;
  controls.maxDistance = 680;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = 1.1;
  controls.screenSpacePanning = false;
  controls.target.set(0, 0, 0);

  // ---- light: a low sun for long shadows, cast once ----
  scene.add(new HemisphereLight(0xffffff, 0x303030, 0.55));
  const sun = new DirectionalLight(0xffffff, 2.6);
  sun.position.set(-210, 230, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -270, right: 270, top: 270, bottom: -270, near: 10, far: 800 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);

  // ---- the land and the sea ----
  const landGeo = new PlaneGeometry(base.size, base.size, base.res - 1, base.res - 1);
  landGeo.rotateX(-Math.PI / 2);
  const landMesh = new Mesh(landGeo, landMaterial());
  landMesh.receiveShadow = true;
  landMesh.castShadow = true;
  scene.add(landMesh);
  const shape = () => {
    const p = landGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(land, p.getX(i), p.getZ(i)));
    p.needsUpdate = true;
    landGeo.computeVertexNormals();
    landGeo.computeBoundingSphere();
  };
  const sea = new Mesh(new PlaneGeometry(2400, 2400), seaMaterial());
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = MAP.sea;
  sea.receiveShadow = true;
  scene.add(sea);

  // ---- forests ----
  const treeGeo = treeGeometries();
  const broadMat = new MeshStandardMaterial({ color: 0x5c5c5c, roughness: 0.95, flatShading: true });
  const pineMat = new MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.95, flatShading: true });
  type Tile = { centre: Vector3; near: InstancedMesh[]; far: InstancedMesh[] };
  let tiles: Tile[] = [];
  const forest = new Group();
  scene.add(forest);
  const plant = (sites: { x: number; z: number; r: number }[]) => {
    for (const t of tiles) for (const m of [...t.near, ...t.far]) m.dispose();
    forest.clear();
    tiles = [];
    const { broad, pine } = scatterTrees(land, sites);
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
    const m = new Matrix4(),
      q = new Quaternion(),
      v = new Vector3(),
      s = new Vector3(),
      up = new Vector3(0, 1, 0);
    buckets.forEach((b, k) => {
      const tile: Tile = { centre: new Vector3(-MAP.size / 2 + ((k % TILES) + 0.5) * size, 0, -MAP.size / 2 + (Math.floor(k / TILES) + 0.5) * size), near: [], far: [] };
      for (const [arr, idx, near, far, mat] of [
        [broad, b.broad, treeGeo.broadNear, treeGeo.broadFar, broadMat],
        [pine, b.pine, treeGeo.pineNear, treeGeo.pineFar, pineMat],
      ] as const) {
        if (!idx.length) continue;
        for (const [geo, list] of [
          [near, tile.near],
          [far, tile.far],
        ] as const) {
          const mesh = new InstancedMesh(geo, mat, idx.length);
          idx.forEach((i, n) => {
            q.setFromAxisAngle(up, arr[i + 4]);
            v.set(arr[i], arr[i + 1], arr[i + 2]);
            s.set(arr[i + 3], arr[i + 3], arr[i + 3]);
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
  type Placed = { entry: MapEntry; type: string; matrix: Matrix4; pos: Vector3 };
  let placed: Placed[] = [];
  let groups = new Map<string, { near: InstancedMesh; far: InstancedMesh; members: Placed[] }>();
  const town = new Group();
  scene.add(town);
  let filter: Filter = 'all';
  const visible = (p: Placed) => filter === 'all' || p.entry.kind === filter;
  const pickable: InstancedMesh[] = [];
  const pickIds = new Map<InstancedMesh, string[]>();

  // Status rings at each building's foot, and the ring of the selected one.
  const ringGeo = new RingGeometry(0.88, 1, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  let rings: InstancedMesh | null = null;
  let status: Status = {};
  const selRing = new Mesh(new RingGeometry(0.8, 1, 64).rotateX(-Math.PI / 2), new MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, emissive: 0x303030 }));
  selRing.visible = false;
  scene.add(selRing);
  let selected: string | null = null;

  const lodFrom = new Vector3(Infinity, 0, 0);
  /** Which buildings are drawn in full: those near the camera. */
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
        if (p.pos.distanceTo(camera.position) < NEAR_BUILDINGS) {
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
    for (const t of tiles) {
      const near = t.centre.distanceTo(new Vector3(camera.position.x, 0, camera.position.z)) < NEAR_TREES + MAP.size / TILES / 2 && camera.position.distanceTo(controls.target) < 300;
      for (const m of t.near) m.visible = near;
      for (const m of t.far) m.visible = !near;
    }
  };

  const placeRings = () => {
    if (rings) {
      town.remove(rings);
      rings.dispose();
    }
    rings = new InstancedMesh(ringGeo, ringMat, Math.max(1, placed.length));
    const m = new Matrix4(),
      q = new Quaternion(),
      s = new Vector3(),
      c = new Color();
    let n = 0;
    for (const p of placed) {
      const st = status[p.entry.id];
      if (!st || st === 'unknown' || !visible(p)) continue;
      const r = footprintOf(p.type) + 0.8;
      s.set(r, 1, r);
      rings.setMatrixAt(n, m.compose(new Vector3(p.pos.x, p.pos.y + 0.25, p.pos.z), q, s));
      // Online: a marble ring; offline: a dark one.
      rings.setColorAt(n, c.setScalar(st === 'up' ? 0.85 : 0.08));
      n++;
    }
    rings.count = n;
    rings.receiveShadow = true;
    town.add(rings);
  };

  const setItems = (items: readonly MapEntry[]) => {
    const kept = items.filter((e) => building(e.place.building));
    const sites = kept.map((e) => ({ x: e.place.x, z: e.place.z, r: footprintOf(e.place.building) }));
    land = withTerraces(base, sites);
    shape();
    plant(sites);
    for (const g of groups.values()) {
      g.near.dispose();
      g.far.dispose();
    }
    town.clear();
    groups = new Map();
    placed = kept.map((entry) => {
      const pos = new Vector3(entry.place.x, heightAt(land, entry.place.x, entry.place.z) - 0.05, entry.place.z);
      const matrix = new Matrix4().compose(pos, new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), entry.place.rotation), new Vector3(S, S, S));
      return { entry, type: entry.place.building, matrix, pos };
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
    placeRings();
    if (selected) select(selected);
    renderer.shadowMap.needsUpdate = true;
    wake();
  };

  // ---- clouds at the edges ----
  const cloudTex = cloudTexture();
  const rnd = seeded(7);
  const clouds = Array.from({ length: 30 }, () => {
    const sp = new Sprite(new SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.35 + rnd() * 0.3, fog: false }));
    const a = rnd() * Math.PI * 2,
      r = 250 + rnd() * 130;
    const home = new Vector3(Math.cos(a) * r, 60 + rnd() * 50, Math.sin(a) * r);
    const sc = 80 + rnd() * 70;
    sp.scale.set(sc, sc * 0.7, 1);
    sp.position.copy(home);
    scene.add(sp);
    return { sp, home, from: new Vector3(Math.cos(a) * r * 0.25, home.y + 120, Math.sin(a) * r * 0.25) };
  });

  // ---- the loop: draw only when something changed ----
  let dirty = true,
    running = true,
    lastInput = performance.now(),
    lastDraw = 0;
  let introStart = opts.intro && !opts.reducedMotion ? performance.now() : -1;
  const INTRO = 2600;
  const frames: number[] = [];
  const wake = () => {
    dirty = true;
    lastInput = performance.now();
  };
  controls.addEventListener('change', wake);
  controls.addEventListener('start', wake);
  const resize = () => {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    wake();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  const tick = (now: number) => {
    if (!running || document.hidden) return;
    controls.update();
    if (introStart >= 0) {
      const k = ease((now - introStart) / INTRO);
      camera.position.lerpVectors(new Vector3(0, 900, 520), HOME, k);
      camera.lookAt(controls.target);
      for (const c of clouds) c.sp.position.lerpVectors(c.from, c.home, k);
      if (k >= 1) introStart = -1;
      dirty = true;
    }
    // The clouds drift while the map is being looked at; after a minute's stillness they rest, and so does the GPU.
    const drifting = !opts.reducedMotion && now - lastInput < 60_000;
    if (drifting && now - lastDraw > 50) {
      for (const c of clouds) {
        c.sp.position.x += 0.12;
        if (c.sp.position.x > 420) c.sp.position.x = -420;
      }
      dirty = true;
    }
    if (!dirty) return;
    dirty = false;
    relod();
    renderer.render(scene, camera);
    frames.push(now);
    while (frames.length && now - frames[0] > 1000) frames.shift();
    lastDraw = now;
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
    const hits = ray.intersectObjects(pickable, false);
    for (const h of hits) {
      const ids = pickIds.get(h.object as InstancedMesh);
      if (ids && h.instanceId !== undefined) return ids[h.instanceId] ?? null;
    }
    return null;
  };
  const groundAt = (x: number, y: number) => {
    aim(x, y);
    // March along the ray until it goes under the land, then halve the step.
    const o = ray.ray.origin,
      d = ray.ray.direction;
    let t = 0,
      step = 4;
    for (let i = 0; i < 600; i++) {
      const p = o.clone().addScaledVector(d, t);
      if (Math.abs(p.x) > MAP.size / 2 || Math.abs(p.z) > MAP.size / 2) {
        if (p.y < -50) return null;
      }
      if (p.y <= Math.max(MAP.sea, heightAt(land, p.x, p.z))) {
        if (step < 0.05) return { x: p.x, z: p.z };
        t -= step;
        step /= 2;
      }
      t += step;
    }
    return null;
  };
  let hoverCb: (id: string | null) => void = () => {};
  let hoverId: string | null = null;
  let hoverQueued = false;
  const onMove = (e: PointerEvent) => {
    if (hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      const id = pick(e.clientX, e.clientY);
      if (id !== hoverId) {
        hoverId = id;
        canvas.style.cursor = id ? 'pointer' : '';
        hoverCb(id);
      }
    });
  };
  canvas.addEventListener('pointermove', onMove);

  // ---- the building being placed ----
  let ghostMesh: Mesh | null = null;
  const ghostMat = marbleMaterial();
  ghostMat.transparent = true;
  ghostMat.opacity = 0.6;
  ghostMat.depthWrite = false;

  const select = (id: string | null) => {
    selected = id;
    const p = placed.find((x) => x.entry.id === id);
    selRing.visible = !!p;
    if (p) {
      const r = footprintOf(p.type) + 1.6;
      selRing.scale.set(r, 1, r);
      selRing.position.set(p.pos.x, p.pos.y + 0.3, p.pos.z);
    }
    wake();
  };

  return {
    setItems,
    setFilter(f) {
      filter = f;
      lodFrom.set(Infinity, 0, 0);
      placeRings();
      renderer.shadowMap.needsUpdate = true;
      wake();
    },
    setStatus(s) {
      status = s;
      placeRings();
      wake();
    },
    select,
    focus(id) {
      const p = placed.find((x) => x.entry.id === id);
      if (!p) return;
      const offset = camera.position.clone().sub(controls.target).setLength(110);
      const to = p.pos.clone();
      if (opts.reducedMotion) {
        controls.target.copy(to);
        camera.position.copy(to.clone().add(offset));
        wake();
        return;
      }
      const fromT = controls.target.clone(),
        fromP = camera.position.clone(),
        t0 = performance.now();
      const step = () => {
        const k = ease((performance.now() - t0) / 900);
        controls.target.lerpVectors(fromT, to, k);
        camera.position.lerpVectors(fromP, to.clone().add(offset), k);
        wake();
        if (k < 1) requestAnimationFrame(step);
      };
      step();
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
      const others = placed.filter((p) => p.entry.id !== except).map((p) => ({ place: p.entry.place, footprint: footprintOf(p.type) }));
      const verdict = canPlace(base, at, footprintOf(type), others);
      ghostMesh.position.set(at.x, heightAt(land, at.x, at.z), at.z);
      ghostMesh.rotation.y = at.rotation;
      ghostMat.opacity = verdict.ok ? 0.75 : 0.3;
      ghostMat.color.setScalar(verdict.ok ? 1 : 0.35);
      wake();
      return verdict;
    },
    setPanning(on) {
      controls.enabled = on;
    },
    onHover(cb) {
      hoverCb = cb;
    },
    stats() {
      return { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, fps: frames.length };
    },
    dispose() {
      running = false;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      controls.dispose();
      for (const g of geoCache.values()) g.dispose();
      landGeo.dispose();
      renderer.dispose();
    },
  };
}

