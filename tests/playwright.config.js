// Playwright configuration for end-to-end tests

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Test directory
  testDir: './e2e',

  // Global timeout for all tests
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000
  },

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html'],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],

  // Global setup and teardown
  globalSetup: require.resolve('./e2e/global-setup.js'),
  globalTeardown: require.resolve('./e2e/global-teardown.js'),

  // Shared settings for all projects
  use: {
    // Base URL for Electron app
    baseURL: 'file://',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot settings
    screenshot: 'only-on-failure',

    // Video settings
    video: 'retain-on-failure',

    // Ignore HTTPS errors for local testing
    ignoreHTTPSErrors: true,

    // Locale
    locale: 'en-US',

    // Timezone
    timezoneId: 'America/New_York'
  },

  // Configure projects for different Electron scenarios
  projects: [
    {
      name: 'electron-main',
      testMatch: '**/electron-*.spec.js',
      use: {
        // Electron-specific settings
        channel: 'chrome', // Use Chromium
        launchOptions: {
          slowMo: 50, // Slow down by 50ms
          args: ['--disable-web-security'] // For testing
        }
      }
    },
    {
      name: 'electron-renderer',
      testMatch: '**/renderer-*.spec.js',
      use: {
        // Renderer process specific settings
        channel: 'chrome'
      }
    }
  ],

  // Output directory
  outputDir: 'test-results/',

  // Whether to update snapshots
  updateSnapshots: 'missing'
});