// The attributes of the gods — the symbols that stand in the temple's central bay.
//
// Every symbol is drawn in "bay space": a 38 × 106 box, x 237–275 (centred on
// x = 256), y 198–304. Each has two drawings:
//   fine — for screens: finer strokes and secondary detail;
//   bold — for print editions and seals: every stroke and gap ≥ ~5.2 units,
//          secondary detail dropped (≥ 4.2 once placed in the print crest).

import { type Pt, type Ring } from './math.ts';
import { bar, circle, hole, leaf, rect, ribbon, ribbonPts, solid } from './path.ts';
import { difference, flatten, offset, ringsPath, union } from './poly.ts';

export type SymbolDetail = 'fine' | 'bold';
export type SymbolFn = (detail: SymbolDetail) => string;

const X = 256;

/** Sampled ellipse ring (flatten() only handles circular arcs). */
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 48): Ring {
  return Array.from({ length: n }, (_, i): Pt => [cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)]);
}
const almond = (cx: number, cy: number, w: number, h: number, steps = 16): Ring => {
  const pts: Ring = [];
  for (let i = 0; i <= steps; i++) pts.push([cx - w / 2 + (w * i) / steps, cy - Math.sin((Math.PI * i) / steps) * (h / 2)]);
  for (let i = steps - 1; i > 0; i--) pts.push([cx - w / 2 + (w * i) / steps, cy + Math.sin((Math.PI * i) / steps) * (h / 2)]);
  return pts;
};
/** Boolean helper: (solids) − (cuts), as clean path data. */
const carve = (solids: string, cuts: string): string => ringsPath(difference(union(flatten(solids)), union(flatten(cuts))));
/** Capsule (rounded bar) from p to q, width w. */
function capsule(p: Pt, q: Pt, w: number): string {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
  const r = w / 2;
  const pts: Ring = [];
  for (let i = 0; i <= 10; i++) {
    const t = a - Math.PI / 2 + (Math.PI * i) / 10;
    pts.push([q[0] + r * Math.cos(t), q[1] + r * Math.sin(t)]);
  }
  for (let i = 0; i <= 10; i++) {
    const t = a + Math.PI / 2 + (Math.PI * i) / 10;
    pts.push([p[0] + r * Math.cos(t), p[1] + r * Math.sin(t)]);
  }
  void L;
  return solid(pts);
}

/**
 * A raised wing: rounded feathers fanning from a covert at the shoulder.
 * `side` −1 = left wing, +1 = right wing; feathers are [tip x offset, tip y, width].
 */
function wing(side: number, shoulder: Pt, feathers: [number, number, number][], covert: [number, number], fine: boolean): string {
  let solids = '';
  const bases: Pt[] = feathers.map((_, i) => [shoulder[0] + side * (1 + i * 1.2), shoulder[1] - 2 - i * 2.5]);
  feathers.forEach(([dx, y, w], i) => {
    solids += capsule(bases[i], [X + side * dx, y], w);
  });
  solids += solid(ellipsePts(shoulder[0] + side * 2, shoulder[1] - covert[1] / 2, covert[0], covert[1]));
  if (!fine) return solids;
  // Fine: hairline separations between neighbouring feathers.
  let cuts = '';
  for (let i = 0; i < feathers.length - 1; i++) {
    const [dx0, y0] = feathers[i];
    const [dx1, y1] = feathers[i + 1];
    const tip: Pt = [X + side * ((dx0 + dx1) / 2), (y0 + y1) / 2 + 3];
    cuts += bar([bases[i][0] + side * 1.5, bases[i][1] - 6], tip, 1.2);
  }
  return carve(solids, cuts);
}

/** Arch: an annular half-ring opening downwards, with straight legs to `foot`. */
function arch(cy: number, rOut: number, rIn: number, foot: number): string {
  const top: Ring = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (Math.PI * i) / 24;
    top.push([X + rOut * Math.cos(a), cy + rOut * Math.sin(a)]);
  }
  const inner: Ring = [];
  for (let i = 24; i >= 0; i--) {
    const a = Math.PI + (Math.PI * i) / 24;
    inner.push([X + rIn * Math.cos(a), cy + rIn * Math.sin(a)]);
  }
  return solid([[X - rOut, foot], ...top, [X + rOut, foot], [X + rIn, foot], ...inner, [X - rIn, foot]]);
}

