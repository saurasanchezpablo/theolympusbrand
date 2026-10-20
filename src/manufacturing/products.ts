// Printable objects made from the print editions. Almost every product is a
// stack of flat layers (see mesh.ts) laid out to print flat on the bed,
// design up, with no supports; the lithophane is a heightfield. Dimensions
// are millimetres.

import { RIM, C, type Ring } from '../geometry/math.ts';
import { flatten, strictlySimple, union, difference, intersection, noSpecks, offset } from '../geometry/poly.ts';
import { lineText } from '../geometry/fonts.ts';
import { lockupParts, type LockupLayout } from '../geometry/lockup.ts';
import { isClean, problemsAt } from '../print/printcheck.ts';
import { PRINTER_MM } from '../print/service.ts';
import { NAME, DOMAIN } from '../brand/identity.ts';
import { qr, qrPath } from '../geometry/qr.ts';
import { area, cleanRings, stack, surfaceArea, validate, type Layer, type Mesh, type MeshReport } from './mesh.ts';
import { lithophaneMesh, rasterise, type LithophaneSpec, type Raster } from './lithophane.ts';

export type ProductId = 'medallion' | 'engraved' | 'two-colour' | 'coaster' | 'nameplate' | 'lithophane' | 'token' | 'stand';

export type ParamKey =
  | 'diameter' | 'flange' | 'base' | 'relief' | 'thickness' | 'depth'
  | 'magnets' | 'magnetDiameter' | 'magnetDepth' | 'keyhole' | 'inscription'
  | 'recess' | 'recessDepth'
  | 'height' | 'margin' | 'corner' | 'layout' | 'caption' | 'qr' | 'bed'
  | 'frame' | 'minThickness' | 'maxThickness' | 'resolution' | 'veins'
  | 'hole' | 'slot' | 'clearance';
export type Params = Partial<Record<ParamKey, number>>;
export type ParamSpec = {
  key: ParamKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  hint: string;
  /** How the value is edited: a number, an on/off switch (0/1), or one of `options` (by index). */
  kind: 'number' | 'toggle' | 'choice';
  options?: string[];
  /** Back-of-plate features are grouped apart from the shape. */
  group: 'shape' | 'back';
};

export type Product = {
  id: ProductId;
  name: string;
  summary: string;
  /** Which print-edition mark it carries. */
  mark: 'crest' | 'seal' | null;
  params: ParamSpec[];
};

const N = (key: ParamKey, label: string, unit: string, min: number, max: number, step: number, value: number, hint: string, group: 'shape' | 'back' = 'shape'): ParamSpec => ({ key, label, unit, min, max, step, value, hint, kind: 'number', group });
const T = (key: ParamKey, label: string, value: 0 | 1, hint: string, group: 'shape' | 'back' = 'shape'): ParamSpec => ({ key, label, unit: '', min: 0, max: 1, step: 1, value, hint, kind: 'toggle', group });
const CH = (key: ParamKey, label: string, options: string[], value: number, hint: string): ParamSpec => ({ key, label, unit: '', min: 0, max: options.length - 1, step: 1, value, hint, kind: 'choice', options, group: 'shape' });

/** Keyhole, sized for a 3.5–4 mm screw with a head up to 8 mm. */
const KEYHOLE = { head: 8.6, shank: 4.6, travel: 8, lip: 1.2, chamber: 2.2 } as const;
const KEYHOLE_DEPTH = KEYHOLE.lip + KEYHOLE.chamber;
/** Material left over any pocket, so it bridges cleanly: four 0.2 mm layers. */
const ROOF = 0.8;
const INSCRIPTION_DEPTH = 0.6;

const BACK: ParamSpec[] = [
  N('magnets', 'Magnet pockets', '', 0, 4, 1, 0, 'Round pockets for disc magnets: hangs on a rack door, a fridge, a steel panel. Glue the magnets in after printing.', 'back'),
  N('magnetDiameter', 'Magnet diameter', 'mm', 3, 20, 0.1, 10.2, 'Pocket diameter: the magnet plus about 0.2 mm.', 'back'),
  N('magnetDepth', 'Magnet depth', 'mm', 1, 6, 0.1, 2.2, 'Pocket depth: the magnet’s thickness plus about 0.2 mm.', 'back'),
  T('keyhole', 'Keyhole hanger', 0, `A keyhole slot to hang it on a 3.5–4 mm screw (head up to 8 mm). Needs a plate of ${(KEYHOLE_DEPTH + ROOF).toFixed(1)} mm or more.`, 'back'),
  T('inscription', 'Back inscription', 1, `The name and ${DOMAIN}, engraved mirrored on the back so it reads when turned over.`, 'back'),
];

