// What a building of the map is: a kind with a name, a family, what it suits,
// how much ground it takes, and how it is drawn — near and from afar.

import type { BufferGeometry } from 'three';
import { Builder, type Detail } from './parts.ts';
import type { Category } from '../../catalog/categories.ts';

export type Family = 'temples' | 'sanctuary' | 'civic' | 'sport' | 'works' | 'monuments' | 'machines';

export type BuildingType = {
  id: string;
  name: string;
  family: Family;
  /** What it stands for: a service, or one of the house's machines. */
  kind: 'service' | 'machine';
  /** The kinds of service it suits (categories), or "machine": only to order the picker — any building can stand for anything. */
  suggests: readonly (Category | 'machine')[];
  /** The radius of ground it takes, in map units: its terrace, and how close another may stand. */
  footprint: number;
  build(detail: Detail): BufferGeometry;
};

/** A building kind from a drawing: the drawing adds its parts to a fresh Builder for each detail. */
export function kind(id: string, name: string, family: Family, k: 'service' | 'machine', suggests: BuildingType['suggests'], footprint: number, draw: (b: Builder, d: Detail) => void): BuildingType {
  return {
    id,
    name,
    family,
    kind: k,
    suggests,
    footprint,
    build(detail) {
      const b = new Builder();
      draw(b, detail);
      return b.finish();
    },
  };
}