/* ---------------------------------------------------------------- */
/* The four gods of Phase 1, now with bold drawings                  */
/* ---------------------------------------------------------------- */

/** Apollo — the lyre. */
const lyre: SymbolFn = (detail) => {
  const bold = detail === 'bold';
  let d = 'M240 282L272 282C272 296 264 302 256 302C248 302 240 296 240 282Z';
  for (const s of [1, -1]) {
    const arm: Ring = (bold
      ? [[241.5, 284], [240, 262], [240, 240], [243, 224], [240, 212], [235, 206]]
      : [[244, 284], [241, 262], [240, 240], [243, 224], [240, 212], [235, 206]]) as Ring;
    d += ribbon(arm.map(([x, y]) => [X + s * (x - X), y]), bold ? [5.8, 5.8, 5.8, 5.8, 5.4, 5.2] : [4.6, 4.4, 4, 3.6, 3, 2.4], { capEnd: 2 });
  }
  d += bar([238, 221], [274, 221], bold ? 5.6 : 4.2);
  const strings = bold ? [251, 261] : [250, 254, 258, 262];
  for (const x of strings) d += bar([x, 223], [x, 282], bold ? 4.8 : 1.4);
  return d;
};

/** Hestia — the flame on the household altar. */
const hearth: SymbolFn = (detail) => {
  const flame = 'M257 204C271 226 275 246 268 258C264 266 260 268 256 268C252 268 248 266 244 258C238 246 243 230 252 218C252 226 254 230 257 232C260 224 260 214 257 204Z';
  if (detail === 'bold') return flame + rect(237, 274, 275, 281) + rect(241, 281, 271, 303);
  return (
    flame +
    'M256 236C251 244 249 252 252 259C253 262 259 262 260 259C263 252 261 244 256 236Z' +
    rect(238, 271, 274, 277) + rect(241, 277, 271, 303) + rectHole(245, 282, 267, 298) + solid([[256, 284], [262, 290], [256, 296], [250, 290]])
  );
};
const rectHole = (x0: number, y0: number, x1: number, y1: number) => hole([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

/** Athena — the owl on its perch. */
const owl: SymbolFn = (detail) => {
  const body = 'M240 224L244 208L251 218L261 218L268 208L272 224C274 252 270 278 256 290C242 278 238 252 240 224Z';
  if (detail === 'bold') {
    // One spectacle-shaped cut: no hairline left between the eyes.
    const eyes = union(flatten(circle(250, 232, 5.6) + circle(262, 232, 5.6) + rect(250, 229, 262, 235)));
    let d = carve(body, ringsPath(eyes));
    // Legs rise into the body where it is still wide, not into its tapering point.
    d += rect(236, 296, 276, 302) + rect(247.5, 274, 252.5, 296) + rect(259.5, 274, 264.5, 296);
    return d;
  }
  let d = body;
  for (const x of [249, 263]) d += circle(x, 230, 6.4, true) + circle(x, 230, 2.8);
  d += hole([[253.6, 237], [258.4, 237], [256, 244]]);
  for (const [y, xs] of [[253, [250, 256, 262]], [262, [247, 253, 259, 265]], [271, [250, 256, 262]]] as [number, number[]][]) {
    for (const x of xs) d += circle(x, y, 1.7, true);
  }
  return d + rect(236, 296, 276, 300.5) + rect(249, 287, 252, 296) + rect(260, 287, 263, 296);
};

/** Argus — the watchman's eyes. */
const eyes: SymbolFn = (detail) => {
  let d = '';
  for (const y of [222, 251, 280]) {
    if (detail === 'bold') d += solid(almond(X, y, 38, 20)) + circle(X, y, 4.4, true);
    else d += solid(almond(X, y, 38, 18)) + hole(almond(X, y, 31, 11.5)) + circle(X, y, 5.2) + circle(X, y, 2, true);
  }
  return d;
};

/* ---------------------------------------------------------------- */
/* New gods                                                          */
/* ---------------------------------------------------------------- */

/** Atlas — the heavens on a pillar. */
const sphere: SymbolFn = (detail) => {
  const bold = detail === 'bold';
  const cy = 230;
  const R = 18.5;
  const w = bold ? 5.4 : 3;
  let d = circle(X, cy, R) + circle(X, cy, R - w, true);
  d += bar([X - R + w - 0.5, cy], [X + R - w + 0.5, cy], w);
  if (!bold) {
    d += bar([X - 14, cy + 8], [X + 14, cy - 8], 2.4); // ecliptic
    d += solid(ellipsePts(X, cy, 7, R - w + 0.5)) + hole(ellipsePts(X, cy, 4.6, R - w - 1.6)); // meridian
  }
  // The pillar: capital, shaft, base and plinth.
  const sh = bold ? 7 : 5;
  const cap = bold ? cy + R - 1.5 : cy + R + 2; // bold: the globe rests on the capital, no hairline gap
  d += solid([[X - 11, cap], [X + 11, cap], [X + sh, cy + R + 8], [X - sh, cy + R + 8]]);
  d += rect(X - sh, cy + R + 8, X + sh, 290);
  if (!bold) d += rectHole(X - 1, cy + R + 12, X + 1, 286);
  d += rect(X - 12, 290, X + 12, 296) + rect(X - 17, 296, X + 17, 303);
  return d;
};

/** Iris — the rainbow, as nested arches: the bridge between worlds. */
const rainbow: SymbolFn = (detail) => {
  if (detail === 'bold') return arch(224, 19, 13.8, 298) + arch(224, 8.6, 3.4, 298) + rect(237, 298, 275, 304);
  return arch(224, 19, 16, 299) + arch(224, 13.5, 10.5, 299) + arch(224, 8, 5, 299) + rect(237, 299, 275, 304);
};

/** Hermes — the kerykeion, the herald's winged staff. */
const kerykeion: SymbolFn = (detail) => {
  const bold = detail === 'bold';
  const w = bold ? 5.8 : 3.8;
  let d = rect(X - w / 2, 221, X + w / 2, 300) + rect(X - 6, 296, X + 6, 303);
  // The head: a ring open at the top, each end finished with a knob.
  const cy = 213;
  const R = 11;
  const rw = bold ? 5.4 : 3.4;
  const start = -90 + 34;
  const span = 360 - 68;
  const outer: Ring = [];
  const inner: Ring = [];
  for (let i = 0; i <= 32; i++) {
    const t = ((start + (span * i) / 32) * Math.PI) / 180;
    outer.push([X + R * Math.cos(t), cy + R * Math.sin(t)]);
    inner.push([X + (R - rw) * Math.cos(t), cy + (R - rw) * Math.sin(t)]);
  }
  d += solid([...outer, ...inner.reverse()]);
  for (const deg of [start, start + span]) {
    const t = (deg * Math.PI) / 180;
    d += circle(X + (R - rw / 2) * Math.cos(t), cy + (R - rw / 2) * Math.sin(t), rw / 2 + (bold ? 0.8 : 1));
  }
  // Wings: two swept feathers each side, springing from the staff.
  for (const s2 of [-1, 1]) {
    const root: Pt = [X + s2 * 1.5, 246];
    const feathers: [number, number, number][] = bold ? [[19, 229, 8], [17, 242, 6.6]] : [[19, 228, 5.6], [18.5, 236, 5], [16, 244, 4.4]];
    for (const [dx, y, fw] of feathers) d += capsule(root, [X + s2 * dx, y], fw);
  }
  return d;
};

/** Hades — the key of the vault below. */
const key: SymbolFn = (detail) => {
  const bold = detail === 'bold';
  const R = 13.5;
  const w = bold ? 6 : 4;
  let d = circle(X, 216, R) + circle(X, 216, R - w, true);
  if (!bold) d += circle(X, 216, 3.6);
  d += rect(X - (bold ? 4.5 : 3), 216 + R - 1, X + (bold ? 4.5 : 3), 302);
  d += rect(X - 8, 216 + R + 1, X + 8, 216 + R + (bold ? 7 : 5));
  // The bit.
  if (bold) d += rect(X + 4, 278, X + 18, 302) + rectHole(X + 4, 287, X + 12.5, 293);
  else d += rect(X + 3, 280, X + 16, 286) + rect(X + 3, 290, X + 13, 296) + rect(X + 3, 298, X + 16, 302);
  return d;
};

/** Kronos — the hourglass: time, and every snapshot of it. */
const hourglass: SymbolFn = (detail) => {
  const bold = detail === 'bold';
  const post = bold ? 5.4 : 3.6;
  let d = rect(237, 199, 275, bold ? 206 : 205) + rect(237, bold ? 297 : 298, 275, 304);
  d += rect(238, 205, 238 + post, 298) + rect(274 - post, 205, 274, 298);
  if (bold) {
    // Sand joined to the bars, so nothing floats a hairline from the posts.
    d += solid([[248, 205], [264, 205], [256, 247]]) + solid([[256, 257], [264, 298], [248, 298]]);
  } else {
    d += carve(solid([[244, 209], [268, 209], [256, 250]]), solid([[247.5, 211.5], [264.5, 211.5], [256, 244.5]]));
    d += carve(solid([[256, 254], [268, 295], [244, 295]]), solid([[256, 259.5], [264.5, 292.5], [247.5, 292.5]]));
    d += solid([[250, 233], [262, 233], [256, 244]]) + solid([[256, 276], [263.5, 292.5], [248.5, 292.5]]);
  }
  return d;
};

/** Nephele — the cloud nymph: your own cloud, brought up to Olympus. */
const clouds: SymbolFn = (detail) => {
  const bold = detail === 'bold';
  const bank = (puffs: [number, number, number][], base: number, x0: number, x1: number) => {
    const body = union(...puffs.map(([x, y, r]) => flatten(circle(x, y, r))), flatten(rect(x0, base - 8, x1, base)));
    return body;
  };
  const upper = bank([[243.5, 236, 7], [252, 229, 9.5], [263, 230, 8.5], [270, 238, 5.5]], 243, 238, 275);
  const lower = bank([[247, 270, 6], [256, 264, 8], [265, 270, 6]], 276, 242, 270);
  if (bold) return ringsPath(union(upper, lower));
  const outline = (b: Ring[]) => difference(b, offset(b, -2.6));
  return ringsPath(union(outline(upper), outline(lower))) + bar([246, 286], [266, 286], 2.4) + bar([250, 293], [262, 293], 2.4);
};

/** Poseidon — the trident: lord of the sea and all it carries. */
const trident: SymbolFn = (detail) => {
  const bold = detail === 'bold';
  const w = bold ? 5.6 : 3.8;
  let d = rect(X - w / 2, 214, X + w / 2, 300);
  d += solid([[X - 5.5, 216], [X, 199], [X + 5.5, 216]]);
  // Side prongs from a curved crossbar.
  d += ribbon([[240, 210], [240, 232], [248, 238], [264, 238], [272, 232], [272, 210]], w);
  for (const x of [240, 272]) d += solid([[x - 5, 212], [x, 199], [x + 5, 212]]);
  d += rect(X - 6, 288, X + 6, bold ? 296 : 293);
  return d;
};

/** Arachne — the web: the weaver whom Athena could not outdo. */
const web: SymbolFn = (detail) => {
  const bold = detail === 'bold';
  if (bold) return boldWeb();
  const cy = 252;
  const R = 18;
  const spokes = bold ? 6 : 8;
  const sw = bold ? 4.4 : 1.8;
  let d = bar([X, 199], [X, cy], sw);
  for (let i = 0; i < spokes; i++) {
    const a = (Math.PI * 2 * i) / spokes + (bold ? Math.PI / 6 : Math.PI / 8);
    d += bar([X, cy], [X + R * Math.cos(a), cy + R * Math.sin(a)], sw);
  }
  const rings = bold ? [9, 17] : [5.5, 10.5, 15.5];
  const n = spokes;
  for (const r of rings) {
    const out = Array.from({ length: n }, (_, i): Pt => {
      const a = (Math.PI * 2 * i) / n + (bold ? Math.PI / 6 : Math.PI / 8);
      return [X + (r + sw / 2) * Math.cos(a), cy + (r + sw / 2) * Math.sin(a)];
    });
    const inn = Array.from({ length: n }, (_, i): Pt => {
      const a = (Math.PI * 2 * i) / n + (bold ? Math.PI / 6 : Math.PI / 8);
      return [X + (r - sw / 2) * Math.cos(a), cy + (r - sw / 2) * Math.sin(a)];
    });
    d += solid(out) + hole(inn);
  }
  if (!bold) d += circle(X, cy, 3);
  return d;
};

/** Bold web: five spokes (one rising into the thread) and one ring of sagging chords. */
function boldWeb(): string {
  const cy = 254;
  const n = 5;
  const sw = 5;
  const angle = (i: number) => -Math.PI / 2 + (Math.PI * 2 * i) / n;
  let d = bar([X, 199], [X, cy], sw) + circle(X, cy, 4.5);
  for (let i = 1; i < n; i++) d += bar([X, cy], [X + 18 * Math.cos(angle(i)), cy + 18 * Math.sin(angle(i))], sw);
  // Each chord sags towards the hub between its two spokes.
  const ringAt = (r: number): Ring => {
    const pts: Ring = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 8; j++) {
        const t = j / 8;
        const a = angle(i) + (Math.PI * 2 * t) / n;
        const rr = r - 3.2 * Math.sin(Math.PI * t);
        pts.push([X + rr * Math.cos(a), cy + rr * Math.sin(a)]);
      }
    }
    return pts;
  };
  d += solid(ringAt(15.5 + sw / 2)) + hole(ringAt(15.5 - sw / 2).reverse());
  return d;
}

