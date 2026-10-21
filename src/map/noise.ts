// Seeded noise for the map: the island's land and where its trees grow. The
// same seed always gives the same values — nothing here is random.

/** A Park–Miller generator: numbers in (0, 1), the same sequence for the same seed. */
export function seeded(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export type Noise = {
  /** Gradient noise in about [-1, 1]. */
  noise2(x: number, y: number): number;
  /** Fractal sum of octaves. */
  fbm(x: number, y: number, octaves?: number): number;
  /** Ridged multifractal: sharp crests and valleys, like a real range. */
  ridged(x: number, y: number): number;
};

/** Gradient noise with its permutation shuffled by the seed. */
export function gradientNoise(seed: number): Noise {
  const rnd = seeded(seed);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const P = new Uint8Array(512);
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const g = (h: number, dx: number, dy: number) => {
    const q = GRAD[h & 7];
    return q[0] * dx + q[1] * dy;
  };
  const noise2 = (x: number, y: number) => {
    const X = Math.floor(x) & 255,
      Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x),
      v = fade(y);
    const a = g(P[X + P[Y]], x, y),
      b = g(P[X + 1 + P[Y]], x - 1, y),
      c = g(P[X + P[Y + 1]], x, y - 1),
      d = g(P[X + 1 + P[Y + 1]], x - 1, y - 1);
    return a + u * (b - a) + v * (c + u * (d - c) - (a + u * (b - a)));
  };
  const fbm = (x: number, y: number, octaves = 6) => {
    let t = 0,
      a = 0.5,
      f = 1;
    for (let i = 0; i < octaves; i++) {
      t += a * noise2(x * f, y * f);
      a *= 0.5;
      f *= 2.03;
    }
    return t;
  };
  const ridged = (x: number, y: number) => {
    let t = 0,
      a = 0.55,
      f = 1,
      w = 1;
    for (let i = 0; i < 7; i++) {
      let n = 1 - Math.abs(noise2(x * f, y * f));
      n *= n;
      n *= w;
      w = Math.min(1, n * 2);
      t += n * a;
      a *= 0.5;
      f *= 2.1;
    }
    return t;
  };
  return { noise2, fbm, ridged };
}
