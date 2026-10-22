// The people of the city: they walk the walkways, cross at the stepping
// stones, go to the agora, the sanctuary, the grove or along some street,
// stop a while at the squares, and set off again. Some walk in pairs.
//
// Each walker is a place on the walking network (plan.walk) — an edge and how
// far along it — so where it stands is worked out, not stepped: the cost per
// frame is a matrix per walker, and choices are made only at the corners.
// The figures are instanced; their stride is four poses, chosen by each
// walker's own phase. They cast no shadow (the city's shadows are cast once).
// Everything is seeded: the same city, the same crowd.

import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CityPlan } from '../../../../src/map/city.ts';
import { seeded } from '../../../../src/map/noise.ts';

/** How high a walkway stands over its roadway (city-mesh's curb). */
const CURB = 0.15;
const POSES = 4;

type Walker = {
  from: number;
  to: number;
  s: number;
  len: number;
  speed: number;
  /** Which side of the way it keeps to, from the way's middle. */
  lane: number;
  target: number;
  pause: number;
  phase: number;
  heading: number;
  /** Its spot when it stands about a square: a direction from the centre, and how far out (0 at the fountain's rim, 1 near the square's edge). */
  spot: [number, number];
  /** A companion walks beside its leader. */
  leader: number;
  /** Its offset from the way's middle as it stands, easing to the side of each new way. */
  off: [number, number] | null;
};

export type People = {
  group: Group;
  update(dt: number): void;
  setVisible(v: boolean): void;
  count: number;
  /** Where each walker stands ([x, y, z]), and whether it has stopped: for tests and the page's numbers. */
  positions(): { at: [number, number, number]; stopped: boolean }[];
  dispose(): void;
};

/** A figure in a long tunic: legs in one of four poses of a stride (pose 0 stands). */
function figure(pose: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const swing = [0, 0.42, 0, -0.42][pose];
  const lift = [0, 0.03, 0.06, 0.03][pose];
  // Legs: below the tunic's hem, swinging.
  for (const side of [-1, 1]) {
    const leg = new BoxGeometry(0.07, 0.24, 0.08).translate(0, -0.12, 0);
    leg.rotateX(side * swing);
    leg.translate(side * 0.055, 0.24 + lift, 0);
    parts.push(leg);
  }
  // The tunic, the shoulders, the head; the arms swing against the legs.
  parts.push(new CylinderGeometry(0.1, 0.15, 0.34, 7).translate(0, 0.39 + lift, 0));
  parts.push(new CylinderGeometry(0.115, 0.1, 0.06, 7).translate(0, 0.59 + lift, 0));
  for (const side of [-1, 1]) {
    const arm = new BoxGeometry(0.05, 0.2, 0.06).translate(0, -0.1, 0);
    arm.rotateX(-side * swing * 0.7);
    arm.translate(side * 0.13, 0.6 + lift, 0);
    parts.push(arm);
  }
  const head = new SphereGeometry(0.075, 7, 5).translate(0, 0.7 + lift, 0);
  // Clothes take the walker's own grey (colour 1); the head is marked 0 and given a light grey of its own.
  const tag = (p: BufferGeometry, v: number) => {
    const g = p.index ? p.toNonIndexed() : p;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.setAttribute('color', new BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(v), 3));
    return g;
  };
  return mergeGeometries([...parts.map((p) => tag(p, 1)), tag(head, 0)])!;
}

