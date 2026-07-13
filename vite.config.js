import { defineConfig } from 'vite';

// Vanilla JS + ES modules. No framework. Static frame sequences live in /public/sequences.
export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2020',
    sourcemap: false
  },
  server: {
    port: 5173
  }
});
