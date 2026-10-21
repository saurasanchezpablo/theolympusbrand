// Publishes the repository's own files under /files/ — the brand's assets,
// the guide, the catalogue, the master's printable models and stickers — with
// an index the site reads. In development they are served live from the
// repository; a build copies them next to the page.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

/** Repository folders published, and what they are. */
export const PUBLISHED = [
  { dir: 'assets/master', group: 'master', label: 'The master identity' },
  { dir: 'assets/services', group: 'services', label: 'Service logos' },
  { dir: 'assets/integrations', group: 'integrations', label: 'Dashboards and themes' },
  { dir: 'assets/screens', group: 'screens', label: 'Wallpapers, boot screens and terminal' },
  { dir: 'assets/map', group: 'map', label: 'The map' },
  { dir: 'manufacturing/3d/master', group: '3d', label: 'Printable models (master)' },
  { dir: 'manufacturing/stickers/master', group: 'stickers', label: 'Stickers (master)' },
  { dir: 'manufacturing/stickers/sheets', group: 'stickers', label: 'Sticker sheets' },
  { dir: 'catalog', group: 'catalog', label: 'Catalogue definitions' },
  { dir: 'docs', group: 'docs', label: 'The guide' },
] as const;

const TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.md': 'text/markdown; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
  '.stl': 'model/stl',
  '.3mf': 'model/3mf',
  '.scad': 'text/plain; charset=utf-8',
  '.yaml': 'text/plain; charset=utf-8',
  '.yml': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.sh': 'text/plain; charset=utf-8',
};

type Published = { path: string; size: number; title?: string; sha256?: string };

function walk(root: string, dir: string, out: Published[]) {
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(root, full, out);
    else {
      const path = relative(root, full).split(sep).join('/');
      // The guide's chapters carry their titles, so the site need not fetch each one to list them.
      const title = /^docs\/(?:[^/]+\/)?[^/]+\.md$/.test(path) ? readFileSync(full, 'utf8').match(/^#\s+(.+)$/m)?.[1] : undefined;
      // The installers carry their checksum, so a copy fetched elsewhere can be checked before it runs.
      const sha256 = name === 'install.sh' ? createHash('sha256').update(readFileSync(full)).digest('hex') : undefined;
      out.push({ path, size: st.size, ...(title ? { title } : {}), ...(sha256 ? { sha256 } : {}) });
    }
  }
}

/** Every published file, with its size. */
/** The one-command installer: in the index (with its checksum), and at the site's root as /install.sh. */
export const LAUNCHER = 'assets/install.sh';

export function publishedFiles(root: string) {
  const files: Published[] = [];
  const launcher = join(root, LAUNCHER);
  if (existsSync(launcher)) files.push({ path: LAUNCHER, size: statSync(launcher).size, sha256: createHash('sha256').update(readFileSync(launcher)).digest('hex') });
  for (const p of PUBLISHED) if (existsSync(join(root, p.dir))) walk(root, join(root, p.dir), files);
  return { groups: PUBLISHED.map((p) => ({ dir: p.dir, group: p.group, label: p.label })), files };
}

/** The site's own web manifest: installable, with the master's icons. */
export function siteManifest(): string {
  const icons = 'files/assets/master/web';
  return JSON.stringify(
    {
      name: 'The Olympus',
      short_name: 'Olympus',
      description: 'The house of theolympus.cloud: the Atelier, the catalogue, the guide and every file.',
      start_url: './#/',
      scope: './',
      display: 'standalone',
      background_color: '#FAFAFA',
      theme_color: '#0E0E0E',
      icons: [
        { src: `${icons}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `${icons}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: `${icons}/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  );
}

export function filesPlugin(root: string): Plugin {
  let outDir = '';
  return {
    name: 'olympus-files',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use('/site.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(siteManifest());
      });
      server.middlewares.use('/install.sh', (req, res, next) => {
        if ((req.url ?? '/').split('?')[0] !== '/' || !existsSync(join(root, LAUNCHER))) return next();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(readFileSync(join(root, LAUNCHER)));
      });
      server.middlewares.use('/files/', (req, res, next) => {
        const path = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '');
        if (path === 'index.json') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(publishedFiles(root)));
          return;
        }
        const ok = (path === LAUNCHER || PUBLISHED.some((p) => path === p.dir || path.startsWith(`${p.dir}/`))) && !path.includes('..');
        const full = join(root, path);
        if (!ok || !existsSync(full) || statSync(full).isDirectory()) return next();
        res.setHeader('Content-Type', TYPES[extname(full)] ?? 'application/octet-stream');
        res.end(readFileSync(full));
      });
    },
    // Only for the page's own bundle (the worker is bundled separately).
    writeBundle(options) {
      if (!options.dir || resolve(options.dir) !== outDir) return;
      const index = publishedFiles(root);
      for (const f of index.files) {
        const to = join(outDir, 'files', f.path);
        mkdirSync(dirname(to), { recursive: true });
        copyFileSync(join(root, f.path), to);
      }
      writeIndex(join(outDir, 'files', 'index.json'), index);
      writeFileSync(join(outDir, 'site.webmanifest'), siteManifest());
      if (existsSync(join(root, LAUNCHER))) copyFileSync(join(root, LAUNCHER), join(outDir, 'install.sh'));
    },
  };
}

function writeIndex(path: string, index: ReturnType<typeof publishedFiles>) {
  mkdirSync(dirname(path), { recursive: true });
  // No dates: the same repository always gives the same site.
  writeFileSync(path, JSON.stringify(index));
}
