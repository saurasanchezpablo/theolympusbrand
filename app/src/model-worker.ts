// Builds printable models and stickers off the page's thread: a lithophane, a
// plate with back features or a marble sticker takes a second or two, and the
// page should keep up with the sliders meanwhile. Same code as the command line.

import { loadBrandFonts } from './fonts.ts';
import { markFor, modelFiles, modelName, type MarkSource, type ModelFile, type Subject } from '../../src/manufacturing/files.ts';
import { defaults, PRODUCTS, suggestedParams, type Model, type Params, type PrintSettings, type ProductId } from '../../src/manufacturing/products.ts';
import { buildSticker, cutlineSvg, layoutSheet, sheetPdf, sheetPreviewSvg, stickerPdf, stickerReadme, stickerSvg, STICKER_ARTS, STICKER_STYLES, type Paper, type Sticker, type StickerSpec } from '../../src/manufacturing/stickers.ts';
import { mockupSvg } from '../../src/render/mockups.ts';
import { baseMarks } from '../../src/catalog/fileset.ts';
import type { Patron } from '../../src/geometry/pantheon.ts';

export type BuildRequest =
  | {
      kind: 'model';
      req: number;
      subject: Subject;
      patron?: Patron;
      product: ProductId;
      /** The user's changes to the suggested values, for this product and (for the stand) the medallion's. */
      overrides: Params;
      medallion: Params;
      settings: PrintSettings;
    }
  | { kind: 'sticker'; req: number; subject: Subject; patron?: Patron; spec: StickerSpec; paper: Paper };

export type BuildResult =
  | { kind: 'model'; req: number; ok: true; suggested: Required<Params>; markMin: number | null; model: Model; files: ModelFile[]; base: string }
  | { kind: 'sticker'; req: number; ok: true; sticker: Sticker; files: ModelFile[]; base: string; perSheet: number; previews: Record<'flat' | 'laptop' | 'server' | 'sheet', string> }
  | { kind: 'model' | 'sticker'; req: number; ok: false; error: string };

const fonts = loadBrandFonts();
const marks = new Map<string, MarkSource>();

function buildModelResult(r: Extract<BuildRequest, { kind: 'model' }>): BuildResult {
  const { req, subject, patron, product, overrides, medallion, settings } = r;
  const kind = PRODUCTS[product].mark;
  let mark: MarkSource | null = null;
  if (kind) {
    const key = `${kind}|${JSON.stringify(patron ?? 'master')}|${subject.id}`;
    if (!marks.has(key)) marks.set(key, markFor(kind, patron, subject.id));
    mark = marks.get(key)!;
  }
  const suggested = suggestedParams(product, mark?.minDiameterMM);
  if (product === 'stand') {
    // The stand fits the medallion as it is set up.
    const med = { ...defaults('medallion'), ...medallion };
    suggested.diameter = med.diameter;
    suggested.slot = Math.round((med.base + med.relief) * 100) / 100;
  }
  const { model, files } = modelFiles(subject, product, { ...suggested, ...overrides }, mark, settings);
  return { kind: 'model', req, ok: true, suggested, markMin: mark?.minDiameterMM ?? null, model, files, base: modelName(subject.id, product) };
}

function buildStickerResult(r: Extract<BuildRequest, { kind: 'sticker' }>): BuildResult {
  const { req, subject, patron, spec, paper } = r;
  const m = baseMarks(patron ?? { god: 'zeus' });
  const sticker = buildSticker(
    { marks: { crestFine: m['crest-fine'].d, crestPrint: m['crest-print'].d, emblemFine: m['emblem-fine'].d, emblemPrint: m['emblem-print'].d, seal: m.seal.d }, name: subject.name ?? 'The Olympus', caption: subject.caption ?? '', url: subject.url },
    spec,
  );
  const base = `the-olympus-${subject.id}-sticker-${spec.art}-${spec.style}`;
  const label = `${subject.title} — sticker, ${STICKER_ARTS[spec.art].toLowerCase()}, ${STICKER_STYLES[spec.style].label.toLowerCase()}`;
  const sheet = layoutSheet(Array.from({ length: 80 }, () => sticker), paper);
  const perSheet = sheet.pages[0]?.length ?? 0;
  const files: ModelFile[] = [
    { path: `${base}.pdf`, data: stickerPdf(sticker, label) },
    { path: `${base}.svg`, data: stickerSvg(sticker, label) },
    { path: `${base}-cutline.svg`, data: cutlineSvg(sticker, label) },
    { path: `${base}-${paper}-sheet.pdf`, data: sheetPdf({ ...sheet, pages: sheet.pages.slice(0, 1) }, `${label} — ${paper.toUpperCase()} sheet`) },
  ];
  files.push({ path: `${base}.md`, data: stickerReadme(sticker, base, label, perSheet, paper) });
  const previews = {
    flat: stickerSvg(sticker, label, { preview: true }),
    laptop: mockupSvg('laptop', sticker),
    server: mockupSvg('server', sticker),
    sheet: sheetPreviewSvg({ ...sheet, pages: sheet.pages.slice(0, 1) }),
  };
  return { kind: 'sticker', req, ok: true, sticker, files, base, perSheet, previews };
}

self.onmessage = async (e: MessageEvent<BuildRequest>) => {
  const r = e.data;
  try {
    await fonts;
    (self as unknown as Worker).postMessage(r.kind === 'model' ? buildModelResult(r) : buildStickerResult(r));
  } catch (err) {
    (self as unknown as Worker).postMessage({ kind: r.kind, req: r.req, ok: false, error: (err as Error).message } satisfies BuildResult);
  }
};
