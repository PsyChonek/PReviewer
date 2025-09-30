const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
	packagerConfig: {
		asar: true,
	},
	rebuildConfig: {},
	makers: [
		// Only use ZIP maker for testing - much more reliable
		{
			name: '@electron-forge/maker-zip',
			platforms: ['win32', 'darwin', 'linux'],
		},
	],
	plugins: [
		{
			name: '@electron-forge/plugin-vite',
			config: {
				build: [
					{
						entry: 'src/main.js',
						config: 'vite.main.config.js',
						target: 'main',
					},
					{
						entry: 'src/preload.js',
						config: 'vite.preload.config.js',
						target: 'preload',
					},
				],
				renderer: [
					{
						name: 'main_window',
						config: 'vite.renderer.config.js',
					},
				],
			},
		},
	],
};
