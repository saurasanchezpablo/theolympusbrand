// The people of the city, drawn: the simulation (src/map/crowd/) decides
// where everyone goes and how; this draws them, every frame, between its
// steps. One instanced figure for the whole crowd — a short chiton, bare
// legs, arms, a head, a mantle over the shoulders for some — whose legs and
// arms the vertex shader swings about the hip and the shoulder: each vertex
// knows its limb, each person its gait. The gait's phase is the distance
// walked over the stride, so the feet keep pace with the ground; its swing
// fades as a person slows and is gone when they stand. They cast no shadow
// (the city's shadows are cast once). The same city, the same crowd.

import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CityPlan } from '../../../../src/map/city.ts';
import type { MapEntry } from '../../../../src/map/items.ts';
import { building, extentOf } from '../../../../src/map/buildings/index.ts';
import { buildNav } from '../../../../src/map/crowd/nav.ts';
import { createCrowd, FIELDS, STRIDE, type Crowd } from '../../../../src/map/crowd/crowd.ts';

export type People = {
  group: Group;
  update(dt: number): void;
  /** The buildings changed: their doors with them. */
  setItems(items: readonly MapEntry[]): void;
  setVisible(v: boolean): void;
  count: number;
  /** Where each person stands ([x, y, z]), and whether they have stopped: for tests and the page's numbers. */
  positions(): { at: [number, number, number]; stopped: boolean }[];
  dispose(): void;
};

/** Limbs, as the shader knows them. */
const BODY = 0,
  LEG_L = 1,
  LEG_R = 2,
  ARM_L = 3,
  ARM_R = 4,
  HEAD = 5,
  CLOAK = 6;
/** Where the legs and arms turn: the hip and the shoulder (figure units, feet at 0). */
const HIP = 0.27,
  SHOULDER = 0.6;

/** The figure, standing, each part tagged with its limb (the head marked for its own grey). */
function figure(): BufferGeometry {
  const parts: [BufferGeometry, number][] = [];
  for (const [side, limb] of [[-1, LEG_L], [1, LEG_R]] as const) {
    // A leg from the hip, and a foot pointing forward.
    parts.push([new BoxGeometry(0.065, HIP, 0.075).translate(side * 0.05, HIP / 2, 0), limb]);
    parts.push([new BoxGeometry(0.07, 0.03, 0.11).translate(side * 0.05, 0.015, 0.02), limb]);
  }
  // The chiton: to the knee, flaring a little; a belt; the shoulders.
  parts.push([new CylinderGeometry(0.095, 0.14, 0.3, 8).translate(0, 0.39, 0), BODY]);
  parts.push([new CylinderGeometry(0.1, 0.1, 0.025, 8).translate(0, 0.47, 0), BODY]);
  parts.push([new CylinderGeometry(0.11, 0.095, 0.07, 8).translate(0, 0.575, 0), BODY]);
  for (const [side, limb] of [[-1, ARM_L], [1, ARM_R]] as const) parts.push([new BoxGeometry(0.05, 0.22, 0.055).translate(side * 0.13, SHOULDER - 0.11, 0), limb]);
  parts.push([new CylinderGeometry(0.03, 0.035, 0.05, 6).translate(0, 0.635, 0), HEAD]);
  parts.push([new SphereGeometry(0.07, 8, 6).translate(0, 0.705, 0), HEAD]);
  // A mantle over the shoulders, falling to the waist, for some (scaled to nothing for the rest).
  parts.push([new CylinderGeometry(0.115, 0.15, 0.17, 8, 1, true).translate(0, 0.53, 0), CLOAK]);
  return mergeGeometries(
    parts.map(([g, limb]) => {
      const p = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal') p.deleteAttribute(k);
      p.setAttribute('limb', new BufferAttribute(new Float32Array(p.attributes.position.count).fill(limb), 1));
      return p;
    }),
  )!;
}

/** How far legs and arms swing at full stride (radians). */
const LEG_SWING = 0.46,
  ARM_SWING = 0.34;

