// Shared 2D primitives. Every geometry in the identity lives on a 512 × 512
// artboard centred at (256, 256); the crest's outer rim is a circle of radius 252.

export type Pt = [number, number];
export type Ring = Pt[];

export const ARTBOARD = 512;
export const C = 256;
export const RIM = 252;

export const rad = (deg: number): number => (deg * Math.PI) / 180;

export const polar = (deg: number, r: number, cx = C, cy = C): Pt => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];

/** Signed area (positive = clockwise on screen, since y points down). */
export const signedArea = (ring: Ring): number =>
  ring.reduce((s, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;

export const cw = (ring: Ring): Ring => (signedArea(ring) >= 0 ? ring : [...ring].reverse());
export const ccw = (ring: Ring): Ring => (signedArea(ring) < 0 ? ring : [...ring].reverse());

const r2 = (v: number): number => Math.round(v * 100) / 100;
export const fmt = (p: Pt): string => `${r2(p[0])} ${r2(p[1])}`;
export const num = r2;
