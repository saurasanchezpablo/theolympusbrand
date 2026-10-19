// STL (compact form, not ASCII): one closed solid per file, millimetres.

import type { Mesh } from '../manufacturing/mesh.ts';

export function stl(mesh: Mesh, name = 'The Olympus'): Uint8Array {
  const n = mesh.triangles.length / 3;
  const out = new Uint8Array(84 + 50 * n);
  const v = new DataView(out.buffer);
  const header = `${name} — STL, millimetres`.slice(0, 80);
  for (let i = 0; i < header.length; i++) out[i] = header.charCodeAt(i) & 0x7f;
  v.setUint32(80, n, true);
  const p = mesh.positions;
  let o = 84;
  for (let t = 0; t < n; t++) {
    const [a, b, c] = [mesh.triangles[3 * t] * 3, mesh.triangles[3 * t + 1] * 3, mesh.triangles[3 * t + 2] * 3];
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const wx = p[c] - p[a], wy = p[c + 1] - p[a + 1], wz = p[c + 2] - p[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (const x of [nx, ny, nz, p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2]]) {
      v.setFloat32(o, x, true);
      o += 4;
    }
    v.setUint16(o, 0, true);
    o += 2;
  }
  return out;
}

/** Read a compact STL back (for tests and checks): triangle count and coordinates. */
export function readStl(data: Uint8Array): { triangles: number; coords: Float32Array } {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const n = v.getUint32(80, true);
  if (data.byteLength !== 84 + 50 * n) throw new Error('STL: size does not match the triangle count');
  const coords = new Float32Array(9 * n);
  for (let t = 0; t < n; t++) for (let k = 0; k < 9; k++) coords[9 * t + k] = v.getFloat32(84 + 50 * t + 12 + 4 * k, true);
  return { triangles: n, coords };
}
