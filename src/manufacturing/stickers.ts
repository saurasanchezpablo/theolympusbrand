// Die-cut stickers: the artwork, a cut path that follows its silhouette, bleed
// beyond the cut, and for clear vinyl a white underbase — each on its own
// layer, as print providers expect. Pure: the command line and the web app
// make the same files.
//
// Bleed, cut tolerance and the finest printable line differ between
// providers; the defaults here are common ones and should be confirmed.

import { RIM, C, type Ring, signedArea } from '../geometry/math.ts';
import { union, offset, difference } from '../geometry/poly.ts';
import { lineText } from '../geometry/fonts.ts';
import { qr, qrPath } from '../geometry/qr.ts';
import { DOMAIN } from '../brand/identity.ts';
import { lockupParts } from '../geometry/lockup.ts';
import { isClean, problemsAt } from '../print/printcheck.ts';
import { SHARED_PRINT_MIN_UNITS } from '../print/service.ts';
import { PALETTE } from '../brand/palette.ts';
import { pathRings, roundedRect } from './products.ts';
import { marble } from './lithophane.ts';
import { pdf, type PdfItem } from '../export/pdf.ts';
import { png, base64 } from '../export/png.ts';

export type StickerArt = 'crest' | 'emblem' | 'seal' | 'lockup-horizontal' | 'lockup-vertical' | 'qr-label';
export type StickerStyle = 'white' | 'dark' | 'clear-dark' | 'clear-light' | 'marble-light' | 'marble-dark';
export type StickerShape = 'contour' | 'rounded';

export type StickerSpec = {
  art: StickerArt;
  style: StickerStyle;
  /** Longest side of the cut shape (mm). */
  size: number;
  /** Margin between the artwork and the cut (mm). */
  border: number;
  /** Ground printed beyond the cut (mm). */
  bleed: number;
  shape: StickerShape;
  /** The finest line the provider prints reliably (mm). */
  finest: number;
};

export const STICKER_DEFAULTS: StickerSpec = { art: 'crest', style: 'white', size: 75, border: 3, bleed: 2, shape: 'contour', finest: 0.15 };

export const STICKER_ARTS: Record<StickerArt, string> = {
  crest: 'Crest',
  emblem: 'Emblem',
  seal: 'Seal',
  'lockup-horizontal': 'Name, horizontal',
  'lockup-vertical': 'Name, vertical',
  'qr-label': 'Label with QR code',
};

type Ground = 'none' | 'obsidian' | 'marble-light' | 'marble-dark';
export const STICKER_STYLES: Record<StickerStyle, { label: string; substrate: string; ground: Ground; ink: string; underbase: boolean; hint: string }> = {
  white: { label: 'White vinyl', substrate: 'white vinyl', ground: 'none', ink: PALETTE.charcoal, underbase: false, hint: 'Charcoal on white vinyl: the classic, crisp on any surface.' },
  dark: { label: 'Dark', substrate: 'white vinyl', ground: 'obsidian', ink: PALETTE.marble, underbase: false, hint: 'A black ground printed to the edge, the design in white: premium on silver and light cases.' },
  'clear-dark': { label: 'Clear · dark ink', substrate: 'clear vinyl', ground: 'none', ink: PALETTE.charcoal, underbase: true, hint: 'Only the design, on clear vinyl, backed with white ink so it stays opaque — for light surfaces.' },
  'clear-light': { label: 'Clear · light ink', substrate: 'clear vinyl', ground: 'none', ink: PALETTE.marble, underbase: true, hint: 'Only the design, light, on clear vinyl with a white underbase — for black laptops and racks.' },
  'marble-light': { label: 'White marble', substrate: 'white vinyl', ground: 'marble-light', ink: PALETTE.charcoal, underbase: false, hint: 'A printed white-marble ground with gray veining — a decorative edition.' },
  'marble-dark': { label: 'Black marble', substrate: 'white vinyl', ground: 'marble-dark', ink: PALETTE.marble, underbase: false, hint: 'A printed black-marble ground with silver veining — a decorative edition.' },
};

