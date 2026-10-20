import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { join } from 'node:path';
import { filesPlugin } from './files-plugin.ts';

// The app imports the brand geometry straight from ../src, so a logo made here
// is the same geometry as one built with `npm run service`. The site also
// publishes the repository's files (assets, guide, models) under /files/.
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [react(), filesPlugin(join(import.meta.dirname, '..'))],
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { fs: { allow: ['..'] } },
});
