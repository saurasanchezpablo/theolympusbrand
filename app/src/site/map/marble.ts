// The map's marble: white stone with thin dark veins and soft clouding, drawn
// in the shader from 3D noise in each building's own space — no texture, no
// seams, the same on every side. Roughness varies a little, as polished stone does.

import { MeshStandardMaterial } from 'three';

export function marbleMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.34, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vP;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
vec3 q = vP * 0.55;
float w = fbm3(q * 0.7);
float v = abs(sin((q.x * 0.9 + q.y * 0.35 + q.z * 0.6 + w * 5.5) * 3.14159));
float vein = 1.0 - pow(v, 0.12);
float cloud = fbm3(q * 2.3) * 0.08;
diffuseColor.rgb = vec3(0.86 - cloud - vein * 0.42 - (1.0 - pow(v, 0.5)) * 0.06);`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.28 + fbm3(vP * 3.0) * 0.18;');
  };
  return m;
}