/** Smallest features of the editions (artboard units on the 504-unit rim), measured once. */
const MIN_UNITS = { crestFine: 0.38, emblemFine: 0.88, print: SHARED_PRINT_MIN_UNITS, seal: 4.5 } as const;

export type StickerMarks = { crestFine: string; crestPrint: string; emblemFine: string; emblemPrint: string; seal: string };
export type StickerInput = { marks: StickerMarks; name: string; caption: string; url?: string };

export type Sticker = {
  spec: StickerSpec;
  /** All in millimetres, y up, the bleed's lower-left corner at the origin. */
  width: number;
  height: number;
  art: Ring[];
  cut: Ring;
  bleed: Ring;
  underbase: Ring[];
  edition: 'fine' | 'print';
  warnings: string[];
  notes: string[];
};

const DOMAIN_URL = `https://${DOMAIN}`;

/** Arc tolerance for offsets in millimetres. */
const ARC = 0.02;

const gray = (hex: string) => parseInt(hex.slice(1, 3), 16) / 255;
const outerRings = (rings: Ring[]) => rings.filter((r) => signedArea(r) > 0);
const largest = (rings: Ring[]) => rings.reduce((a, b) => (Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a));
const bbox = (rings: Ring[]) => {
  const pts = rings.flat();
  return { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) };
};
const shift = (rings: Ring[], dx: number, dy: number): Ring[] => rings.map((r) => r.map(([x, y]): [number, number] => [x + dx, y + dy]));

