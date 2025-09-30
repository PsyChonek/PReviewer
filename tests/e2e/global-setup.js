// Global setup for E2E tests

const { execSync } = require('child_process');
const { existsSync, mkdirSync, writeFileSync } = require('fs');
const path = require('path');

async function globalSetup() {
	console.log('Setting up E2E test environment...');

	// Build renderer with Vite (which includes CSS processing)
	const rendererDistPath = path.join(__dirname, '../../dist/renderer');
	if (!existsSync(rendererDistPath)) {
		console.log('Building renderer for tests...');
		execSync('vite build --config vite.renderer.config.js', {
			cwd: path.join(__dirname, '../..'),
			stdio: 'inherit',
		});
	}

	// Create test fixtures directory
	const fixturesDir = path.join(__dirname, 'fixtures');
	if (!existsSync(fixturesDir)) {
		mkdirSync(fixturesDir, { recursive: true });
	}

	// Setup mock Git repository for testing
	const testRepoPath = path.join(fixturesDir, 'test-repo');
	if (!existsSync(testRepoPath)) {
		console.log('Creating test Git repository...');

		// Create test repository
		mkdirSync(testRepoPath, { recursive: true });
		execSync('git init', { cwd: testRepoPath, stdio: 'inherit' });
		execSync('git config user.email "test@example.com"', {
			cwd: testRepoPath,
			stdio: 'inherit',
		});
		execSync('git config user.name "Test User"', {
			cwd: testRepoPath,
			stdio: 'inherit',
		});

		// Create initial files and commit
		writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Repository');
		writeFileSync(
			path.join(testRepoPath, 'app.js'),
			"console.log('Hello World');"
		);
		execSync('git add .', { cwd: testRepoPath, stdio: 'inherit' });
		execSync('git commit -m "Initial commit"', {
			cwd: testRepoPath,
			stdio: 'inherit',
		});

		// Create feature branch with changes
		execSync('git checkout -b feature/test-changes', {
			cwd: testRepoPath,
			stdio: 'inherit',
		});
		writeFileSync(
			path.join(testRepoPath, 'app.js'),
			"console.log('Hello Test World');\nfunction testFunction() { return true; }"
		);
		execSync('git add app.js', { cwd: testRepoPath, stdio: 'inherit' });
		execSync('git commit -m "Add test function"', {
			cwd: testRepoPath,
			stdio: 'inherit',
		});

		// Switch back to master (default branch)
		execSync('git checkout master', {
			cwd: testRepoPath,
			stdio: 'inherit',
		});
	}

	console.log('E2E test environment setup complete');
}

module.exports = globalSetup;
