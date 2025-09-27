import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig(async () => {
  const { default: tailwindcss } = await import('@tailwindcss/vite');

  return {
    plugins: [react(), tailwindcss()],
    root: 'src',
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'src/index.html'),
      },
      outDir: '../dist/renderer',
      emptyOutDir: true,
    },
    server: {
      port: 3002,
      strictPort: true,
    },
  };
});