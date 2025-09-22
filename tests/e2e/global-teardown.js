// Global teardown for E2E tests

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

async function globalTeardown() {
  console.log('Cleaning up E2E test environment...');

  try {
    // Clean up test fixtures
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (fs.existsSync(fixturesDir)) {
      console.log('Removing test fixtures...');
      await fs.remove(fixturesDir);
    }

    // Kill any remaining Electron processes
    try {
      if (process.platform === 'win32') {
        execSync('taskkill /f /im electron.exe', { stdio: 'ignore' });
      } else {
        execSync('pkill -f electron || true', { stdio: 'ignore' });
      }
    } catch (error) {
      // Ignore errors - processes might not be running
    }

    console.log('E2E test environment cleanup complete');
  } catch (error) {
    console.error('Error during teardown:', error);
  }
}

module.exports = globalTeardown;