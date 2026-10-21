// Monuments and homes: columns and statues of honour, tombs, stelae, a curved
// bench, and the houses of the island — a courtyard house, a villa, a farm.

import { CylinderGeometry, ConeGeometry, SphereGeometry } from 'three';
import { box, column, crepidoma, cylinder, dome, entablature, gable, peristyle, statue, type Builder, type Detail } from './parts.ts';
import { kind, type BuildingType } from './types.ts';

function columnOfHonour(b: Builder, d: Detail): void {
  const y = crepidoma(b, 4.6, 4.6, 3, 0, 0, 0, 0.35, 0.45);
  box(b, 3.2, 3, 3.2, 0, y, 0);
  box(b, 3.6, 0.4, 3.6, 0, y + 3, 0);
  column(b, 0, y + 3.4, 0, 12, 0.7, 'doric', d, 24);
  box(b, 2.4, 0.5, 2.4, 0, y + 15.4, 0);
  statue(b, 0, y + 15.9, 0, 3.2);
}

function statueOnPlinth(b: Builder, d: Detail): void {
  const y = crepidoma(b, 3.4, 3.4, 2, 0, 0, 0, 0.3, 0.4);
  box(b, 2.6, 2.4, 2.6, 0, y, 0);
  box(b, 3, 0.3, 3, 0, y + 2.4, 0);
  statue(b, 0, y + 2.7, 0, 4.2);
  if (d === 'near') box(b, 0.12, 2.2, 0.12, 0.7, y + 3.4, 0.2);
}

/** A choragic monument: a little round building of engaged columns on a tall square base, a finial of leaves on its roof. */
function choragic(b: Builder, d: Detail): void {
  const y = crepidoma(b, 4.4, 4.4, 2, 0, 0, 0, 0.35, 0.4);
  box(b, 3.8, 4.6, 3.8, 0, y, 0);
  cylinder(b, 1.6, 1.6, 4, 0, y + 4.6, 0, d === 'near' ? 28 : 10);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    column(b, Math.cos(a) * 1.65, y + 4.6, Math.sin(a) * 1.65, 4, 0.2, 'corinthian', d, 12);
  }
  cylinder(b, 1.95, 1.95, 0.5, 0, y + 8.6, 0, d === 'near' ? 28 : 10);
  const roof = new ConeGeometry(1.95, 0.8, d === 'near' ? 28 : 10);
  roof.translate(0, y + 9.5, 0);
  b.add(roof);
  const finial = new SphereGeometry(0.4, 10, 8);
  finial.translate(0, y + 10.2, 0);
  b.add(finial);
}

/** A mausoleum: a high base, a colonnaded chamber, a stepped pyramid roof and a chariot group on top. */
function mausoleum(b: Builder, d: Detail): void {
  box(b, 12, 6, 10, 0, 0, 0);
  const y = 6;
  box(b, 8, 5, 6, 0, y, 0);
  peristyle(b, 11, 9, y, 0, 0, 5, 0.3, 1.8, 'ionic', d);
  const t = entablature(b, 11.4, 9.4, 0, y + 5, 0, 'continuous', d);
  const steps = d === 'near' ? 12 : 4;
  for (let i = 0; i < steps; i++) {
    const k = 1 - i / steps;
    box(b, 11.4 * k, 4.2 / steps, 9.4 * k, 0, t + (i * 4.2) / steps, 0);
  }
  box(b, 2.4, 0.8, 1.6, 0, t + 4.2, 0);
  statue(b, 0, t + 5, 0, 1.6);
}

/** A tumulus: a great round mound with a stone ring and an entrance passage. */
function tumulus(b: Builder, d: Detail): void {
  cylinder(b, 8.5, 8.5, 1.4, 0, 0, 0, d === 'near' ? 48 : 14);
  const mound = new SphereGeometry(8.3, d === 'near' ? 40 : 12, d === 'near' ? 14 : 5, 0, Math.PI * 2, 0, Math.PI / 2);
  mound.scale(1, 0.55, 1);
  mound.translate(0, 1.4, 0);
  b.add(mound);
  box(b, 2.4, 2.6, 4, 0, 0, 8.6);
  box(b, 1.2, 1.8, 0.2, 0, 0, 10.62);
  statue(b, 0, 6, 0, 1.8);
}

/** A row of grave stelae along a path, each with its little pediment. */
function stelae(b: Builder, d: Detail): void {
  box(b, 16, 0.3, 3, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const x = -6.6 + i * 2.2,
      h = 2.4 + (i % 3) * 0.6;
    box(b, 1.2, h, 0.3, x, 0.3, -0.6);
    if (d === 'near') gable(b, 1.2, 0.3, x, 0.3 + h, -0.6, 0.35, 'z', d);
  }
  if (d === 'near') for (let i = 0; i < 3; i++) {
    const urn = new CylinderGeometry(0.25, 0.4, 1.2, 12);
    urn.translate(-4 + i * 4, 0.9, 0.8);
    b.add(urn);
  }
}