/** Hephaestus — hammer and anvil: the divine smith and miner. */
const forge: SymbolFn = (detail) => {
  const bold = detail === 'bold';
  let d = solid([[241, 266], [275, 266], [275, 274], [265, 277], [262, 287], [269, 293], [269, 301], [243, 301], [243, 293], [250, 287], [248, 277], [242, 274], [236, 269]]);
  d += rect(X - (bold ? 3.5 : 2.4), 220, X + (bold ? 3.5 : 2.4), bold ? 259 : 260);
  d += solid([[241, 203], [270, 203], [273, 207], [273, 216], [270, 220], [241, 220], [238, 215], [238, 208]]);
  if (!bold) d += rect(X - 6, 220, X + 6, 224);
  return d;
};

/** Nike — the victor's wreath, tied with ribbons. */
const wreath: SymbolFn = (detail) => {
  const bold = detail === 'bold';
  const cx = X;
  const cy = 244;
  const R = 15;
  let d = '';
  // Two branches meeting at the bottom, open at the top.
  for (const side of [-1, 1]) {
    const stem: Ring = [];
    for (let i = 0; i <= 20; i++) {
      const deg = 90 + side * (8 + (150 * i) / 20);
      stem.push([cx + R * Math.cos((deg * Math.PI) / 180), cy + R * Math.sin((deg * Math.PI) / 180)]);
    }
    d += ribbon(stem, bold ? 4.2 : 2.2);
    const n = bold ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const deg = 90 + side * (22 + (128 * (i + 0.5)) / n);
      const t = (deg * Math.PI) / 180;
      const base: Pt = [cx + R * Math.cos(t), cy + R * Math.sin(t)];
      const tangent: Pt = [-Math.sin(t) * side, Math.cos(t) * side];
      const radial: Pt = [Math.cos(t), Math.sin(t)];
      const len = bold ? 11.5 : 10;
      for (const lean of bold ? [1] : [1, -1]) {
        const v: Pt = [tangent[0] + radial[0] * lean * 0.75, tangent[1] + radial[1] * lean * 0.75];
        const L = Math.hypot(v[0], v[1]);
        d += leaf(base, [base[0] + (v[0] / L) * len, base[1] + (v[1] / L) * len], bold ? 7 : 4.4);
      }
    }
  }
  // The tie, and two short ribbon tails splayed outwards with forked ends.
  d += circle(cx, cy + R + 1, bold ? 5.2 : 3.8);
  for (const side of [-1, 1]) {
    const tail: Ring = [[cx + side * 2, cy + R + 3], [cx + side * 9, cy + R + 14], [cx + side * 15, cy + R + 24]];
    const tw = bold ? 6.4 : 4.4;
    const pts = ribbonPts(tail, tw);
    // Fork the end: a notch cut into the tail's tip.
    const [ex, ey] = tail[2];
    const ux = (tail[2][0] - tail[1][0]) / Math.hypot(tail[2][0] - tail[1][0], tail[2][1] - tail[1][1]);
    const uy = (tail[2][1] - tail[1][1]) / Math.hypot(tail[2][0] - tail[1][0], tail[2][1] - tail[1][1]);
    d += carve(solid(pts), solid([[ex + ux * 1, ey + uy * 1], [ex - ux * (bold ? 5.5 : 4) - uy * 0.01, ey - uy * (bold ? 5.5 : 4)], [ex + ux * 1 + uy * 0.01, ey + uy * 1 - ux * 0.01]]));
  }
  return d;
};

