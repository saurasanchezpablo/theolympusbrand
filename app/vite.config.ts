import { defineConfig, type Plugin } from 'vite';
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

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [react(), tailwindcss(), contentPolicy(), filesPlugin(join(import.meta.dirname, '..'))],
  // `@/…` is app/src — the alias shadcn/ui and Aceternity components are written against.
  resolve: { alias: { '@': join(import.meta.dirname, 'src') } },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { fs: { allow: ['..'] } },
});
