// The Olympus — screens: wallpapers, boot screens and the crest in the terminal.
//
//   npm run screens                  the master's → assets/screens/
//   npm run screens -- jellyfin      a service's → assets/screens/services/jellyfin/ (not kept in the repository)
//   npm run screens -- jellyfin web  several at once
//   npm run screens -- master --no-wallpapers
//
// Wallpapers: black marble, white marble, graphite and blueprint, for 1080p,
// 1440p and 4K desktops, ultrawide and phone. Boot: a GRUB background and a
// Plymouth theme, each with an install script. Terminal: the message of the
// day, the console login and the SSH banner, with an install script.

import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { loadNodeFonts } from '../src/node/fonts.ts';
import { loadCatalog, logoOf } from '../src/node/catalog.ts';
import { baseMarks } from '../src/catalog/fileset.ts';
import { crest, seal } from '../src/geometry/crest.ts';
import { DOMAIN } from '../src/brand/identity.ts';
import { png } from '../src/export/png.ts';
import { marbleScreen } from '../src/render/wallpaper.ts';
import { screensKit, type ScreenSubject } from '../src/screens/screens.ts';
import { ROOT } from './lib/build-service.ts';

loadNodeFonts();
const args = process.argv.slice(2);
const targets = args.filter((a) => !a.startsWith('--'));
if (targets[0] === 'help') {
  console.log('npm run screens [-- <master|service-id> …] [--no-wallpapers]');
  process.exit(0);
}
const wallpapers = !args.includes('--no-wallpapers');
const catalogue = loadCatalog();

async function build(target: string) {
  let subject: ScreenSubject;
  let out: string;
  if (target === 'master') {
    subject = { id: 'master', name: 'The Olympus', caption: DOMAIN, url: `https://${DOMAIN}`, marks: { crest: crest(), seal: seal() } };
    out = join(ROOT, 'assets', 'screens');
  } else {
    const s = catalogue.find((x) => x.id === target);
    if (!s) {
      console.error(`✖ no service "${target}" in the catalogue (npm run service -- list)`);
      process.exit(1);
    }
    const m = baseMarks(s.patron, logoOf(s)?.d);
    subject = { id: s.id, name: s.name, caption: s.caption, url: s.url, marks: { crest: m['crest-fine'], seal: m.seal } };
    out = join(ROOT, 'assets', 'screens', 'services', s.id);
  }

  const started = Date.now();
  const files = await screensKit(
    subject,
    {
      png: (svg, width, opts) => {
        const r = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render();
        if (!opts?.gray) return r.asPng();
        // Everything is neutral: keep one channel. (`pixels` copies the buffer on each read: read it once.)
        const px = r.pixels;
        const gray = new Uint8Array(r.width * r.height);
        for (let i = 0; i < gray.length; i++) gray[i] = px[4 * i];
        return png(gray, r.width, r.height, 1);
      },
      ground: (w, h, tone) => png(marbleScreen(w, h, tone), w, h, 1),
      sha256: (data) => createHash('sha256').update(data).digest('hex'),
    },
    { wallpapers },
  );
  // Replace only what was rebuilt: the master's folder also holds the services', and --no-wallpapers keeps the wallpapers.
  for (const d of ['boot', 'terminal', 'shell', 'arch', 'README.md', 'install.sh', ...(wallpapers ? ['wallpapers'] : [])]) rmSync(join(out, d), { recursive: true, force: true });
  let bytes = 0;
  for (const f of files) {
    const path = join(out, f.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, f.data, f.path.endsWith('.sh') || f.path.endsWith('20-the-olympus') || f.path.endsWith('/the-olympus') ? { mode: 0o755 } : {});
    bytes += typeof f.data === 'string' ? Buffer.byteLength(f.data) : f.data.length;
  }
  console.log(`✔ ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB, ${((Date.now() - started) / 1000).toFixed(0)} s → ${out}`);

  // The terminal kit's guide is also a chapter of the site's guide, under Screens.
  if (target === 'master') {
    const guide = files.find((f) => f.path === 'shell/README.md');
    if (guide) {
      mkdirSync(join(ROOT, 'docs', 'screens'), { recursive: true });
      writeFileSync(join(ROOT, 'docs', 'screens', 'terminal.md'), guide.data);
    }
  }
}

for (const target of targets.length ? targets : ['master']) await build(target);
