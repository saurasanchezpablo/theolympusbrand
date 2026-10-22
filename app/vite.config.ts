import { defineConfig, type Connect, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { join } from 'node:path';
import { filesPlugin } from './files-plugin.ts';

// The app imports the brand geometry straight from ../src, so a logo made here
// is the same geometry as one built with `npm run service`. The site also
// publishes the repository's files (assets, guide, models) under /files/.
/**
 * The built page carries its own content policy, so it is protected behind
 * any web server — not only behind the house's nginx, which sends the same.
 * (Not in development: the dev server needs inline scripts.)
 */
const contentPolicy = (): Plugin => ({
  name: 'olympus-content-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'self'",
      },
      injectTo: 'head-prepend',
    },
  ],
});

/**
 * /api/ — the map's edit API, in the dev server itself (as in the house's own
 * server, scripts/serve.ts) when OLYMPUS_DATA names a data folder; otherwise
 * the plain answer a site without it gives. Changes are saved, not published:
 * there is no release to rebuild here.
 */
const editorApi = (): Plugin => {
  type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  let handler: Promise<Handler> | null = null;
  const load = (): Promise<Handler> =>
    (handler ??= process.env.OLYMPUS_DATA
      ? import(pathToFileURL(join(import.meta.dirname, '../scripts/lib/editor/server.ts')).href).then((m: { createEditorApi: () => { handle: Handler } }) => m.createEditorApi().handle)
      : Promise.resolve(async (_req, res) => {
          res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
          res.end('{"editor":false}');
        }));
  const mount = (server: { middlewares: Connect.Server }): void => {
    server.middlewares.use((req, res, next) => {
      const path = (req.url ?? '').split('?')[0];
      if (path !== '/api' && !path.startsWith('/api/')) return next();
      load()
        .then((h) => h(req, res))
        .catch(next);
    });
  };
  return { name: 'olympus-editor-api', configureServer: mount, configurePreviewServer: mount };
};

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [react(), tailwindcss(), contentPolicy(), filesPlugin(join(import.meta.dirname, '..')), editorApi()],
  // `@/…` is app/src — the alias shadcn/ui and Aceternity components are written against.
  resolve: { alias: { '@': join(import.meta.dirname, 'src') } },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { fs: { allow: ['..'] } },
});
