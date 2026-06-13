import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './', // Build relative paths to support both root Vercel deployments and GitHub Pages subfolders
  root: '.',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html')
      }
    }
  },
  server: {
    port: 5173,
    open: true,
  },
});
