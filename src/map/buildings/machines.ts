// The house's works: the buildings that stand for its machines. They read as
// places of labour, not of worship — long halls of repeated bays, chimneys,
// buildings on piers, vaults and wheels — so a machine is told from a service
// at a glance. They are marble like everything else on the island.

import { CylinderGeometry, TorusGeometry, ExtrudeGeometry, Shape } from 'three';
import { arcade, box, crepidoma, cylinder, dome, gable, wall, type Builder, type Detail } from './parts.ts';
import { kind, type BuildingType } from './types.ts';

/** The rack hall: a long low hall whose front is stacked units between pilasters, louvres along its ridge. */
function rackHall(b: Builder, d: Detail, bays: number): void {
  const w = bays * 2.6,
    dd = 7;
  const y = crepidoma(b, w, dd, 1, 0, 0, 0);
  box(b, w, 5, dd, 0, y, 0);
  for (let i = 0; i <= bays; i++) for (const s of [-1, 1]) box(b, 0.5, 5.2, 0.35, -w / 2 + (i * w) / bays, y, s * (dd / 2 + 0.1));
  if (d === 'near')
    for (let i = 0; i < bays; i++)
      for (let u = 0; u < 6; u++) for (const s of [-1, 1]) box(b, 1.8, 0.42, 0.12, -w / 2 + 1.3 + i * 2.6, y + 0.6 + u * 0.72, s * (dd / 2 + 0.06));
  box(b, w + 0.6, 0.4, dd + 0.6, 0, y + 5, 0);
  // A low ridge of louvres: the hall breathes.
  box(b, w - 2, 1, 2.2, 0, y + 5.4, 0);
  if (d === 'near') for (let i = 0; i < Math.round((w - 2) / 0.8); i++) box(b, 0.12, 0.8, 2.3, -w / 2 + 1.4 + i * 0.8, y + 5.5, 0);
}

/** The forge: a stout hall with a tall square chimney and an anvil block before its wide door. */
function forge(b: Builder, d: Detail): void {
  const y = crepidoma(b, 10, 8, 1, 0, 0, 0);
  box(b, 10, 5, 8, 0, y, 0);
  box(b, 4, 3.6, 0.3, 0, y, 4.05);
  gable(b, 8, 10, 0, y + 5, 0, 0.25, 'x', d);
  box(b, 2.2, 13, 2.2, 3.4, y, -2.2);
  box(b, 2.6, 0.5, 2.6, 3.4, y + 13, -2.2);
  box(b, 1.4, 1, 0.8, -2.6, y, 5.4);
}

/** The workshop: a hall lit by a raised clerestory, big doors on its long side. */
function workshop(b: Builder, d: Detail): void {
  const y = crepidoma(b, 14, 8, 1, 0, 0, 0);
  box(b, 14, 4.6, 8, 0, y, 0);
  box(b, 14, 1.6, 3.6, 0, y + 4.6, 0);
  if (d === 'near') for (let i = 0; i < 8; i++) box(b, 1.1, 0.8, 0.12, -6 + i * 1.7, y + 5, 1.82);
  gable(b, 3.6, 14, 0, y + 6.2, 0, 0.28, 'x', d);
  for (const s of [-1, 1]) {
    const roof = new Shape();
    roof.moveTo(0, 0);
    roof.lineTo(2.2, 0);
    roof.lineTo(0, 0.9);
    roof.closePath();
    const g = new ExtrudeGeometry(roof, { depth: 14.4, bevelEnabled: false });
    g.translate(0, 0, -7.2);
    g.rotateY(-Math.PI / 2);
    if (s < 0) g.rotateY(Math.PI);
    g.translate(0, y + 4.6, s * 1.8);
    b.add(g);
  }
  for (const x of [-4, 0, 4]) box(b, 2.4, 3.4, 0.3, x, y, 4.05);
}

/** The granary: a store raised on rows of stone piers, steps up to its door. */
function granary(b: Builder, d: Detail): void {
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) box(b, 0.7, 2, 0.7, -5 + i * 2.5, 0, -2.5 + j * 2.5);
  box(b, 12, 0.5, 6.6, 0, 2, 0);
  box(b, 11.4, 4, 6, 0, 2.5, 0);
  if (d === 'near') for (let i = 0; i < 5; i++) box(b, 0.4, 0.8, 0.1, -4.4 + i * 2.2, 5.2, 3.02);
  gable(b, 6.6, 12, 0, 6.5, 0, 0.3, 'x', d);
  for (let i = 0; i < 4; i++) box(b, 1.6, 0.5 * (i + 1), 0.5, 4, 0, 3.3 + 1.6 - i * 0.5);
}

/** The cistern house: a low vaulted store beside a round tank under a lid. */
function cisternHouse(b: Builder, d: Detail): void {
  const y = crepidoma(b, 10, 6, 1, -2, 0, 0);
  box(b, 10, 3, 6, -2, y, 0);
  const vault = new CylinderGeometry(3, 3, 10, d === 'near' ? 24 : 8, 1, false, -Math.PI / 2, Math.PI);
  vault.rotateZ(Math.PI / 2);
  vault.translate(-2, y + 3, 0);
  b.add(vault);
  cylinder(b, 3, 3, 3.6, 6, 0, 0, d === 'near' ? 32 : 10);
  cylinder(b, 3.2, 3.2, 0.4, 6, 3.6, 0, d === 'near' ? 32 : 10);
}