export function createPeople(plan: CityPlan, opts: { count: number; still: boolean }): People {
  const { nodes, edges, use } = plan.walk;
  const adj: { to: number; use: number }[][] = nodes.map(() => []);
  edges.forEach(([a, b], k) => {
    adj[a].push({ to: b, use: use[k] });
    adj[b].push({ to: a, use: use[k] });
  });
  const dist = (a: number, b: number) => Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][2] - nodes[b][2]);
  // The squares' centres: where people gather.
  const hubs = plan.squares.map((q) => {
    const cx = (q.rect[0] + q.rect[2]) / 2,
      cz = (q.rect[1] + q.rect[3]) / 2;
    let best = 0,
      d = Infinity;
    nodes.forEach((n, k) => {
      const e = Math.hypot(n[0] - cx, n[2] - cz);
      if (e < d) (d = e), (best = k);
    });
    // How far from its centre people stand about: across most of the square, clear of the fountain.
    const reach = Math.min(q.rect[2] - q.rect[0], q.rect[3] - q.rect[1]) / 2;
    return { node: best, kind: q.kind, pull: q.kind === 'agora' ? 8 : q.kind === 'sanctuary' ? 3 : q.kind === 'grove' ? 2 : 1, reach };
  });
  const isHub = new Map(hubs.map((h) => [h.node, h]));
  const rnd = seeded(4711);
  const agora = hubs.find((h) => h.kind === 'agora')!.node;
  const busy = edges.map(([a, b], k) => use[k] / (1 + Math.min(dist(a, agora), dist(b, agora)) / 70));
  const total = busy.reduce((s, v) => s + v, 0);
  const pickEdge = () => {
    let r = rnd() * total;
    for (let k = 0; k < busy.length; k++) if ((r -= busy[k]) <= 0) return k;
    return busy.length - 1;
  };
  const pickTarget = (): number => {
    const r = rnd();
    // Most go to a square (the agora most), the rest somewhere along the streets.
    if (r < 0.6) {
      const pulls = hubs.reduce((s, h) => s + h.pull, 0);
      let t = rnd() * pulls;
      for (const h of hubs) if ((t -= h.pull) <= 0) return h.node;
    }
    return edges[pickEdge()][rnd() < 0.5 ? 0 : 1];
  };
  // A walker's spot when it stands about a square: a direction, and how far out (evenly over the area).
  const spotOf = (): [number, number] => [rnd() * Math.PI * 2, Math.sqrt(rnd())];
  /** Where a walker stands at a node: at a square, its own spot — from the fountain's rim out to well clear of the square's stoas and statues. */
  const at = (w: Walker, n: number): [number, number, number] => {
    const p = nodes[n];
    const hub = isHub.get(n);
    if (!hub) return [p[0], p[1], p[2]];
    const r = 2.8 + w.spot[1] * Math.max(0.5, hub.reach * 0.62 - 2.8);
    return [p[0] + Math.cos(w.spot[0]) * r, p[1], p[2] + Math.sin(w.spot[0]) * r];
  };  const walkers: Walker[] = [];
  for (let k = 0; k < opts.count; k++) {
    const pair = k > 0 && k % 6 === 0 && walkers[k - 1].leader < 0;
    if (pair) {
      const l = walkers[k - 1];
      walkers.push({ ...l, lane: l.lane > 0 ? l.lane - 0.42 : l.lane + 0.42, leader: k - 1, phase: (l.phase + 0.5) % 1, off: null });
      continue;
    }
    // A fifth of the crowd is already standing about the squares; the rest are on their way somewhere.
    if (k % 5 === 2) {
      const pulls = hubs.reduce((sum, h) => sum + h.pull, 0);
      let t = rnd() * pulls;
      const hub = hubs.find((h) => (t -= h.pull) <= 0) ?? hubs[0];
      const from = adj[hub.node][Math.floor(rnd() * adj[hub.node].length)].to;
      const w: Walker = { from, to: hub.node, s: 0, len: 1, speed: 0.36 + rnd() * 0.22, lane: (rnd() < 0.5 ? -1 : 1) * (0.12 + rnd() * 0.2), target: hub.node, pause: 2 + rnd() * 16, phase: rnd(), heading: rnd() * Math.PI * 2, spot: spotOf(), leader: -1, off: null };
      w.len = Math.max(0.01, Math.hypot(at(w, hub.node)[0] - nodes[from][0], at(w, hub.node)[2] - nodes[from][2]));
      w.s = w.len;
      walkers.push(w);
      continue;
    }
    const e = pickEdge();
    const [a, b] = rnd() < 0.5 ? edges[e] : [edges[e][1], edges[e][0]];
    const len = Math.max(0.01, dist(a, b));
    walkers.push({ from: a, to: b, s: rnd() * len, len, speed: 0.36 + rnd() * 0.22, lane: (rnd() < 0.5 ? -1 : 1) * (0.12 + rnd() * 0.2), target: pickTarget(), pause: 0, phase: rnd(), heading: 0, spot: spotOf(), leader: -1, off: null });
  }

  /** The next way from a node: towards its target, on through rather than back, busier ways more often. */
  const choose = (w: Walker) => {
    const here = w.to;
    const options = adj[here].filter((o) => o.to !== w.from || adj[here].length === 1);
    let sum = 0;
    const weights = options.map((o) => {
      const closer = dist(o.to, w.target) < dist(here, w.target) - 0.01 ? 4 : 1;
      const v = o.use * closer;
      sum += v;
      return v;
    });
    let r = rnd() * sum;
    let pick = options[0];
    for (let k = 0; k < options.length; k++) if ((r -= weights[k]) <= 0) {
      pick = options[k];
      break;
    }
    w.from = here;
    w.to = pick.to;
    w.s = 0;
    w.len = Math.max(0.01, Math.hypot(at(w, w.to)[0] - at(w, w.from)[0], at(w, w.to)[2] - at(w, w.from)[2]));
  };

  // The figures: one instanced mesh per pose, filled each frame with the walkers in that pose.
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  material.onBeforeCompile = (sh) => {
    // The head's vertices carry 0: it takes a light grey of its own, whatever the clothes.
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nif (vColor.r < 0.01) diffuseColor.rgb = vec3(0.62);');
  };
  const group = new Group();
  const geos = Array.from({ length: POSES }, (_, p) => figure(p));
  const meshes = geos.map((g) => {
    const m = new InstancedMesh(g, material, Math.max(1, walkers.length));
    m.count = 0;
    m.receiveShadow = true;
    m.castShadow = false;
    m.frustumCulled = false;
    group.add(m);
    return m;
  });
  const tone = walkers.map((_, k) => {
    // Tunics from near white to dark: a crowd, in grey.
    const r = Math.sin(k * 12.9898) * 43758.5453;
    const f = r - Math.floor(r);
    return new Color().setScalar(f < 0.35 ? 0.85 : f < 0.65 ? 0.55 : f < 0.85 ? 0.35 : 0.2);
  });
  const m4 = new Matrix4(),
    q = new Quaternion(),
    up = new Vector3(0, 1, 0),
    pos = new Vector3();
  const SCALE = new Vector3(0.95, 0.95, 0.95);
  const where: { at: [number, number, number]; stopped: boolean }[] = walkers.map(() => ({ at: [0, 0, 0], stopped: false }));
  const place = (dt = 0) => {
    const counts = new Array(POSES).fill(0);
    walkers.forEach((w, k) => {
      const ref = w.leader >= 0 ? walkers[w.leader] : w;
      const A = at(ref, ref.from),
        B = at(ref, ref.to);
      const t = ref.len > 0 ? Math.min(1, ref.s / ref.len) : 0;
      const dx = B[0] - A[0],
        dz = B[2] - A[2];
      const l = Math.hypot(dx, dz) || 1;
      // Keep to its side: the offset turns with the way, easing round a corner rather than jumping.
      const tx = (-dz / l) * w.lane,
        tz = (dx / l) * w.lane;
      if (!w.off) w.off = [tx, tz];
      const ease = Math.min(1, dt * 2.5);
      w.off[0] += (tx - w.off[0]) * ease;
      w.off[1] += (tz - w.off[1]) * ease;
      const [ox, oz] = w.off;
      // On the walkways a curb above the crossing's height; on a square, its own level.
      const ya = A[1] + (isHub.has(ref.from) ? 0 : CURB),
        yb = B[1] + (isHub.has(ref.to) ? 0 : CURB);
      pos.set(A[0] + dx * t + ox, ya + (yb - ya) * t, A[2] + dz * t + oz);
      const want = Math.atan2(dx, dz);
      const d = ((want - w.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      w.heading += d * 0.2;
      const stopped = ref.pause > 0;
      where[k].at = [pos.x, pos.y, pos.z];
      where[k].stopped = stopped;
      const pose = stopped || opts.still ? 0 : Math.floor(((w.phase + (ref.s / 0.55) * 0.5) % 1) * POSES) % POSES;
      q.setFromAxisAngle(up, w.heading);
      m4.compose(pos, q, SCALE);
      const mesh = meshes[pose];
      mesh.setMatrixAt(counts[pose], m4);
      mesh.setColorAt(counts[pose], tone[k]);
      counts[pose]++;
    });
    meshes.forEach((m, p) => {
      m.count = counts[p];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  };
  place();
  return {
    group,
    count: walkers.length,
    update(dt) {
      if (opts.still) return;
      for (const w of walkers) {
        if (w.leader >= 0) continue;
        if (w.pause > 0) {
          w.pause -= dt;
          if (w.pause <= 0) w.target = pickTarget();
          continue;
        }
        w.s += w.speed * dt;
        while (w.s >= w.len) {
          const over = w.s - w.len;
          if (w.to === w.target) {
            // Arrived: a while at a square, a moment elsewhere; then somewhere new.
            w.pause = isHub.has(w.to) ? 4 + rnd() * 14 : rnd() < 0.3 ? 1 + rnd() * 3 : 0;
            if (!w.pause) w.target = pickTarget();
            w.s = w.len;
            if (w.pause) break;
          }
          choose(w);
          w.s = over;
        }
      }
      place(dt);
    },
    setVisible(v) {
      group.visible = v;
    },
    positions() {
      return where.map((w) => ({ at: [...w.at] as [number, number, number], stopped: w.stopped }));
    },
    dispose() {
      for (const g of geos) g.dispose();
      material.dispose();
    },
  };
}