export function buildSticker(input: StickerInput, spec: StickerSpec): Sticker {
  const warnings: string[] = [];
  const notes: string[] = [];
  const s = { ...spec, size: Math.max(15, Math.min(400, spec.size)), border: Math.max(0, Math.min(15, spec.border)), bleed: Math.max(0, Math.min(6, spec.bleed)), finest: Math.max(0.05, Math.min(0.5, spec.finest)) };
  const inner = s.size - 2 * s.border;
  const fits = (units: number, artMM: number) => (s.finest * 2 * RIM) / units <= artMM;
  const m = input.marks;
  let edition: 'fine' | 'print' = 'print';
  let art: Ring[];

  if (s.art === 'crest' || s.art === 'emblem' || s.art === 'seal') {
    const k = inner / (2 * RIM);
    let d: string;
    if (s.art === 'seal') d = m.seal;
    else {
      const fineUnits = s.art === 'crest' ? MIN_UNITS.crestFine : MIN_UNITS.emblemFine;
      edition = fits(fineUnits, inner) ? 'fine' : 'print';
      d = s.art === 'crest' ? (edition === 'fine' ? m.crestFine : m.crestPrint) : edition === 'fine' ? m.emblemFine : m.emblemPrint;
    }
    const units = s.art === 'seal' ? MIN_UNITS.seal : edition === 'fine' ? (s.art === 'crest' ? MIN_UNITS.crestFine : MIN_UNITS.emblemFine) : MIN_UNITS.print;
    if (!fits(units, inner)) warnings.push(`At ${Math.round(s.size)} mm the finest lines fall below ${s.finest} mm — ${Math.ceil((s.finest * 2 * RIM) / units + 2 * s.border)} mm or more prints cleanly${s.art === 'crest' ? ', or use the seal for small stickers' : ''}.`);
    art = pathRings(d, k, C, C);
  } else if (s.art === 'qr-label') {
    // Seal · name and address · QR code, on a label. The code always reads dark
    // on light: with a light ink it is a light panel with the modules cut out.
    const url = input.url ?? DOMAIN_URL;
    if (!input.url) warnings.push(`No address is set for this service; the code points to ${DOMAIN_URL}.`);
    const code = qr(url, 'Q');
    const quiet = 2;
    const n = code.size + 2 * quiet;
    const H = 100; // label units: the seal and the code are H tall
    const name = lineText(input.name.toUpperCase(), { cx: 0, baseline: 0, size: 100, tracking: 0.08, role: 'inscription' });
    const nameK = 20 / name.capHeight;
    const shown = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const addr = lineText(shown, { cx: 0, baseline: 0, size: 100, tracking: 0.04, role: 'companion' });
    const addrK = 8.5 / addr.capHeight;
    const textW = Math.max(name.width * nameK, addr.width * addrK);
    const x1 = H + 16;
    const x2 = x1 + textW + 16;
    const total = x2 + H;
    const k = inner / total;
    const at = (d: string, ox: number, oy: number, kk: number) => pathRings(d, k * kk, ox, oy, { tx: 0, ty: 0 });
    const shiftX = (rings: Ring[], dx: number, dy = 0) => shift(rings, dx * k, dy * k);
    const sealRings = shiftX(at(m.seal, C, C, H / (2 * RIM)), -total / 2 + H / 2);
    // Each line's left edge at the text column (its path is centred on x = 0).
    const nameRings = shiftX(at(name.d, -name.width / 2, 0, nameK), -total / 2 + x1, 4);
    const addrRings = shiftX(at(addr.d, -addr.width / 2, 0, addrK), -total / 2 + x1, -24);
    const module = H / n;
    const modules = shiftX(at(qrPath(code, 0, 0, 1, quiet), n / 2, n / 2, module), total / 2 - H / 2);
    const light = gray(STICKER_STYLES[s.style].ink) > 0.5;
    const panel = shiftX([roundedRect(H * k, H * k, 0)], total / 2 - H / 2);
    const code2 = light ? difference(panel, modules) : modules;
    const moduleMM = module * k;
    if (moduleMM < 0.5) warnings.push(`The code’s modules are ${moduleMM.toFixed(2)} mm — under 0.5 mm phones may struggle; make the label larger.`);
    notes.push(`The QR code (version ${code.version}, error correction Q) opens ${url}; modules ${moduleMM.toFixed(2)} mm.`);
    art = [...sealRings, ...nameRings, ...addrRings, ...code2];
    s.shape = 'rounded';
  } else {
    const layout = s.art === 'lockup-horizontal' ? 'horizontal' : 'vertical';
    const parts = lockupParts({ id: 'sticker', d: m.crestPrint }, { name: input.name, caption: input.caption, layout });
    const k = inner / Math.max(parts.width, parts.height);
    const at = { tx: 0, ty: 0 };
    const text = [...pathRings(parts.name, k, parts.width / 2, parts.height / 2, at), ...pathRings(parts.caption, k, parts.width / 2, parts.height / 2, at)];
    if (!isClean(problemsAt(union(text), s.finest, { topology: true }))) warnings.push(`At this size some lettering falls below ${s.finest} mm; make the sticker larger.`);
    if (!fits(MIN_UNITS.print, 2 * RIM * k)) warnings.push(`At this size the crest’s finest lines fall below ${s.finest} mm; make the sticker larger.`);
    art = [...pathRings(parts.crest, k, parts.width / 2, parts.height / 2, at), ...text];
  }

  // Scale to the ink itself (a lockup's nominal width includes the letters' side spacing).
  {
    const b = bbox(art);
    const f = inner / Math.max(b.x1 - b.x0, b.y1 - b.y0);
    const [cx, cy] = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
    art = art.map((r) => r.map(([x, y]): [number, number] => [(x - cx) * f, (y - cy) * f]));
  }

  // The cut: the silhouette grown by the border, its gaps closed so the blade
  // follows one smooth line (inside corners no tighter than the closing radius).
  let cut: Ring;
  if (s.shape === 'rounded') {
    const b = bbox(art);
    cut = roundedRect(b.x1 - b.x0 + 2 * s.border, b.y1 - b.y0 + 2 * s.border, Math.min(6, s.border * 2 + 1), (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
  } else {
    // Arcs to 0.02 mm: a coarser polygon would cut into the border at the corners.
    const grown = offset(union(art), Math.max(s.border, 0.5), ARC);
    let r = Math.max(1.5, s.border);
    let shape = outerRings(offset(offset(grown, r, ARC), -r, ARC));
    while (shape.length > 1 && r < 60) {
      r *= 1.6;
      shape = outerRings(offset(offset(grown, r, ARC), -r, ARC));
    }
    if (shape.length > 1) warnings.push('The design breaks into separate pieces; only the largest outline is cut.');
    cut = largest(shape);
  }
  const bleedRing = largest(outerRings(offset([cut], Math.max(s.bleed, 0.01), ARC)));
  const style = STICKER_STYLES[s.style];
  const underbase = style.underbase ? offset(union(art), -0.1, ARC) : [];

  // Lower-left of the bleed at the origin.
  const b = bbox([bleedRing]);
  const [dx, dy] = [-b.x0, -b.y0];
  const cb = bbox([cut]);
  notes.push(
    `Cut: ${Math.round((cb.x1 - cb.x0) * 10) / 10} × ${Math.round((cb.y1 - cb.y0) * 10) / 10} mm, on its own layer as the spot colour “CutContour” (0.25 pt). Some providers want it in 100 % magenta: recolour that one layer.`,
    style.ground === 'none' ? `Substrate: ${style.substrate}. Nothing is printed outside the design${style.underbase ? '' : ''}.` : `Substrate: ${style.substrate}. The ground runs ${s.bleed} mm past the cut (bleed) so no white edge shows.`,
    `The design keeps at least ${s.border} mm inside the cut. Edition: ${s.art === 'seal' ? 'the seal' : edition} — chosen for lines of ${s.finest} mm or more.`,
  );
  if (style.underbase) notes.push('White underbase: the spot colour “White”, choked 0.1 mm inside the ink so no white halo shows if the plates shift.');
  notes.push('Confirm bleed, cut tolerance and the finest printable line with your print provider.');
  return { spec: s, width: b.x1 - b.x0, height: b.y1 - b.y0, art: shift(art, dx, dy), cut: shift([cut], dx, dy)[0], bleed: shift([bleedRing], dx, dy)[0], underbase: shift(underbase, dx, dy), edition, warnings, notes };
}

/* ---------------------------------------------------------------- */
/* Marble grounds                                                     */
/* ---------------------------------------------------------------- */

/** A marble ground at 300 dpi over w × h mm (rows top to bottom), as 8-bit gray. */
export function marbleGround(kind: 'marble-light' | 'marble-dark', w: number, h: number, dpi = 300): { gray: Uint8Array; px: [number, number] } {
  const pw = Math.max(1, Math.round((w / 25.4) * dpi));
  const ph = Math.max(1, Math.round((h / 25.4) * dpi));
  const out = new Uint8Array(pw * ph);
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const v = marble(((x + 0.5) / pw) * w, h - ((y + 0.5) / ph) * h, kind === 'marble-light' ? 11 : 23);
      out[y * pw + x] = kind === 'marble-light' ? Math.round(244 - 118 * v) : Math.round(20 + 138 * v);
    }
  }
  return { gray: out, px: [pw, ph] };
}

