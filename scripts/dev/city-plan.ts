// Dev only: the city's plan drawn from above — land, streets and walkways,
// plots by part, squares, retaining walls, the walk network, furniture.
// node scripts/dev/city-plan.ts <out.png> [px per unit]
import { writeFileSync } from 'node:fs';
import { makeTerrain, heightAt } from '../../src/map/terrain.ts';
import { planCity, gradeCity } from '../../src/map/city.ts';
import { png } from '../../src/export/png.ts';

const [out = 'plan.png', k = '3'] = process.argv.slice(2);
const K = Number(k);
const t0 = Date.now();
const land = makeTerrain();
const plan = planCity(land);
const t1 = Date.now();
const graded = gradeCity(land, plan);
const t2 = Date.now();
const [bx0, bz0, bx1, bz1] = [-200, -60, 200, 200];
const W = Math.round((bx1 - bx0) * K), H = Math.round((bz1 - bz0) * K);
const px = new Uint8Array(W * H * 4).fill(255);
const set = (x: number, z: number, v: number) => {
  const i = Math.round((x - bx0) * K), j = Math.round((z - bz0) * K);
  if (i < 0 || j < 0 || i >= W || j >= H) return;
  const o = (j * W + i) * 4; px[o] = px[o + 1] = px[o + 2] = v;
};
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const x = bx0 + i / K, z = bz0 + j / K; const h = heightAt(graded, x, z);
  set(x, z, h <= 0 ? 30 : 90 + Math.min(100, h * 2) - ((h % 2) < 0.15 ? 30 : 0));
}
const fill = (r: number[], v: number) => { for (let x = r[0]; x <= r[2]; x += 1 / K) for (let z = r[1]; z <= r[3]; z += 1 / K) set(x, z, v); };
const line = (x0: number, z0: number, x1: number, z1: number, v: number) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * K * 2); for (let s = 0; s <= n; s++) set(x0 + ((x1 - x0) * s) / n, z0 + ((z1 - z0) * s) / n, v); };
for (const s of plan.streets) { const A = plan.nodes[s.a], B = plan.nodes[s.b]; fill([Math.min(A.x, B.x) - s.width / 2, Math.min(A.z, B.z) - s.width / 2, Math.max(A.x, B.x) + s.width / 2, Math.max(A.z, B.z) + s.width / 2], s.rank === 'avenue' ? 215 : s.rank === 'street' ? 200 : 185); }
for (const q of plan.squares) fill(q.rect, q.kind === 'grove' ? 160 : 230);
for (const l of plan.lots) { const [x0, z0, x1, z1] = l.rect; const v = l.part === 'quarter' ? 120 : l.part === 'half' ? 80 : l.part === 'precinct' ? 40 : 60; if (l.part === 'whole') continue; line(x0, z0, x1, z0, v); line(x1, z0, x1, z1, v); line(x1, z1, x0, z1, v); line(x0, z1, x0, z0, v);
  // the facing: a tick toward the front
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; line(cx, cz, cx + Math.sin(l.facing) * 2.5, cz + Math.cos(l.facing) * 2.5, 0); }
for (const [a, b] of plan.walk.edges) { const A = plan.walk.nodes[a], B = plan.walk.nodes[b]; line(A[0], A[2], B[0], B[2], 150); }
for (const [x, , z] of plan.furniture.lamps) fill([x - 0.3, z - 0.3, x + 0.3, z + 0.3], 0);
for (const [x, , z] of plan.furniture.trees) fill([x - 0.6, z - 0.6, x + 0.6, z + 0.6], 70);
for (const [x, , z] of plan.furniture.fountains) fill([x - 1.5, z - 1.5, x + 1.5, z + 1.5], 255);
for (const f of plan.fixtures) fill([f.x - 2, f.z - 2, f.x + 2, f.z + 2], 100);
for (const w of plan.circuit.walls) line(w[0], w[1], w[2], w[3], 0);
for (const [x, , z] of plan.circuit.towers) fill([x - 1.6, z - 1.6, x + 1.6, z + 1.6], 0);
for (const [x, , z] of plan.circuit.gates) fill([x - 1, z - 1, x + 1, z + 1], 255);
writeFileSync(out, png(px, W, H));
const parts: Record<string, number> = {}; for (const l of plan.lots) parts[`${l.district}/${l.part}`] = (parts[`${l.district}/${l.part}`] ?? 0) + 1;
console.log(JSON.stringify({ plan: t1 - t0, grade: t2 - t1, streets: plan.streets.length, nodes: plan.nodes.length, squares: plan.squares.map((s) => s.kind), lots: parts, walk: [plan.walk.nodes.length, plan.walk.edges.length], lamps: plan.furniture.lamps.length, trees: plan.furniture.trees.length, bytes: JSON.stringify(plan).length }));
