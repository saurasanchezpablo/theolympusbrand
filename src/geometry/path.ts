// Path-data builders. Winding convention, so a whole mark can be one
// nonzero-filled path: solids run clockwise on screen, holes counter-clockwise
// and only ever sit inside a single solid.

import { C, type Pt, type Ring, cw, ccw, fmt, num, polar, rad } from './math.ts';

export const poly = (pts: Ring): string => `M${pts.map(fmt).join('L')}Z`;
export const solid = (pts: Ring): string => poly(cw(pts));
export const hole = (pts: Ring): string => poly(ccw(pts));
export const rect = (x0: number, y0: number, x1: number, y1: number): string => solid([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
export const rectHole = (x0: number, y0: number, x1: number, y1: number): string => hole([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

/** Full circle; sweep 1 = clockwise on screen. */
export function circle(cx: number, cy: number, r: number, isHole = false): string {
  const s = isHole ? 0 : 1;
  return `M${fmt([cx - r, cy])}A${num(r)} ${num(r)} 0 1 ${s} ${fmt([cx + r, cy])}A${num(r)} ${num(r)} 0 1 ${s} ${fmt([cx - r, cy])}Z`;
}

export const annulus = (rIn: number, rOut: number, cx = C, cy = C): string => circle(cx, cy, rOut) + circle(cx, cy, rIn, true);

/** Annular sector between angles a0 < a1 (degrees) and radii rIn < rOut, clockwise. */
export function sector(a0: number, a1: number, rIn: number, rOut: number): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  return (
    `M${fmt(polar(a0, rOut))}A${num(rOut)} ${num(rOut)} 0 ${large} 1 ${fmt(polar(a1, rOut))}` +
    `L${fmt(polar(a1, rIn))}A${num(rIn)} ${num(rIn)} 0 ${large} 0 ${fmt(polar(a0, rIn))}Z`
  );
}

/** A straight bar of width w from p to q. */
export function bar(p: Pt, q: Pt, w: number): string {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const nx = (-(q[1] - p[1]) / L) * (w / 2);
  const ny = ((q[0] - p[0]) / L) * (w / 2);
  return solid([[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny]]);
}

/**
 * A polyline thickened into one polygon with mitred joints. The width may
 * taper (one width per vertex); optional pointed caps at either end.
 */
export function ribbonPts(points: Ring, w: number | number[], { capStart = 0, capEnd = 0 } = {}): Ring {
  const half = (i: number) => (Array.isArray(w) ? w[i] : w) / 2;
  const n = points.length;
  const normal = (a: Pt, b: Pt): Pt => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
  };
  const left: Ring = [];
  const right: Ring = [];
  for (let i = 0; i < n; i++) {
    let nv: Pt;
    let scale = 1;
    if (i === 0) nv = normal(points[0], points[1]);
    else if (i === n - 1) nv = normal(points[n - 2], points[n - 1]);
    else {
      const n1 = normal(points[i - 1], points[i]);
      const n2 = normal(points[i], points[i + 1]);
      const L = Math.hypot(n1[0] + n2[0], n1[1] + n2[1]);
      nv = [(n1[0] + n2[0]) / L, (n1[1] + n2[1]) / L];
      scale = 1 / Math.max(0.35, nv[0] * n1[0] + nv[1] * n1[1]); // mitre, clamped
    }
    const h = half(i) * scale;
    left.push([points[i][0] + nv[0] * h, points[i][1] + nv[1] * h]);
    right.push([points[i][0] - nv[0] * h, points[i][1] - nv[1] * h]);
  }
  const tip = (a: Pt, b: Pt, len: number): Pt => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [b[0] + ((b[0] - a[0]) / L) * len, b[1] + ((b[1] - a[1]) / L) * len];
  };
  const out: Ring = [...left];
  if (capEnd) out.push(tip(points[n - 2], points[n - 1], capEnd));
  out.push(...right.reverse());
  if (capStart) out.push(tip(points[1], points[0], capStart));
  return out;
}

export const ribbon = (points: Ring, w: number | number[], opts = {}): string => solid(ribbonPts(points, w, opts));

/** Leaf (vesica) from base to tip — fuller near the base, finer towards the tip. */
export function leaf(base: Pt, tipPt: Pt, width: number, steps = 10): string {
  const L = Math.hypot(tipPt[0] - base[0], tipPt[1] - base[1]);
  const ux = (tipPt[0] - base[0]) / L;
  const uy = (tipPt[1] - base[1]) / L;
  const pts: Ring = [];
  for (const side of [1, -1]) {
    for (let i = 0; i <= steps; i++) {
      const t = side === 1 ? i / steps : 1 - i / steps;
      const prof = Math.sin(Math.PI * Math.pow(t, 0.8)) * (width / 2);
      if (!(side === -1 && (i === 0 || i === steps))) {
        pts.push([base[0] + ux * L * t - uy * prof * side, base[1] + uy * L * t + ux * prof * side]);
      }
    }
  }
  return solid(pts);
}

/** Small lozenge used as a separator, oriented along the radius at `deg`. */
export function lozenge(deg: number, R: number, s = 4.5): string {
  const u: Pt = [Math.cos(rad(deg)), Math.sin(rad(deg))];
  const t: Pt = [-u[1], u[0]];
  const c = polar(deg, R);
  return solid([
    [c[0] + u[0] * s, c[1] + u[1] * s],
    [c[0] + t[0] * s * 0.7, c[1] + t[1] * s * 0.7],
    [c[0] - u[0] * s, c[1] - u[1] * s],
    [c[0] - t[0] * s * 0.7, c[1] - t[1] * s * 0.7],
  ]);
}

/** Uniform scale + translate of absolute path data (M L C Q A Z only). */
export function transformPath(d: string, k: number, tx: number, ty: number): string {
  const X = (v: number) => num(v * k + tx);
  const Y = (v: number) => num(v * k + ty);
  return d.replace(/([MLCQAZ])([^MLCQAZ]*)/g, (_m, cmd: string, args: string) => {
    if (cmd === 'Z') return 'Z';
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    const out: (number | string)[] = [];
    if (cmd === 'A') {
      for (let i = 0; i < n.length; i += 7) out.push(num(n[i] * k), num(n[i + 1] * k), n[i + 2], n[i + 3], n[i + 4], X(n[i + 5]), Y(n[i + 6]));
    } else {
      for (let i = 0; i < n.length; i += 2) out.push(X(n[i]), Y(n[i + 1]));
    }
    return cmd + out.join(' ');
  });
}

/** Scale path data about a centre point. */
export const scaleAbout = (d: string, k: number, cx = C, cy = C): string => transformPath(d, k, cx * (1 - k), cy * (1 - k));