/* ---------------------------------------------------------------- */
/* Files                                                              */
/* ---------------------------------------------------------------- */

const svgPath = (rings: Ring[], h: number) => rings.map((r) => `M${r.map(([x, y]) => `${x.toFixed(3)} ${(h - y).toFixed(3)}`).join('L')}Z`).join('');

/**
 * The production SVG: layers Bleed (ground), Artwork, White (underbase) and
 * CutContour, in millimetres. `preview` shows the cut as a dashed line on the
 * substrate instead (for screens; not for print).
 */
export function stickerSvg(st: Sticker, title: string, { preview = false, bare = false }: { preview?: boolean; bare?: boolean } = {}): string {
  const style = STICKER_STYLES[st.spec.style];
  const W = st.width.toFixed(3);
  const H = st.height.toFixed(3);
  const layer = (id: string, body: string, hidden = false) =>
    `  <g id="${id}" inkscape:groupmode="layer" inkscape:label="${id}"${hidden ? ' style="display:none"' : ''}>\n    ${body}\n  </g>\n`;
  let ground = '';
  if (style.ground === 'obsidian') ground = `<path d="${svgPath([st.bleed], st.height)}" fill="${PALETTE.obsidian}"/>`;
  else if (style.ground !== 'none') {
    const g = marbleGround(style.ground, st.width, st.height, preview ? 150 : 300);
    ground = `<clipPath id="bleed-clip"><path d="${svgPath([st.bleed], st.height)}"/></clipPath><image clip-path="url(#bleed-clip)" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" href="data:image/png;base64,${base64(png(g.gray, g.px[0], g.px[1], 1))}"/>`;
  }
  let out = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">\n  <title>${title}</title>\n`;
  if (preview) {
    // The substrate: white vinyl; clear vinyl on the surface it is meant for (dark for light ink, light for dark ink).
    // `bare`: no surface and no cut line — the sticker as applied, for mockups.
    const clear = style.substrate === 'clear vinyl';
    const surface = st.spec.style === 'clear-light' ? PALETTE.graphite : '#D6D6D6';
    if (clear) out += `${bare ? '' : `  <rect width="${W}" height="${H}" fill="${surface}"/>\n`}  <path d="${svgPath([st.cut], st.height)}" fill="#FFFFFF" fill-opacity="${bare ? 0.06 : 0.08}"/>\n`;
    else out += `  <path d="${svgPath([st.cut], st.height)}" fill="#FFFFFF"/>\n`;
    if (ground) out += `  <g clip-path="url(#cut-clip)"><clipPath id="cut-clip"><path d="${svgPath([st.cut], st.height)}"/></clipPath>${ground}</g>\n`;
    out += `  <path d="${svgPath(st.art, st.height)}" fill="${style.ink}"/>\n`;
    out += bare
      ? `  <path d="${svgPath([st.cut], st.height)}" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="0.25"/>\n`
      : `  <path d="${svgPath([st.cut], st.height)}" fill="none" stroke="${PALETTE.slate}" stroke-width="0.3" stroke-dasharray="1.2 0.8"/>\n`;
    return out + '</svg>\n';
  }
  if (ground) out += layer('Bleed', ground);
  out += layer('Artwork', `<path d="${svgPath(st.art, st.height)}" fill="${style.ink}"/>`);
  if (st.underbase.length) out += layer('White', `<path d="${svgPath(st.underbase, st.height)}" fill="#FFFFFF"/>`, true);
  out += layer('CutContour', `<path d="${svgPath([st.cut], st.height)}" fill="none" stroke="#000000" stroke-width="0.088"/>`);
  return out + '</svg>\n';
}

