// Mesh builder smoke test on simple shapes: node scripts/dev/mesh-smoke.ts
import { stack, validate, type Layer } from '../../src/manufacturing/mesh.ts';
import type { Ring } from '../../src/geometry/math.ts';
const circle = (r: number, n = 64, cx = 0, cy = 0): Ring => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
const rev = (r: Ring) => [...r].reverse();
const disc = circle(50);
const pocket = circle(5, 32, 20, 0);
const mark = circle(30);
const markHole = rev(circle(10));
const tests: Record<string, Layer[]> = {
  plate: [{ rings: [disc], z0: 0, z1: 3 }],
  raised: [{ rings: [disc], z0: 0, z1: 3 }, { rings: [mark, markHole], z0: 3, z1: 4.2 }],
  engraved: [{ rings: [disc], z0: 0, z1: 3 }, { rings: [disc, rev(mark), rev(markHole)], z0: 3, z1: 4 }],
  magnets: [{ rings: [disc, rev(pocket)], z0: 0, z1: 2 }, { rings: [disc], z0: 2, z1: 3 }, { rings: [mark, markHole], z0: 3, z1: 4.2 }],
};
for (const [name, layers] of Object.entries(tests)) {
  const r = validate(stack(layers), layers);
  console.log(name.padEnd(9), r.ok ? 'OK ' : 'BAD', `tris ${r.triangles} bad ${r.badEdges} deg ${r.degenerate} vol ${r.volume.toFixed(2)} / ${r.expectedVolume.toFixed(2)}`);
}
const overlapping: Layer[] = [{ rings: [disc, circle(10, 32, 49)], z0: 0, z1: 1 }];
console.log('overlap  ', validate(stack(overlapping), overlapping).overlaps === 1 ? 'caught' : 'MISSED');
