// Defence and works: walls and towers, the lighthouse, the aqueduct, a bridge,
// the harbour's mole and its ship sheds.

import { CylinderGeometry, SphereGeometry, ConeGeometry } from 'three';
import { arcade, box, column, crepidoma, cylinder, entablature, gable, wall, type Builder, type Detail } from './parts.ts';
import { kind, type BuildingType } from './types.ts';

/** A stretch of the acropolis wall with its gate between two towers. */
function acropolisGate(b: Builder, d: Detail): void {
  for (const s of [-1, 1]) {
    wall(b, 7, 6, 2, s * 8.5, 0, 0, 0, d === 'near');
    box(b, 4, 8.4, 4, s * 3.6, 0, 0);
    if (d === 'near') for (let i = 0; i < 3; i++) box(b, 0.9, 0.9, 4.2, s * 3.6 - 1.3 + i * 1.3, 8.4, 0);
  }
  arcade(b, 3.2, 5.6, 4, 1, 0, 0, 0);
  box(b, 3.2, 2.8, 4, 0, 5.6, 0);
}

/** A round tower of dressed stone, with a crenellated top and arrow slits. */
function roundTower(b: Builder, d: Detail): void {
  const y = crepidoma(b, 9, 9, 1, 0, 0, 0);
  cylinder(b, 4, 4.4, 11, 0, y, 0, d === 'near' ? 32 : 10);
  cylinder(b, 4.6, 4.6, 0.6, 0, y + 11, 0, d === 'near' ? 32 : 10);
  const n = d === 'near' ? 16 : 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    box(b, 1.1, 1.2, 0.7, Math.cos(a) * 4.3, y + 11.6, Math.sin(a) * 4.3, -a + Math.PI / 2);
  }
  if (d === 'near') for (let k = 0; k < 2; k++) for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + k * 0.5;
    box(b, 0.5, 1.4, 0.3, Math.cos(a) * 4.25, y + 3.5 + k * 4, Math.sin(a) * 4.25, -a + Math.PI / 2);
  }
  for (const s of [-1, 1]) wall(b, 6, 6, 2, s * 7.5, 0, 0, 0, d === 'near');
}

/** A square tower with a pitched roof and windows high up. */
function squareTower(b: Builder, d: Detail): void {
  const y = crepidoma(b, 7, 7, 1, 0, 0, 0);
  box(b, 6.4, 12, 6.4, 0, y, 0);
  if (d === 'near') for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    box(b, 0.8, 1.6, 0.12, -1.2 + i * 2.4, y + 9, s * 3.22);
    box(b, 0.12, 1.6, 0.8, s * 3.22, y + 9, -1.2 + i * 2.4);
  }
  box(b, 7, 0.5, 7, 0, y + 12, 0);
  const roof = new ConeGeometry(5.2, 3, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(0, y + 14, 0);
  b.add(roof);
}

/** The lighthouse: a square base, an octagonal shaft, a round lantern of columns, a statue on top. */
function lighthouse(b: Builder, d: Detail): void {
  const y = crepidoma(b, 7, 7, 2, 0, 0, 0);
  box(b, 6.4, 8, 6.4, 0, y, 0);
  if (d === 'near') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    box(b, 0.6, 1.4, 0.15, -1.8 + i * 1.8, y + 5, s * 3.24);
    box(b, 0.15, 1.4, 0.6, s * 3.24, y + 5, -1.8 + i * 1.8);
  }
  box(b, 7, 0.5, 7, 0, y + 8, 0);
  cylinder(b, 2.6, 3, 6, 0, y + 8.5, 0, 8);
  cylinder(b, 3.1, 3.1, 0.4, 0, y + 14.5, 0, 8);
  cylinder(b, 1.6, 1.8, 4, 0, y + 14.9, 0, d === 'near' ? 24 : 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    column(b, Math.cos(a) * 1.7, y + 18.9, Math.sin(a) * 1.7, 2.2, 0.16, 'doric', d, 10);
  }
  cylinder(b, 2.2, 2.2, 0.3, 0, y + 21.1, 0, d === 'near' ? 24 : 8);
  const cap = new ConeGeometry(2.2, 2.2, d === 'near' ? 24 : 8);
  cap.translate(0, y + 22.5, 0);
  b.add(cap);
  const ball = new SphereGeometry(0.5, 12, 8);
  ball.translate(0, y + 24, 0);
  b.add(ball);
}

