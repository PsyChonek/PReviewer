#!/usr/bin/env node

// Custom test runner script for coordinating different test types

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const testType = args[0] || 'all';
const options = args.slice(1);

const testCommands = {
  unit: ['npx', 'jest', '--testPathPattern=tests/unit', '--verbose'],
  integration: ['npx', 'jest', '--testPathPattern=tests/integration', '--verbose'],
  renderer: ['npx', 'jest', '--testPathPattern=tests/renderer', '--verbose'],
  e2e: ['npx', 'playwright', 'test'],
  coverage: ['npx', 'jest', '--coverage', '--verbose'],
  watch: ['npx', 'jest', '--watch', '--verbose'],
  ci: ['npx', 'jest', '--ci', '--coverage', '--watchAll=false', '--verbose']
};

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running: ${command} ${args.join(' ')}\n`);

    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd()
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${command} completed successfully\n`);
        resolve(code);
      } else {
        console.log(`\n❌ ${command} failed with code ${code}\n`);
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error(`\n💥 Error running ${command}:`, error);
      reject(error);
    });
  });
}

async function runTests() {
  try {
    // Ensure build directory exists
    const distDir = path.join(__dirname, 'dist');
    if (!fs.existsSync(distDir)) {
      console.log('📦 Building CSS for tests...');
      await runCommand('npm', ['run', 'build-css-prod']);
    }

    switch (testType) {
      case 'unit':
        await runCommand(...testCommands.unit.concat(options));
        break;

      case 'integration':
        await runCommand(...testCommands.integration.concat(options));
        break;

      case 'renderer':
        await runCommand(...testCommands.renderer.concat(options));
        break;

      case 'e2e':
        console.log('🎭 Running Playwright end-to-end tests...');
        await runCommand(...testCommands.e2e.concat(options));
        break;

      case 'coverage':
        await runCommand(...testCommands.coverage.concat(options));
        break;

      case 'watch':
        console.log('👀 Starting Jest in watch mode...');
        await runCommand(...testCommands.watch.concat(options));
        break;

      case 'ci':
        console.log('🔄 Running CI test suite...');
        await runCommand(...testCommands.ci.concat(options));
        break;

      case 'all':
        console.log('🧪 Running all test suites...');

        console.log('\n1️⃣ Unit Tests');
        await runCommand(...testCommands.unit);

        console.log('\n2️⃣ Integration Tests');
        await runCommand(...testCommands.integration);

        console.log('\n3️⃣ Renderer Tests');
        await runCommand(...testCommands.renderer);

        console.log('\n4️⃣ End-to-End Tests');
        await runCommand(...testCommands.e2e);

        console.log('\n5️⃣ Coverage Report');
        await runCommand(...testCommands.coverage);

        console.log('\n🎉 All tests completed successfully!');
        break;

      case 'quick':
        console.log('⚡ Running quick test suite (unit + integration)...');

        await runCommand(...testCommands.unit);
        await runCommand(...testCommands.integration);

        console.log('\n⚡ Quick tests completed!');
        break;

      default:
        console.error(`\n❌ Unknown test type: ${testType}`);
        console.log('\nAvailable test types:');
        console.log('  unit         - Run unit tests only');
        console.log('  integration  - Run integration tests only');
        console.log('  renderer     - Run renderer/UI tests only');
        console.log('  e2e          - Run end-to-end tests only');
        console.log('  coverage     - Run all tests with coverage');
        console.log('  watch        - Run tests in watch mode');
        console.log('  ci           - Run tests in CI mode');
        console.log('  quick        - Run unit + integration tests');
        console.log('  all          - Run all test suites (default)');
        console.log('\nUsage: node test-runner.js [test-type] [options]');
        console.log('Example: node test-runner.js unit --verbose');
        process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Test execution failed:', error.message);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Test execution interrupted');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Test execution terminated');
  process.exit(143);
});

// Run tests
runTests().catch((error) => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});