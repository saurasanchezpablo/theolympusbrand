// The sanctuary: what stands around the temples — treasuries, altars, gates,
// shrines, springs and votive monuments.

import { CylinderGeometry, ConeGeometry } from 'three';
import { arcade, box, column, crepidoma, entablature, gable, stair, statue, type Builder, type Detail } from './parts.ts';
import { kind, type BuildingType } from './types.ts';

/** A small closed treasury: two columns between the walls' ends, a pediment. */
function treasury(b: Builder, d: Detail): void {
  const y = crepidoma(b, 6, 8.4, 3, 0, 0, 0);
  box(b, 6, 5.6, 6.4, 0, y, -1);
  for (const s of [-1, 1]) box(b, 0.8, 5.6, 2.4, s * 2.6, y, 3.1);
  column(b, -1, y, 3.6, 5.6, 0.38, 'doric', d);
  column(b, 1, y, 3.6, 5.6, 0.38, 'doric', d);
  const t = entablature(b, 6.4, 8.8, 0, y + 5.6, 0, 'triglyph', d);
  gable(b, 6.4, 8.8, 0, t, 0, 0.26, 'z', d);
}

/** A great altar: a broad stair up between two colonnaded wings (after Pergamon). */
function greatAltar(b: Builder, d: Detail): void {
  box(b, 18, 3.6, 16, 0, 0, -1);
  if (d === 'near') for (let i = 0; i < 28; i++) box(b, 0.5, 1.6, 0.15, -8.4 + i * 0.62, 1.4, 7.02);
  for (let i = 0; i < 9; i++) box(b, 9, 0.4 * (i + 1), 0.5, 0, 0, 7 + 4.2 - i * 0.5);
  for (let i = 0; i < 12; i++) column(b, -7.7 + i * 1.4, 3.6, -8.4, 3.2, 0.24, 'ionic', d);
  for (const s of [-1, 1]) for (let j = 0; j < 7; j++) column(b, s * 8.4, 3.6, -7.4 + j * 2.1, 3.2, 0.24, 'ionic', d);
  for (const s of [-1, 1]) for (let j = 0; j < 3; j++) column(b, s * (6.2 + j * -1.5), 3.6, 6.4, 3.2, 0.24, 'ionic', d);
  entablature(b, 17.6, 1.2, 0, 6.8, -8.4, 'continuous', d);
  for (const s of [-1, 1]) entablature(b, 1.2, 15, s * 8.4, 6.8, -1, 'continuous', d);
  box(b, 5, 1.4, 3, 0, 3.6, -3);
}

/** A small altar on two steps, with corner horns. */
function altar(b: Builder, d: Detail): void {
  const y = crepidoma(b, 5, 3.4, 2, 0, 0, 0, 0.35, 0.5);
  box(b, 5, 1.6, 3.4, 0, y, 0);
  box(b, 5.4, 0.3, 3.8, 0, y + 1.6, 0);
  if (d === 'near') for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const horn = new ConeGeometry(0.28, 0.7, 6);
    horn.translate(sx * 2.4, y + 2.25, sz * 1.5);
    b.add(horn);
  }
  statue(b, 0, 0, 3.6, 2.2);
}

/** A propylon: the sanctuary's gate — columns before and behind a passage, under one pediment. */
function propylon(b: Builder, d: Detail, wings: boolean): void {
  const y = crepidoma(b, 14, 7, 3, 0, 0, 0);
  for (const z of [3, -3]) for (const x of [-5, -3, -1, 1, 3, 5]) column(b, x, y, z, 6, 0.42, 'doric', d);
  box(b, 1.2, 6, 4.6, -6.2, y, 0);
  box(b, 1.2, 6, 4.6, 6.2, y, 0);
  const t = entablature(b, 13.6, 7, 0, y + 6, 0, 'triglyph', d);
  gable(b, 7, 13.6, 0, t, 0, 0.3, 'x', d);
  if (wings)
    for (const s of [-1, 1]) {
      const yy = crepidoma(b, 5, 6, 2, s * 10.5, 0, 0);
      box(b, 5, 4.2, 5, s * 10.5, yy, -0.4);
      for (let i = 0; i < 3; i++) column(b, s * (8.8 + i * 1.6), yy, 2.6, 4.2, 0.3, 'doric', d);
      entablature(b, 5.2, 5.6, s * 10.5, yy + 4.2, 0, 'triglyph', d);
    }
}

