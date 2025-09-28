// Global setup for E2E tests

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

async function globalSetup() {
  console.log('Setting up E2E test environment...');

  // Build CSS if not already built
  const cssPath = path.join(__dirname, '../../src/compiled-styles.css');
  if (!existsSync(cssPath)) {
    console.log('Building CSS for tests...');
    execSync('npx @tailwindcss/cli@latest -i src/index.css -o src/compiled-styles.css', {
      cwd: path.join(__dirname, '../..'),
      stdio: 'inherit'
    });
  }

  // Create test fixtures directory
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!existsSync(fixturesDir)) {
    execSync(`mkdir -p "${fixturesDir}"`, { stdio: 'inherit' });
  }

  // Setup mock Git repository for testing
  const testRepoPath = path.join(fixturesDir, 'test-repo');
  if (!existsSync(testRepoPath)) {
    console.log('Creating test Git repository...');

    // Create test repository
    execSync(`mkdir -p "${testRepoPath}"`, { stdio: 'inherit' });
    execSync('git init', { cwd: testRepoPath, stdio: 'inherit' });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath, stdio: 'inherit' });
    execSync('git config user.name "Test User"', { cwd: testRepoPath, stdio: 'inherit' });

    // Create initial files and commit
    execSync(`echo "# Test Repository" > README.md`, { cwd: testRepoPath, stdio: 'inherit' });
    execSync(`echo "console.log('Hello World');" > app.js`, { cwd: testRepoPath, stdio: 'inherit' });
    execSync('git add .', { cwd: testRepoPath, stdio: 'inherit' });
    execSync('git commit -m "Initial commit"', { cwd: testRepoPath, stdio: 'inherit' });

    // Create feature branch with changes
    execSync('git checkout -b feature/test-changes', { cwd: testRepoPath, stdio: 'inherit' });
    execSync(`echo "console.log('Hello Test World');" > app.js`, { cwd: testRepoPath, stdio: 'inherit' });
    execSync(`echo "function testFunction() { return true; }" >> app.js`, { cwd: testRepoPath, stdio: 'inherit' });
    execSync('git add app.js', { cwd: testRepoPath, stdio: 'inherit' });
    execSync('git commit -m "Add test function"', { cwd: testRepoPath, stdio: 'inherit' });

    // Switch back to master (default branch)
    execSync('git checkout master', { cwd: testRepoPath, stdio: 'inherit' });
  }

  console.log('E2E test environment setup complete');
}

module.exports = globalSetup;