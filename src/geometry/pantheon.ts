// The pantheon: the god of each service, drawn for the temple's central bay
// (38 units wide, centred on x = 256, y ≈ 251), and the seal tier built from it.
// Zeus — the master — has no statue: his bay holds more server racks.

import { C, type Ring } from './math.ts';
import { annulus, bar, circle, hole, poly, rect, rectHole, ribbon, ribbonPts, solid, transformPath } from './path.ts';
import { ccw } from './math.ts';

export type GodId = 'zeus' | 'apollo' | 'hestia' | 'athena' | 'argus';

export type God = { id: GodId; name: string; domain: string; cella?: () => string };

const almond = (cx: number, cy: number, w: number, h: number, steps = 14): Ring => {
  const pts: Ring = [];
  for (let i = 0; i <= steps; i++) pts.push([cx - w / 2 + (w * i) / steps, cy - Math.sin((Math.PI * i) / steps) * (h / 2)]);
  for (let i = steps - 1; i > 0; i--) pts.push([cx - w / 2 + (w * i) / steps, cy + Math.sin((Math.PI * i) / steps) * (h / 2)]);
  return pts;
};

export const GODS: Record<GodId, God> = {
  zeus: { id: 'zeus', name: 'ZEUS', domain: 'The Olympus' },

  apollo: {
    id: 'apollo',
    name: 'APOLLO',
    domain: 'Media',
    cella: () => {
      // Lyre: sound box, curving arms, yoke and four strings.
      let d = 'M240 282L272 282C272 296 264 302 256 302C248 302 240 296 240 282Z';
      for (const s of [1, -1]) {
        const arm: Ring = ([[244, 284], [241, 262], [240, 240], [243, 224], [240, 212], [235, 206]] as Ring).map(([x, y]) => [C + s * (x - C), y]);
        d += ribbon(arm, [4.6, 4.4, 4, 3.6, 3, 2.4], { capEnd: 2 });
      }
      d += bar([238, 221], [274, 221], 4.2);
      for (const x of [250, 254, 258, 262]) d += bar([x, 223], [x, 282], 1.4);
      return d;
    },
  },

  hestia: {
    id: 'hestia',
    name: 'HESTIA',
    domain: 'Home',
    cella: () =>
      // Flame on the household altar.
      'M257 204C271 226 275 246 268 258C264 266 260 268 256 268C252 268 248 266 244 258C238 246 243 230 252 218C252 226 254 230 257 232C260 224 260 214 257 204Z' +
      'M256 236C251 244 249 252 252 259C253 262 259 262 260 259C263 252 261 244 256 236Z' +
      rect(238, 271, 274, 277) +
      rect(241, 277, 271, 303) +
      rectHole(245, 282, 267, 298) +
      solid([[256, 284], [262, 290], [256, 296], [250, 290]]),
  },

  athena: {
    id: 'athena',
    name: 'ATHENA',
    domain: 'Security',
    cella: () => {
      // Athena's owl on a perch.
      let d = 'M240 224L244 208L251 218L261 218L268 208L272 224C274 252 270 278 256 290C242 278 238 252 240 224Z';
      for (const x of [249, 263]) d += circle(x, 230, 6.4, true) + circle(x, 230, 2.8);
      d += hole([[253.6, 237], [258.4, 237], [256, 244]]);
      for (const [y, xs] of [[253, [250, 256, 262]], [262, [247, 253, 259, 265]], [271, [250, 256, 262]]] as [number, number[]][]) {
        for (const x of xs) d += circle(x, y, 1.7, true);
      }
      d += rect(236, 296, 276, 300.5) + rect(249, 287, 252, 296) + rect(260, 287, 263, 296);
      return d;
    },
  },

  argus: {
    id: 'argus',
    name: 'ARGUS',
    domain: 'Monitoring',
    cella: () => {
      // Argus Panoptes, the hundred-eyed watchman.
      let d = '';
      for (const y of [222, 251, 280]) d += solid(almond(256, y, 38, 18)) + hole(almond(256, y, 31, 11.5)) + circle(256, y, 5.2) + circle(256, y, 2, true);
      return d;
    },
  },
};

/** Bold temple-server for the master seal: bolt in the pediment, rack bars in the bays. */
function templeGlyph(): string {
  let d = solid([[92, 186], [256, 86], [420, 186]]);
  d += poly(ccw(ribbonPts([[176, 166], [210, 147], [240, 170], [272, 145], [304, 168], [336, 156]], 10)));
  d += rect(104, 196, 408, 226);
  for (const x of [130, 206, 306, 382]) d += rect(x - 20, 236, x + 20, 372);
  for (const [x0, x1] of [[156, 180], [232, 280], [332, 356]]) {
    for (const y of [244, 270, 296, 322, 348]) d += rect(x0, y, x1, y + 14);
  }
  d += rect(92, 382, 420, 400) + rect(72, 408, 440, 428);
  return d;
}

/** The seal tier (≤ 48 px): a heavy ring around one bold symbol. */
export function sealGlyph(god: GodId): string {
  let d = annulus(214, 252);
  const cella = GODS[god].cella;
  if (!cella) d += transformPath(templeGlyph(), 0.76, 256 * 0.24, 257 * 0.24 - 4);
  else {
    const k = 3.15;
    d += transformPath(cella(), k, 256 - 256 * k, 256 - 251 * k);
  }
  return d;
}
