// Exports. SVGs come straight from the shared file plan; PNGs are rasterised
// by the browser's own SVG renderer (the command line uses resvg — same
// geometry, pixel-level anti-aliasing may differ by a hair).

import { zipSync, strToU8 } from 'fflate';
import { productionSvg, treatmentSvg, type Ground, type Treatment } from '../../src/render/svg.ts';
import { svgFiles, rasterJobs, FAVICON, type MarkKey } from '../../src/catalog/fileset.ts';
import { designFile, catalogFile, libraryFile, type Design } from '../../src/catalog/design.ts';
import { ico } from '../../src/export/ico.ts';
import { PRINTER_MM, type PrintReport } from '../../src/print/service.ts';
import type { Mark } from '../../src/geometry/crest.ts';
import type { Service } from '../../src/catalog/service.ts';

export function download(name: string, data: string | Uint8Array, type: string): void {
  const url = URL.createObjectURL(new Blob([typeof data === 'string' ? data : new Uint8Array(data)], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Rasterise an SVG document at a pixel width (height follows its aspect ratio). */
export async function svgToPng(svg: string, width: number): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const height = Math.round((width * img.naturalHeight) / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot draw to a canvas.');
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
    if (!blob) throw new Error('The browser could not encode the PNG.');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type FileVariant = { ground: Ground; ink?: string; suffix: string };

export const fileName = (id: string, key: string, suffix = '', ext = 'svg') => `the-olympus-${id}-${key}${suffix}.${ext}`;

export function markSvg(mark: Mark, variant: FileVariant, title: string): string {
  return productionSvg(mark, { ground: variant.ground, ink: variant.ink, title });
}

export function presentationSvg(mark: Mark, treatment: Treatment): string {
  return treatmentSvg(mark, treatment, { size: 1024 });
}

const sha256 = async (data: Uint8Array) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>))].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * The full asset pack — the same files `npm run service -- build` writes,
 * plus the design itself, laid out to drop into the repository.
 */
export async function assetPack(design: Design, service: Service, marks: Record<MarkKey, Mark>, print: PrintReport, warnings: string[], onProgress: (done: number, total: number) => void): Promise<Uint8Array> {
  const id = service.id;
  const root = `the-olympus-${id}`;
  const files: Record<string, Uint8Array> = {};
  const svgs = svgFiles(service, marks);
  const rasters = rasterJobs(service, marks);
  const total = svgs.length + rasters.length + FAVICON.sizes.length;
  let done = 0;
  const tick = () => onProgress(++done, total);

  for (const f of svgs) {
    files[`assets/services/${id}/${f.path}`] = strToU8(f.svg);
    tick();
  }
  for (const j of rasters) {
    files[`assets/services/${id}/${j.path}`] = await svgToPng(j.svg, j.width);
    tick();
  }
  const icons = [];
  for (const size of FAVICON.sizes) {
    icons.push({ size, png: await svgToPng(FAVICON.svg(marks), size) });
    tick();
  }
  files[`assets/services/${id}/favicon.ico`] = ico(icons);

  const list = await Promise.all(Object.entries(files).map(async ([path, data]) => ({ path: path.slice(`assets/services/${id}/`.length), sha256: await sha256(data) })));
  const manifest = {
    service: { id, name: service.name, category: service.category, patron: service.patron, letter: service.letter, caption: service.caption, logo: service.logo ?? null },
    print: { variablePartsMinUnits: print.minUnits, minDiameterMM: print.minDiameterMM, featureMM: PRINTER_MM },
    warnings,
    files: list,
  };
  files[`assets/services/${id}/manifest.json`] = strToU8(JSON.stringify(manifest, null, 2) + '\n');
  files[`catalog/services/${id}.json`] = strToU8(catalogFile(design));
  if (design.logoSvg) files[`catalog/logos/${id}.svg`] = strToU8(design.logoSvg);
  files[`${id}.olympus.json`] = strToU8(designFile(design));

  return zipSync(Object.fromEntries(Object.entries(files).map(([p, d]) => [`${root}/${p}`, d])), { level: 6 });
}

export { designFile, libraryFile };
