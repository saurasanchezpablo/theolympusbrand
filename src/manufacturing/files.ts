// The files of a printable model — shared by the command line and the web app.
// Images are returned as pixels; each host encodes them (Node: PNG writer,
// browser: canvas).

import { crest, crestParts, seal, CREST_PARTS, type CrestPart } from '../geometry/crest.ts';
import type { Patron } from '../geometry/pantheon.ts';
import type { Ring } from '../geometry/math.ts';
import { productionSvg } from '../render/svg.ts';
import { renderMeshes } from '../render/mesh-render.ts';
import { geometryOf, minFeature, minDiameterMM } from '../print/printcheck.ts';
import { ringsPath } from '../geometry/poly.ts';
import { checkPrint, PRINTER_MM, SHARED_PRINT_MIN_UNITS } from '../print/service.ts';
import { stl } from '../export/stl.ts';
import { threeMf } from '../export/threemf.ts';
import { buildModel, estimate, modelVolume, DEFAULT_SETTINGS, PRODUCTS, type Model, type Params, type PrintSettings, type ProductId } from './products.ts';
import { backlit, heightmap } from './lithophane.ts';
import { scadSource } from './scad.ts';
import { mdText, xmlText } from '../catalog/text.ts';

/** A print-edition mark; a crest also comes in its parts, for the layered medallion. */
export type MarkSource = { d: string; minDiameterMM: number; svg: string; file: string; parts?: Record<CrestPart, string> };

/**
 * The print-edition mark a product carries, with the size it prints from.
 * `id` names the files ("master" or a service id).
 */
export function markFor(kind: 'crest' | 'seal', patron: Patron | undefined, id: string): MarkSource {
  const master = !patron || ('god' in patron && patron.god === 'zeus');
  if (kind === 'crest') {
    const d = ringsPath(geometryOf(crest({ detail: 'print', patron }).d));
    const min = master ? Math.ceil(minDiameterMM(SHARED_PRINT_MIN_UNITS, PRINTER_MM)) : checkPrint(patron!).minDiameterMM;
    const raw = crestParts({ detail: 'print', patron });
    const parts = Object.fromEntries(CREST_PARTS.map((k) => [k, ringsPath(geometryOf(raw[k]))])) as Record<CrestPart, string>;
    return { d, minDiameterMM: min, svg: productionSvg({ id: 'crest-print', d }, { title: `The Olympus — ${id} — crest, print edition` }), file: `the-olympus-${id}-crest-print.svg`, parts };
  }
  const d = ringsPath(geometryOf(seal({ patron }).d));
  const { w } = minFeature(geometryOf(d));
  return { d, minDiameterMM: Math.ceil(minDiameterMM(w, PRINTER_MM)), svg: productionSvg({ id: 'seal', d }, { title: `The Olympus — ${id} — seal` }), file: `the-olympus-${id}-seal.svg` };
}

/** Who the model is for: file names, titles, and the words on nameplates and inscriptions. */
export type Subject = { id: string; title: string; name?: string; caption?: string; url?: string };

export type ModelFile = { path: string; data: Uint8Array | string };
export type ModelImage = { path: string; rgba: Uint8ClampedArray; width: number; height: number; caption: string };

export const modelName = (id: string, product: ProductId) => `the-olympus-${id}-${product}`;

