// Temples: the house's sacred buildings, in the three orders and their plans —
// peripteral, prostyle, in antis, dipteral, on a podium, round.

import { box, column, crepidoma, cylinder, dome, entablature, gable, peristyle, statue, type Builder, type Detail, type Order } from './parts.ts';
import { kind, type BuildingType } from './types.ts';

type Temple = {
  w: number; // the stylobate's width (the columns' outer line)
  d: number;
  steps?: number;
  h?: number; // column height
  r?: number; // column radius
  order: Order;
  /** Which columns: all round, one row or two all round, only at the front (and back), or between the walls' ends. */
  plan: 'peripteral' | 'dipteral' | 'prostyle' | 'amphiprostyle' | 'antis' | 'double-antis' | 'pseudo';
  front?: number; // columns across the front, for the prostyle plans
  podium?: number; // a high podium with a stair, instead of steps all round
};

function temple(b: Builder, t: Temple, detail: Detail): void {
  const h = t.h ?? 6,
    r = t.r ?? 0.42,
    order = t.order;
  const frieze = order === 'doric' ? 'triglyph' : 'continuous';
  let y: number;
  if (t.podium) {
    box(b, t.w + 1.2, t.podium, t.d + 1.2, 0, 0, -0.8);
    // The stair up the front.
    for (let i = 0; i < Math.round(t.podium / 0.3); i++) box(b, t.w * 0.7, t.podium - i * 0.3, 0.45, 0, 0, t.d / 2 - 0.2 + i * 0.45);
    y = t.podium;
  } else y = crepidoma(b, t.w, t.d, t.steps ?? 3, 0, 0, 0);
  const cellaW = t.w - (t.plan === 'dipteral' ? 4.4 : 2.6);
  const spacing = (t.w - 0.5) / Math.max(1, (t.front ?? Math.round(t.w / 2)) - 1);
  switch (t.plan) {
    case 'peripteral':
      peristyle(b, t.w, t.d, y, 0, 0, h, r, spacing, order, detail);
      box(b, cellaW, h * 0.86, t.d - 3.2, 0, y, 0);
      break;
    case 'dipteral':
      peristyle(b, t.w, t.d, y, 0, 0, h, r, spacing, order, detail);
      peristyle(b, t.w - 2.2, t.d - 2.2, y, 0, 0, h, r, spacing, order, detail);
      box(b, cellaW, h * 0.86, t.d - 5.4, 0, y, 0);
      break;
    case 'pseudo':
      // Engaged columns: half-columns set into the cella's walls, a free porch in front.
      box(b, t.w - 0.6, h * 0.9, t.d - 3, 0, y, -1.2);
      for (let i = 0; i < (t.front ?? 6); i++) column(b, -t.w / 2 + 0.25 + (i * (t.w - 0.5)) / ((t.front ?? 6) - 1), y, t.d / 2 - 0.4, h, r, order, detail);
      for (let j = 1; j < 5; j++) for (const s of [-1, 1]) column(b, s * (t.w / 2 - 0.3), y, -t.d / 2 + 0.6 + j * ((t.d - 3.6) / 5), h, r * 0.9, order, detail);
      break;
    default: {
      const front = t.front ?? 4;
      const ends = t.plan === 'amphiprostyle' ? [1, -1] : [1];
      const antis = t.plan === 'antis' || t.plan === 'double-antis';
      const cols = antis ? 2 : front;
      const span = antis ? t.w * 0.36 : t.w - 0.5;
      box(b, t.w - 1, h * 0.92, t.d - (t.plan === 'amphiprostyle' ? 5 : 2.8), 0, y, t.plan === 'amphiprostyle' ? 0 : -1.1);
      for (const end of t.plan === 'double-antis' ? [1, -1] : ends) {
        for (let i = 0; i < cols; i++) column(b, -span / 2 + (i * span) / Math.max(1, cols - 1), y, end * (t.d / 2 - 0.4), h, r, order, detail);
        if (antis) for (const s of [-1, 1]) box(b, 0.9, h, 2.6, s * (t.w / 2 - 0.95), y, end * (t.d / 2 - 1.3));
      }
    }
  }
  const top = entablature(b, t.w + 0.6, t.d + 0.6, 0, y + h, t.podium ? -0.2 : 0, frieze, detail);
  gable(b, t.w + 0.6, t.d + 0.6, 0, top, t.podium ? -0.2 : 0, 0.24, 'z', detail);
}

function tholos(b: Builder, detail: Detail, open: boolean, order: Order): void {
  for (let i = 0; i < 3; i++) cylinder(b, 6.4 - i * 0.5, 6.4 - i * 0.5, 0.32, 0, i * 0.32, 0, detail === 'near' ? 48 : 16);
  const y = 0.96,
    n = detail === 'near' ? 16 : 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    column(b, Math.cos(a) * 5.3, y, Math.sin(a) * 5.3, 5.4, 0.34, order, detail);
  }
  if (!open) cylinder(b, 3.6, 3.6, 5.2, 0, y, 0, detail === 'near' ? 40 : 12);
  else statue(b, 0, y, 0, 3.2);
  cylinder(b, 6, 6, 0.6, 0, y + 5.4, 0, detail === 'near' ? 48 : 16);
  cylinder(b, 6.3, 6.3, 0.3, 0, y + 6.0, 0, detail === 'near' ? 48 : 16);
  if (open) cylinder(b, 6.3, 6.3, 0.2, 0, y + 6.3, 0, 16);
  else dome(b, 5.6, y + 6.3, 16, detail, 0.5);
  if (!open) cylinder(b, 0.15, 0.5, 1.4, 0, y + 9.0, 0, 8);
}

