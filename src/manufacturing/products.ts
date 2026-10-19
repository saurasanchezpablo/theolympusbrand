// Printable objects made from the print editions. Every product is a stack of
// flat layers (see mesh.ts), laid out to print flat on the bed, design up, with
// no supports. Dimensions are millimetres; the mark's 504-unit rim is scaled
// to the plate.

import { RIM, C, type Ring, signedArea } from '../geometry/math.ts';
import { flatten, strictlySimple, union, difference, noSpecks, offset } from '../geometry/poly.ts';
import { cleanRings, stack, validate, type Layer, type Mesh, type MeshReport } from './mesh.ts';

export type ProductId = 'medallion' | 'engraved' | 'two-colour' | 'token' | 'stand';

export type ParamKey = 'diameter' | 'flange' | 'base' | 'relief' | 'thickness' | 'depth' | 'magnets' | 'magnetDiameter' | 'magnetDepth' | 'hole' | 'slot' | 'clearance';
export type Params = Partial<Record<ParamKey, number>>;
export type ParamSpec = { key: ParamKey; label: string; unit: string; min: number; max: number; step: number; value: number; hint: string };

export type Product = {
  id: ProductId;
  name: string;
  summary: string;
  /** Which print-edition mark it carries. */
  mark: 'crest' | 'seal' | null;
  params: ParamSpec[];
};

const P = (key: ParamKey, label: string, unit: string, min: number, max: number, step: number, value: number, hint: string): ParamSpec => ({ key, label, unit, min, max, step, value, hint });

const MAGNETS = [
  P('magnets', 'Magnet pockets', '', 0, 4, 1, 0, 'Round pockets in the back for disc magnets: hangs on a rack door, a fridge, a steel panel. Glue the magnets in after printing.'),
  P('magnetDiameter', 'Magnet diameter', 'mm', 3, 20, 0.1, 10.2, 'Pocket diameter: the magnet plus about 0.2 mm.'),
  P('magnetDepth', 'Magnet depth', 'mm', 1, 6, 0.1, 2.2, 'Pocket depth: the magnet’s thickness plus about 0.2 mm.'),
];

