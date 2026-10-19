// The files a service is delivered as — one plan shared by the command line
// (which rasterises with resvg) and the web app (which rasterises in a canvas).
// The SVG files are identical wherever they are made.

import { crest, emblem, seal, type Mark } from '../geometry/crest.ts';
import { lockup } from '../geometry/lockup.ts';
import { ringsPath } from '../geometry/poly.ts';
import { productionSvg, type Ground } from '../render/svg.ts';
import { geometryOf } from '../print/printcheck.ts';
import { PALETTE } from '../brand/palette.ts';
import type { Patron } from '../geometry/pantheon.ts';
import type { Service } from './service.ts';

export const MARK_KEYS = ['crest-fine', 'crest-print', 'emblem-fine', 'emblem-print', 'seal', 'lockup-horizontal', 'lockup-vertical'] as const;
export type MarkKey = (typeof MARK_KEYS)[number];

/** Print editions are written as the exact polygons the print check measured. */
const printed = (m: Mark): Mark => ({ ...m, d: ringsPath(geometryOf(m.d)) });

export type LockupKey = 'lockup-horizontal' | 'lockup-vertical';

/** The marks that depend only on the patron and logo. `logo` is imported path data for the fine logo slot. */
export function baseMarks(patron: Patron, logo?: string): Record<Exclude<MarkKey, LockupKey>, Mark> {
  return {
    'crest-fine': crest({ patron, logo }),
    'crest-print': printed(crest({ patron, detail: 'print' })),
    'emblem-fine': emblem({ patron }),
    'emblem-print': printed(emblem({ patron, detail: 'print' })),
    seal: seal({ patron }),
  };
}

/** The lockups: the fine crest with the service's name and caption. */
export function lockups(crestFine: Mark, s: Pick<Service, 'name' | 'caption'>): Record<LockupKey, Mark> {
  return {
    'lockup-horizontal': lockup(crestFine, { name: s.name, caption: s.caption, layout: 'horizontal' }),
    'lockup-vertical': lockup(crestFine, { name: s.name, caption: s.caption, layout: 'vertical' }),
  };
}

/** Every mark of a service. */
export function serviceMarks(s: Service, logo?: string): Record<MarkKey, Mark> {
  const base = baseMarks(s.patron, logo);
  return { ...base, ...lockups(base['crest-fine'], s) };
}

export const GROUNDS: { suffix: string; ground: Ground; ink?: string }[] = [
  { suffix: '', ground: 'transparent' },
  { suffix: '-white', ground: 'transparent', ink: PALETTE.marble },
  { suffix: '-on-light', ground: 'light' },
  { suffix: '-on-dark', ground: 'dark' },
];

export const markTitle = (s: Service, key: MarkKey) => `The Olympus — ${s.name} — ${key.replace('-', ' ')}`;

/** Every production SVG: each mark on each ground. */
export function svgFiles(s: Service, marks: Record<MarkKey, Mark>): { path: string; svg: string }[] {
  return MARK_KEYS.flatMap((k) =>
    GROUNDS.map((g) => ({ path: `svg/the-olympus-${s.id}-${k}${g.suffix}.svg`, svg: productionSvg(marks[k], { ground: g.ground, ink: g.ink, title: markTitle(s, k) }) })),
  );
}

// [mark, widths, also in white ink at the first width]
const RASTERS: [MarkKey, number[], boolean][] = [
  ['crest-fine', [512], true],
  ['emblem-fine', [128, 256], false],
  ['seal', [32, 64, 180, 512], false],
  ['lockup-horizontal', [1600], true],
  ['lockup-vertical', [800], false],
];

/** Every PNG to render: the SVG to rasterise and its pixel width. */
export function rasterJobs(s: Service, marks: Record<MarkKey, Mark>): { path: string; svg: string; width: number }[] {
  const svg = (k: MarkKey, ink?: string) => productionSvg(marks[k], { ground: 'transparent', ink });
  return RASTERS.flatMap(([k, widths, white]) => [
    ...widths.map((width) => ({ path: `png/the-olympus-${s.id}-${k}-${width}.png`, svg: svg(k), width })),
    ...(white ? [{ path: `png/the-olympus-${s.id}-${k}-white-${widths[0]}.png`, svg: svg(k, PALETTE.marble), width: widths[0] }] : []),
  ]);
}

/** The favicon: the seal at these sizes, packed into one .ico. */
export const FAVICON = { sizes: [16, 32, 48], svg: (marks: Record<MarkKey, Mark>) => productionSvg(marks.seal, { ground: 'transparent' }) };
