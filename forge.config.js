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
		{
			name: '@electron-forge/maker-squirrel',
			config: {
				// Create shortcuts on desktop and start menu
				setupIcon: './assets/icon.ico',
				loadingGif: './assets/install-spinner.gif',
				// Shortcuts configuration
				shortcutFolderName: 'PReviewer',
				createDesktopShortcut: true,
				createStartMenuShortcut: true,
			},
		},
		{ name: '@electron-forge/maker-deb', config: {} },
		{ name: '@electron-forge/maker-rpm', config: {} },
		{
			name: '@electron-forge/maker-dmg',
			config: {
				background: './assets/dmg-background.png',
				format: 'ULFO',
				contents: (opts) => [
					{ x: 180, y: 200, type: 'file', path: opts.appPath },
					{ x: 460, y: 200, type: 'link', path: '/Applications' },
				],
			},
		},
	],
	plugins: [
		{
			name: '@electron-forge/plugin-vite',
			config: {
				build: [
					{ entry: 'src/main.ts', config: 'vite.main.config.js' },
					{
						entry: 'src/preload.ts',
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
