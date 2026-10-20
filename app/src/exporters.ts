// Exports. SVGs come straight from the shared file plan; PNGs are rasterised
// by the browser's own SVG renderer (the command line uses resvg — same
// geometry, pixel-level anti-aliasing may differ by a hair).

import { zipSync, strToU8 } from 'fflate';
import { productionSvg, treatmentSvg, type Ground, type Treatment } from '../../src/render/svg.ts';
import { svgFiles, rasterJobs, FAVICON, type MarkKey } from '../../src/catalog/fileset.ts';
import { designFile, catalogFile, libraryFile, type Design } from '../../src/catalog/design.ts';
import { ico } from '../../src/export/ico.ts';
import { webIcons } from '../../src/catalog/webicons.ts';
import { coinSvg } from '../../src/integrations/kit.ts';
import { addressOf, dashboardSnippets, iconName } from '../../src/integrations/dashboards.ts';
import { themeKit } from '../../src/integrations/themes/index.ts';
import { png } from '../../src/export/png.ts';
import { marbleScreen } from '../../src/render/wallpaper.ts';
import { issue, motd, motdScript, sshBanner, terminalInstall, wallpaperSvg, WALLPAPER_SIZES, WALLPAPER_STYLES, type ScreenSubject, type WallpaperSize, type WallpaperStyle } from '../../src/screens/screens.ts';
import type { ScreenTone } from '../../src/render/wallpaper.ts';
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
  const favicon = ico(icons);
  files[`assets/services/${id}/favicon.ico`] = favicon;
  // The web icon set, as the command line writes it.
  const web = webIcons(marks.seal, { name: `${service.name} · The Olympus`, short: service.name });
  for (const f of web.files) files[`assets/services/${id}/web/${f.path}`] = strToU8(f.data);
  for (const r of web.rasters) files[`assets/services/${id}/web/${r.path}`] = await svgToPng(r.svg, r.width);
  files[`assets/services/${id}/web/favicon.ico`] = favicon;

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
  // Dashboard icons and entries, for a start page that already lists the house.
  const entry = { id, name: service.name, category: service.category, description: service.description, url: service.url, app: service.app };
  files[`dashboard/${iconName(id, '', 'svg')}`] = strToU8(coinSvg(marks.seal, 'dark', `The Olympus — ${service.name}`));
  files[`dashboard/${iconName(id)}`] = await svgToPng(coinSvg(marks.seal, 'dark', `The Olympus — ${service.name}`), 256);
  files[`dashboard/${iconName(id, '-light')}`] = await svgToPng(coinSvg(marks.seal, 'light', `The Olympus — ${service.name}`), 256);
  files['dashboard/README.md'] = strToU8(dashboardSnippets(entry));
  // The theme kit of the application the service runs, made from its seal.
  const kit = service.app ? themeKit(service.app) : undefined;
  if (kit) {
    const ctx = {
      entry,
      id,
      name: service.name,
      url: addressOf(entry),
      marks: { seal: marks.seal, emblem: marks['emblem-fine'], crest: marks['crest-fine'] },
      png: svgToPng,
      ground: (w: number, h: number, tone: ScreenTone) => png(marbleScreen(w, h, tone), w, h, 1),
    };
    for (const [path, data] of await kit.files(ctx)) files[`theme/${kit.id}/${path}`] = typeof data === 'string' ? strToU8(data) : data;
  }
  // The crest in the terminal: message of the day, console login, SSH banner.
  const screen: ScreenSubject = { id, name: service.name, caption: service.caption, url: service.url, marks: { crest: marks['crest-fine'], seal: marks.seal } };
  files['terminal/motd-braille.txt'] = strToU8(motd(screen, 'braille'));
  files['terminal/motd-ascii.txt'] = strToU8(motd(screen, 'ascii'));
  files['terminal/20-the-olympus'] = strToU8(motdScript(screen));
  files['terminal/issue'] = strToU8(issue(screen));
  files['terminal/issue.net'] = strToU8(sshBanner(screen));
  files['terminal/install.sh'] = strToU8(terminalInstall());

  return zipSync(Object.fromEntries(Object.entries(files).map(([p, d]) => [`${root}/${p}`, d])), { level: 6 });
}

export { designFile, libraryFile };

/** A marble ground, drawn in a worker, as an encoded gray PNG. */
function marbleGround(w: number, h: number, tone: ScreenTone): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./ground-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<Uint8Array>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'The marble could not be drawn.'));
    };
    worker.postMessage({ w, h, tone });
  });
}

/** A wallpaper as PNG, made in the browser (the command line's are rasterised by resvg). */
export async function wallpaperPng(subject: ScreenSubject, style: WallpaperStyle, size: WallpaperSize): Promise<Uint8Array> {
  const { w, h } = WALLPAPER_SIZES[size];
  const tone = WALLPAPER_STYLES[style].ground;
  const ground = tone ? await marbleGround(w, h, tone) : undefined;
  return svgToPng(wallpaperSvg(subject, style, size, ground), w);
}
