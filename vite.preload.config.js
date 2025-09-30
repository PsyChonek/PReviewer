import { defineConfig } from 'vite';
import { builtinModules } from 'module';

export default defineConfig({
	build: {
		outDir: '.vite/build',
		rollupOptions: {
			external: ['electron', ...builtinModules],
		},
	},
	resolve: {
		conditions: ['electron-preload', 'node'],
	},
});
