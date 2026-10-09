import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5178, host: true },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    // RC13.9: the one chunk over Rollup's 500 kB default is three.js itself
    // (~609 kB, its own long-cached chunk below; every module imports it as
    // a namespace, so there is nothing to shake). The limit sits just above
    // it so the warning still fires the day GAME code crosses 500 kB —
    // main is ~471 kB now that the definitions load on demand.
    chunkSizeWarningLimit: 620,
    rollupOptions: {
      output: {
        // RC10.4: three.js is roughly two thirds of the bundle and changes
        // about once a year, while the game changes every commit. Its own
        // chunk means a returning player re-downloads the game and keeps the
        // engine, and the two arrive in parallel on a first visit instead of
        // one after the other inside a single file.
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
});