/** An aqueduct: a stretch of two tiers of arches carrying the water channel. */
function aqueduct(b: Builder, d: Detail): void {
  arcade(b, 3.2, 7, 1.6, 7, 0, 0, 0);
  box(b, 22.6, 0.4, 2, 0, 7, 0);
  arcade(b, 1.6, 3.6, 1.3, 14, 0, 7.4, 0);
  box(b, 22.6, 0.9, 1.6, 0, 11, 0);
  if (d === 'near') for (const z of [0.7, -0.7]) box(b, 22.6, 0.4, 0.2, 0, 11.9, z);
}

/** A stone bridge of three arches over a stream bed. */
function bridge(b: Builder, d: Detail): void {
  arcade(b, 5, 4.6, 4, 3, 0, 0, 0);
  box(b, 16, 0.5, 4.4, 0, 4.6, 0);
  for (const z of [2, -2]) box(b, 16, 0.8, 0.3, 0, 5.1, z);
  if (d === 'near') for (const x of [-7.5, 7.5]) for (const z of [2, -2]) {
    const post = new CylinderGeometry(0.25, 0.25, 1.6, 10);
    post.translate(x, 5.9, z);
    b.add(post);
  }
  box(b, 18, 0.2, 7, 0, 0, 0);
}

/** A harbour mole: a stone pier running out with a little lighthouse at its head and mooring posts. */
function harbourMole(b: Builder, d: Detail): void {
  box(b, 3.4, 1.4, 22, 0, 0, 0);
  box(b, 7, 1.4, 3, 0, 0, 10);
  cylinder(b, 1.4, 1.6, 5, 0, 1.4, 10.4, d === 'near' ? 20 : 6);
  const top = new ConeGeometry(1.6, 1.4, d === 'near' ? 20 : 6);
  top.translate(0, 7.1, 10.4);
  b.add(top);
  if (d === 'near') for (let i = 0; i < 8; i++) for (const s of [-1, 1]) cylinder(b, 0.18, 0.2, 0.7, s * 1.5, 1.4, -9 + i * 2.2, 8);
}

/** Ship sheds: long slipways under a row of roofs on columns. */
function shipSheds(b: Builder, d: Detail): void {
  for (let i = 0; i < 4; i++) {
    const x = -7.5 + i * 5;
    box(b, 4.4, 0.4, 18, x, 0, 0);
    for (let j = 0; j < 6; j++) for (const s of [-1, 1]) column(b, x + s * 2.4, 0.4, -8 + j * 3.2, 4, 0.22, 'doric', d);
    gable(b, 5, 18, x, 4.4, 0, 0.3, 'z', d);
  }
}

export const WORKS: BuildingType[] = [
  kind('acropolis-gate', 'Acropolis gate', 'works', 'service', ['security', 'proxy'], 12.5, acropolisGate),
  kind('round-tower', 'Round tower', 'works', 'service', ['security', 'monitoring'], 11, roundTower),
  kind('square-tower', 'Square tower', 'works', 'service', ['security', 'monitoring'], 5.5, squareTower),
  kind('lighthouse', 'Lighthouse', 'works', 'service', ['monitoring', 'networking'], 6.5, lighthouse),
  kind('aqueduct', 'Aqueduct', 'works', 'service', ['networking', 'storage'], 11.5, aqueduct),
  kind('bridge', 'Bridge', 'works', 'service', ['networking', 'proxy'], 10, bridge),
  kind('harbour-mole', 'Harbour mole', 'works', 'service', ['networking', 'other'], 12, harbourMole),
  kind('ship-sheds', 'Ship sheds', 'works', 'service', ['containers', 'backup'], 14.5, shipSheds),
];
