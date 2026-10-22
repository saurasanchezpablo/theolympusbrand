// The map's ground: engraved graphite stone — darker on cliffs, paler on the
// high meadows, contours cut every 4 units and more deeply every 20, crisp at
// any distance — and the dark sea with its engraved swell rings.

import { CanvasTexture, MeshStandardMaterial, RepeatWrapping } from 'three';
import { gradientNoise } from '../../../../src/map/noise.ts';

/** A fine grain of the stone, grey, tiled across the island. */
function grainTexture(): CanvasTexture {
  const W = 256;
  const c = document.createElement('canvas');
  c.width = c.height = W;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, W);
  const n = gradientNoise(77);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      // Tileable: the noise is sampled on a torus.
      const a = (x / W) * Math.PI * 2,
        b = (y / W) * Math.PI * 2;
      const v = n.fbm(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + Math.cos(b) * 3, 5) * 0.6 + n.noise2(Math.sin(b) * 20 + 40, Math.cos(a) * 20) * 0.4;
      const tone = 150 + v * 110;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = tone;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(32, 32);
  t.anisotropy = 8;
  return t;
}

export function landMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, map: grainTexture() });
  // The scene advances this: the clouds' shadows drift with the clouds.
  m.userData.time = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = m.userData.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz; vN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vW; varying vec3 vN;
uniform float uTime;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
float line(float h, float step, float w) { float f = abs(fract(h / step - 0.5) - 0.5) * step; float d = fwidth(h); return 1.0 - smoothstep(0.0, d * w, f); }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
float h = vW.y;
float slope = 1.0 - clamp(vN.y, 0.0, 1.0);
float tone = mix(0.13, 0.075, smoothstep(0.25, 0.6, slope));
tone = mix(tone, 0.22, smoothstep(55.0, 80.0, h) * (1.0 - smoothstep(0.35, 0.7, slope)));
tone = mix(tone, 0.2, 1.0 - smoothstep(0.2, 2.5, h));
vec3 base = vec3(tone) * (0.7 + 0.6 * diffuseColor.r);
float minor = line(h, 4.0, 1.1) * 0.45;
float major = line(h, 20.0, 1.8);
base = mix(base, vec3(0.42), clamp(minor + major, 0.0, 1.0) * step(0.3, h));
// Shadows of the clouds passing over, soft and slow.
vec2 c = vW.xz * 0.0065 + vec2(-uTime * 0.016, 0.0);
float cloud = n2(c) * 0.6 + n2(c * 2.1 + 7.0) * 0.4;
base *= 1.0 - smoothstep(0.55, 0.78, cloud) * 0.32;
diffuseColor.rgb = base;`,
      );
  };
  return m;
}

export function seaMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.35, metalness: 0.1 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace(
      '#include <map_fragment>',
      `#include <map_fragment>
float r = length(vW.xz);
float sw = abs(fract(r / 8.0) - 0.5);
float l = 1.0 - smoothstep(0.0, fwidth(r / 8.0) * 1.2, sw);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05), l * 0.6);`,
    );
  };
  return m;
}
