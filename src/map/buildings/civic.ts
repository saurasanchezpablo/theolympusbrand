// The city's public buildings: colonnades, halls of council and assembly,
// libraries, archives, markets, fountains and baths.

import { CylinderGeometry, ExtrudeGeometry, Shape } from 'three';
import { box, column, crepidoma, cylinder, dome, entablature, gable, type Builder, type Detail } from './parts.ts';
import { kind, type BuildingType } from './types.ts';

/** A lean-to roof over a w-long, d-deep colonnade, high at the back. */
function leanTo(b: Builder, w: number, d: number, x: number, y: number, z: number): void {
  const s = new Shape();
  s.moveTo(-d / 2 - 0.3, 0);
  s.lineTo(d / 2 + 0.3, 0);
  s.lineTo(-d / 2 - 0.3, d * 0.3);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: w + 0.4, bevelEnabled: false });
  g.translate(0, 0, -(w + 0.4) / 2);
  g.rotateY(-Math.PI / 2);
  g.translate(x, y, z);
  b.add(g);
}

/** A stoa: a long colonnade before a back wall; two storeys, or an L of two wings. */
function stoa(b: Builder, d: Detail, storeys: 1 | 2): void {
  const y = crepidoma(b, 22, 6, 2, 0, 0, 0);
  const h = 5;
  for (let s = 0; s < storeys; s++) {
    const yy = y + s * (h + 1.45);
    for (let i = 0; i < 12; i++) column(b, -10.5 + i * (21 / 11), yy, 2.6, h, s ? 0.28 : 0.34, s ? 'ionic' : 'doric', d);
    box(b, 22, h, 0.6, 0, yy, -2.6);
    box(b, 0.6, h, 5.2, -10.8, yy, 0);
    box(b, 0.6, h, 5.2, 10.8, yy, 0);
    entablature(b, 22.2, 5.8, 0, yy + h, 0, s ? 'continuous' : 'triglyph', d);
  }
  leanTo(b, 22.2, 5.8, 0, y + storeys * (h + 1.45), 0);
}

function stoaL(b: Builder, d: Detail): void {
  // Two wings meeting at a corner, facing a square.
  for (const [w, x, z, ry] of [[16, -1, -5, 0], [12, 6, 2, Math.PI / 2]] as const) {
    const c = Math.cos(ry),
      sn = Math.sin(ry);
    const at = (lx: number, lz: number) => [x + lx * c + lz * sn, z - lx * sn + lz * c] as const;
    const yy = 0.6;
    box(b, ry ? 6.6 : w + 0.6, 0.6, ry ? w + 0.6 : 6.6, x, 0, z);
    for (let i = 0; i < Math.round(w / 2); i++) {
      const [cx, cz] = at(-w / 2 + 0.6 + (i * (w - 1.2)) / (Math.round(w / 2) - 1), 2.6);
      column(b, cx, yy, cz, 4.6, 0.32, 'doric', d);
    }
    const [bx, bz] = at(0, -2.6);
    box(b, ry ? 0.6 : w, 4.6, ry ? w : 0.6, bx, yy, bz);
    entablature(b, ry ? 5.8 : w + 0.2, ry ? w + 0.2 : 5.8, x, yy + 4.6, z, 'triglyph', d);
    const s = new Shape();
    s.moveTo(-3.2, 0);
    s.lineTo(3.2, 0);
    s.lineTo(-3.2, 1.7);
    s.closePath();
    const roof = new ExtrudeGeometry(s, { depth: w + 0.4, bevelEnabled: false });
    roof.translate(0, 0, -(w + 0.4) / 2);
    roof.rotateY(-Math.PI / 2 + ry);
    roof.translate(x, yy + 6.05, z);
    b.add(roof);
  }
}

/** A bouleuterion: a square council hall with stepped seats inside, columns on its porch. */
function bouleuterion(b: Builder, d: Detail): void {
  const y = crepidoma(b, 14, 14, 2, 0, 0, 0);
  box(b, 14, 6, 11, 0, y, -1.5);
  for (let i = 0; i < 6; i++) column(b, -6.25 + i * 2.5, y, 6.4, 6, 0.36, 'doric', d);
  const t = entablature(b, 14.4, 14.4, 0, y + 6, 0, 'triglyph', d);
  gable(b, 14.4, 14.4, 0, t, 0, 0.18, 'z', d);
}

