// The Olympus — service catalogue tool.
//
//   npm run service -- list
//   npm run service -- gods
//   npm run service -- categories
//   npm run service -- add --name "Vaultwarden" --category security [--god athena|monogram|logo]
//                          [--id vaultwarden] [--monogram V] [--logo path/to/logo.svg]
//                          [--caption "The Olympus · Vault"] [--url https://vault.theolympus.cloud]
//                          [--app vaultwarden] [--description "Password manager"] [--no-build]
//   npm run service -- apps                 (the applications with a theme kit, and which service themes each)
//   npm run service -- build [id …] [--warn-only]  (all services when no id is given)
//   npm run service -- index                (only the catalogue-wide files: index, boards, tables)
//   npm run service -- check [id …]        (validate and print-check, write nothing)
//   npm run service -- remove <id>

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadNodeFonts } from '../src/node/fonts.ts';
import { loadCatalog, writeSpec, CATALOG_DIR, SERVICES_DIR } from '../src/node/catalog.ts';
import { validateSpec, resolve, slugify, type ServiceSpec } from '../src/catalog/service.ts';
import { GODS, CATEGORIES } from '../src/geometry/pantheon.ts';
import { importLogo } from '../src/geometry/logo.ts';
import { THEME_KITS, themeAssignments, themeKit } from '../src/integrations/themes/index.ts';
import { buildService, buildIndex, SERVICES_OUT } from './lib/build-service.ts';
import { checkPrint } from '../src/print/service.ts';

loadNodeFonts();

const [command = 'help', ...rest] = process.argv.slice(2);
const flags: Record<string, string | true> = {};
const positional: string[] = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = rest[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else flags[key] = true;
  } else positional.push(a);
}
const flag = (k: string) => (typeof flags[k] === 'string' ? (flags[k] as string) : undefined);
const pad = (s: string, n: number) => s.padEnd(n);

