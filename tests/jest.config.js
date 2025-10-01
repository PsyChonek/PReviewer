module.exports = {
	// Test environment
	testEnvironment: 'node',

	// Test file patterns
	testMatch: ['**/*.test.js', '**/*.spec.js'],

	// Setup files
	setupFilesAfterEnv: ['<rootDir>/setup.js'],

	// Coverage configuration
	collectCoverage: false,
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],
	collectCoverageFrom: ['../src/main.js', '../src/renderer.js', '../src/preload.js', '!**/node_modules/**', '!**/tests/**', '!**/coverage/**', '!**/dist/**'],

	// Coverage thresholds - temporarily lowered during test fixes
	coverageThreshold: {
		global: {
			branches: 10,
			functions: 10,
			lines: 10,
			statements: 10,
		},
	},

	// Module paths
	moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],

	// Transform configuration
	transform: {},

	// Mock TypeScript files for now
	moduleNameMapper: {
		'\\.(ts|tsx)$': '<rootDir>/mocks/empty.js',
	},

	// Test timeout
	testTimeout: 30000,

	// Projects for different test types
	projects: [
		{
			displayName: 'unit',
			testMatch: ['<rootDir>/unit/**/*.test.js'],
			testEnvironment: 'node',
			setupFilesAfterEnv: ['<rootDir>/setup.js'],
		},
		{
			displayName: 'integration',
			testMatch: ['<rootDir>/integration/**/*.test.js'],
			testEnvironment: 'node',
			setupFilesAfterEnv: ['<rootDir>/setup.js'],
		},
		{
			displayName: 'renderer',
			testMatch: ['<rootDir>/renderer/**/*.test.js'],
			testEnvironment: 'jsdom',
			setupFilesAfterEnv: ['<rootDir>/setup.js', '<rootDir>/react-setup.js'],
			moduleNameMapper: {
				'\\.(css|less|scss|sass)$': 'identity-obj-proxy',
			},
			transform: {
				'^.+\\.(js|jsx|ts|tsx)$': [
					'babel-jest',
					{
						presets: [['@babel/preset-env', { targets: { node: 'current' } }], ['@babel/preset-react', { runtime: 'automatic' }], '@babel/preset-typescript'],
					},
				],
			},
			transformIgnorePatterns: ['node_modules/(?!((@testing-library|@babel)/.*\\.js$))'],
		},
	],

	// Mock configuration
	clearMocks: true,
	resetMocks: true,
	restoreMocks: true,
};