/** Only the cut path — some providers ask for it as a separate file. */
export function cutlineSvg(st: Sticker, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${st.width.toFixed(3)} ${st.height.toFixed(3)}" width="${st.width.toFixed(3)}mm" height="${st.height.toFixed(3)}mm">\n  <title>${title} — cut path</title>\n  <path id="CutContour" d="${svgPath([st.cut], st.height)}" fill="none" stroke="#000000" stroke-width="0.088"/>\n</svg>\n`;
}

/** The sticker's PDF items, placed at (x, y) mm. */
function stickerItems(st: Sticker, x: number, y: number): PdfItem[] {
  const style = STICKER_STYLES[st.spec.style];
  const move = (rings: Ring[]) => shift(rings, x, y);
  const items: PdfItem[] = [];
  if (style.ground === 'obsidian') items.push({ kind: 'fill', layer: 'Bleed', rings: move([st.bleed]), paint: { gray: gray(PALETTE.obsidian) } });
  else if (style.ground !== 'none') {
    const g = marbleGround(style.ground, st.width, st.height);
    items.push({ kind: 'image', layer: 'Bleed', gray: g.gray, px: g.px, at: [x, y, st.width, st.height], clip: move([st.bleed]) });
  }
  if (st.underbase.length) items.push({ kind: 'fill', layer: 'White', rings: move(st.underbase), paint: { spot: 'White' } });
  items.push({ kind: 'fill', layer: 'Artwork', rings: move(st.art), paint: { gray: gray(style.ink) } });
  items.push({ kind: 'stroke', layer: 'CutContour', rings: move([st.cut]), paint: { spot: 'CutContour' }, width: 0.25 });
  return items;
}

export function stickerPdf(st: Sticker, title: string): Uint8Array {
  return pdf(title, [{ width: st.width, height: st.height, items: stickerItems(st, 0, 0) }]);
}

/* ---------------------------------------------------------------- */
/* Sheets                                                             */
/* ---------------------------------------------------------------- */

