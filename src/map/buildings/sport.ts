// Performance and sport: theatres, the stadium, the hippodrome, the gymnasium
// and its wrestling school.

import { LatheGeometry, Vector2, CylinderGeometry } from 'three';
import { box, column, crepidoma, entablature, gable, peristyle, statue, type Builder, type Detail } from './parts.ts';
import { kind, type BuildingType } from './types.ts';

/** A theatre: tiers of seats round more than half a circle, the orchestra, and the stage building behind it. */
function theatre(b: Builder, d: Detail, rows: number, inner: number): void {
  const run = 1.05,
    rise = 0.5;
  const prof = [new Vector2(inner, 0)];
  const steps = d === 'near' ? rows : Math.ceil(rows / 3);
  for (let i = 0; i < steps; i++) {
    const k = rows / steps;
    prof.push(new Vector2(inner + i * run * k, rise * (i + 1) * k));
    prof.push(new Vector2(inner + (i + 1) * run * k, rise * (i + 1) * k));
  }
  const outer = inner + rows * run;
  prof.push(new Vector2(outer, rise * rows + 0.2), new Vector2(outer, 0), new Vector2(inner, 0));
  prof.reverse();
  const cavea = new LatheGeometry(prof, d === 'near' ? 56 : 14, -Math.PI / 2 - 0.25, Math.PI + 0.5);
  cavea.translate(0, 0, 1.5);
  b.add(cavea);
  if (d === 'near')
    for (let k = 0; k < 5; k++) {
      const a = -0.25 + ((k + 0.5) * (Math.PI + 0.5)) / 5 - Math.PI / 2;
      for (let i = 0; i < rows; i++) box(b, 0.5, 0.25, 0.9, Math.sin(a) * (inner + 0.5 + i * run), rise * i, Math.cos(a) * (inner + 0.5 + i * run) + 1.5, a);
    }
  const orchestra = new CylinderGeometry(inner, inner, 0.2, d === 'near' ? 40 : 12);
  orchestra.translate(0, 0.1, 1.5);
  b.add(orchestra);
  const w = inner * 2 + 6;
  const y = crepidoma(b, w, 2.6, 1, 0, 0, -inner + 0.6);
  box(b, w, 4.4, 2.2, 0, y, -inner + 0.4);
  const n = Math.max(4, Math.round(w / 2));
  for (let i = 0; i < n; i++) column(b, -w / 2 + 1 + (i * (w - 2)) / (n - 1), y, -inner + 1.9, 4, 0.28, 'ionic', d);
  entablature(b, w + 0.2, 0.9, 0, y + 4, -inner + 1.9, 'continuous', d);
}

/** A stadium: the long track between two banks, the starting line and the judges' seats. */
function stadium(b: Builder, d: Detail): void {
  const L = 30,
    W = 6;
  box(b, L, 0.15, W, 0, 0, 0);
  for (const s of [-1, 1]) {
    const tiers = d === 'near' ? 5 : 2;
    for (let i = 0; i < tiers; i++) box(b, L, ((i + 1) * 2) / tiers, 4 / tiers, 0, 0, s * (W / 2 + (i * 4) / tiers + 2 / tiers));
  }
  // The rounded end.
  const end = new CylinderGeometry(W / 2 + 4, W / 2 + 4, 2, d === 'near' ? 24 : 8, 1, false, 0, Math.PI);
  end.translate(L / 2, 1, 0);
  b.add(end);
  box(b, 0.4, 0.6, W, -L / 2 + 1, 0, 0);
  if (d === 'near') for (let i = 0; i < 8; i++) box(b, 0.15, 1, 0.15, -L / 2 + 1, 0.6, -W / 2 + 0.4 + i * 0.75);
  box(b, 4, 2.6, 2, 0, 0, -W / 2 - 5);
  for (const x of [-1.5, 0, 1.5]) column(b, x, 2.6, -W / 2 - 4.4, 2.2, 0.16, 'doric', d);
}