/** An ekklesiasterion: an open stepped assembly, a speaker's platform at its foot. */
function ekklesiasterion(b: Builder, d: Detail): void {
  const n = d === 'near' ? 8 : 3;
  for (let i = 0; i < n; i++) {
    const r = 4 + (i * 8) / n;
    const step = new CylinderGeometry(r + 8 / n, r + 8 / n, (i + 1) * 0.45 * (8 / n), d === 'near' ? 40 : 12, 1, false, Math.PI / 2 + 0.3, Math.PI - 0.6);
    step.translate(0, ((i + 1) * 0.45 * (8 / n)) / 2, 0);
    b.add(step);
  }
  box(b, 4, 1, 2.4, 0, 0, -3);
  if (d === 'near') for (let i = 0; i < 5; i++) column(b, -4 + i * 2, 0, -5.4, 3, 0.2, 'ionic', d);
}

/** A prytaneion: the town's hearth hall — a court with a round hearth house. */
function prytaneion(b: Builder, d: Detail): void {
  const y = crepidoma(b, 13, 11, 1, 0, 0, 0);
  for (const [w, dd, x, z] of [[13, 0.6, 0, -5.2], [0.6, 11, -6.2, 0], [0.6, 11, 6.2, 0]] as const) box(b, w, 4.4, dd, x, y, z);
  box(b, 13, 4.4, 3, 0, y, -3.6);
  for (let i = 0; i < 5; i++) column(b, -4 + i * 2, y, 4.6, 4.4, 0.3, 'doric', d);
  entablature(b, 13.2, 11.2, 0, y + 4.4, 0, 'triglyph', d);
  cylinder(b, 2.2, 2.2, 3.6, 0, y, 0.8, d === 'near' ? 32 : 10);
  dome(b, 2.3, y + 3.6, 8, d, 0.7);
}

/** An odeon: a roofed music hall, square, with a low dome over its middle. */
function odeon(b: Builder, d: Detail): void {
  const y = crepidoma(b, 14, 12, 2, 0, 0, 0);
  box(b, 14, 6, 12, 0, y, 0);
  if (d === 'near') for (let i = 0; i < 6; i++) box(b, 0.7, 6, 0.4, -6 + i * 2.4, y, 6.05);
  const t = entablature(b, 14.2, 12.2, 0, y + 6, 0, 'triglyph', d);
  cylinder(b, 4.2, 4.2, 1.6, 0, t, 0, 8);
  dome(b, 4.2, t + 1.6, 12, d, 0.62);
}

/** A library: a hall behind a two-storey facade of columns, statues in its niches. */
function library(b: Builder, d: Detail): void {
  const y = crepidoma(b, 14, 10, 3, 0, 0, 0);
  box(b, 14, 9, 9, 0, y, -0.6);
  for (const s of [0, 1]) for (let i = 0; i < 4; i++) {
    const x = -5.4 + i * 3.6;
    column(b, x, y + s * 4.6, 4.4, 4.2, 0.3, s ? 'corinthian' : 'ionic', d);
  }
  box(b, 14.2, 0.4, 1.4, 0, y + 4.2, 4.2);
  const t = entablature(b, 14.4, 10.4, 0, y + 9, 0, 'continuous', d);
  gable(b, 10.4, 14.4, 0, t, 0, 0.22, 'x', d);
}

/** An archive: a plain strong hall with small windows high up and a single door. */
function archive(b: Builder, d: Detail): void {
  const y = crepidoma(b, 12, 8, 2, 0, 0, 0);
  box(b, 12, 5.4, 8, 0, y, 0);
  if (d === 'near') for (let i = 0; i < 6; i++) box(b, 0.6, 0.6, 0.1, -5 + i * 2, y + 4.2, 4.02);
  box(b, 1.6, 3, 0.2, 0, y, 4.05);
  const t = entablature(b, 12.2, 8.2, 0, y + 5.4, 0, 'triglyph', d);
  gable(b, 8.2, 12.2, 0, t, 0, 0.26, 'x', d);
}

/** A mint: a walled yard with a furnace chimney and a pillared office. */
function mint(b: Builder, d: Detail): void {
  for (const [w, dd, x, z] of [[12, 0.5, 0, -5], [12, 0.5, 0, 5], [0.5, 10, -6, 0], [0.5, 10, 6, 0]] as const) box(b, w, 2.4, dd, x, 0, z);
  box(b, 6, 4, 4, -2.6, 0, -2.4);
  cylinder(b, 0.7, 0.9, 7, 3.6, 0, -2.6, d === 'near' ? 16 : 6);
  for (const x of [-4.6, -2.6, -0.6]) column(b, x, 0, 0, 4, 0.26, 'doric', d);
  gable(b, 6.4, 4.6, -2.6, 4, -2.2, 0.25, 'x', d);
}

