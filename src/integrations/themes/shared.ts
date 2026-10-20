// What the theme kits share: how to embed an SVG in CSS, how to quote for the shell.

/** An SVG as a CSS url(): only the characters CSS and URLs require are escaped. */
export const cssSvg = (svg: string) =>
  `url("data:image/svg+xml,${svg.replace(/\n\s*/g, ' ').replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'")}")`;

/** A single-quoted shell word. */
export const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
