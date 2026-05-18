import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Build relative paths to support both root Vercel deployments and GitHub Pages subfolders
  root: '.',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: true,
  },
});
