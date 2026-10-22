// The map's files, built with the site (npm run map, part of npm run build):
//
//   assets/map/terrain.bin   the island, graded to its city — the same every time; kept in the repository
//   assets/map/city.json     the city: streets, plots, squares, walls, walkways, furniture — kept too
//   assets/map/items.json    every service and machine, its building and place, its card
//   assets/map/still.png     the island from above, for phones and browsers without WebGL
//   assets/map/logos/        the logos the cards show
//
// items.json, still.png and logos/ come from the server's own data as well as
// the catalogue, so they are made on each server and never kept in git.

import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalog, CATALOG_DIR } from '../src/node/catalog.ts';
import { dataLogo, loadMachines, loadPlaces } from '../src/node/data.ts';
import { encodeTerrain } from '../src/map/terrain.ts';
import { island } from '../src/node/island.ts';
import { mapData } from '../src/map/items.ts';
import { stillImage } from '../src/map/still.ts';
import { png } from '../src/export/png.ts';

const OUT = new URL('../assets/map/', import.meta.url).pathname;
const t0 = Date.now();
mkdirSync(OUT, { recursive: true });
const { land: terrain, plan } = island();
writeFileSync(join(OUT, 'terrain.bin'), encodeTerrain(terrain));
writeFileSync(join(OUT, 'city.json'), JSON.stringify(plan) + '\n');

const services = loadCatalog();
const machines = loadMachines();
// The logos the cards show: the server's own first, then the catalogue's.
rmSync(join(OUT, 'logos'), { recursive: true, force: true });
mkdirSync(join(OUT, 'logos'), { recursive: true });
const logos = new Set<string>();
for (const item of [...services, ...machines]) {
  if (!item.logo) continue;
  const own = dataLogo(item.id);
  const repo = join(CATALOG_DIR, item.logo);
  const from = own ?? (existsSync(repo) ? repo : null);
  if (!from) continue;
  copyFileSync(from, join(OUT, 'logos', `${item.id}.svg`));
  logos.add(item.id);
}
const data = mapData(services, machines, loadPlaces(), plan, logos);
if (data.unplaced.length) console.warn(`⚠ no room on the island for: ${data.unplaced.map((u) => u.name).join(', ')}`);
writeFileSync(join(OUT, 'items.json'), JSON.stringify(data, null, 2) + '\n');
const px = 1600;
writeFileSync(join(OUT, 'still.png'), png(stillImage(terrain, plan, data, px), px, px, 1));
console.log(`✔ the map: ${data.items.length} buildings (${machines.length} machine${machines.length === 1 ? "" : "s"}), ${((Date.now() - t0) / 1000).toFixed(1)} s → assets/map/`);
