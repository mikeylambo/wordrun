import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5178, host: true },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // RC10.4: three.js is roughly two thirds of the bundle and changes
        // about once a year, while the game changes every commit. Its own
        // chunk means a returning player re-downloads the game and keeps the
        // engine, and the two arrive in parallel on a first visit instead of
        // one after the other inside a single file.
        // The addons (glTF loader, meshopt) stay out of it: only the runner
        // model needs them, and it loads them after first paint.
        manualChunks: (id) => (id.includes('node_modules/three/build') ? 'three' : undefined),
      },
    },
  },
});