export const PRODUCTS: Record<ProductId, Product> = {
  medallion: {
    id: 'medallion',
    name: 'Medallion',
    summary: 'The crest raised on a round backing plate — a wall or desk piece, a rack badge with magnets.',
    mark: 'crest',
    params: [
      P('diameter', 'Diameter', 'mm', 40, 300, 1, 100, 'Outer diameter of the plate.'),
      P('flange', 'Flange', 'mm', 0.6, 6, 0.1, 1.2, 'Plate left around the crest’s rim.'),
      P('base', 'Plate thickness', 'mm', 1.6, 10, 0.1, 3, 'A multiple of your layer height keeps the relief crisp.'),
      P('relief', 'Relief height', 'mm', 0.4, 4, 0.1, 1.2, 'How far the design stands proud of the plate.'),
      ...MAGNETS,
    ],
  },
  engraved: {
    id: 'engraved',
    name: 'Engraved medallion',
    summary: 'The crest cut into a solid plate — quiet, stone-like, best in one light filament.',
    mark: 'crest',
    params: [
      P('diameter', 'Diameter', 'mm', 40, 300, 1, 100, 'Outer diameter of the plate.'),
      P('flange', 'Flange', 'mm', 0.8, 8, 0.1, 2, 'Solid border left around the crest’s rim.'),
      P('thickness', 'Plate thickness', 'mm', 2.4, 12, 0.1, 4, 'Total thickness.'),
      P('depth', 'Engraving depth', 'mm', 0.4, 4, 0.1, 1, 'How deep the design is cut.'),
      ...MAGNETS,
    ],
  },
  'two-colour': {
    id: 'two-colour',
    name: 'Two-colour medallion',
    summary: 'Plate and relief as separate parts — for a filament change at the relief, or a multi-material printer.',
    mark: 'crest',
    params: [
      P('diameter', 'Diameter', 'mm', 40, 300, 1, 100, 'Outer diameter of the plate.'),
      P('flange', 'Flange', 'mm', 0.6, 6, 0.1, 1.2, 'Plate left around the crest’s rim.'),
      P('base', 'Plate thickness', 'mm', 1.6, 10, 0.1, 3, 'The colour changes at this height.'),
      P('relief', 'Relief height', 'mm', 0.4, 4, 0.1, 1.2, 'Height of the second colour.'),
      ...MAGNETS,
    ],
  },
  token: {
    id: 'token',
    name: 'Token',
    summary: 'The seal raised on a small disc with a keyring lug — a key fob, a bag tag, a cable tag.',
    mark: 'seal',
    params: [
      P('diameter', 'Diameter', 'mm', 20, 80, 1, 40, 'Diameter of the disc (the lug adds to the height).'),
      P('flange', 'Flange', 'mm', 0.6, 4, 0.1, 1.2, 'Plate left around the seal’s ring.'),
      P('base', 'Disc thickness', 'mm', 1.2, 6, 0.1, 2.4, 'Thickness of the disc and lug.'),
      P('relief', 'Relief height', 'mm', 0.4, 3, 0.1, 1, 'How far the seal stands proud.'),
      P('hole', 'Keyring hole', 'mm', 2.5, 8, 0.1, 4.5, 'Diameter of the hole in the lug.'),
    ],
  },
  stand: {
    id: 'stand',
    name: 'Desk stand',
    summary: 'A slotted foot that holds a medallion upright on a desk or shelf.',
    mark: null,
    params: [
      P('diameter', 'Medallion diameter', 'mm', 40, 300, 1, 100, 'The medallion it holds.'),
      P('slot', 'Medallion thickness', 'mm', 1.6, 16, 0.1, 4.2, 'Its thickest point: plate plus relief.'),
      P('clearance', 'Clearance', 'mm', 0, 1, 0.05, 0.3, 'Added to the slot width; tune it to your printer.'),
      P('depth', 'Slot depth', 'mm', 4, 30, 0.5, 10, 'How much of the medallion sits in the foot.'),
    ],
  },
};

export const defaults = (id: ProductId): Required<Params> =>
  Object.fromEntries(PRODUCTS[id].params.map((p) => [p.key, p.value])) as Required<Params>;

/**
 * Defaults for a product carrying a mark: the diameter is raised, if needed,
 * to the smallest size at which the mark prints cleanly.
 */
export function suggestedParams(id: ProductId, minDiameterMM?: number): Required<Params> {
  const p = defaults(id);
  if (minDiameterMM && PRODUCTS[id].mark) p.diameter = Math.max(p.diameter, Math.ceil(minDiameterMM + 2 * p.flange));
  return p;
}

/** Values clamped to each parameter's range. */
export function clampParams(id: ProductId, params: Params): Required<Params> {
  const out = { ...defaults(id) } as Required<Params>;
  for (const p of PRODUCTS[id].params) {
    const v = params[p.key];
    if (typeof v === 'number' && Number.isFinite(v)) out[p.key] = Math.min(p.max, Math.max(p.min, v));
  }
  return out;
}

/* ---------------------------------------------------------------- */
/* Geometry helpers (millimetres, y up, solids anticlockwise)         */
/* ---------------------------------------------------------------- */

const SEGMENTS_PER_MM = 1.2;

