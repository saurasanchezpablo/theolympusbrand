// Builds every file for one service, and the catalogue-wide index, boards and docs.

import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { crest, seal } from '../../src/geometry/crest.ts';
import { GODS, CATEGORIES } from '../../src/geometry/pantheon.ts';
import { productionSvg } from '../../src/render/svg.ts';
import { checkPrint, PRINTER_MM, PRINT_MIN_UNITS } from '../../src/print/service.ts';
import { PALETTE } from '../../src/brand/palette.ts';
import { logoOf } from '../../src/node/catalog.ts';
import type { Service } from '../../src/catalog/service.ts';
import { serviceMarks, svgFiles, rasterJobs, FAVICON } from '../../src/catalog/fileset.ts';
import { ico } from '../../src/export/ico.ts';
import { webIcons } from '../../src/catalog/webicons.ts';
import { board, header, text, place, pixels } from './board.ts';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SERVICES_OUT = join(ROOT, 'assets', 'services');

const png = (svg: string, width: number) => new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();

export type ServiceReport = { id: string; name: string; files: number; printOk: boolean; printMinUnits: number; printMinDiameterMM: number; warnings: string[] };

export function buildService(s: Service): ServiceReport {
  const out = join(SERVICES_OUT, s.id);
  rmSync(out, { recursive: true, force: true });
  const files: { path: string; sha256: string }[] = [];
  const write = (rel: string, data: string | Uint8Array) => {
    const path = join(out, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data);
    files.push({ path: relative(out, path), sha256: createHash('sha256').update(data).digest('hex') });
  };
  const warnings: string[] = [];
  const logo = logoOf(s);
  if (logo) warnings.push(...logo.warnings.map((w) => `logo: ${w}`));

  const marks = serviceMarks(s, logo?.d);
  for (const f of svgFiles(s, marks)) write(f.path, f.svg);
  for (const j of rasterJobs(s, marks)) write(j.path, png(j.svg, j.width));
  const favicon = ico(FAVICON.sizes.map((size) => ({ size, png: png(FAVICON.svg(marks), size) })));
  write('favicon.ico', favicon);
  // The web icon set: drop web/ into a service's static files or theme.
  const web = webIcons(marks.seal, { name: `${s.name} · The Olympus`, short: s.name });
  for (const f of web.files) write(`web/${f.path}`, f.data);
  for (const r of web.rasters) write(`web/${r.path}`, png(r.svg, r.width));
  write('web/favicon.ico', favicon);

  // Preview board.
  {
    const W = 1600;
    let b = header(W, s.name.toUpperCase(), `${s.caption.toUpperCase()} · ${s.category.toUpperCase()}${s.description ? ` · ${s.description.toUpperCase()}` : ''}`);
    b += place(productionSvg(marks['crest-fine'], { ground: 'light' }), 64, 170, 420) + text(64, 616, 'Crest · fine', { size: 13, fill: PALETTE.slate });
    b += place(productionSvg(marks['crest-print'], { ground: 'light' }), 520, 170, 420) + text(520, 616, 'Crest · print', { size: 13, fill: PALETTE.slate });
    b += place(productionSvg(marks['emblem-fine'], { ground: 'light' }), 976, 170, 200) + text(976, 396, 'Emblem', { size: 13, fill: PALETTE.slate });
    b += place(productionSvg(marks.seal, { ground: 'light' }), 1212, 170, 200) + text(1212, 396, 'Seal', { size: 13, fill: PALETTE.slate });
    b += pixels(productionSvg(marks.seal, { ground: 'light' }), 976, 430, 32) + pixels(productionSvg(marks.seal, { ground: 'light' }), 1060, 430, 16);
    b += text(976, 520, '32 px · 16 px (shown 2×)', { size: 13, fill: PALETTE.slate });
    const lh = marks['lockup-horizontal'];
    const lw = 1472;
    const lhH = (lw * 512) / lh.width!;
    const shownH = Math.min(220, lhH);
    const shownW = (shownH * lh.width!) / 512;
    b += `<rect x="64" y="660" width="${W - 128}" height="${shownH + 48}" fill="${PALETTE.paper}"/>`;
    b += productionSvg(lh, { ground: 'light' }).replace(/<svg [^>]*>/, `<svg x="88" y="684" width="${shownW}" height="${shownH}" viewBox="0 0 ${lh.width} 512">`).replace(/<title>[^<]*<\/title>/, '');
    b += `<rect x="64" y="${684 + shownH + 48}" width="${W - 128}" height="${shownH + 48}" fill="${PALETTE.obsidian}"/>`;
    b += productionSvg(lh, { ground: 'dark' }).replace(/<svg [^>]*>/, `<svg x="88" y="${684 + shownH + 72}" width="${shownW}" height="${shownH}" viewBox="0 0 ${lh.width} 512">`).replace(/<title>[^<]*<\/title>/, '');
    const pc = checkPrint(s.patron);
    const y = 684 + 2 * shownH + 150;
    b += text(64, y, `Print edition prints from Ø ${pc.minDiameterMM} mm on a 0.4 mm nozzle${warnings.length ? ` · ${warnings.length} logo warning(s)` : ''}`, { size: 14 });
    const pathPng = join(out, 'preview.png');
    board(pathPng, W, y + 40, PALETTE.paper, b);
    files.push({ path: 'preview.png', sha256: createHash('sha256').update(readFileSync(pathPng)).digest('hex') });
  }

  const pc = checkPrint(s.patron);
  if (!pc.ok) warnings.push(`print: the patron or slot loses detail at ${PRINT_MIN_UNITS} u (smallest clean feature ${pc.minUnits} u)`);
  const report: ServiceReport = { id: s.id, name: s.name, files: files.length + 1, printOk: pc.ok, printMinUnits: pc.minUnits, printMinDiameterMM: pc.minDiameterMM, warnings };
  write(
    'manifest.json',
    JSON.stringify({ service: { id: s.id, name: s.name, category: s.category, patron: s.patron, letter: s.letter, caption: s.caption, logo: s.logo ?? null }, print: { variablePartsMinUnits: report.printMinUnits, minDiameterMM: report.printMinDiameterMM, featureMM: PRINTER_MM }, warnings, files }, null, 2) + '\n',
  );
  return report;
}

