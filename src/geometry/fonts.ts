// Typography. Geometry never reads files: fonts are registered once by the
// host (Node scripts via src/node/fonts.ts, the browser app via fetch) and
// lettering is always converted to outlines, so no export depends on an
// installed font.
//
//   inscription       — Cinzel Bold (700), the screen crest and lockup names
//   inscriptionHeavy  — Cinzel Black (900), print editions
//   companion         — Jost Semibold (600), lockup captions
//   body              — Jost Regular (400), running text in the brand book
// Cinzel and Jost: SIL Open Font License 1.1.

import type { Font } from 'opentype.js';
import { fmt } from './math.ts';

export type FontRole = 'inscription' | 'inscriptionHeavy' | 'companion' | 'body';

const registry: Partial<Record<FontRole, Font>> = {};

export function registerFont(role: FontRole, f: Font): void {
  registry[role] = f;
}

export function font(role: FontRole): Font {
  const f = registry[role];
  if (!f) throw new Error(`Font "${role}" is not registered — call loadNodeFonts() (Node) or registerFont() first.`);
  return f;
}

/** Characters of `text` the role's font cannot draw (they would come out as empty boxes). */
export function missingGlyphs(text: string, role: FontRole): string[] {
  const f = font(role);
  return [...new Set([...text])].filter((ch) => ch.trim() !== '' && f.charToGlyphIndex(ch) === 0);
}

export const capRatio = (f: Font): number => ((f.tables.os2?.sCapHeight as number | undefined) ?? f.unitsPerEm * 0.7) / f.unitsPerEm;

export type LineTextOptions = { cx: number; baseline: number; size: number; tracking?: number; maxWidth?: number; role?: FontRole };

/**
 * Horizontal text as outlined glyphs, centred on cx with its baseline at y.
 * The size shrinks (never grows) so the line fits maxWidth.
 */
export function lineText(
  text: string,
  { cx, baseline, size, tracking = 0.12, maxWidth = Infinity, role = 'inscription' }: LineTextOptions,
): { d: string; width: number; size: number; capHeight: number } {
  const f = font(role);
  const glyphs = f.stringToGlyphs(text);
  const widthAt = (sz: number) => {
    const k = sz / f.unitsPerEm;
    return glyphs.reduce((w, g, i) => {
      const kern = i < glyphs.length - 1 ? f.getKerningValue(g, glyphs[i + 1]) * k + tracking * sz : 0;
      return w + (g.advanceWidth ?? 0) * k + kern;
    }, 0);
  };
  const fit = Math.min(size, size * (maxWidth / widthAt(size)));
  const k = fit / f.unitsPerEm;
  const total = widthAt(fit);
  let x = cx - total / 2;
  let d = '';
  glyphs.forEach((g, i) => {
    for (const c of g.getPath(x, baseline, fit).commands) {
      if (c.type === 'Z') d += 'Z';
      else if (c.type === 'M' || c.type === 'L') d += c.type + fmt([c.x, c.y]);
      else if (c.type === 'Q') d += `Q${fmt([c.x1, c.y1])} ${fmt([c.x, c.y])}`;
      else if (c.type === 'C') d += `C${fmt([c.x1, c.y1])} ${fmt([c.x2, c.y2])} ${fmt([c.x, c.y])}`;
    }
    const kern = i < glyphs.length - 1 ? f.getKerningValue(g, glyphs[i + 1]) * k + tracking * fit : 0;
    x += (g.advanceWidth ?? 0) * k + kern;
  });
  return { d, width: total, size: fit, capHeight: capRatio(f) * fit };
}