export function circle(r: number, cx = 0, cy = 0, n = Math.max(32, Math.ceil(2 * Math.PI * r * SEGMENTS_PER_MM))): Ring {
  return Array.from({ length: n }, (_, i): [number, number] => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
}

const rev = (r: Ring): Ring => [...r].reverse();

function roundedRect(w: number, h: number, r: number, cx = 0, cy = 0): Ring {
  const pts: Ring = [];
  const corners: [number, number, number][] = [
    [cx + w / 2 - r, cy - h / 2 + r, -90],
    [cx + w / 2 - r, cy + h / 2 - r, 0],
    [cx - w / 2 + r, cy + h / 2 - r, 90],
    [cx - w / 2 + r, cy - h / 2 + r, 180],
  ];
  for (const [x, y, a0] of corners) {
    for (let i = 0; i <= 8; i++) {
      const a = ((a0 + (90 * i) / 8) * Math.PI) / 180;
      pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
    }
  }
  return pts;
}

/**
 * A print-edition mark (artboard path data) as millimetre rings: strictly
 * simple, y flipped, centred, its rim scaled to `diameter`.
 */
/** Geometry finer than this (mm) is cleaned away before meshing. */
export const MESH_TOLERANCE = 0.02;

export function markRings(d: string, diameter: number): Ring[] {
  const k = diameter / (2 * RIM);
  // Into millimetres first, so the polygon booleans run on the same 0.001 mm
  // grid the mesh uses. Then the mark is shrunk by 0.01 mm — fifty times finer
  // than anything a nozzle prints — so no two of its parts touch, not even at
  // a corner: as holes in the plate's face, touching parts would leave
  // zero-area triangles and non-manifold edges.
  const mm = noSpecks(union(flatten(d)), 0.5).map((r) => r.map(([x, y]): [number, number] => [(x - C) * k, (C - y) * k]));
  return cleanRings(strictlySimple(offset(mm, -MESH_TOLERANCE / 2)), MESH_TOLERANCE / 4);
}

function magnetPockets(n: number, plateR: number, d: number): Ring[] {
  if (n <= 0) return [];
  if (n === 1) return [circle(d / 2)];
  const rr = plateR * 0.45;
  return Array.from({ length: n }, (_, i) => {
    const a = Math.PI / 2 + (2 * Math.PI * i) / n + (n === 2 ? Math.PI / 2 : 0);
    return circle(d / 2, rr * Math.cos(a), rr * Math.sin(a));
  });
}

/* ---------------------------------------------------------------- */
/* Models                                                             */
/* ---------------------------------------------------------------- */

export type Part = { name: string; mesh: Mesh; report: MeshReport; tone: 'light' | 'dark' };
export type Model = {
  product: ProductId;
  params: Required<Params>;
  parts: Part[];
  /** Overall size of the printed object (mm). */
  size: [number, number, number];
  warnings: string[];
  notes: string[];
};

const part = (name: string, layers: Layer[], tone: 'light' | 'dark'): Part => {
  const mesh = stack(layers);
  return { name, mesh, report: validate(mesh, layers), tone };
};

/**
 * Build a product. `mark` is the print-edition path data it carries;
 * `minDiameterMM` the smallest size that mark prints at on the house printer.
 */
export function buildModel(id: ProductId, input: Params, mark?: { d: string; minDiameterMM: number }): Model {
  const p = clampParams(id, input);
  const warnings: string[] = [];
  const notes: string[] = [
    'Print flat on the bed, design facing up. No supports needed.',
    'Layer height 0.2 mm or finer; heights that are multiples of it come out exact.',
  ];
  const needsMark = PRODUCTS[id].mark !== null;
  if (needsMark && !mark) throw new Error(`${id}: needs a mark`);
  const markD = id === 'engraved' ? p.diameter - 2 * p.flange : p.diameter - 2 * p.flange;
  if (mark && markD < mark.minDiameterMM) warnings.push(`At Ø ${Math.round(markD)} mm the finest details fall below a 0.4 mm nozzle’s reach — ${Math.ceil(mark.minDiameterMM + 2 * p.flange)} mm or more prints cleanly.`);

  const R = p.diameter / 2;
  const plate = circle(R);
  const pocketsFit = (thickness: number) => {
    if (!p.magnets) return [] as Ring[];
    // At least 0.8 mm (four 0.2 mm layers) must bridge over a pocket.
    if (p.magnetDepth > thickness - 0.8) {
      warnings.push(`The magnet pockets are deeper than the plate allows (at most ${(thickness - 0.8).toFixed(1)} mm); they were left out.`);
      return [];
    }
    if (p.magnetDiameter > R * 0.5) {
      warnings.push('The magnets are too wide for this plate; they were left out.');
      return [];
    }
    notes.push(`Glue ${p.magnets} disc magnet${p.magnets > 1 ? 's' : ''} (Ø ${(p.magnetDiameter - 0.2).toFixed(1)} × ${(p.magnetDepth - 0.2).toFixed(1)} mm) into the pockets after printing; the pockets open on the bed side and bridge cleanly.`);
    return magnetPockets(p.magnets, R, p.magnetDiameter);
  };
  // The plate, with its magnet pockets open at the bottom.
  const plateLayers = (top: number, pockets: Ring[]): Layer[] =>
    pockets.length ? [{ rings: [plate, ...pockets.map(rev)], z0: 0, z1: p.magnetDepth }, { rings: [plate], z0: p.magnetDepth, z1: top }] : [{ rings: [plate], z0: 0, z1: top }];

  let parts: Part[];
  let height: number;
  let width = p.diameter;
  let depthY = p.diameter;

  switch (id) {
    case 'medallion':
    case 'two-colour': {
      const art = markRings(mark!.d, markD);
      const top = p.base + p.relief;
      const pockets = pocketsFit(p.base);
      if (id === 'medallion') parts = [part('medallion', [...plateLayers(p.base, pockets), { rings: art, z0: p.base, z1: top }], 'light')];
      else {
        parts = [part('plate', plateLayers(p.base, pockets), 'dark'), part('relief', [{ rings: art, z0: p.base, z1: top }], 'light')];
        notes.push(`One printer, two filaments: change filament at ${p.base.toFixed(2)} mm (the first layer of the relief). Multi-material: load the 3MF and give each part its filament.`);
      }
      height = top;
      notes.push(`Thickest point ${top.toFixed(1)} mm — the desk stand’s slot should match.`);
      break;
    }
    case 'engraved': {
      const art = markRings(mark!.d, markD);
      const floor = p.thickness - p.depth;
      if (floor < 1.2) warnings.push('Less than 1.2 mm of plate is left under the engraving; it may be fragile.');
      const pockets = pocketsFit(floor);
      parts = [part('engraved medallion', [...plateLayers(floor, pockets), { rings: [plate, ...art.map(rev)], z0: floor, z1: p.thickness }], 'light')];
      height = p.thickness;
      notes.push('For contrast, wipe dark acrylic paint into the engraving and clean the top face; or print in a speckled “marble” filament.');
      break;
    }
    case 'token': {
      const art = markRings(mark!.d, markD);
      const lugR = p.hole / 2 + 3;
      const lugY = R + lugR * 0.55;
      const outline = cleanRings(strictlySimple(difference(union([plate], [circle(lugR, 0, lugY)]), [circle(p.hole / 2, 0, lugY)])));
      parts = [part('token', [{ rings: outline, z0: 0, z1: p.base }, { rings: art, z0: p.base, z1: p.base + p.relief }], 'light')];
      height = p.base + p.relief;
      depthY = p.diameter / 2 + lugY + lugR;
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
      height = base + p.depth;
      width = L;
      depthY = W;
      notes.push(`Slot ${slotW.toFixed(2)} × ${slotL.toFixed(1)} mm, ${p.depth} mm deep. Print a test first: if the medallion is loose, lower the clearance; if it will not go in, raise it.`);
      break;
    }
  }
  for (const pt of parts!) if (!pt.report.ok) warnings.push(`The ${pt.name} mesh failed validation (${pt.report.badEdges} bad edges, ${pt.report.degenerate} degenerate triangles, ${pt.report.overlaps} overlapping layers).`);
  return { product: id, params: p, parts: parts!, size: [round1(width), round1(depthY), round1(height!)], warnings, notes };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Total printed volume (cm³) — for filament estimates. */
export const modelVolume = (m: Model) => m.parts.reduce((s, pt) => s + pt.report.volume, 0) / 1000;

/** Signed area helper, re-exported for tests. */
export const ringArea = signedArea;