/** The Erechtheion's porch: maidens for columns, on a high base. */
function caryatidTemple(b: Builder, detail: Detail): void {
  const y = crepidoma(b, 9, 13, 3, 0, 0, 0);
  box(b, 8, 5.2, 11, 0, y, -0.6);
  for (let i = 0; i < 6; i++) column(b, -3.5 + i * 1.4, y, 6.1, 5.6, 0.36, 'ionic', detail);
  const t = entablature(b, 9.6, 13.6, 0, y + 5.6, 0, 'continuous', detail);
  gable(b, 9.6, 13.6, 0, t, 0, 0.22, 'z', detail);
  // The porch of the maidens on the side.
  box(b, 4.6, 2, 3.4, 5.6, 0, -2.5);
  for (const [x, z] of [[4, -1.3], [5.5, -1.3], [7, -1.3], [4, -3.4], [7, -3.4], [5.5, -3.4]]) statue(b, x, 2, z, 2.6);
  box(b, 4.8, 0.5, 3.6, 5.6, 4.6, -2.4);
}

export const TEMPLES: BuildingType[] = [
  kind('temple-doric', 'Doric temple', 'temples', 'service', ['virtualization', 'cloud', 'other'], 12, (b, d) => temple(b, { w: 10, d: 16, order: 'doric', plan: 'peripteral', front: 6 }, d)),
  kind('temple-ionic', 'Ionic temple', 'temples', 'service', ['cloud', 'home', 'web'], 12, (b, d) => temple(b, { w: 10, d: 16, order: 'ionic', plan: 'peripteral', front: 6, h: 6.4, r: 0.38 }, d)),
  kind('temple-corinthian', 'Corinthian temple', 'temples', 'service', ['web', 'cloud', 'media'], 12, (b, d) => temple(b, { w: 10, d: 16, order: 'corinthian', plan: 'peripteral', front: 6, h: 6.8, r: 0.36 }, d)),
  kind('temple-octastyle', 'Great temple', 'temples', 'service', ['virtualization', 'cloud'], 16.5, (b, d) => temple(b, { w: 15, d: 24, order: 'doric', plan: 'peripteral', front: 8, h: 7.5, r: 0.5 }, d)),
  kind('temple-dipteral', 'Temple with a double colonnade', 'temples', 'service', ['virtualization', 'storage'], 14.5, (b, d) => temple(b, { w: 13, d: 20, order: 'doric', plan: 'dipteral', front: 6, h: 7, r: 0.42 }, d)),
  kind('temple-hexastyle', 'Temple with a porch of six', 'temples', 'service', ['web', 'proxy', 'other'], 10.5, (b, d) => temple(b, { w: 9, d: 13, order: 'doric', plan: 'prostyle', front: 6 }, d)),
  kind('temple-tetrastyle', 'Temple with a porch of four', 'temples', 'service', ['web', 'home', 'other'], 8.5, (b, d) => temple(b, { w: 7, d: 10, order: 'ionic', plan: 'prostyle', front: 4, h: 5.2, r: 0.32 }, d)),
  kind('temple-amphiprostyle', 'Temple with two porches', 'temples', 'service', ['networking', 'proxy'], 9.5, (b, d) => temple(b, { w: 7, d: 12, order: 'ionic', plan: 'amphiprostyle', front: 4, h: 5.2, r: 0.32 }, d)),
  kind('temple-in-antis', 'Temple in antis', 'temples', 'service', ['sandbox', 'other'], 8, (b, d) => temple(b, { w: 6.4, d: 8.6, order: 'doric', plan: 'antis', h: 4.8, r: 0.34 }, d)),
  kind('temple-double-antis', 'Temple with two porches in antis', 'temples', 'service', ['backup', 'storage'], 8.5, (b, d) => temple(b, { w: 6.4, d: 11, order: 'doric', plan: 'double-antis', h: 4.8, r: 0.34 }, d)),
  kind('temple-podium', 'Temple on a podium', 'temples', 'service', ['web', 'proxy', 'cloud'], 11, (b, d) => temple(b, { w: 8, d: 14, order: 'corinthian', plan: 'prostyle', front: 6, podium: 2.4, h: 6.4, r: 0.34 }, d)),
  kind('temple-pseudoperipteral', 'Temple with engaged columns', 'temples', 'service', ['containers', 'other'], 10.5, (b, d) => temple(b, { w: 8, d: 14, order: 'ionic', plan: 'pseudo', front: 6, h: 5.6, r: 0.34 }, d)),
  kind('tholos', 'Tholos', 'temples', 'service', ['home', 'monitoring', 'other'], 7, (b, d) => tholos(b, d, false, 'doric')),
  kind('monopteros', 'Monopteros', 'temples', 'service', ['sandbox', 'community'], 7, (b, d) => tholos(b, d, true, 'corinthian')),
  kind('temple-caryatids', 'Temple of the maidens', 'temples', 'service', ['community', 'home'], 10.5, caryatidTemple),
];
