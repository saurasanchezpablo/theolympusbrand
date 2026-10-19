// The Olympus — identity constants.

import type { BeadRhythm } from '../geometry/border.ts';

export const NAME = 'THE OLYMPUS';

/** The house's border rhythms. Fixed for The Olympus; never varied per service. */
export type BorderRhythms = { hooks: string; beads: BeadRhythm };

export const BORDER: BorderRhythms = {
  hooks: '01010000001110100101001100100000010000010100010101001001',
  beads: [
    [3, 1], [3, 3], [1, 3], [3, 1], [1, 1], [1, 3], [1, 3], [3, 1], [1, 7],
    [1, 1], [3, 3], [3, 1], [3, 1], [1, 3], [1, 1], [3, 3], [3, 1], [1, 7],
  ],
};