/** An oracle's shrine: a sunken court with the seat of the oracle under a canopy. */
function oracle(b: Builder, d: Detail): void {
  for (const [w, z] of [[12, -5.6], [12, 5.6]]) box(b, w, 2.4, 0.8, 0, 0, z);
  for (const x of [-5.6, 5.6]) box(b, 0.8, 2.4, 10.4, x, 0, 0);
  box(b, 3, 0.4, 3, 0, 0, 0);
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) column(b, x, 0.4, z, 3.6, 0.2, 'ionic', d);
  box(b, 3, 0.4, 3, 0, 4, 0);
  const tripod = new CylinderGeometry(0.7, 0.2, 1.2, d === 'near' ? 16 : 6);
  tripod.translate(0, 1.0, 0);
  b.add(tripod);
  box(b, 3, 3, 0.8, 0, 0, 5.6);
  for (const s of [-1, 1]) column(b, s * 1.6, 0, 6.4, 3.4, 0.26, 'doric', d);
}

/** A hero's shrine: a walled precinct, a little temple in antis and a tomb mound. */
function heroon(b: Builder, d: Detail): void {
  for (const z of [-6, 6]) box(b, 12, 1.6, 0.5, 0, 0, z);
  for (const x of [-6, 6]) box(b, 0.5, 1.6, 12, x, 0, 0);
  const y = crepidoma(b, 4, 5.4, 2, -2, 0, -1.6);
  box(b, 4, 3.4, 3.6, -2, y, -2.4);
  for (const s of [-1, 1]) column(b, -2 + s * 0.7, y, 0.6, 3.4, 0.26, 'doric', d);
  const t = entablature(b, 4.4, 5.8, -2, y + 3.4, -1.6, 'triglyph', d);
  gable(b, 4.4, 5.8, -2, t, -1.6, 0.25, 'z', d);
  const mound = new CylinderGeometry(1.4, 2.6, 1.6, d === 'near' ? 24 : 8);
  mound.translate(3, 0.8, 2.6);
  b.add(mound);
}

/** A nymphaeum: a curved fountain wall with niches, columns and a basin. */
function nymphaeum(b: Builder, d: Detail): void {
  const wallSeg = d === 'near' ? 24 : 8;
  const g = new CylinderGeometry(7, 7, 6, wallSeg, 1, true, -Math.PI / 2, Math.PI);
  g.translate(0, 3, 0);
  b.add(g);
  const inner = new CylinderGeometry(6.4, 6.4, 6, wallSeg, 1, true, -Math.PI / 2, Math.PI);
  inner.scale(-1, 1, 1);
  inner.translate(0, 3, 0);
  b.add(inner);
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI;
    column(b, Math.sin(a) * 6.0, 0.6, Math.cos(a) * -6.0, 5.4, 0.26, 'corinthian', d);
    if (i < 6 && d === 'near') statue(b, Math.sin(a + Math.PI / 12) * 6.6, 1.8, Math.cos(a + Math.PI / 12) * -6.6, 1.8);
  }
  box(b, 13.6, 0.6, 3, 0, 0, 1.6);
  box(b, 12.6, 0.3, 2, 0, 0.6, 1.6);
}

/** A spring house: a roofed porch over a basin fed by a lion's-head spout. */
function springHouse(b: Builder, d: Detail): void {
  const y = crepidoma(b, 8, 6, 1, 0, 0, 0);
  box(b, 8, 4.4, 1, 0, y, -2.5);
  for (const s of [-1, 1]) box(b, 1, 4.4, 5, s * 3.5, y, 0);
  for (const x of [-1.6, 0, 1.6]) column(b, x, y, 2.5, 4.4, 0.28, 'doric', d);
  box(b, 5.4, 0.8, 3.2, 0, y, -0.6);
  const t = entablature(b, 8.4, 6.4, 0, y + 4.4, 0, 'triglyph', d);
  gable(b, 6.4, 8.4, 0, t, 0, 0.3, 'x', d);
}

