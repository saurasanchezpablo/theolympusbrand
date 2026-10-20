// The Olympus — integrations: dashboard configurations and theme kits.
//
//   npm run integrations                    → assets/integrations/
//   npm run integrations -- --icons-url https://brand.theolympus.cloud/files/assets/integrations/icons/
//   npm run integrations -- --out /path/to/folder
//
// Dashboards (Homepage, Dashy, Homer, bookmarks, a table for Heimdall and
// Homarr) list every service in the catalogue; theme kits (Nextcloud,
// Jellyfin, Proxmox VE, Grafana, Uptime Kuma) carry the matching service's
// seal. --icons-url makes the dashboards load the icons from a URL instead of
// their own icon folders (written to --out only, never to the repository).

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { loadNodeFonts } from '../src/node/fonts.ts';
import { loadCatalog, logoOf } from '../src/node/catalog.ts';
import { baseMarks } from '../src/catalog/fileset.ts';
import { crest, emblem, seal } from '../src/geometry/crest.ts';
import { integrationKit, type KitMarks } from '../src/integrations/kit.ts';
import type { DashboardOptions } from '../src/integrations/dashboards.ts';
import { ROOT } from './lib/build-service.ts';

loadNodeFonts();
const args = process.argv.slice(2);
const flag = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const fail = (m: string): never => {
  console.error(`✖ ${m}`);
  process.exit(1);
};
if (args.includes('help') || args.includes('--help')) {
  console.log('npm run integrations [-- --icons-url <url>] [--out <folder>]');
  process.exit(0);
}

const iconsUrl = flag('icons-url');
if (iconsUrl !== undefined && !/^https?:\/\/\S+$/.test(iconsUrl)) fail('--icons-url wants an http(s) address');
const defaultOut = join(ROOT, 'assets', 'integrations');
const out = flag('out') ? resolve(flag('out')!) : defaultOut;
if (iconsUrl && out === defaultOut) fail('--icons-url writes a personal copy: give it an --out folder');
const opts: DashboardOptions = iconsUrl ? { icons: { kind: 'url', base: iconsUrl } } : {};

const services = loadCatalog();
const cache = new Map<string, KitMarks>();
const marks = (id: string): KitMarks => {
  if (!cache.has(id)) {
    if (id === 'master') cache.set(id, { seal: seal(), emblem: emblem(), crest: crest() });
    else {
      const s = services.find((x) => x.id === id)!;
      const m = baseMarks(s.patron, logoOf(s)?.d);
      cache.set(id, { seal: m.seal, emblem: m['emblem-fine'], crest: m['crest-fine'] });
    }
  }
  return cache.get(id)!;
};

const files = await integrationKit(
  { entries: services.map((s) => ({ id: s.id, name: s.name, category: s.category, description: s.description, url: s.url })), marks },
  { png: (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng() },
  opts,
);
rmSync(out, { recursive: true, force: true });
let bytes = 0;
for (const f of files) {
  const path = join(out, f.path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, f.data, f.path.endsWith('.sh') ? { mode: 0o755 } : {});
  bytes += typeof f.data === 'string' ? Buffer.byteLength(f.data) : f.data.length;
}
console.log(`✔ ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB → ${out}`);