/** A market hall: a long basilica, a nave higher than its aisles. */
function marketHall(b: Builder, d: Detail): void {
  const y = crepidoma(b, 20, 10, 1, 0, 0, 0);
  box(b, 20, 5, 10, 0, y, 0);
  box(b, 20, 3, 5, 0, y + 5, 0);
  if (d === 'near') for (let i = 0; i < 9; i++) box(b, 0.8, 1.6, 0.1, -8 + i * 2, y + 5.8, 2.55);
  if (d === 'near') for (let i = 0; i < 10; i++) column(b, -9 + i * 2, y, 5.4, 4.2, 0.24, 'ionic', d);
  gable(b, 5.4, 20.4, 0, y + 8, 0, 0.3, 'x', d);
  leanTo(b, 20.4, 2.6, 0, y + 5, -3.8);
}

/** A row of market stalls under one long tiled roof on posts. */
function marketStalls(b: Builder, d: Detail): void {
  box(b, 18, 0.4, 5, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const x = -7.5 + i * 2.5;
    box(b, 0.3, 3.2, 0.3, x, 0.4, 2.2);
    box(b, 0.3, 3.2, 0.3, x, 0.4, -2.2);
    if (i < 6) box(b, 2, 1, 1.2, x + 1.25, 0.4, 1.2);
  }
  box(b, 18, 3.2, 0.4, 0, 0.4, -2.4);
  gable(b, 5.2, 18, 0, 3.6, 0, 0.26, 'x', d);
}

/** A fountain house: a long basin under a porch, water from a row of spouts. */
function fountainHouse(b: Builder, d: Detail): void {
  const y = crepidoma(b, 12, 6, 1, 0, 0, 0);
  box(b, 12, 4, 0.8, 0, y, -2.6);
  box(b, 10.6, 0.9, 2.6, 0, y, -0.8);
  for (let i = 0; i < 5; i++) column(b, -4.8 + i * 2.4, y, 2.4, 4, 0.28, 'doric', d);
  const t = entablature(b, 12.4, 6.4, 0, y + 4, 0, 'triglyph', d);
  gable(b, 6.4, 12.4, 0, t, 0, 0.3, 'x', d);
}

/** Baths: halls under domes and vaults around a pool court. */
function bathhouse(b: Builder, d: Detail): void {
  box(b, 18, 5, 8, 0, 0, -4);
  for (const x of [-6, 0, 6]) {
    cylinder(b, 2.6, 2.6, 1, x, 5, -4, d === 'near' ? 24 : 8);
    const g = new CylinderGeometry(0.01, 2.6, 2.2, d === 'near' ? 24 : 8);
    g.translate(x, 7.1, -4);
    b.add(g);
  }
  box(b, 18, 0.6, 9, 0, 0, 4.5);
  box(b, 10, 0.3, 5, 0, 0.3, 4.5);
  for (let i = 0; i < 7; i++) for (const z of [0.6, 8.6]) column(b, -7.5 + i * 2.5, 0.6, z, 3.6, 0.24, 'ionic', d);
}

export const CIVIC: BuildingType[] = [
  kind('stoa', 'Stoa', 'civic', 'service', ['storage', 'backup'], 12.5, (b, d) => stoa(b, d, 1)),
  kind('stoa-two-storey', 'Stoa of two storeys', 'civic', 'service', ['storage', 'containers'], 12.5, (b, d) => stoa(b, d, 2)),
  kind('stoa-l', 'Corner stoa', 'civic', 'service', ['backup', 'containers'], 12.5, stoaL),
  kind('bouleuterion', 'Council house', 'civic', 'service', ['community', 'home'], 11.5, bouleuterion),
  kind('ekklesiasterion', 'Assembly place', 'civic', 'service', ['community', 'competitive'], 12.5, ekklesiasterion),
  kind('prytaneion', 'Hearth hall', 'civic', 'service', ['home', 'monitoring'], 9, prytaneion),
  kind('odeon', 'Odeon', 'civic', 'service', ['media', 'other'], 11, odeon),
  kind('library', 'Library', 'civic', 'service', ['cloud', 'storage', 'web'], 11, library),
  kind('archive', 'Archive', 'civic', 'service', ['backup', 'storage'], 8.5, archive),
  kind('mint', 'Mint', 'civic', 'service', ['security', 'other'], 8, mint),
  kind('market-hall', 'Market hall', 'civic', 'service', ['web', 'containers'], 11.5, marketHall),
  kind('market-stalls', 'Market stalls', 'civic', 'service', ['web', 'sandbox'], 9.5, marketStalls),
  kind('fountain-house', 'Fountain house', 'civic', 'service', ['networking', 'storage'], 7.5, fountainHouse),
  kind('bathhouse', 'Baths', 'civic', 'service', ['home', 'media'], 13, bathhouse),
];
