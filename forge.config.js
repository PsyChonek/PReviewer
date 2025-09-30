const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const builtins = require('module').builtinModules;

module.exports = {
	packagerConfig: {
		out: 'build',
		asar: true,
		icon: './assets/icon',
		extraResource: ['.vite', 'assets'],
		ignore: [],
	},
	rebuildConfig: {},
	makers: [
		{ name: '@electron-forge/maker-squirrel', config: {} },
		{ name: '@electron-forge/maker-zip', platforms: ['darwin'] },
		{ name: '@electron-forge/maker-deb', config: {} },
		{ name: '@electron-forge/maker-rpm', config: {} },
	],
	plugins: [
		{
			name: '@electron-forge/plugin-vite',
			config: {
				build: [
					{ entry: 'src/main.js', config: 'vite.main.config.js' },
					{
						entry: 'src/preload.js',
						config: 'vite.preload.config.js',
					},
				],
				renderer: [{ name: 'main_window', config: 'vite.renderer.config.js' }],
			},
		},
		new FusesPlugin({
			version: FuseVersion.V1,
			[FuseV1Options.RunAsNode]: false,
			[FuseV1Options.EnableCookieEncryption]: true,
			[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
			[FuseV1Options.EnableNodeCliInspectArguments]: false,
			[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
			[FuseV1Options.OnlyLoadAppFromAsar]: false,
		}),
	],
};