/** The watch tower: a tall square tower with a beacon basket on top, a ladder of windows up its face. */
function watchTower(b: Builder, d: Detail): void {
  const y = crepidoma(b, 5, 5, 1, 0, 0, 0);
  box(b, 4.2, 16, 4.2, 0, y, 0);
  if (d === 'near') for (let i = 0; i < 5; i++) box(b, 0.6, 1, 0.12, 0, y + 2 + i * 2.8, 2.12);
  box(b, 5.2, 0.5, 5.2, 0, y + 16, 0);
  for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) box(b, 0.5, 2.4, 0.5, x, y + 16.5, z);
  box(b, 5.2, 0.4, 5.2, 0, y + 18.9, 0);
  const brazier = new CylinderGeometry(1.1, 0.5, 1, d === 'near' ? 16 : 6);
  brazier.translate(0, y + 19.8, 0);
  b.add(brazier);
}

/** The gatehouse: two squat towers either side of an arch, a walkway over it. */
function gatehouse(b: Builder, d: Detail): void {
  for (const s of [-1, 1]) {
    box(b, 4, 8, 4, s * 4, 0, 0);
    wall(b, 4, 0.01, 4, s * 4, 8, 0, 0, d === 'near');
  }
  arcade(b, 4, 5.4, 4, 1, 0, 0, 0);
  box(b, 4, 2.2, 4, 0, 5.4, 0);
  wall(b, 4, 0.01, 4, 0, 7.6, 0, 0, d === 'near');
}

/** The kiln: a beehive dome with its stoke hole and a chimney. */
function kiln(b: Builder, d: Detail): void {
  box(b, 9, 0.5, 9, 0, 0, 0);
  cylinder(b, 3.4, 3.6, 2, 0, 0.5, 0, d === 'near' ? 28 : 8);
  dome(b, 3.4, 2.5, 10, d, 0.9);
  box(b, 1.4, 1.6, 1.2, 0, 0.5, 3.6);
  cylinder(b, 0.6, 0.8, 5, 0, 5, 0, d === 'near' ? 14 : 6);
  for (const s of [-1, 1]) box(b, 2, 1.2, 1.2, s * 3, 0.5, -3.4);
}

/** The mill house: a hall with a great wheel turning at its side in a stone race. */
function millHouse(b: Builder, d: Detail): void {
  const y = crepidoma(b, 10, 7, 1, -1.4, 0, 0);
  box(b, 10, 5, 7, -1.4, y, 0);
  gable(b, 7, 10, -1.4, y + 5, 0, 0.3, 'x', d);
  box(b, 1.6, 2, 9, 5.6, 0, 0);
  const wheel = new TorusGeometry(3, 0.25, 8, d === 'near' ? 32 : 10);
  wheel.rotateY(Math.PI / 2);
  wheel.translate(4.4, 3.4, 0);
  b.add(wheel);
  if (d === 'near')
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const paddle = new CylinderGeometry(0.08, 0.08, 3, 5);
      paddle.rotateX(Math.PI / 2 + a);
      paddle.translate(4.4, 3.4 + Math.sin(a) * 1.5, Math.cos(a) * -1.5);
      b.add(paddle);
    }
}

/** The storehouse: a big plain warehouse with a row of loading doors and a crane post. */
function storehouse(b: Builder, d: Detail): void {
  const y = crepidoma(b, 18, 9, 1, 0, 0, 0);
  box(b, 18, 6, 9, 0, y, 0);
  for (let i = 0; i < 5; i++) box(b, 2, 3.4, 0.3, -7 + i * 3.5, y, 4.55);
  gable(b, 9, 18, 0, y + 6, 0, 0.22, 'x', d);
  box(b, 0.6, 8, 0.6, 9.6, 0, 3.2);
  box(b, 3.4, 0.4, 0.4, 8.2, 7.6, 3.2);
  if (d === 'near') for (let i = 0; i < 8; i++) box(b, 0.5, 0.9, 0.12, -7.7 + i * 2.2, y + 4.4, 4.56);
}

export const MACHINES: BuildingType[] = [
  kind('rack-hall', 'Rack hall', 'machines', 'machine', ['machine'], 11.5, (b, d) => rackHall(b, d, 7)),
  kind('rack-hall-long', 'Long rack hall', 'machines', 'machine', ['machine'], 16, (b, d) => rackHall(b, d, 11)),
  kind('forge', 'Forge', 'machines', 'machine', ['machine'], 8, forge),
  kind('workshop', 'Workshop', 'machines', 'machine', ['machine'], 9, workshop),
  kind('granary', 'Granary', 'machines', 'machine', ['machine'], 7.5, granary),
  kind('cistern-house', 'Cistern house', 'machines', 'machine', ['machine'], 9.5, cisternHouse),
  kind('watch-tower', 'Watch tower', 'machines', 'machine', ['machine'], 4.5, watchTower),
  kind('gatehouse', 'Gatehouse', 'machines', 'machine', ['machine'], 7, gatehouse),
  kind('kiln', 'Kiln', 'machines', 'machine', ['machine'], 6.5, kiln),
  kind('mill-house', 'Mill house', 'machines', 'machine', ['machine'], 8.5, millHouse),
  kind('storehouse', 'Storehouse', 'machines', 'machine', ['machine'], 11, storehouse),
];