export const PRODUCTS: Record<ProductId, Product> = {
  medallion: {
    id: 'medallion',
    name: 'Medallion',
    summary: 'The crest raised on a round backing plate — a wall or desk piece, a rack badge with magnets.',
    mark: 'crest',
    params: [
      N('diameter', 'Diameter', 'mm', 40, 300, 1, 100, 'Outer diameter of the plate.'),
      N('flange', 'Flange', 'mm', 0.6, 6, 0.1, 1.2, 'Plate left around the crest’s rim.'),
      N('base', 'Plate thickness', 'mm', 1.6, 10, 0.1, 3, 'A multiple of your layer height keeps the relief crisp.'),
      N('relief', 'Relief height', 'mm', 0.4, 4, 0.1, 1.2, 'How far the design stands proud of the plate.'),
      ...BACK,
    ],
  },
  engraved: {
    id: 'engraved',
    name: 'Engraved medallion',
    summary: 'The crest cut into a solid plate — quiet, stone-like, best in one light filament.',
    mark: 'crest',
    params: [
      N('diameter', 'Diameter', 'mm', 40, 300, 1, 100, 'Outer diameter of the plate.'),
      N('flange', 'Flange', 'mm', 0.8, 8, 0.1, 2, 'Solid border left around the crest’s rim.'),
      N('thickness', 'Plate thickness', 'mm', 2.4, 12, 0.1, 4, 'Total thickness.'),
      N('depth', 'Engraving depth', 'mm', 0.4, 4, 0.1, 1, 'How deep the design is cut.'),
      ...BACK,
    ],
  },
  'two-colour': {
    id: 'two-colour',
    name: 'Two-colour medallion',
    summary: 'Plate and relief as separate parts — for a filament change at the relief, or a multi-material printer.',
    mark: 'crest',
    params: [
      N('diameter', 'Diameter', 'mm', 40, 300, 1, 100, 'Outer diameter of the plate.'),
      N('flange', 'Flange', 'mm', 0.6, 6, 0.1, 1.2, 'Plate left around the crest’s rim.'),
      N('base', 'Plate thickness', 'mm', 1.6, 10, 0.1, 3, 'The colour changes at this height.'),
      N('relief', 'Relief height', 'mm', 0.4, 4, 0.1, 1.2, 'Height of the second colour.'),
      ...BACK,
    ],
  },
  coaster: {
    id: 'coaster',
    name: 'Coaster',
    summary: 'The crest engraved flush, so a glass stands level — with a recess underneath for a felt or cork pad.',
    mark: 'crest',
    params: [
      N('diameter', 'Diameter', 'mm', 70, 130, 1, 100, 'Outer diameter.'),
      N('flange', 'Flange', 'mm', 1, 10, 0.1, 3, 'Solid border around the crest.'),
      N('thickness', 'Thickness', 'mm', 3, 10, 0.1, 5, 'Total thickness.'),
      N('depth', 'Engraving depth', 'mm', 0.4, 2, 0.1, 0.8, 'Shallow keeps it easy to wipe.'),
      T('recess', 'Pad recess', 1, 'A shallow recess in the base for a felt or cork pad, so it never scratches the table.'),
      N('recessDepth', 'Recess depth', 'mm', 0.4, 3, 0.1, 1, 'The thickness of the pad.'),
    ],
  },
  nameplate: {
    id: 'nameplate',
    name: 'Nameplate',
    summary: 'The crest with the service’s name and caption on a plate — for a server, a rack, a door.',
    mark: 'crest',
    params: [
      N('height', 'Height', 'mm', 40, 200, 1, 80, 'Height of the plate; the length follows the name.'),
      CH('layout', 'Layout', ['Horizontal', 'Vertical'], 0, 'The name beside the crest, or beneath it.'),
      T('caption', 'Caption', 1, 'The line under the name (“The Olympus · …”).'),
      T('qr', 'QR code', 0, 'The service’s address as a QR code beside the name. Print the relief in a contrasting colour (a filament change) so phones can read it.'),
      N('margin', 'Margin', 'mm', 3, 20, 0.5, 5, 'Plate left around the design.'),
      N('corner', 'Corner radius', 'mm', 0, 20, 0.5, 6, 'Rounding of the plate’s corners.'),
      N('base', 'Plate thickness', 'mm', 1.6, 10, 0.1, 3, 'A multiple of your layer height keeps the relief crisp.'),
      N('relief', 'Relief height', 'mm', 0.4, 4, 0.1, 1.2, 'How far the design stands proud of the plate.'),
      N('bed', 'Bed size', 'mm', 100, 400, 1, 256, 'The longest side your printer takes; a longer plate is scaled down to fit.'),
      ...BACK,
    ],
  },
  lithophane: {
    id: 'lithophane',
    name: 'Marble lithophane',
    summary: 'A thin disc that turns into backlit marble: hold it to a window or a lamp and the crest and veining appear in the light.',
    mark: 'crest',
    params: [
      N('diameter', 'Diameter', 'mm', 50, 160, 1, 100, 'Outer diameter.'),
      N('frame', 'Frame', 'mm', 2, 10, 0.5, 4, 'Solid rim around the picture.'),
      N('minThickness', 'Thinnest', 'mm', 0.4, 1.6, 0.1, 0.8, 'The brightest areas. Thinner glows more but is more fragile.'),
      N('maxThickness', 'Thickest', 'mm', 1.8, 5, 0.1, 3, 'The darkest areas, and the frame.'),
      N('veins', 'Veining', '%', 0, 100, 5, 55, 'How strongly the marble veining shows.'),
      N('resolution', 'Resolution', 'mm', 0.2, 0.6, 0.05, 0.3, 'Mesh spacing. Finer is sharper and heavier.'),
    ],
  },
  token: {
    id: 'token',
    name: 'Token',
    summary: 'The seal raised on a small disc with a keyring lug — a key fob, a bag tag, a cable tag.',
    mark: 'seal',
    params: [
      N('diameter', 'Diameter', 'mm', 20, 80, 1, 40, 'Diameter of the disc (the lug adds to the height).'),
      N('flange', 'Flange', 'mm', 0.6, 4, 0.1, 1.2, 'Plate left around the seal’s ring.'),
      N('base', 'Disc thickness', 'mm', 1.2, 6, 0.1, 2.4, 'Thickness of the disc and lug.'),
      N('relief', 'Relief height', 'mm', 0.4, 3, 0.1, 1, 'How far the seal stands proud.'),
      N('hole', 'Keyring hole', 'mm', 2.5, 8, 0.1, 4.5, 'Diameter of the hole in the lug.'),
    ],
  },
  stand: {
    id: 'stand',
    name: 'Desk stand',
    summary: 'A slotted foot that holds a medallion or lithophane upright on a desk or shelf.',
    mark: null,
    params: [
      N('diameter', 'Medallion diameter', 'mm', 40, 300, 1, 100, 'The medallion it holds.'),
      N('slot', 'Medallion thickness', 'mm', 1.6, 16, 0.1, 4.2, 'Its thickest point: plate plus relief.'),
      N('clearance', 'Clearance', 'mm', 0, 1, 0.05, 0.3, 'Added to the slot width; tune it to your printer.'),
      N('depth', 'Slot depth', 'mm', 4, 30, 0.5, 10, 'How much of the medallion sits in the foot.'),
    ],
  },
};