/** Millimetre rings as an SVG in millimetres (y down again), for OpenSCAD's import(). */
function ringsSvg(rings: Ring[], title: string): string {
  const pts = rings.flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => -p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const d = rings.map((r) => `M${r.map(([x, y]) => `${x.toFixed(3)} ${(-y).toFixed(3)}`).join('L')}Z`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0.toFixed(3)} ${y0.toFixed(3)} ${(x1 - x0).toFixed(3)} ${(y1 - y0).toFixed(3)}" width="${(x1 - x0).toFixed(3)}mm" height="${(y1 - y0).toFixed(3)}mm">
  <title>${xmlText(title)}</title>
  <path d="${d}" fill="#1C1C1C" fill-rule="nonzero"/>
</svg>
`;
}

/**
 * Build a product and its files. Images (the preview, and for a lithophane its
 * backlit view and heightmap) are made on request — rendering takes a moment.
 */
export function modelFiles(
  subject: Subject,
  product: ProductId,
  params: Params,
  mark: MarkSource | null,
  settings: PrintSettings = DEFAULT_SETTINGS,
): { model: Model; files: ModelFile[]; images: (preview?: { width: number; height: number }) => ModelImage[] } {
  const model = buildModel(product, params, { mark: mark ?? undefined, name: subject.name, caption: subject.caption, url: subject.url }, settings);
  const base = modelName(subject.id, product);
  const label = `${subject.title} — ${PRODUCTS[product].name}`;
  const files: ModelFile[] = [];
  if (model.parts.length === 1) files.push({ path: `${base}.stl`, data: stl(model.parts[0].mesh, label) });
  else for (const pt of model.parts) files.push({ path: `${base}-${pt.name}.stl`, data: stl(pt.mesh, `${label} ${pt.name}`) });
  files.push({ path: `${base}.3mf`, data: threeMf(label, model.parts) });

  const sources: { mark?: string; art?: string; heightmap?: { file: string; pixels: number }; tiers?: { file: string; cx: number; cy: number }[] } = {};
  if (model.tiers) {
    // One drawing per tier; OpenSCAD centres each on import, so its centre goes with it.
    sources.tiers = model.tiers.map((t, i) => {
      const pts = t.rings.flat();
      const xs = pts.map((q) => q[0]);
      const ys = pts.map((q) => q[1]);
      const file = `${base}-tier-${i + 1}.svg`;
      files.push({ path: file, data: ringsSvg(t.rings, `${label} — tier ${i + 1}`) });
      return { file, cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
    });
  } else if (model.art) {
    sources.art = `${base}-design.svg`;
    files.push({ path: sources.art, data: ringsSvg(model.art, label) });
  } else if (model.lithophane) sources.heightmap = { file: `${base}-heightmap.png`, pixels: heightmapPixels(model) };
  else if (mark) {
    sources.mark = mark.file;
    files.push({ path: mark.file, data: mark.svg });
  }
  files.push({ path: `${base}.scad`, data: scadSource(model, label, sources) });
  files.push({ path: `${base}.md`, data: modelReadme(subject.title, model, base, mark) });

  const images = (preview = { width: 1200, height: 900 }) => modelImages(model, base, preview);
  return { model, files, images };
}

/** The model's images: its preview, its back, and for a lithophane its backlit view and heightmap. */
export function modelImages(model: Model, base: string, preview = { width: 1200, height: 900 }): ModelImage[] {
  const out: ModelImage[] = [{ path: `${base}-preview.png`, rgba: renderMeshes(model.parts, { azimuth: -24, elevation: 52, ...preview }), ...preview, caption: 'Rendered from the mesh' }];
  if (model.back.length) out.push({ path: `${base}-back.png`, rgba: renderMeshes(model.parts, { azimuth: 204, elevation: -58, ...preview }), ...preview, caption: 'The back, rendered from the mesh' });
  if (model.lithophane) {
    const { spec, raster } = model.lithophane;
    const px = heightmapPixels(model);
    out.push({ path: `${base}-backlit.png`, rgba: backlit(spec, raster, 800), width: 800, height: 800, caption: 'Simulated, held to the light' });
    out.push({ path: `${base}-heightmap.png`, rgba: heightmap(spec, raster, px), width: px, height: px, caption: 'Heightmap for OpenSCAD' });
  }
  return out;
}

const heightmapPixels = (model: Model) => (model.lithophane ? Math.min(800, Math.round((model.lithophane.spec.diameter - 2 * model.lithophane.spec.frame) / 0.2)) : 0);

const fmt = (v: number, unit = 'mm') => `${Number.isInteger(v) ? v : v.toFixed(2).replace(/0+$/, '')} ${unit}`.trim();

/** The model's sheet: dimensions, parameters, validation and how to print it. */
export function modelReadme(title: string, model: Model, base: string, mark: MarkSource | null): string {
  const spec = PRODUCTS[model.product];
  const cm3 = modelVolume(model);
  const est = estimate(model, model.settings);
  const value = (key: (typeof spec.params)[number]) => (key.kind === 'toggle' ? (model.params[key.key] ? 'on' : 'off') : key.kind === 'choice' ? key.options![model.params[key.key]] : fmt(model.params[key.key], key.unit));
  const rows = spec.params.filter((p) => !p.when || model.params[p.when.key] === p.when.is).map((p) => `| ${p.label} | ${value(p)} | ${p.hint} |`);
  const files = model.parts.length === 1 ? [`\`${base}.stl\` — the solid, ready to slice`] : model.parts.map((pt) => `\`${base}-${pt.name}.stl\` — the ${pt.name}`);
  const infill = model.product === 'lithophane' ? 100 : model.settings.infill;
  return `# ${mdText(title)} — ${spec.name}

${spec.summary}

![Preview](${base}-preview.png)

*Preview rendered from the mesh itself.*
${model.back.length ? `\n![The back](${base}-back.png)\n\n*The back: ${model.back.map((f) => (f.kind === 'magnets' ? `${f.centres.length} magnet pocket${f.centres.length > 1 ? 's' : ''}` : f.kind === 'keyhole' ? 'a keyhole hanger' : f.kind === 'recess' ? 'a pad recess' : 'the inscription')).join(', ')}.*\n` : ''}${model.lithophane ? `\n![Backlit](${base}-backlit.png)\n\n*Simulated: how it looks held to the light.*\n` : ''}
| | |
|---|---|
| Size | ${model.size[0]} × ${model.size[1]} × ${model.size[2]} mm |
| Volume | ${cm3.toFixed(1)} cm³ |
| Filament | ≈ ${Math.round(est.grams)} g, ${est.metres.toFixed(1)} m of ${model.settings.filament} mm at ${infill} % infill (an estimate) |
${mark ? `| Design prints from | Ø ${mark.minDiameterMM} mm on a 0.4 mm nozzle |\n` : ''}
## Parameters

| Parameter | Value | |
|---|---|---|
${rows.join('\n')}

## Files

- ${files.join('\n- ')}
- \`${base}.3mf\` — ${model.parts.length > 1 ? 'both parts as one object, each ready for its own filament' : 'the same solid, in 3MF'}
- \`${base}.scad\` — parametric source for OpenSCAD

## Validation

${model.parts.map((pt) => `- **${pt.name}**: ${pt.report.ok ? 'valid' : 'INVALID'} — ${pt.report.triangles.toLocaleString('en')} triangles, closed and manifold (${pt.report.badEdges} open or doubled edges), ${pt.report.degenerate} degenerate triangles, no self-intersection (${pt.report.overlaps} overlapping layers), volume ${(pt.report.volume / 1000).toFixed(2)} cm³ as designed.`).join('\n')}

## Printing

- ${model.notes.join('\n- ')}
${model.warnings.length ? `\n## Warnings\n\n- ${model.warnings.join('\n- ')}\n` : ''}`;
}
