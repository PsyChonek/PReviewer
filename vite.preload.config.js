import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    outDir: '.vite/build',
    rollupOptions: {
      external: ['electron']
    }
  },
  resolve: {
    // Some libs that can run in both Web and Node.js environments will have exports
    // conditions for both. We need to tell Vite which conditions to use to resolve
    // these libs. Using `electron-preload` and `node` conditions enables these libs to
    // run in the preload script correctly.
    conditions: ['electron-preload', 'node'],
  },
});