/** An exedra: a curved stone bench with a back, statues at its ends. */
function exedra(b: Builder, d: Detail): void {
  const seg = d === 'near' ? 32 : 10;
  const seat = new CylinderGeometry(5, 5, 0.9, seg, 1, false, -Math.PI / 2, Math.PI);
  seat.translate(0, 0.45, 0);
  b.add(seat);
  const back = new CylinderGeometry(5.6, 5.6, 2.2, seg, 1, false, -Math.PI / 2, Math.PI);
  back.translate(0, 1.1, 0);
  b.add(back);
  for (const s of [-1, 1]) {
    box(b, 1.2, 1.4, 1.2, s * 5.3, 0, 0.3);
    statue(b, s * 5.3, 1.4, 0.3, 2.4);
  }
}

/** A courtyard house: rooms round a small court with a well, a tiled roof sloping inward. */
function courtyardHouse(b: Builder, d: Detail): void {
  for (const [w, dd, x, z] of [[12, 3, 0, -4.5], [12, 3, 0, 4.5], [3, 6, -4.5, 0], [3, 6, 4.5, 0]] as const) {
    box(b, w, 3.6, dd, x, 0, z);
    gable(b, w < dd ? w : dd, w < dd ? dd : w, x, 3.6, z, 0.28, w < dd ? 'z' : 'x', d);
  }
  if (d === 'near') for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) column(b, x, 0, z, 3.2, 0.18, 'doric', d, 10);
  cylinder(b, 0.6, 0.6, 0.8, 0, 0, 0, 14);
}

/** A villa: a house round a peristyle garden, with a porch and a wing. */
function villa(b: Builder, d: Detail): void {
  const y = crepidoma(b, 18, 14, 1, 0, 0, 0);
  peristyle(b, 10, 7, y, 2, 0, 3.4, 0.2, 1.7, 'ionic', d);
  for (const [w, dd, x, z] of [[18, 3.4, 0, -5.3], [18, 3.4, 0, 5.3], [4, 7.2, -7, 0]] as const) {
    box(b, w, 4, dd, x, y, z);
    gable(b, w < dd ? w : dd, w < dd ? dd : w, x, y + 4, z, 0.26, w < dd ? 'z' : 'x', d);
  }
  box(b, 8, 0.15, 5, 2, y, 0);
  if (d === 'near') cylinder(b, 0.8, 0.8, 0.6, 2, y, 0, 16);
}

/** A farmhouse: a long house, a threshing floor, a granary on posts and a walled yard. */
function farmhouse(b: Builder, d: Detail): void {
  box(b, 10, 3.6, 5, -2, 0, -3);
  gable(b, 5, 10, -2, 3.6, -3, 0.32, 'x', d);
  cylinder(b, 3, 3, 0.2, 4.6, 0, 3, d === 'near' ? 24 : 8);
  for (const [x, z] of [[-5.2, 2.2], [-3.2, 2.2], [-5.2, 4.2], [-3.2, 4.2]]) box(b, 0.3, 1.2, 0.3, x, 0, z);
  box(b, 2.6, 2, 2.6, -4.2, 1.2, 3.2);
  gable(b, 2.6, 2.6, -4.2, 3.2, 3.2, 0.4, 'z', d);
  for (const [w, dd, x, z] of [[16, 0.4, 0, 7], [0.4, 14, 8, 0]] as const) box(b, w, 1.2, dd, x, 0, z);
}

export const MONUMENTS: BuildingType[] = [
  kind('column-of-honour', 'Column of honour', 'monuments', 'service', ['monitoring', 'other'], 5.5, columnOfHonour),
  kind('statue', 'Statue', 'monuments', 'service', ['other', 'sandbox'], 3.5, statueOnPlinth),
  kind('choragic-monument', 'Choragic monument', 'monuments', 'service', ['competitive', 'media'], 4.5, choragic),
  kind('mausoleum', 'Mausoleum', 'monuments', 'service', ['backup', 'storage'], 9, mausoleum),
  kind('tumulus', 'Tumulus', 'monuments', 'service', ['backup', 'other'], 11.5, tumulus),
  kind('stelae', 'Stelae', 'monuments', 'service', ['monitoring', 'backup'], 8.5, stelae),
  kind('exedra', 'Exedra', 'monuments', 'service', ['community', 'home'], 6.5, exedra),
  kind('courtyard-house', 'Courtyard house', 'monuments', 'service', ['home', 'sandbox'], 9, courtyardHouse),
  kind('villa', 'Villa', 'monuments', 'service', ['home', 'media'], 12.5, villa),
  kind('farmhouse', 'Farmhouse', 'monuments', 'service', ['home', 'other'], 11, farmhouse),
];
