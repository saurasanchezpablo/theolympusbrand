// The home page's art, drawn from the house's own sources: the crest's parts
// for the anatomy (app/public/anatomy/*.svg), two seeded cloud banks that tile
// sideways (app/public/clouds/*.webp), and small previews of real outputs for
// the workshop (app/public/showcase/*.webp). Deterministic; run after changing
// the crest or the outputs. Needs ffmpeg with libwebp.
//
//   node scripts/dev/site-art.ts

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lib/build-service.ts';
import { loadNodeFonts } from '../../src/node/fonts.ts';
import { CREST_PARTS, crestParts } from '../../src/geometry/crest.ts';
import { png } from '../../src/export/png.ts';

const PUBLIC = join(ROOT, 'app', 'public');
const webp = (src: string, out: string, filter: string, quality = 80) =>
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', `${filter},hue=s=0`, '-c:v', 'libwebp', '-pix_fmt', 'yuva420p', '-quality', String(quality), '-compression_level', '6', out]);

// The anatomy: one SVG per part, all on the crest's 512 artboard, ink only (the page colours them).
loadNodeFonts();
const anatomy = join(PUBLIC, 'anatomy');
mkdirSync(anatomy, { recursive: true });
const parts = crestParts({ detail: 'fine' });
for (const part of CREST_PARTS) writeFileSync(join(anatomy, `${part}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="${parts[part]}"/></svg>\n`);

// The clouds: seeded puffs heaped along a bank, lit from above, their edges
// worn by periodic noise — so each bank wraps seamlessly sideways.
function bank(width: number, height: number, seed: number, puffs: number, top: number): Uint8Array {
  let state = seed >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hash = (x: number, y: number, o: number) => {
    let h = (x * 374761393 + y * 668265263 + o * 2147483647 + seed * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number, period: number, o: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const at = (i: number, j: number) => hash(((i % period) + period) % period, j, o);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    return a + (b - a) * fy;
  };
  // Big puffs low in the bank, smaller ones crowning it.
  const list = Array.from({ length: puffs }, () => {
    const lift = rand();
    const r = height * (0.16 + 0.22 * (1 - lift) * rand() + 0.06);
    return { x: rand() * width, y: height - r * 0.35 - lift * (height * (1 - top) - r * 0.2), r };
  });
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let n = 0;
      let amp = 0.5;
      for (let o = 0; o < 5; o++) {
        const f = 8 * 2 ** o;
        n += amp * noise((x / width) * f, (y / width) * f, f, o);
        amp *= 0.5;
      }
      // A soft union of the puffs; each lights its own crown, blended by weight.
      let clear = 1;
      let light = 0;
      let weight = 0;
      for (const p of list) {
        for (const dx of [x - p.x, x - p.x - width, x - p.x + width]) {
          const d = Math.hypot(dx, y - p.y) / p.r;
          if (d >= 1) continue;
          const w = (1 - d * d) ** 1.5;
          clear *= 1 - w;
          const k = w ** 3;
          light += k * (0.5 - 0.5 * ((y - p.y) / p.r));
          weight += k;
        }
      }
      const density = 1 - clear;
      light = weight ? light / weight : 0;
      // Wear the edges with noise; the bank's foot fades into the haze below.
      const edge = Math.min(1, Math.max(0, (density - 0.25 + (n - 0.5) * 0.6) * 2.6));
      const i = 4 * (y * width + x);
      const shade = Math.round(112 + 140 * Math.min(1, Math.max(0, light * 0.75 + (n - 0.5) * 0.5 + (1 - y / height) * 0.25)));
      rgba[i] = rgba[i + 1] = rgba[i + 2] = shade;
      rgba[i + 3] = Math.round(255 * edge);
    }
  }
  return rgba;
}
const clouds = join(PUBLIC, 'clouds');
mkdirSync(clouds, { recursive: true });
for (const [name, seed, puffs, top] of [
  ['back', 7, 70, 0.25],
  ['front', 19, 56, 0.45],
] as const) {
  const w = 2048;
  const h = 640;
  const tmp = join(clouds, `${name}.png`);
  writeFileSync(tmp, png(bank(w, h, seed, puffs, top), w, h, 4));
  webp(tmp, join(clouds, `${name}.webp`), 'scale=2048:640', 72);
  rmSync(tmp);
}

// The workshop: what each part of the site makes, as it really comes out.
const showcase = join(PUBLIC, 'showcase');
mkdirSync(showcase, { recursive: true });
for (const [name, src] of [
  ['atelier', 'assets/master/presentation/the-olympus-crest-engraved.png'],
  ['catalogue', 'docs/catalog/seals.png'],
  ['guide', 'docs/design-system/ds-1-construction.png'],
  ['downloads', 'manufacturing/3d/master/layered/the-olympus-master-layered-preview.png'],
] as const)
  webp(join(ROOT, src), join(showcase, `${name}.webp`), 'scale=720:-2:flags=lanczos', 78);

console.log(`✔ ${anatomy}, ${clouds}, ${showcase}`);
