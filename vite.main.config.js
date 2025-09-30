import { defineConfig } from 'vite';
import { builtinModules } from 'module';

export default defineConfig({
	resolve: {
		conditions: ['electron-main', 'node'],
	},
	build: {
		outDir: '.vite/build',
		rollupOptions: {
			external: ['electron', ...builtinModules],
		},
	},
});
