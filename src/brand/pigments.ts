// The house's pigments: colour only where colour carries meaning — the
// sixteen colours of a terminal, the green of something running and the red
// of something failed. Grey stays the house: the marks, the wallpapers, the
// boot screens and the site are never coloured. The pigments are the
// colours of ancient stone and metal, muted to sit beside marble.
//
// This is the only file that may hold a colour with a hue; tests/palette.test.ts
// enforces it, and says which files may use the pigments.

/** A pigment on each ground: `dark` and `light` are its normal tones, `darkBright` and `lightBright` its bright ones. Each reads at 4.5:1 or more on its ground. */
export type Pigment = { name: string; dark: string; darkBright: string; light: string; lightBright: string };

export const PIGMENTS = {
  /** Gilded bronze. */
  gold: { name: 'Gold', dark: '#C9A55E', darkBright: '#E8CB8A', light: '#86651C', lightBright: '#8C6B1F' },
  /** The red marble of Greece. */
  rossoAntico: { name: 'Rosso antico', dark: '#C46A5C', darkBright: '#E3907F', light: '#9B3C31', lightBright: '#B2483B' },
  /** The green marble of Thessaly. */
  verdeAntico: { name: 'Verde antico', dark: '#7FA98B', darkBright: '#A6CDB0', light: '#3E6E4C', lightBright: '#437353' },
  /** Lapis lazuli. */
  lapis: { name: 'Lapis', dark: '#7391C4', darkBright: '#9EB7E0', light: '#34568E', lightBright: '#3F64A0' },
  /** Imperial porphyry. */
  porphyry: { name: 'Porphyry', dark: '#AA769D', darkBright: '#CDA0C2', light: '#76416C', lightBright: '#87507C' },
  /** Aquamarine, the sea stone. */
  aquamarine: { name: 'Aquamarine', dark: '#6FA9A8', darkBright: '#9ACCCB', light: '#2E6D6C', lightBright: '#2F7170' },
} as const satisfies Record<string, Pigment>;

export type PigmentName = keyof typeof PIGMENTS;

/** The pigment of each of a terminal's six colours (red, green, yellow, blue, magenta, cyan). */
export const ANSI_PIGMENTS: readonly PigmentName[] = ['rossoAntico', 'verdeAntico', 'gold', 'lapis', 'porphyry', 'aquamarine'];

/** What a colour means wherever the house shows a state. */
export const STATUS = {
  ok: PIGMENTS.verdeAntico,
  warn: PIGMENTS.gold,
  error: PIGMENTS.rossoAntico,
  info: PIGMENTS.lapis,
} as const;