export const defaults = (id: ProductId): Required<Params> => Object.fromEntries(PRODUCTS[id].params.map((p) => [p.key, p.value])) as Required<Params>;

/**
 * Defaults for a product carrying a mark: the size is raised, if needed, to
 * the smallest at which the mark prints cleanly.
 */
export function suggestedParams(id: ProductId, minDiameterMM?: number): Required<Params> {
  const p = defaults(id);
  if (!minDiameterMM || !PRODUCTS[id].mark) return p;
  if (id === 'nameplate') p.height = Math.max(p.height, Math.ceil(minDiameterMM * 1.02 + 2 * p.margin));
  else if (id === 'lithophane') p.diameter = Math.max(p.diameter, Math.ceil(minDiameterMM + 2 * p.frame + 2));
  else p.diameter = Math.max(p.diameter, Math.ceil(minDiameterMM + 2 * p.flange));
  return p;
}

/** Values clamped to each parameter's range. */
export function clampParams(id: ProductId, params: Params): Required<Params> {
  const out = { ...defaults(id) } as Required<Params>;
  for (const p of PRODUCTS[id].params) {
    const v = params[p.key];
    if (typeof v === 'number' && Number.isFinite(v)) out[p.key] = Math.min(p.max, Math.max(p.min, p.kind === 'number' ? v : Math.round(v)));
  }
  return out;
}

/* ---------------------------------------------------------------- */
/* Print settings and estimates                                       */
/* ---------------------------------------------------------------- */

export type PrintSettings = {
  /** Layer height (mm). */
  layer: number;
  /** Infill (%). */
  infill: number;
  /** Filament diameter (mm). */
  filament: number;
  /** Filament density (g/cm³) — PLA 1.24, PETG 1.27. */
  density: number;
};

export const DEFAULT_SETTINGS: PrintSettings = { layer: 0.2, infill: 15, filament: 1.75, density: 1.24 };

/** Filament for a model: walls and skins (about 0.85 mm deep everywhere) plus infill. An estimate. */
export function estimate(model: Model, s: PrintSettings): { grams: number; metres: number } {
  let mm3 = 0;
  for (const p of model.parts) {
    const v = p.report.volume;
    const shell = Math.min(v, surfaceArea(p.mesh) * 0.85 * 0.5);
    const infill = model.product === 'lithophane' ? 100 : s.infill;
    mm3 += shell + (v - shell) * (infill / 100);
  }
  return { grams: (mm3 / 1000) * s.density, metres: mm3 / (Math.PI * (s.filament / 2) ** 2) / 1000 };
}