export function createPeople(plan: CityPlan, opts: { count: number; still: boolean }): People {
  const family = (t: string) => building(t)?.family ?? 'temples';
  const known = (items: readonly MapEntry[]) => items.filter((e) => building(e.place.building));
  const crowd: Crowd = createCrowd(buildNav(plan, [], extentOf, family), { count: opts.count });

  const geo = figure();
  const material = new MeshStandardMaterial({ roughness: 0.85 });
  const gait = new InstancedBufferAttribute(new Float32Array(opts.count * 2), 2);
  const look = new InstancedBufferAttribute(new Float32Array(opts.count * 2), 2);
  geo.setAttribute('gait', gait);
  geo.setAttribute('look', look);
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float limb;
attribute vec2 gait; // phase (radians), swing (0 standing … 1 full stride)
attribute vec2 look; // cloak (0/1), the head's grey
varying float vHead;
varying float vMantle;
mat3 aboutX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
float swing = sin(gait.x) * gait.y;
mat3 turn = mat3(1.0);
if (limb > 0.5 && limb < 1.5) turn = aboutX(swing * ${LEG_SWING.toFixed(2)});
else if (limb > 1.5 && limb < 2.5) turn = aboutX(-swing * ${LEG_SWING.toFixed(2)});
else if (limb > 2.5 && limb < 3.5) turn = aboutX(-swing * ${ARM_SWING.toFixed(2)});
else if (limb > 3.5 && limb < 4.5) turn = aboutX(swing * ${ARM_SWING.toFixed(2)});
objectNormal = turn * objectNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
float pivot = limb < 2.5 ? ${HIP.toFixed(2)} : ${SHOULDER.toFixed(2)};
if (limb > 0.5 && limb < 4.5) { transformed.y -= pivot; transformed = turn * transformed; transformed.y += pivot; }
// The body rises a little twice a stride, as the weight passes over each foot.
if (limb < 0.5 || limb > 2.5) transformed.y += gait.y * 0.01 * (1.0 - cos(2.0 * gait.x));
if (limb > 5.5) transformed *= look.x;
vHead = limb > 4.5 && limb < 5.5 ? look.y : -1.0;
vMantle = limb > 5.5 ? 1.0 : 0.0;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHead;\nvarying float vMantle;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nif (vHead >= 0.0) diffuseColor.rgb = vec3(vHead);\n// The mantle: a darker cloth than the chiton under it.\nif (vMantle > 0.5) diffuseColor.rgb *= 0.62;');
  };
  const mesh = new InstancedMesh(geo, material, Math.max(1, opts.count));
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  const group = new Group();
  group.add(mesh);

  // Each one's own look: clothes from near white to dark, a himation for some, a height of their own, a lighter or darker head.
  const rand = (k: number, n: number) => {
    const r = Math.sin(k * 12.9898 + n * 78.233) * 43758.5453;
    return r - Math.floor(r);
  };
  const scale: number[] = [];
  for (let k = 0; k < opts.count; k++) {
    const f = rand(k, 1);
    mesh.setColorAt(k, new Color().setScalar(f < 0.3 ? 0.86 : f < 0.6 ? 0.58 : f < 0.82 ? 0.38 : 0.22));
    look.setXY(k, rand(k, 2) < 0.35 ? 1 : 0, 0.5 + rand(k, 3) * 0.2);
    scale.push(0.9 + rand(k, 4) * 0.14);
  }
  look.needsUpdate = true;

  const m4 = new Matrix4(),
    q = new Quaternion(),
    up = new Vector3(0, 1, 0),
    pos = new Vector3(),
    s = new Vector3();
  const where: { at: [number, number, number]; stopped: boolean }[] = Array.from({ length: opts.count }, () => ({ at: [0, 0, 0], stopped: false }));
  const draw = (alpha: number) => {
    const { prev, cur } = crowd.frames();
    for (let k = 0; k < crowd.count; k++) {
      const o = k * FIELDS;
      const t = alpha;
      pos.set(prev[o] + (cur[o] - prev[o]) * t, prev[o + 1] + (cur[o + 1] - prev[o + 1]) * t, prev[o + 2] + (cur[o + 2] - prev[o + 2]) * t);
      let dh = cur[o + 3] - prev[o + 3];
      if (dh > Math.PI) dh -= Math.PI * 2;
      if (dh < -Math.PI) dh += Math.PI * 2;
      q.setFromAxisAngle(up, prev[o + 3] + dh * t);
      s.setScalar(scale[k]);
      m4.compose(pos, q, s);
      mesh.setMatrixAt(k, m4);
      const speed = prev[o + 4] + (cur[o + 4] - prev[o + 4]) * t;
      const walked = prev[o + 5] + (cur[o + 5] - prev[o + 5]) * t;
      // The stride's phase from the distance walked (scaled to the person's own size); its swing from the speed.
      const swing = opts.still ? 0 : Math.min(1, Math.max(0, (speed - 0.02) / 0.3));
      gait.setXY(k, (walked / (STRIDE * scale[k])) * Math.PI * 2, swing);
      where[k].at = [pos.x, pos.y, pos.z];
      where[k].stopped = cur[o + 6] > 0.5;
    }
    mesh.instanceMatrix.needsUpdate = true;
    gait.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  draw(0);

  return {
    group,
    count: opts.count,
    update(dt) {
      if (opts.still) return;
      draw(crowd.advance(dt));
    },
    setItems(items) {
      crowd.setNav(buildNav(plan, known(items), extentOf, family));
      draw(0);
    },
    setVisible(v) {
      group.visible = v;
    },
    positions() {
      return where.map((w) => ({ at: [...w.at] as [number, number, number], stopped: w.stopped }));
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