/** A votive column with a sphinx on top, on a stepped base. */
function votiveColumn(b: Builder, d: Detail): void {
  const y = crepidoma(b, 3, 3, 3, 0, 0, 0, 0.35, 0.4);
  box(b, 2.2, 1.6, 2.2, 0, y, 0);
  column(b, 0, y + 1.6, 0, 9, 0.5, 'ionic', d, 20);
  box(b, 1.6, 0.6, 1.6, 0, y + 10.6, 0);
  // The sphinx: a crouching body and a raised head and wings.
  box(b, 0.7, 0.8, 1.6, 0, y + 11.2, 0);
  box(b, 0.5, 0.9, 0.5, 0, y + 12, 0.5);
  if (d === 'near') for (const s of [-1, 1]) box(b, 0.1, 1.2, 1.0, s * 0.35, y + 11.9, -0.2);
}

/** A tripod monument: a bronze tripod and its cauldron on a tall stepped base. */
function tripodMonument(b: Builder, d: Detail): void {
  const y = crepidoma(b, 3.4, 3.4, 4, 0, 0, 0, 0.4, 0.35);
  box(b, 2.6, 3, 2.6, 0, y, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new CylinderGeometry(0.06, 0.09, 3, 6);
    leg.rotateZ(0.18);
    leg.rotateY(a);
    leg.translate(Math.cos(a) * 0.5, y + 4.5, Math.sin(a) * 0.5);
    b.add(leg);
  }
  const bowl = new CylinderGeometry(0.9, 0.4, 0.8, d === 'near' ? 20 : 8);
  bowl.translate(0, y + 6.2, 0);
  b.add(bowl);
}

/** An arched fountain gate into the sanctuary: an arcade with an attic. */
function sacredGate(b: Builder, d: Detail): void {
  arcade(b, 3.4, 6.4, 2, 3, 0, 0, 0);
  for (const x of [-5.1, -1.7, 1.7, 5.1]) column(b, x, 0, 1.4, 6.4, 0.3, 'corinthian', d);
  entablature(b, 11, 2.6, 0, 6.4, 0.2, 'continuous', d);
  box(b, 10, 2, 2, 0, 7.85, 0);
  if (d === 'near') stair(b, 4, 4, 0, 0, 1.2, 0);
}

export const SANCTUARY: BuildingType[] = [
  kind('treasury', 'Treasury', 'sanctuary', 'service', ['security', 'backup'], 7.5, treasury),
  kind('great-altar', 'Great altar', 'sanctuary', 'service', ['home', 'other'], 13, greatAltar),
  kind('altar', 'Altar', 'sanctuary', 'service', ['home', 'sandbox'], 5.5, altar),
  kind('propylon', 'Gate of the sanctuary', 'sanctuary', 'service', ['proxy', 'networking', 'security'], 10, (b, d) => propylon(b, d, false)),
  kind('propylaea', 'Gate with wings', 'sanctuary', 'service', ['proxy', 'networking'], 15, (b, d) => propylon(b, d, true)),
  kind('oracle', 'Oracle', 'sanctuary', 'service', ['monitoring', 'other'], 8.5, oracle),
  kind('heroon', 'Hero’s shrine', 'sanctuary', 'service', ['community', 'other'], 9, heroon),
  kind('nymphaeum', 'Nymphaeum', 'sanctuary', 'service', ['media', 'home'], 7.5, nymphaeum),
  kind('spring-house', 'Spring house', 'sanctuary', 'service', ['storage', 'networking'], 6, springHouse),
  kind('votive-column', 'Votive column', 'sanctuary', 'service', ['monitoring', 'other'], 4, votiveColumn),
  kind('tripod-monument', 'Tripod monument', 'sanctuary', 'service', ['competitive', 'gaming'], 4.5, tripodMonument),
  kind('sacred-gate', 'Arched gate', 'sanctuary', 'service', ['proxy', 'security'], 7, sacredGate),
];