/* ---------------------------------------------------------------- */
/* Geometry helpers (millimetres, y up, solids anticlockwise)         */
/* ---------------------------------------------------------------- */

const SEGMENTS_PER_MM = 1.2;

export function circle(r: number, cx = 0, cy = 0, n = Math.max(32, Math.ceil(2 * Math.PI * r * SEGMENTS_PER_MM))): Ring {
  return Array.from({ length: n }, (_, i): [number, number] => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
}

const rev = (r: Ring): Ring => [...r].reverse();

export function roundedRect(w: number, h: number, r: number, cx = 0, cy = 0): Ring {
  const rr = Math.max(0, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  if (rr < 0.05)
    return [
      [cx - w / 2, cy - h / 2],
      [cx + w / 2, cy - h / 2],
      [cx + w / 2, cy + h / 2],
      [cx - w / 2, cy + h / 2],
    ];
  const pts: Ring = [];
  const steps = Math.max(4, Math.ceil(rr * 1.2));
  const corners: [number, number, number][] = [
    [cx + w / 2 - rr, cy - h / 2 + rr, -90],
    [cx + w / 2 - rr, cy + h / 2 - rr, 0],
    [cx - w / 2 + rr, cy + h / 2 - rr, 90],
    [cx - w / 2 + rr, cy - h / 2 + rr, 180],
  ];
  for (const [x, y, a0] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = ((a0 + (90 * i) / steps) * Math.PI) / 180;
      pts.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]);
    }
  }
  return pts;
}

/** Geometry finer than this (mm) is cleaned away before meshing. */
export const MESH_TOLERANCE = 0.02;

/**
 * Path data (artboard units, y down) as millimetre rings (y up): scaled by k
 * about (ox, oy), moved to (tx, ty), optionally mirrored left–right and grown.
 * The polygon booleans run in millimetres, on the same 0.001 mm grid the mesh
 * uses; the result is shrunk by 0.01 mm — fifty times finer than anything a
 * nozzle prints — so no two parts touch, not even at a corner (touching parts
 * would leave zero-area triangles and non-manifold edges). Reflections need no
 * re-winding: the union reads either winding as solid.
 */
export function pathRings(d: string, k: number, ox: number, oy: number, { tx = 0, ty = 0, mirror = false, grow = 0 } = {}): Ring[] {
  const sx = mirror ? -k : k;
  const mm = noSpecks(union(flatten(d)), 0.5).map((r) => r.map(([x, y]): [number, number] => [tx + (x - ox) * sx, ty + (oy - y) * k]));
  return cleanRings(strictlySimple(offset(mm, grow - MESH_TOLERANCE / 2)), MESH_TOLERANCE / 4);
}

/** A print-edition mark as millimetre rings, centred, its rim scaled to `diameter`. */
export const markRings = (d: string, diameter: number): Ring[] => pathRings(d, diameter / (2 * RIM), C, C);

/** Lines of text, centred on (cx, cy), cap heights in mm. Jost Semibold. */
export function textRings(lines: { text: string; cap: number }[], cx: number, cy: number, mirror: boolean): Ring[] {
  const gap = 0.75;
  const total = lines.reduce((s, l) => s + l.cap, 0) + gap * lines[0].cap * (lines.length - 1);
  let top = cy + total / 2;
  const out: Ring[] = [];
  for (const l of lines) {
    const probe = lineText(l.text, { cx: 0, baseline: 0, size: 100, tracking: 0.14, role: 'companion' });
    const k = l.cap / probe.capHeight;
    out.push(...pathRings(probe.d, k, 0, 0, { tx: cx, ty: top - l.cap, mirror }));
    top -= l.cap * (1 + gap);
  }
  return out;
}