export const PAPERS = { a4: [210, 297], a5: [148, 210], a3: [297, 420], letter: [215.9, 279.4] } as const;
export type Paper = keyof typeof PAPERS;

export type SheetLayout = { paper: Paper; pages: { sticker: Sticker; x: number; y: number }[][]; overflow: number };

/**
 * Lay stickers out on sheets in rows (tallest first), with a margin and a
 * gutter between bleeds. Stickers too big for the paper are counted in
 * `overflow` and left out.
 */
export function layoutSheet(stickers: Sticker[], paper: Paper, { margin = 10, gutter = 3 } = {}): SheetLayout {
  const [W, H] = PAPERS[paper];
  const order = stickers.map((s, i) => ({ s, i })).sort((a, b) => b.s.height - a.s.height || a.i - b.i);
  const pages: SheetLayout['pages'] = [];
  let page: SheetLayout['pages'][number] = [];
  let x = margin;
  let yTop = H - margin;
  let rowH = 0;
  let overflow = 0;
  for (const { s } of order) {
    if (s.width > W - 2 * margin || s.height > H - 2 * margin) {
      overflow++;
      continue;
    }
    if (x + s.width > W - margin) {
      x = margin;
      yTop -= rowH + gutter;
      rowH = 0;
    }
    if (yTop - s.height < margin) {
      pages.push(page);
      page = [];
      x = margin;
      yTop = H - margin;
      rowH = 0;
    }
    page.push({ sticker: s, x, y: yTop - s.height });
    x += s.width + gutter;
    rowH = Math.max(rowH, s.height);
  }
  if (page.length) pages.push(page);
  return { paper, pages, overflow };
}

export function sheetPdf(layout: SheetLayout, title: string): Uint8Array {
  const [W, H] = PAPERS[layout.paper];
  return pdf(
    title,
    layout.pages.map((pg) => ({ width: W, height: H, items: pg.flatMap(({ sticker, x, y }) => stickerItems(sticker, x, y)) })),
  );
}

/** A preview of one sheet page (SVG, screen only: cut lines dashed). */
export function sheetPreviewSvg(layout: SheetLayout, page = 0): string {
  const [W, H] = PAPERS[layout.paper];
  // A sheet often repeats one sticker: draw each distinct one once.
  const drawn = new Map<Sticker, string>();
  const preview = (st: Sticker) => drawn.get(st) ?? drawn.set(st, stickerSvg(st, '', { preview: true })).get(st)!;
  const body = (layout.pages[page] ?? [])
    .map(({ sticker, x, y }) => preview(sticker).replace(/<svg [^>]*>/, `<svg x="${x.toFixed(3)}" y="${(H - y - sticker.height).toFixed(3)}" width="${sticker.width.toFixed(3)}" height="${sticker.height.toFixed(3)}" viewBox="0 0 ${sticker.width.toFixed(3)} ${sticker.height.toFixed(3)}">`).replace(/<title>[^<]*<\/title>/, ''))
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">\n  <rect width="${W}" height="${H}" fill="#FFFFFF"/>\n${body}\n</svg>\n`;
}

/** The sticker's sheet: sizes, substrate, files and notes. */
export function stickerReadme(st: Sticker, base: string, label: string, perSheet: number, paper: Paper): string {
  const style = STICKER_STYLES[st.spec.style];
  return `# ${label}

![Preview](${base}-preview.png)

| | |
|---|---|
| Cut size | ${st.spec.size} mm (longest side) |
| File size | ${st.width.toFixed(1)} × ${st.height.toFixed(1)} mm, bleed included |
| Substrate | ${style.substrate} |
| On a ${paper.toUpperCase()} sheet | ${perSheet} |

${style.hint}

## Files

- \`${base}.pdf\`, \`${base}.svg\` — production file, layers Bleed / Artwork / White / CutContour
- \`${base}-cutline.svg\` — the cut path alone
- \`${base}-${paper}-sheet.pdf\` — ${perSheet} on a ${paper.toUpperCase()} sheet

## Notes

- ${st.notes.join('\n- ')}
${st.warnings.length ? `\n## Warnings\n\n- ${st.warnings.join('\n- ')}\n` : ''}`;
}
