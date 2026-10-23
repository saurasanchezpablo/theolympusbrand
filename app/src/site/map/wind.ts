// A breeze in the trees: their crowns lean and sway a little, more the higher
// up the tree, each tree in its own time (from where it stands). One clock
// for the whole island; the scene moves it only while it is drawing anyway
// (the people walking near), never under reduced motion.

import type { Material } from 'three';

/** The breeze's clock (seconds). */
export const WIND = { value: 0 };

/** Let a tree material sway in the breeze: trunks still, crowns moving. */
export function windy<T extends Material>(m: T): T {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.wind = WIND;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float wind;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
#ifdef USE_INSTANCING
vec2 at = instanceMatrix[3].xz;
#else
vec2 at = vec2(0.0);
#endif
float lean = max(0.0, position.y - 0.8) * 0.03;
float t = wind * 1.1 + at.x * 0.13 + at.y * 0.17;
transformed.x += (sin(t) + 0.4 * sin(t * 2.3 + 1.7)) * lean;
transformed.z += (cos(t * 0.8 + 0.6)) * lean * 0.6;`,
    );
  };
  m.customProgramCacheKey = () => 'windy';
  return m;
}
