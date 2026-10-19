// Where a model's mesh is not manifold: node scripts/dev/mesh-diag.ts [product] [god]
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { crest, seal } from '../../src/geometry/crest.ts';
import { buildModel, defaults, type ProductId } from '../../src/manufacturing/products.ts';
import type { GodId } from '../../src/geometry/pantheon.ts';
loadNodeFonts();
const id = (process.argv[2] ?? 'engraved') as ProductId;
const god = (process.argv[3] ?? 'apollo') as GodId;
const m = buildModel(id, defaults(id), { d: id === 'token' ? seal({ patron: { god } }).d : crest({ detail: 'print', patron: { god } }).d, minDiameterMM: 0 });
const mesh = m.parts[0].mesh;
const P = (i: number) => [0, 1, 2].map((k) => mesh.positions[3 * i + k].toFixed(4)).join(',');
const edges = new Map<string, number>();
for (let t = 0; t < mesh.triangles.length; t += 3) {
  const tri = [0, 1, 2].map((e) => mesh.triangles[t + e]);
  for (let e = 0; e < 3; e++) edges.set(`${tri[e]}>${tri[(e + 1) % 3]}`, (edges.get(`${tri[e]}>${tri[(e + 1) % 3]}`) ?? 0) + 1);
  const v = tri.map((i) => [0, 1, 2].map((k) => mesh.positions[3 * i + k]));
  const u = v[1].map((x, k) => x - v[0][k]), w = v[2].map((x, k) => x - v[0][k]);
  const n = Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]);
  if (n < 1e-10) console.log('degenerate', tri.map(P).join(' | '));
}
for (const [k, n] of edges) {
  const [a, b] = k.split('>');
  const r = edges.get(`${b}>${a}`) ?? 0;
  if (n !== 1 || r !== 1) console.log(`edge ${P(+a)} → ${P(+b)}  fwd ${n} back ${r}`);
}