/* ---------------------------------------------------------------- */
/* Catalogue-wide outputs                                            */
/* ---------------------------------------------------------------- */

export function buildIndex(services: Service[]): void {
  mkdirSync(SERVICES_OUT, { recursive: true });
  writeFileSync(
    join(SERVICES_OUT, 'index.json'),
    JSON.stringify(services.map((s) => ({ id: s.id, name: s.name, category: s.category, patron: s.patron, caption: s.caption, url: s.url ?? null, path: `${s.id}/` })), null, 2) + '\n',
  );
  // Overview board: every service's crest with its name and patron.
  const cols = 4;
  const cell = 400;
  const W = 64 * 2 + cols * cell;
  const rows = Math.ceil(services.length / cols);
  let b = header(W, 'THE PANTHEON', `${services.length} SERVICES · ONE TEMPLE · EACH WITH ITS GOD`);
  services.forEach((s, i) => {
    const x = 64 + (i % cols) * cell;
    const y = 170 + Math.floor(i / cols) * 470;
    b += place(productionSvg(crest({ patron: s.patron }), { ground: 'light' }), x, y, 360);
    b += text(x, y + 392, s.name.toUpperCase(), { size: 17, font: 'semibold', spacing: 0.12 });
    b += text(x, y + 416, `${'god' in s.patron ? GODS[s.patron.god].name : 'MONOGRAM'} · ${s.category}`, { size: 13, fill: PALETTE.slate });
  });
  board(join(ROOT, 'docs', 'catalog', 'overview.png'), W, 170 + rows * 470 + 20, PALETTE.paper, b);
  // Seals board, at true pixel sizes.
  let sb = header(W, 'SEALS', 'EVERY SERVICE AT FAVICON SIZE · 64, 32 AND 16 PX (SMALL SIZES SHOWN 2×)');
  services.forEach((s, i) => {
    const x = 64 + (i % cols) * cell;
    const y = 170 + Math.floor(i / cols) * 190;
    const sv = productionSvg(seal({ patron: s.patron }), { ground: 'light' });
    sb += pixels(sv, x, y, 64, 1) + pixels(sv, x + 84, y, 32) + pixels(sv, x + 160, y, 16);
    sb += text(x, y + 100, s.name.toUpperCase(), { size: 14, font: 'semibold', spacing: 0.12 });
  });
  board(join(ROOT, 'docs', 'catalog', 'seals.png'), W, 170 + Math.ceil(services.length / cols) * 190 + 10, PALETTE.paper, sb);
  writeCatalogDoc(services);
}

/** Replace the text between `<!-- name:begin … -->` and `<!-- name:end -->`. */
function between(doc: string, name: string, body: string): string {
  const a = doc.indexOf(`<!-- ${name}:begin`);
  const z = doc.indexOf(`<!-- ${name}:end -->`);
  if (a < 0 || z < 0) throw new Error(`docs/03-catalog.md is missing the ${name} markers`);
  const open = doc.indexOf('-->', a) + 3;
  return doc.slice(0, open) + '\n\n' + body + '\n\n' + doc.slice(z);
}

const sentence = (s: string) => s[0].toUpperCase() + s.slice(1).toLowerCase();

function writeCatalogDoc(services: Service[]): void {
  const file = join(ROOT, 'docs', '03-catalog.md');
  let doc = readFileSync(file, 'utf8');
  const pantheon = Object.entries(CATEGORIES).map(([c, domain]) => {
    const g = Object.values(GODS).find((x) => x.categories.includes(c as keyof typeof CATEGORIES));
    return `| ${c} | ${g ? sentence(g.name) : '—'} | ${g ? g.attribute : 'The service’s initial, as a monogram'} | ${domain} |`;
  });
  doc = between(doc, 'pantheon', ['| Category | Patron | Attribute | Domain |', '|---|---|---|---|', ...pantheon].join('\n'));
  const rows = services.map((s) => {
    const patron = 'god' in s.patron ? `${sentence(GODS[s.patron.god].name)} — ${GODS[s.patron.god].attribute.toLowerCase()}` : `Monogram ${s.letter}`;
    return `| <img src="../assets/services/${s.id}/png/the-olympus-${s.id}-seal-64.png" width="32"> | **${s.name}** | ${s.category} | ${patron} | [files](../assets/services/${s.id}/) |`;
  });
  doc = between(doc, 'catalog', ['| | Service | Category | Patron | |', '|---|---|---|---|---|', ...rows].join('\n'));
  writeFileSync(file, doc);
}

