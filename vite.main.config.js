import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    // Some libs that can run in both Web and Node.js environments will have exports
    // conditions for both. We need to tell Vite which conditions to use to resolve
    // these libs. Using `electron-main` and `node` conditions enables these libs to
    // run in the main process correctly.
    conditions: ['electron-main', 'node'],
  },
  build: {
    outDir: '.vite/build',
    rollupOptions: {
      external: [
        'simple-git',
        'axios',
        'openai',
        'marked',
        'zustand',
        'electron-squirrel-startup',
        '@fortawesome/fontawesome-free',
        '@tailwindcss/typography'
      ],
    },
  },
});