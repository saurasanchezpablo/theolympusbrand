// QR codes (ISO/IEC 18004), byte mode, versions 1–10, error correction M or Q,
// with the mask chosen by the standard penalty rules. Pure and deterministic:
// a service's address becomes a matrix of modules, drawn as one path.

export type QrLevel = 'M' | 'Q';

// Per version: [error-correction codewords per block, [blocks, data codewords] groups].
const BLOCKS: Record<QrLevel, [number, [number, number][]][]> = {
  M: [
    [10, [[1, 16]]],
    [16, [[1, 28]]],
    [26, [[1, 44]]],
    [18, [[2, 32]]],
    [24, [[2, 43]]],
    [16, [[4, 27]]],
    [18, [[4, 31]]],
    [22, [[2, 38], [2, 39]]],
    [22, [[3, 36], [2, 37]]],
    [26, [[4, 43], [1, 44]]],
  ],
  Q: [
    [13, [[1, 13]]],
    [22, [[1, 22]]],
    [18, [[2, 17]]],
    [26, [[2, 24]]],
    [18, [[2, 15], [2, 16]]],
    [24, [[4, 19]]],
    [18, [[2, 14], [4, 15]]],
    [22, [[4, 18], [2, 19]]],
    [20, [[4, 16], [4, 17]]],
    [24, [[6, 19], [2, 20]]],
  ],
};
const ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const LEVEL_BITS: Record<QrLevel, number> = { M: 0b00, Q: 0b11 };

/* GF(256) arithmetic and Reed–Solomon. */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsRemainder(data: number[], degree: number): number[] {
  // Generator (x − α⁰)(x − α¹)…(x − α^(degree−1)), highest term first.
  let gen = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(gen.length + 1).fill(0);
    gen.forEach((g, j) => {
      next[j] ^= g;
      next[j + 1] ^= mul(g, EXP[i]);
    });
    gen = next;
  }
  const rem = new Array(degree).fill(0);
  for (const d of data) {
    const factor = d ^ rem.shift()!;
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return rem;
}

