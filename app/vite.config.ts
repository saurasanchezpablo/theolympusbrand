import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app imports the brand geometry straight from ../src, so a logo made here
// is the same geometry as one built with `npm run service`.
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { fs: { allow: ['..'] } },
});
