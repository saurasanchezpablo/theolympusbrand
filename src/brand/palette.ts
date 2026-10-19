// The Olympus — grayscale palette. Every value is a neutral grey (R = G = B);
// tests/palette.test.ts enforces it.

export const PALETTE = {
  obsidian: '#0E0E0E', // deepest ground; black marble base
  charcoal: '#1C1C1C', // primary ink on light grounds
  graphite: '#3A3A3A', // secondary ink, dark UI surfaces
  slate: '#5E5E5E', // captions, tertiary text
  silver: '#9A9A9A', // marble veining, disabled
  ash: '#C9C9C9', // hairlines on light grounds
  marble: '#EDEDED', // primary ink on dark grounds; white marble base
  paper: '#FAFAFA', // lightest ground
} as const;

export type Tone = keyof typeof PALETTE;

/** Recommended ink for each ground. */
export const PAIRINGS = {
  light: { ground: PALETTE.paper, ink: PALETTE.charcoal },
  dark: { ground: PALETTE.obsidian, ink: PALETTE.marble },
} as const;