/* BCH codes for the format and version information. */
function bch(value: number, poly: number, bits: number): number {
  const deg = Math.floor(Math.log2(poly));
  let v = value << deg;
  while (v >= 1 << deg) v ^= poly << (Math.floor(Math.log2(v)) - deg);
  return ((value << deg) | v) & ((1 << bits) - 1);
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

export type Qr = { size: number; version: number; level: QrLevel; mask: number; modules: boolean[][] };

/** Encode text (UTF-8, byte mode) at the smallest version that fits. */
export function qr(text: string, level: QrLevel = 'M'): Qr {
  const bytes = [...new TextEncoder().encode(text)];
  let version = 0;
  // Byte mode counts characters in 8 bits up to version 9, in 16 from version 10.
  const countBits = (v: number) => (v <= 9 ? 8 : 16);
  for (let v = 1; v <= 10; v++) {
    const cap = BLOCKS[level][v - 1][1].reduce((s, [n, d]) => s + n * d, 0);
    if (4 + countBits(v) + 8 * bytes.length <= 8 * cap) {
      version = v;
      break;
    }
  }
  if (!version) throw new Error(`QR: "${text.slice(0, 40)}…" is too long (at most ${BLOCKS[level][9][1].reduce((s, [n, d]) => s + n * d, 0) - 3} bytes at level ${level})`);
  const [ecLen, groups] = BLOCKS[level][version - 1];
  const dataLen = groups.reduce((s, [n, d]) => s + n * d, 0);

  // Bit stream: mode, count, data, terminator, padding.
  const bits: number[] = [];
  const put = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, countBits(version));
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, dataLen * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; data.length < dataLen; pad ^= 0xec ^ 0x11) data.push(pad);

  // Blocks, error correction, interleaving.
  const blocks: number[][] = [];
  let at = 0;
  for (const [n, d] of groups) for (let i = 0; i < n; i++) blocks.push(data.slice(at, (at += d)));
  const ecs = blocks.map((b) => rsRemainder(b, ecLen));
  const stream: number[] = [];
  for (let i = 0; i < Math.max(...blocks.map((b) => b.length)); i++) for (const b of blocks) if (i < b.length) stream.push(b[i]);
  for (let i = 0; i < ecLen; i++) for (const e of ecs) stream.push(e[i]);

  // Function patterns.
  const size = 17 + 4 * version;
  const mod: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r: number, c: number, v: boolean) => {
    mod[r][c] = v;
    fixed[r][c] = true;
  };
  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const [rr, cc] = [r0 + r, c0 + c];
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        set(rr, cc, ring !== 2 && ring !== 4);
      }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const al = ALIGN[version - 1];
  for (const r of al)
    for (const c of al) {
      if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (r === al[al.length - 1] && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  // Reserve format areas (filled per mask) and the dark module.
  for (let i = 0; i < 9; i++) {
    fixed[8][i] = fixed[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    fixed[8][size - 1 - i] = fixed[size - 1 - i][8] = true;
  }
  set(size - 8, 8, true);
  if (version >= 7) {
    const v = bch(version, 0x1f25, 18);
    for (let i = 0; i < 18; i++) {
      const bit = ((v >> i) & 1) === 1;
      set(Math.floor(i / 3), size - 11 + (i % 3), bit);
      set(size - 11 + (i % 3), Math.floor(i / 3), bit);
    }
  }

  // Data, in the zigzag from the bottom-right corner.
  const dataBits: boolean[] = [];
  for (const b of stream) for (let i = 7; i >= 0; i--) dataBits.push(((b >> i) & 1) === 1);
  let k = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let n = 0; n < size; n++) {
      const upward = ((size - 1 - col) / 2) % 2 === 0 || col < 6 ? (((size - 1 - (col < 6 ? col + 1 : col)) / 2) % 2 === 0) : false;
      const r = upward ? size - 1 - n : n;
      for (const c of [col, col - 1]) {
        if (fixed[r][c]) continue;
        mod[r][c] = k < dataBits.length ? dataBits[k] : false;
        k++;
      }
    }
  }

  // Try every mask; keep the one with the lowest penalty.
  let best: { mask: number; score: number; m: boolean[][] } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = mod.map((row, r) => row.map((v, c) => (fixed[r][c] ? v : v !== MASKS[mask](r, c))));
    const format = bch((LEVEL_BITS[level] << 3) | mask, 0x537, 15) ^ 0x5412;
    for (let i = 0; i < 15; i++) {
      const bit = ((format >> i) & 1) === 1;
      // Around the top-left finder.
      if (i < 6) m[i][8] = bit;
      else if (i < 8) m[i + 1][8] = bit;
      else m[size - 15 + i][8] = bit;
      if (i < 8) m[8][size - 1 - i] = bit;
      else if (i < 9) m[8][15 - i] = bit;
      else m[8][14 - i] = bit;
    }
    m[size - 8][8] = true;
    const score = penalty(m);
    if (!best || score < best.score) best = { mask, score, m };
  }
  return { size, version, level, mask: best!.mask, modules: best!.m };
}

function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  // N1: runs of five or more in a row or column.
  for (let i = 0; i < n; i++) {
    for (const line of [m[i], m.map((row) => row[i])]) {
      let run = 1;
      for (let j = 1; j <= n; j++) {
        if (j < n && line[j] === line[j - 1]) run++;
        else {
          if (run >= 5) score += 3 + run - 5;
          run = 1;
        }
      }
    }
  }
  // N2: 2 × 2 blocks of one colour.
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) score += 3;
  // N3: finder-like patterns.
  const pat = [true, false, true, true, true, false, true];
  for (let i = 0; i < n; i++) {
    for (const line of [m[i], m.map((row) => row[i])]) {
      for (let j = 0; j + 7 <= n; j++) {
        if (!pat.every((p, k) => line[j + k] === p)) continue;
        const before = j >= 4 && [1, 2, 3, 4].every((k) => !line[j - k]);
        const after = j + 11 <= n && [7, 8, 9, 10].every((k) => !line[j + k]);
        if (before || after) score += 40;
      }
    }
  }
  // N4: balance of dark and light.
  const dark = m.flat().filter(Boolean).length;
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

/** The dark modules as one path: unit squares at (x, y), scaled to `module` units, with a quiet zone of `quiet` modules. */
export function qrPath(code: Qr, x = 0, y = 0, module = 1, quiet = 0): string {
  let d = '';
  code.modules.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c++;
        continue;
      }
      let e = c;
      while (e < row.length && row[e]) e++;
      const x0 = x + (c + quiet) * module;
      const y0 = y + (r + quiet) * module;
      d += `M${x0} ${y0}L${x + (e + quiet) * module} ${y0}L${x + (e + quiet) * module} ${y0 + module}L${x0} ${y0 + module}Z`;
      c = e;
    }
  });
  return d;
}