/** Ares — the crested Corinthian helmet, seen from the front. */
const helmet: SymbolFn = (detail) => {
  const bold = detail === 'bold';
  // Horsehair crest, carried on a holder that sits on the bowl.
  const plume: Ring = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (Math.PI * i) / 24;
    plume.push([X + 17 * Math.cos(a), 220 + 16 * Math.sin(a)]);
  }
  let d = solid(plume) + rect(X - 4, 218, X + 4, 232);
  if (!bold) for (const x of [247, 253, 259, 265]) d += rectHole(x - 0.7, 207, x + 0.7, 217);
  // Bowl: a dome flaring into long cheek guards.
  const half: Ring = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (Math.PI / 2) * (i / 12);
    half.push([X + 18 * Math.cos(a), 248 + 20 * Math.sin(a)]);
  }
  const tipX = 9;
  const leftSide: Ring = bold ? [[X - 18, 266], [X - 17.5, 284], [X - 16.5, 302], [X - 9, 302]] : [[X - 18, 266], [X - 16.5, 284], [X - tipX - 3, 302], [X - tipX + 3, 302]];
  const outline: Ring = [...leftSide.slice().reverse(), ...half, ...half.slice().reverse().map(([x, y]): Pt => [2 * X - x, y]), ...leftSide.map(([x, y]): Pt => [2 * X - x, y])];
  // The T-shaped face: eye slits joined to the mouth slot below the nose guard.
  const ey0 = bold ? 249 : 250;
  const ey1 = bold ? 259 : 257;
  const slot = bold ? 8.8 : 4.5;
  const [eo, ei] = bold ? [13, 11.5] : [15, 13]; // eye slit ends: bold leaves metal at the temples
  const face = solid([[X - eo, ey0], [X + eo, ey0], [X + ei, ey1], [X + slot, ey1 + 3], [X + slot, 304], [X - slot, 304], [X - slot, ey1 + 3], [X - ei, ey1]]);
  const nose = rect(X - (bold ? 3 : 2), ey0 - 2, X + (bold ? 3 : 2), bold ? 279 : 276);
  d += carve(solid(outline), ringsPath(difference(flatten(face), flatten(nose))));
  return d;
};

/** Dionysus — the kantharos, the cup of the feast. */
const kantharos: SymbolFn = (detail) => {
  const bold = detail === 'bold';
  const w = bold ? 5.4 : 3.2;
  let d = rect(238, 234, 274, 240);
  d += 'M241 240L271 240C271 256 264 264 256 264C248 264 241 256 241 240Z';
  for (const s of [-1, 1]) {
    const cx = X + s * 15;
    d += circle(cx, 220, bold ? 9.4 : 8) + circle(cx, 220, (bold ? 9.4 : 8) - w, true);
    d += rect(cx - w / 2, 226, cx + w / 2, 236);
  }
  d += rect(X - (bold ? 4.5 : 3), 263, X + (bold ? 4.5 : 3), 290);
  if (!bold) d += rect(X - 6, 274, X + 6, 278);
  d += solid([[X - 10, 290], [X + 10, 290], [X + 15, 302], [X - 15, 302]]);
  return d;
};

export const SYMBOLS = {
  lyre, hearth, owl, eyes, sphere, rainbow, kerykeion, key, hourglass, clouds, trident, web, forge, wreath, helmet, kantharos,
} satisfies Record<string, SymbolFn>;
export type SymbolId = keyof typeof SYMBOLS;