const boxOf = (rings: Ring[]) => {
  const pts = rings.flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

/* ---------------------------------------------------------------- */
/* The back of a plate: pockets, a keyhole, an inscription            */
/* ---------------------------------------------------------------- */

/** A void inside a plate, from z0 to z1 above the bed. */
type Cavity = { rings: Ring[]; z0: number; z1: number };

/** Where the back features went — for the OpenSCAD source and the sheet. */
export type BackFeature =
  | { kind: 'magnets'; centres: [number, number][]; diameter: number; depth: number }
  | { kind: 'keyhole'; x: number; y: number }
  | { kind: 'inscription'; lines: { text: string; cap: number }[]; y: number; depth: number }
  | { kind: 'recess'; diameter: number; depth: number };

export const KEYHOLE_SPEC = KEYHOLE;

type Shape = { kind: 'disc'; r: number } | { kind: 'rect'; w: number; h: number };

/**
 * The plate as layers: its outline from the bed up to `top`, with every cavity
 * cut out where it is. Bands split wherever a cavity starts or ends.
 */
function plateLayers(outline: Ring[], top: number, cavities: Cavity[]): Layer[] {
  const zs = [...new Set([0, top, ...cavities.flatMap((c) => [c.z0, c.z1]).filter((z) => z > 0 && z < top)])].sort((a, b) => a - b);
  const layers: Layer[] = [];
  for (let i = 0; i + 1 < zs.length; i++) {
    const [a, b] = [zs[i], zs[i + 1]];
    const active = cavities.filter((c) => c.z0 <= a + 1e-9 && c.z1 >= b - 1e-9);
    const holes = active.length ? cleanRings(strictlySimple(union(...active.map((c) => c.rings))), MESH_TOLERANCE / 4) : [];
    layers.push({ rings: [...outline, ...holes.map(rev)], z0: a, z1: b });
  }
  return layers;
}

/**
 * Place the back features a plate's parameters ask for, in order of priority
 * (magnets, keyhole, inscription). A feature that would not fit — too deep for
 * the plate, too close to the edge or to another feature, too fine to print —
 * is left out with a warning.
 */
function backFeatures(p: Required<Params>, shape: Shape, floor: number, lines: string[], warnings: string[], notes: string[], placed: BackFeature[]): Cavity[] {
  const usable = floor - ROOF;
  const inner = shape.kind === 'disc' ? [circle(shape.r - 2)] : [roundedRect(shape.w - 4, shape.h - 4, Math.max(0, p.corner - 2))];
  const taken: Ring[] = [];
  const cavities: Cavity[] = [];
  const fits = (rings: Ring[]) => {
    const footprint = offset(union(rings), 1);
    const outside = area(difference(footprint, inner));
    const clash = taken.length ? area(intersection(footprint, taken)) : 0;
    return outside < 1e-3 && clash < 1e-3;
  };
  const accept = (rings: Ring[]) => taken.push(...offset(union(rings), 0.5));

  // Magnets.
  if (p.magnets > 0) {
    const d = p.magnetDiameter;
    const centres: [number, number][] =
      shape.kind === 'disc'
        ? p.magnets === 1
          ? [[0, 0]]
          : Array.from({ length: p.magnets }, (_, i) => {
              const a = Math.PI / 2 + (2 * Math.PI * i) / p.magnets + (p.magnets === 2 ? Math.PI / 2 : 0);
              return [shape.r * 0.45 * Math.cos(a), shape.r * 0.45 * Math.sin(a)];
            })
        : Array.from({ length: p.magnets }, (_, i) => [(p.magnets === 1 ? 0 : -0.35 + (0.7 * i) / (p.magnets - 1)) * shape.w, 0]);
    const rings = centres.map(([x, y]) => circle(d / 2, x, y));
    if (p.magnetDepth > usable) warnings.push(`The magnet pockets are deeper than the plate allows (at most ${Math.max(0, usable).toFixed(1)} mm); they were left out.`);
    else if (!fits(rings)) warnings.push('The magnets do not fit on this plate; they were left out.');
    else {
      accept(rings);
      cavities.push({ rings, z0: 0, z1: p.magnetDepth });
      placed.push({ kind: 'magnets', centres, diameter: d, depth: p.magnetDepth });
      notes.push(`Glue ${p.magnets} disc magnet${p.magnets > 1 ? 's' : ''} (Ø ${(d - 0.2).toFixed(1)} × ${(p.magnetDepth - 0.2).toFixed(1)} mm) into the pockets after printing; they open on the bed side and bridge cleanly.`);
    }
  }

  // Keyhole: a screw head enters the round opening, the plate drops, the shank rides up the slot under a lip.
  if (p.keyhole) {
    const cy = shape.kind === 'disc' ? shape.r * 0.42 : shape.h * 0.18;
    const k = KEYHOLE;
    const slot = (halfW: number, r: number, extra: number) => union([circle(r, 0, cy)], [roundedRect(halfW * 2, k.travel + extra, 0, 0, cy + (k.travel + extra) / 2)], [circle(halfW, 0, cy + k.travel + extra)]);
    const entry = slot(k.shank / 2, k.head / 2, 0);
    const chamber = slot(k.head / 2, k.head / 2 + 0.2, 0.4);
    if (KEYHOLE_DEPTH > usable) warnings.push(`The keyhole needs a plate of ${(KEYHOLE_DEPTH + ROOF).toFixed(1)} mm or more under the design; it was left out.`);
    else if (!fits(chamber)) warnings.push('The keyhole does not fit beside the other features; it was left out.');
    else {
      accept(chamber);
      cavities.push({ rings: entry, z0: 0, z1: k.lip }, { rings: chamber, z0: k.lip, z1: KEYHOLE_DEPTH });
      placed.push({ kind: 'keyhole', x: 0, y: cy });
      notes.push('Keyhole: drive a 3.5–4 mm screw into the wall, leave its head about 2 mm proud, slip the plate over it and let it drop.');
    }
  }

  // Inscription, mirrored so it reads when the piece is turned over.
  if (p.inscription && lines.length) {
    const size = shape.kind === 'disc' ? shape.r * 2 : shape.h;
    const cap = Math.min(9, Math.max(3.6, size * (shape.kind === 'disc' ? 0.055 : 0.075)));
    const candidates = shape.kind === 'disc' ? [-0.42, -0.24, 0] .map((f) => f * shape.r) : [-0.22, 0, 0.18].map((f) => f * shape.h);
    const depth = Math.min(INSCRIPTION_DEPTH, usable);
    let done = false;
    for (let scale = 1; scale <= 1.3 && !done; scale += 0.15) {
      const spec = lines.map((text, i) => ({ text: text.toUpperCase(), cap: (i === 0 ? cap : cap * 0.78) * scale }));
      for (const cy of candidates) {
        const rings = textRings(spec, 0, cy, true);
        if (!rings.length || !fits(rings)) continue;
        if (!isClean(problemsAt(union(rings), PRINTER_MM, { topology: true }))) break;
        accept(rings);
        cavities.push({ rings, z0: 0, z1: depth });
        placed.push({ kind: 'inscription', lines: spec, y: cy, depth });
        done = true;
        break;
      }
    }
    if (depth < 0.4) warnings.push('The plate is too thin for a back inscription; it was left out.');
    else if (!done) warnings.push('The back inscription does not fit or would print too fine at this size; it was left out.');
    else notes.push(`The inscription on the back (${lines.join(' · ')}) is cut ${depth.toFixed(1)} mm deep into the first layers; it reads when the piece is turned over.`);
  }
  return cavities;
}

/* ---------------------------------------------------------------- */
/* Models                                                             */
/* ---------------------------------------------------------------- */

export type Part = { name: string; mesh: Mesh; report: MeshReport; tone: 'light' | 'dark'; layers?: Layer[] };
export type Model = {
  product: ProductId;
  params: Required<Params>;
  settings: PrintSettings;
  parts: Part[];
  /** Overall size of the printed object (mm). */
  size: [number, number, number];
  warnings: string[];
  notes: string[];
  /** For the lithophane: what is needed to show it backlit. */
  lithophane?: { spec: LithophaneSpec; raster: Raster };
  /** Back features as placed. */
  back: BackFeature[];
  /** The raised or engraved design in millimetres (for the OpenSCAD source of shapes it cannot rebuild). */
  art?: Ring[];
};

export type ModelInput = {
  /** The print-edition mark (crest or seal) and the smallest diameter it prints at. */
  mark?: { d: string; minDiameterMM: number };
  /** The service's name and lockup caption (nameplate) and the back inscription. */
  name?: string;
  caption?: string;
  /** The service's address, for a QR code. */
  url?: string;
};

const part = (name: string, layers: Layer[], tone: 'light' | 'dark'): Part => {
  const mesh = stack(layers);
  return { name, mesh, report: validate(mesh, layers), tone, layers };
};

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Build a product for a mark. */
export function buildModel(id: ProductId, input: Params, src: ModelInput = {}, settings: PrintSettings = DEFAULT_SETTINGS): Model {
  const p = clampParams(id, input);
  const mark = src.mark;
  const warnings: string[] = [];
  const notes: string[] = [];
  if (PRODUCTS[id].mark && !mark) throw new Error(`${id}: needs a mark`);
  const name = src.name?.trim() || NAME;
  const inscription = [name, DOMAIN];
  const layer = settings.layer;

  const R = (p.diameter ?? 0) / 2;
  const plate = circle(R);
  const markD = p.diameter - 2 * p.flange;
  const checkSize = (d: number) => {
    if (mark && d < mark.minDiameterMM - 0.5) warnings.push(`At Ø ${Math.round(d)} mm the crest’s finest details fall below a 0.4 mm nozzle’s reach — it prints cleanly from Ø ${mark.minDiameterMM} mm.`);
  };
  let parts: Part[] = [];
  let size: [number, number, number] = [p.diameter, p.diameter, 0];
  let lithophane: Model['lithophane'];
  const heights: [string, number][] = [];
  const placed: BackFeature[] = [];
  let artRings: Ring[] | undefined;

  switch (id) {
    case 'medallion':
    case 'two-colour': {
      checkSize(markD);
      const art = markRings(mark!.d, markD);
      const top = p.base + p.relief;
      const back = backFeatures(p, { kind: 'disc', r: R }, p.base, inscription, warnings, notes, placed);
      const plateL = plateLayers([plate], p.base, back);
      const reliefL: Layer = { rings: art, z0: p.base, z1: top };
      if (id === 'medallion') parts = [part('medallion', [...plateL, reliefL], 'light')];
      else {
        parts = [part('plate', plateL, 'dark'), part('relief', [reliefL], 'light')];
        const n = Math.round(p.base / layer) + 1;
        notes.push(`One printer, two filaments: change filament at layer ${n} (z = ${p.base.toFixed(2)} mm, assuming ${layer} mm layers throughout). Multi-material: load the 3MF and give each part its filament.`);
      }
      size = [p.diameter, p.diameter, top];
      heights.push(['plate', p.base], ['relief', p.relief]);
      notes.push(`Thickest point ${top.toFixed(1)} mm — the desk stand’s slot should match.`);
      break;
    }
    case 'engraved':
    case 'coaster': {
      checkSize(markD);
      const art = markRings(mark!.d, markD);
      const floor = p.thickness - p.depth;
      let back: Cavity[] = [];
      if (id === 'engraved') back = backFeatures(p, { kind: 'disc', r: R }, floor, inscription, warnings, notes, placed);
      else if (p.recess) {
        if (floor - p.recessDepth < 1.2) warnings.push('Less than 1.2 mm would be left between the pad recess and the engraving; the recess was left out.');
        else {
          back = [{ rings: [circle(R - Math.max(3, p.flange))], z0: 0, z1: p.recessDepth }];
          placed.push({ kind: 'recess', diameter: 2 * (R - Math.max(3, p.flange)), depth: p.recessDepth });
          notes.push(`Stick a Ø ${Math.floor(2 * (R - Math.max(3, p.flange)))} × ${p.recessDepth} mm felt or cork pad into the recess.`);
        }
      }
      if (floor < 1.2) warnings.push('Less than 1.2 mm of plate is left under the engraving; it may be fragile.');
      parts = [part(id === 'coaster' ? 'coaster' : 'engraved medallion', [...plateLayers([plate], floor, back), { rings: [plate, ...art.map(rev)], z0: floor, z1: p.thickness }], 'light')];
      size = [p.diameter, p.diameter, p.thickness];
      heights.push(['thickness', p.thickness], ['engraving', p.depth]);
      if (id === 'coaster') notes.push('The top is flat, so glasses stand level. PETG copes better than PLA with a hot mug; neither is for food contact.');
      notes.push('For contrast, wipe dark acrylic paint into the engraving and clean the top face; or print in a speckled “marble” filament.');
      break;
    }
    case 'nameplate': {
      const layout: LockupLayout = p.layout === 1 ? 'vertical' : 'horizontal';
      const parts2 = lockupParts({ id: 'crest-print', d: mark!.d }, { name, caption: p.caption ? (src.caption ?? '') : '', layout });
      // With a QR code, the code (as tall as the crest) stands to the right of the lockup.
      const QR_SIDE = 512;
      const QR_GAP = 72;
      const artW = parts2.width + (p.qr ? QR_GAP + QR_SIDE : 0);
      const artH = parts2.height;
      let k = (p.height - 2 * p.margin) / artH;
      let width = artW * k + 2 * p.margin;
      let height = p.height;
      if (Math.max(width, height) > p.bed) {
        const fit = Math.min((p.bed - 2 * p.margin) / artW, (p.bed - 2 * p.margin) / artH);
        k = Math.min(k, fit);
        width = artW * k + 2 * p.margin;
        height = artH * k + 2 * p.margin;
        warnings.push(`Scaled down to fit a ${p.bed} mm bed (${round1(width)} × ${round1(height)} mm). A vertical layout keeps long names larger.`);
      }
      checkSize(2 * RIM * k);
      const at = { tx: 0, ty: 0 };
      const [ox, oy] = [artW / 2, artH / 2];
      const crest = pathRings(parts2.crest, k, ox, oy, at);
      const text = [...pathRings(parts2.name, k, ox, oy, { ...at, grow: 0.12 }), ...(parts2.caption ? pathRings(parts2.caption, k, ox, oy, { ...at, grow: 0.08 }) : [])];
      let code: Ring[] = [];
      if (p.qr) {
        const url = src.url ?? `https://${DOMAIN}`;
        if (!src.url) warnings.push(`No address is set for this service; the QR code points to https://${DOMAIN}.`);
        const c = qr(url, 'Q');
        const quiet = 2;
        const module = QR_SIDE / (c.size + 2 * quiet);
        code = pathRings(qrPath(c, parts2.width + QR_GAP, (artH - QR_SIDE) / 2, module, quiet), k, ox, oy, at);
        const mm = module * k;
        if (mm < 1) warnings.push(`The QR code’s modules are ${mm.toFixed(2)} mm; phones read printed codes best from 1 mm — make the plate taller.`);
        notes.push(`The QR code opens ${url} (modules ${mm.toFixed(2)} mm). In one colour it scans poorly: change filament at the first layer of the relief, z = ${p.base.toFixed(2)} mm.`);
      }
      if (!isClean(problemsAt(union(text), PRINTER_MM, { topology: true }))) warnings.push(`At this size some lettering falls below a 0.4 mm nozzle’s reach${p.caption ? ' — the caption first; turn it off or make the plate taller' : ' — make the plate taller'}.`);
      const art = cleanRings(strictlySimple(union(crest, text, code)), MESH_TOLERANCE / 4);
      artRings = art;
      const outline = roundedRect(width, height, p.corner);
      const back = backFeatures(p, { kind: 'rect', w: width, h: height }, p.base, inscription.slice(1), warnings, notes, placed);
      parts = [part('nameplate', [...plateLayers([outline], p.base, back), { rings: art, z0: p.base, z1: p.base + p.relief }], 'light')];
      size = [round1(width), round1(height), p.base + p.relief];
      heights.push(['plate', p.base], ['relief', p.relief]);
      break;
    }
    case 'lithophane': {
      const spec: LithophaneSpec = { diameter: p.diameter, frame: p.frame, minThickness: p.minThickness, maxThickness: Math.max(p.maxThickness, p.minThickness + 0.4), resolution: p.resolution, veins: p.veins / 100 };
      const art = markRings(mark!.d, p.diameter - 2 * p.frame - 2);
      checkSize(p.diameter - 2 * p.frame - 2);
      const raster = rasterise(art, p.diameter / 2, 0.1);
      const { mesh, volume } = lithophaneMesh(spec, raster);
      parts = [{ name: 'lithophane', mesh, report: validate(mesh, volume), tone: 'light' }];
      size = [p.diameter, p.diameter, spec.maxThickness];
      lithophane = { spec, raster };
      notes.length = 0;
      notes.push(
        'Print flat on the bed in white (or natural) PLA, with 100 % infill — the light has to pass through solid plastic.',
        'Fine layers (0.12 mm) and 3–4 walls give the smoothest tones; slow outer walls avoid streaks.',
        'Hold it to a window or light it from behind — a warm white LED, or the desk stand in front of a lamp.',
      );
      break;
    }
    case 'token': {
      checkSize(markD);
      const art = markRings(mark!.d, markD);
      const lugR = p.hole / 2 + 3;
      const lugY = R + lugR * 0.55;
      const outline = cleanRings(strictlySimple(difference(union([plate], [circle(lugR, 0, lugY)]), [circle(p.hole / 2, 0, lugY)])));
      parts = [part('token', [{ rings: outline, z0: 0, z1: p.base }, { rings: art, z0: p.base, z1: p.base + p.relief }], 'light')];
      size = [p.diameter, round1(R + lugY + lugR), p.base + p.relief];
      heights.push(['disc', p.base], ['relief', p.relief]);
      notes.push('A tough filament (PETG) wears better on a keyring than PLA.');
      break;
    }
    case 'stand': {
      const slotW = p.slot + p.clearance;
      const R0 = p.diameter / 2;
      const chord = 2 * Math.sqrt(Math.max(0, R0 * R0 - (R0 - p.depth) ** 2));
      const slotL = chord + 4;
      const L = slotL + 24;
      const W = Math.max(28, slotW + 20);
      const base = 3;
      const body = roundedRect(L, W, 5);
      const slot = rev(roundedRect(slotL, slotW, Math.min(slotW / 2 - 0.01, 1)));
      parts = [part('stand', [{ rings: [body], z0: 0, z1: base }, { rings: [body, slot], z0: base, z1: base + p.depth }], 'light')];
      size = [round1(L), round1(W), base + p.depth];
      notes.push(`Slot ${slotW.toFixed(2)} × ${slotL.toFixed(1)} mm, ${p.depth} mm deep. Print a test first: if the piece is loose, lower the clearance; if it will not go in, raise it.`);
      break;
    }
  }
  if (id !== 'lithophane') notes.unshift('Print flat on the bed, design facing up. No supports needed.', `Layers of ${layer} mm: ${heights.length ? 'the heights below are whole numbers of layers unless noted.' : 'any height works.'}`);
  for (const [label, h] of heights) {
    const n = h / layer;
    if (Math.abs(n - Math.round(n)) > 0.01) warnings.push(`The ${label} (${h} mm) is not a whole number of ${layer} mm layers; the slicer will make it ${(Math.max(1, Math.round(n)) * layer).toFixed(2)} mm.`);
  }
  for (const pt of parts) if (!pt.report.ok) warnings.push(`The ${pt.name} mesh failed validation (${pt.report.badEdges} bad edges, ${pt.report.degenerate} degenerate triangles, ${pt.report.overlaps} overlapping layers).`);
  return { product: id, params: p, settings, parts, size: [round1(size[0]), round1(size[1]), round1(size[2])], warnings, notes, lithophane, back: placed, art: artRings };
}

/** Total printed volume (cm³). */
export const modelVolume = (m: Model) => m.parts.reduce((s, pt) => s + pt.report.volume, 0) / 1000;
