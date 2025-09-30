import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
	js.configs.recommended,
	{
		files: ['**/*.{ts,tsx,js,jsx}'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				// Node.js globals
				window: 'readonly',
				document: 'readonly',
				console: 'readonly',
				module: 'readonly',
				require: 'readonly',
				process: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly',
				Buffer: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				// Browser globals
				navigator: 'readonly',
				alert: 'readonly',
				confirm: 'readonly',
				localStorage: 'readonly',
				Blob: 'readonly',
				URL: 'readonly',
				ClipboardItem: 'readonly',
				fetch: 'readonly',
				// DOM types
				HTMLDetailsElement: 'readonly',
				HTMLDivElement: 'readonly',
				MouseEvent: 'readonly',
				Node: 'readonly',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
			react,
			'react-hooks': reactHooks,
		},
		rules: {
			...tseslint.configs.recommended.rules,
			...react.configs.recommended.rules,
			...reactHooks.configs.recommended.rules,
			'react/react-in-jsx-scope': 'off',
			'react/prop-types': 'off',
			'react/no-unescaped-entities': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_' },
			],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-empty-object-type': 'warn',
			'no-console': 'off',
			'react-hooks/exhaustive-deps': 'warn',
		},
		settings: {
			react: {
				version: 'detect',
			},
		},
	},
	// Electron main/preload files can use CommonJS
	{
		files: ['src/main.js', 'src/preload.js'],
		rules: {
			'@typescript-eslint/no-require-imports': 'off',
		},
	},
	{
		ignores: [
			'node_modules/**',
			'dist/**',
			'out/**',
			'.vite/**',
			'tests/**',
			'*.config.js',
			'*.config.ts',
		],
	},
];
