// The files of a printable model — shared by the command line and the web app.
// The preview is returned as pixels; each host encodes it (Node: PNG writer,
// browser: canvas).

import { crest, seal } from '../geometry/crest.ts';
import type { Patron } from '../geometry/pantheon.ts';
import { productionSvg } from '../render/svg.ts';
import { renderMeshes } from '../render/mesh-render.ts';
import { geometryOf, minFeature, minDiameterMM } from '../print/printcheck.ts';
import { ringsPath } from '../geometry/poly.ts';
import { checkPrint, PRINTER_MM, SHARED_PRINT_MIN_UNITS } from '../print/service.ts';
import { stl } from '../export/stl.ts';
import { threeMf } from '../export/threemf.ts';
import { buildModel, modelVolume, PRODUCTS, type Model, type Params, type ProductId } from './products.ts';
import { scadSource } from './scad.ts';

/** PLA, for filament estimates (g/cm³). */
const PLA_DENSITY = 1.24;

export type MarkSource = { d: string; minDiameterMM: number; svg: string; file: string };

/**
 * The print-edition mark a product carries, with the size it prints from.
 * `id` names the files ("master" or a service id).
 */
export function markFor(kind: 'crest' | 'seal', patron: Patron | undefined, id: string): MarkSource {
  const master = !patron || ('god' in patron && patron.god === 'zeus');
  if (kind === 'crest') {
    const d = ringsPath(geometryOf(crest({ detail: 'print', patron }).d));
    const min = master ? Math.ceil(minDiameterMM(SHARED_PRINT_MIN_UNITS, PRINTER_MM)) : checkPrint(patron!).minDiameterMM;
    return { d, minDiameterMM: min, svg: productionSvg({ id: 'crest-print', d }, { title: `The Olympus — ${id} — crest, print edition` }), file: `the-olympus-${id}-crest-print.svg` };
  }
  const d = ringsPath(geometryOf(seal({ patron }).d));
  const { w } = minFeature(geometryOf(d));
  return { d, minDiameterMM: Math.ceil(minDiameterMM(w, PRINTER_MM)), svg: productionSvg({ id: 'seal', d }, { title: `The Olympus — ${id} — seal` }), file: `the-olympus-${id}-seal.svg` };
}

export type ModelFile = { path: string; data: Uint8Array | string };

export const modelName = (id: string, product: ProductId) => `the-olympus-${id}-${product}`;

/** Build a product for a mark and return the model with its files (preview as pixels). */
export function modelFiles(
  id: string,
  title: string,
  product: ProductId,
  params: Params,
  mark: MarkSource | null,
  preview: { width: number; height: number } | null = { width: 1200, height: 900 },
): { model: Model; files: ModelFile[]; preview: ModelPreview | null } {
  const model = buildModel(product, params, mark ?? undefined);
  const base = modelName(id, product);
  const files: ModelFile[] = [];
  if (model.parts.length === 1) files.push({ path: `${base}.stl`, data: stl(model.parts[0].mesh, `${title} ${PRODUCTS[product].name}`) });
  else for (const pt of model.parts) files.push({ path: `${base}-${pt.name}.stl`, data: stl(pt.mesh, `${title} ${PRODUCTS[product].name} ${pt.name}`) });
  files.push({ path: `${base}.3mf`, data: threeMf(`${title} — ${PRODUCTS[product].name}`, model.parts) });
  files.push({ path: `${base}.scad`, data: scadSource(product, model.params, `${title} — ${PRODUCTS[product].name}`, mark?.file ?? null) });
  if (mark) files.push({ path: mark.file, data: mark.svg });
  files.push({ path: `${base}.md`, data: modelReadme(title, model, base, mark) });
  return { model, files, preview: preview ? previewOf(model, base, preview) : null };
}

export type ModelPreview = { path: string; rgba: Uint8ClampedArray; width: number; height: number };

/** The preview image of a model, rendered from its mesh. */
export const previewOf = (model: Model, base: string, size: { width: number; height: number }): ModelPreview => ({
  path: `${base}-preview.png`,
  rgba: renderMeshes(model.parts, { azimuth: -24, elevation: 52, ...size }),
  ...size,
});

const fmt = (v: number, unit = 'mm') => `${Number.isInteger(v) ? v : v.toFixed(2).replace(/0+$/, '')} ${unit}`.trim();

/** The model's sheet: dimensions, parameters, validation and how to print it. */
export function modelReadme(title: string, model: Model, base: string, mark: MarkSource | null): string {
  const spec = PRODUCTS[model.product];
  const cm3 = modelVolume(model);
  const rows = spec.params.map((p) => `| ${p.label} | ${fmt(model.params[p.key], p.unit)} | ${p.hint} |`);
  const files = model.parts.length === 1 ? [`\`${base}.stl\` — the solid, ready to slice`] : model.parts.map((pt) => `\`${base}-${pt.name}.stl\` — the ${pt.name}`);
  return `# ${title} — ${spec.name}

${spec.summary}

![Preview](${base}-preview.png)

*Preview rendered from the mesh itself.*

| | |
|---|---|
| Size | ${model.size[0]} × ${model.size[1]} × ${model.size[2]} mm |
| Volume | ${cm3.toFixed(1)} cm³ — at most ${Math.ceil(cm3 * PLA_DENSITY)} g of PLA solid; much less at 15–20 % infill |
${mark ? `| Mark prints from | Ø ${mark.minDiameterMM} mm on a 0.4 mm nozzle |\n` : ''}
## Parameters

| Parameter | Value | |
|---|---|---|
${rows.join('\n')}

## Files

- ${files.join('\n- ')}
- \`${base}.3mf\` — ${model.parts.length > 1 ? 'both parts as one object, each ready for its own filament' : 'the same solid, in 3MF'}
- \`${base}.scad\` — parametric source for OpenSCAD${mark ? `, reading \`${mark.file}\`` : ''}

## Validation

${model.parts.map((pt) => `- **${pt.name}**: ${pt.report.ok ? 'valid' : 'INVALID'} — ${pt.report.triangles.toLocaleString('en')} triangles, closed and manifold (${pt.report.badEdges} open or doubled edges), ${pt.report.degenerate} degenerate triangles, no self-intersection (${pt.report.overlaps} overlapping layers), volume ${(pt.report.volume / 1000).toFixed(2)} cm³ as designed.`).join('\n')}

## Printing

- ${model.notes.join('\n- ')}
${model.warnings.length ? `\n## Warnings\n\n- ${model.warnings.join('\n- ')}\n` : ''}`;
}