/** The turn of a hippodrome: its spine with columns, an obelisk-like post and the turning posts. */
function hippodromeTurn(b: Builder, d: Detail): void {
  box(b, 24, 0.15, 14, 0, 0, 0);
  box(b, 16, 1.2, 1.6, -2, 0, 0);
  for (let i = 0; i < 5; i++) column(b, -9 + i * 3.6, 1.2, 0, 3.4, 0.24, 'corinthian', d);
  for (const x of [6.6, -10.6]) for (let i = 0; i < 3; i++) {
    const g = new CylinderGeometry(0.15, 0.4, 3, d === 'near' ? 12 : 5);
    g.translate(x + (i - 1) * 0.6, 1.5, 0);
    b.add(g);
  }
  // The banks round the turn.
  const bank = new CylinderGeometry(8, 8, 2.2, d === 'near' ? 32 : 10, 1, true, 0, Math.PI);
  bank.translate(8, 1.1, 0);
  b.add(bank);
  for (const s of [-1, 1]) box(b, 16, 2.2, 1.4, -4, 0, s * 7.3);
}

/** A gymnasium: a large court ringed by colonnades, a running track inside. */
function gymnasium(b: Builder, d: Detail): void {
  box(b, 22, 0.4, 16, 0, 0, 0);
  peristyle(b, 21, 15, 0.4, 0, 0, 4, 0.26, 2.6, 'doric', d);
  for (const z of [-7.8, 7.8]) box(b, 21.6, 0.3, 1.2, 0, 4.4, z);
  for (const x of [-10.8, 10.8]) box(b, 1.2, 0.3, 15.6, x, 4.4, 0);
  box(b, 21, 4.4, 0.6, 0, 0.4, -8.4);
  box(b, 16, 0.12, 2, 0, 0.4, 2);
}

/** A palaestra: the wrestling school — a square court, rooms round it, its sand floor. */
function palaestra(b: Builder, d: Detail): void {
  box(b, 15, 0.4, 15, 0, 0, 0);
  peristyle(b, 10, 10, 0.4, 0, 0, 3.8, 0.24, 2.5, 'doric', d);
  for (const [w, dd, x, z] of [[15, 2.4, 0, -6.3], [15, 2.4, 0, 6.3], [2.4, 10.2, -6.3, 0], [2.4, 10.2, 6.3, 0]] as const) box(b, w, 4.2, dd, x, 0.4, z);
  box(b, 8.6, 0.1, 8.6, 0, 0.4, 0);
  statue(b, 0, 0.5, 0, 2);
  for (const z of [-6.3, 6.3]) gable(b, 2.4, 15, 0, 4.6, z, 0.3, 'x', d);
}

/** A xystus: a covered running track — a long roofed colonnade with a lane inside. */
function xystus(b: Builder, d: Detail): void {
  const y = crepidoma(b, 26, 5, 1, 0, 0, 0);
  for (let i = 0; i < 14; i++) for (const z of [-2.2, 2.2]) column(b, -12.5 + i * (25 / 13), y, z, 4.4, 0.26, 'doric', d);
  box(b, 25, 0.1, 2.4, 0, y, 0);
  const t = entablature(b, 26, 5, 0, y + 4.4, 0, 'triglyph', d);
  gable(b, 5, 26, 0, t, 0, 0.25, 'x', d);
}

export const SPORT: BuildingType[] = [
  kind('theatre', 'Theatre', 'sport', 'service', ['media', 'community'], 16.5, (b, d) => theatre(b, d, 10, 4)),
  kind('theatre-small', 'Small theatre', 'sport', 'service', ['media', 'sandbox'], 11, (b, d) => theatre(b, d, 6, 3)),
  kind('stadium', 'Stadium', 'sport', 'service', ['gaming', 'competitive'], 22.5, stadium),
  kind('hippodrome-turn', 'Hippodrome', 'sport', 'service', ['gaming', 'competitive'], 17, hippodromeTurn),
  kind('gymnasium', 'Gymnasium', 'sport', 'service', ['gaming', 'sandbox'], 14, gymnasium),
  kind('palaestra', 'Wrestling school', 'sport', 'service', ['competitive', 'gaming'], 11, palaestra),
  kind('xystus', 'Covered track', 'sport', 'service', ['gaming', 'monitoring'], 14, xystus),
];
