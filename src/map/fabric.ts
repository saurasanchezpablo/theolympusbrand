// The city's own fabric: what stands on the plots no service or machine
// takes. Houses two to a quarter in the town — courtyard houses, two-storey
// houses, now and then a garden or a workshop — a larger house round a
// peristyle on some halves, an orchard on the odd whole block, workshops in
// the works quarter. Which is where follows from the plot's id: the same city
// every time, and a plot a building leaves gets its houses back.

import type { CityPlan, Lot } from './city.ts';
import { isFree, plotsOf } from './placement.ts';

/** courtyard: a house round a court; storey: a taller block; garden: trees behind a wall; workshop: a long shed with a yard; villa: a large house round a colonnaded court; orchard: trees in rows behind a wall. */
export type HouseKind = 'courtyard' | 'storey' | 'garden' | 'workshop' | 'villa' | 'orchard';
export type House = { kind: HouseKind; x: number; y: number; z: number; w: number; d: number; rotation: number; seed: number };

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;

/** The houses on every free quarter, given which plots are taken (plot id → item id). */
export function fabric(plan: CityPlan, taken: ReadonlyMap<string, string>): House[] {
  const plots = plotsOf(plan);
  const out: House[] = [];
  const done = new Set<string>();
  const cover = (l: Lot) => {
    done.add(l.id);
    for (const c of plots.children.get(l.id) ?? []) cover(plots.byId.get(c)!);
  };
  for (const l of plan.lots) {
    if (done.has(l.id) || !isFree(plots, l.id, taken)) continue;
    const h = hash(l.id);
    const [x0, z0, x1, z1] = l.rect;
    const whole = (kind: HouseKind, inset: number) => {
      out.push({ kind, x: r2((x0 + x1) / 2), y: l.ground, z: r2((z0 + z1) / 2), w: r2(x1 - x0 - inset * 2), d: r2(z1 - z0 - inset * 2), rotation: l.facing, seed: h & 0xff });
      cover(l);
    };
    if (l.part === 'whole' && l.district === 'town' && h % 17 === 3) whole('orchard', 0.3);
    else if (l.part === 'half' && l.district === 'town' && h % 6 === 1) whole('villa', 0.4);
    else if (l.part === 'quarter') {
      out.push(...housesOn(l));
      done.add(l.id);
    }
  }
  return out;
}

/** A quarter's two houses, side by side along its street, set back a little from it. */
export function housesOn(l: Lot): House[] {
  const [x0, z0, x1, z1] = l.rect;
  const h = hash(l.id);
  const gap = 0.35;
  const w = (x1 - x0 - gap * 3) / 2;
  const d = z1 - z0 - 0.7;
  // The front edge is the one facing the street: north quarters face north.
  const facesSouth = Math.abs(l.facing) < 0.01;
  const zc = facesSouth ? z1 - 0.25 - d / 2 : z0 + 0.25 + d / 2;
  const out: House[] = [];
  for (let n = 0; n < 2; n++) {
    const seed = (h >>> (n * 8)) & 0xff;
    let kind: HouseKind;
    if (l.district === 'works') kind = 'workshop';
    else kind = seed % 11 === 0 ? 'garden' : seed % 23 === 5 ? 'workshop' : seed % 4 === 0 ? 'storey' : 'courtyard';
    out.push({ kind, x: r2(x0 + gap + w / 2 + n * (w + gap)), y: l.ground, z: r2(zc), w: r2(w), d: r2(d), rotation: l.facing, seed });
  }
  return out;
}