function fail(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

function build(ids: string[]) {
  const all = loadCatalog();
  const targets = ids.length ? ids.map((id) => all.find((s) => s.id === id) ?? fail(`no service "${id}" in catalog/services/`)) : all;
  let failed = false;
  for (const s of targets) {
    const t0 = Date.now();
    const r = buildService(s);
    const ok = r.printOk;
    failed ||= !ok;
    console.log(`${ok ? '✔' : '✖'} ${pad(s.id, 18)} ${pad(s.caption, 26)} ${r.files} files · prints from Ø ${r.printMinDiameterMM} mm · ${Date.now() - t0} ms`);
    for (const w of r.warnings) console.log(`    ⚠ ${w}`);
  }
  buildIndex(all);
  console.log(`→ assets/services/ · docs/03-catalog.md · docs/catalog/*.png (${all.length} services)`);
  // --warn-only: a patron that loses detail in print is reported, not an error (the automatic rebuild uses it).
  if (failed && !flags['warn-only']) process.exit(1);
}

switch (command) {
  case 'list': {
    for (const s of loadCatalog()) console.log(`${pad(s.id, 18)} ${pad(s.name, 22)} ${pad(s.category, 15)} ${'god' in s.patron ? GODS[s.patron.god].name : 'logo' in s.patron ? 'its own logo' : `monogram ${s.letter}`}`);
    break;
  }
  case 'gods': {
    const used = new Map<string, string[]>();
    for (const s of loadCatalog()) if ('god' in s.patron) used.set(s.patron.god, [...(used.get(s.patron.god) ?? []), s.id]);
    for (const g of Object.values(GODS)) {
      if (g.id === 'zeus') continue;
      console.log(`${pad(g.id, 11)} ${pad(g.attribute, 38)} default for: ${pad(g.categories.join(', ') || '—', 15)} used by: ${(used.get(g.id) ?? []).join(', ') || '—'}`);
    }
    console.log(`${pad('monogram', 11)} the service's initial in Cinzel — for anything no god fits`);
    console.log(`${pad('logo', 11)} the service's own logo (with --logo); its initial in print when the logo is too fine`);
    break;
  }
  case 'categories': {
    for (const [k, v] of Object.entries(CATEGORIES)) {
      const g = Object.values(GODS).find((x) => x.categories.includes(k as keyof typeof CATEGORIES));
      console.log(`${pad(k, 15)} ${pad(g ? g.name : 'monogram', 11)} ${v}`);
    }
    break;
  }
  case 'apps': {
    const entries = loadCatalog();
    for (const { kit, entry, dir } of themeAssignments(entries)) {
      const how = entry ? (entry.app === kit.id ? `${entry.id} (names it)` : `${entry.id} (fits it)`) : 'the master (no service runs it)';
      console.log(`${pad(dir, 22)} ${pad(kit.label, 16)} from ${how}`);
    }
    for (const s of entries.filter((e) => e.app && !themeKit(e.app))) console.log(`⚠ ${s.id} runs "${s.app}", which has no theme kit`);
    console.log(`Name an application with --app <id> (${THEME_KITS.map((k) => k.id).join(', ')}).`);
    break;
  }
  case 'add': {
    const name = flag('name') ?? fail('--name is required');
    const id = flag('id') ?? slugify(name);
    if (existsSync(join(SERVICES_DIR, `${id}.json`)) && !flags.force) fail(`catalog/services/${id}.json already exists (use --force to overwrite)`);
    const spec: ServiceSpec = { id, name, category: (flag('category') ?? fail(`--category is required (${Object.keys(CATEGORIES).join(', ')})`)) as ServiceSpec['category'] };
    if (flag('god')) spec.god = flag('god') as ServiceSpec['god'];
    if (flag('monogram')) spec.monogram = flag('monogram');
    if (flag('caption')) spec.caption = flag('caption');
    if (flag('url')) spec.url = flag('url');
    if (flag('app')) {
      spec.app = flag('app');
      if (!themeKit(spec.app!)) console.log(`⚠ no theme kit for "${spec.app}" yet: the service is listed on dashboards, not themed (npm run service -- apps)`);
    }
    if (flag('description')) spec.description = flag('description');
    const logoSrc = flag('logo');
    if (logoSrc) {
      if (!existsSync(logoSrc)) fail(`logo file ${logoSrc} not found`);
      const { warnings } = importLogo(readFileSync(logoSrc, 'utf8'));
      for (const w of warnings) console.log(`⚠ logo: ${w}`);
      mkdirSync(join(CATALOG_DIR, 'logos'), { recursive: true });
      copyFileSync(logoSrc, join(CATALOG_DIR, 'logos', `${id}.svg`));
      spec.logo = `logos/${id}.svg`;
    }
    try {
      validateSpec(spec, 'new service');
    } catch (e) {
      fail((e as Error).message);
    }
    const s = resolve(spec);
    console.log(`✔ catalog/services/${id}.json — ${s.name} · ${s.category} · ${s.caption}`);
    writeSpec(spec);
    if (!flags['no-build']) build([id]);
    break;
  }
  case 'build':
    build(positional);
    break;
  case 'index':
    buildIndex(loadCatalog());
    console.log('✔ index, boards and tables');
    break;
  case 'check': {
    const all = loadCatalog();
    let failed = false;
    for (const s of positional.length ? all.filter((x) => positional.includes(x.id)) : all) {
      const { ok, minUnits: w, minDiameterMM: dmin } = checkPrint(s.patron);
      failed ||= !ok;
      console.log(`${ok ? '✔' : '✖'} ${pad(s.id, 18)} patron & slot ${w.toFixed(2)} u · whole crest prints from Ø ${Math.ceil(dmin)} mm`);
    }
    console.log(`✔ ${all.length} service files valid`);
    if (failed) process.exit(1);
    break;
  }
  case 'remove': {
    const id = positional[0] ?? fail('usage: npm run service -- remove <id>');
    const file = join(SERVICES_DIR, `${id}.json`);
    if (!existsSync(file)) fail(`no service "${id}"`);
    rmSync(file);
    rmSync(join(CATALOG_DIR, 'logos', `${id}.svg`), { force: true });
    rmSync(join(SERVICES_OUT, id), { recursive: true, force: true });
    console.log(`✔ removed ${id}`);
    buildIndex(loadCatalog());
    break;
  }
  default:
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split("\n").slice(2, 14).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}
