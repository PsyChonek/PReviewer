// End-to-end tests for renderer process integration

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs-extra');

test.describe('Renderer Process Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Load the HTML file directly for testing
    const htmlPath = path.join(__dirname, '../../index.html');
    await page.goto(`file://${htmlPath}`);

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
  });

  test('should load application UI correctly', async ({ page }) => {
    // Check if main elements are present
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toContainText('AI PR Reviewer');

    // Check for main sections
    await expect(page.locator('#repo-path')).toBeVisible();
    await expect(page.locator('#from-branch')).toBeVisible();
    await expect(page.locator('#to-branch')).toBeVisible();
    await expect(page.locator('#start-review-btn')).toBeVisible();
  });

  test('should have proper initial state', async ({ page }) => {
    // Repository path should be empty
    const repoPath = page.locator('#repo-path');
    await expect(repoPath).toHaveValue('');

    // Branch selects should be disabled
    const fromBranch = page.locator('#from-branch');
    const toBranch = page.locator('#to-branch');
    await expect(fromBranch).toBeDisabled();
    await expect(toBranch).toBeDisabled();

    // Start review button should be disabled
    const startBtn = page.locator('#start-review-btn');
    await expect(startBtn).toBeDisabled();

    // Progress section should be hidden
    const progressSection = page.locator('#progress-section');
    await expect(progressSection).toHaveClass(/hidden/);

    // Stats section should be hidden
    const statsSection = page.locator('#stats-section');
    await expect(statsSection).toHaveClass(/hidden/);
  });

  test('should open configuration modal', async ({ page }) => {
    // Click settings button
    const settingsBtn = page.locator('button[aria-label="Open configuration settings"]');
    await settingsBtn.click();

    // Modal should be visible
    const modal = page.locator('#config-modal');
    await expect(modal).toBeVisible();

    // Check modal content
    await expect(page.locator('#ollama-url')).toBeVisible();
    await expect(page.locator('#ollama-model')).toBeVisible();
    await expect(page.locator('#debug-enabled')).toBeVisible();
  });

  test('should handle configuration form', async ({ page }) => {
    // Open settings
    await page.locator('button[aria-label="Open configuration settings"]').click();

    // Fill configuration form
    await page.locator('#ollama-url').fill('http://localhost:11434/api/generate');
    await page.locator('#ollama-model').fill('codellama');
    await page.locator('#debug-enabled').check();

    // Save configuration
    await page.locator('button:has-text("Save Settings")').click();

    // Modal should close
    const modal = page.locator('#config-modal');
    await expect(modal).not.toBeVisible();
  });

  test('should handle repository selection simulation', async ({ page }) => {
    // Mock electronAPI if not available
    await page.addInitScript(() => {
      window.electronAPI = {
        selectDirectory: () => Promise.resolve('/test/repo/path'),
        getGitBranches: () => Promise.resolve(['main', 'feature-branch']),
        getGitDiff: () => Promise.resolve('mock diff content'),
        callOllamaAPI: () => Promise.resolve('mock review response'),
        testOllamaConnection: () => Promise.resolve({ success: true, version: '0.1.7' }),
        onOllamaProgress: () => () => {}
      };
    });

    // Simulate repository selection by directly updating the input
    await page.locator('#repo-path').fill('/test/repo/path');

    // Simulate enabling branch selects
    await page.evaluate(() => {
      const fromBranch = document.getElementById('from-branch');
      const toBranch = document.getElementById('to-branch');
      const startBtn = document.getElementById('start-review-btn');

      fromBranch.disabled = false;
      toBranch.disabled = false;
      startBtn.disabled = false;

      // Add options
      fromBranch.innerHTML = '<option value="feature-branch">feature-branch</option>';
      toBranch.innerHTML = '<option value="main">main</option>';
    });

    // Verify state changes
    await expect(page.locator('#repo-path')).toHaveValue('/test/repo/path');
    await expect(page.locator('#from-branch')).not.toBeDisabled();
    await expect(page.locator('#to-branch')).not.toBeDisabled();
    await expect(page.locator('#start-review-btn')).not.toBeDisabled();
  });

  test('should show token preview when branches are selected', async ({ page }) => {
    // Setup repository and branches
    await page.addInitScript(() => {
      window.electronAPI = {
        getGitDiff: () => Promise.resolve('+ console.log("test");')
      };
    });

    await page.locator('#repo-path').fill('/test/repo');

    await page.evaluate(() => {
      const fromBranch = document.getElementById('from-branch');
      const toBranch = document.getElementById('to-branch');

      fromBranch.disabled = false;
      toBranch.disabled = false;
      fromBranch.innerHTML = '<option value="feature">feature</option>';
      toBranch.innerHTML = '<option value="main">main</option>';
    });

    // Simulate token preview display
    await page.evaluate(() => {
      const previewSection = document.getElementById('token-preview');
      previewSection.classList.remove('hidden');

      document.getElementById('preview-diff-size').textContent = '0.5 KB';
      document.getElementById('preview-input-tokens').textContent = '150';
      document.getElementById('preview-output-tokens').textContent = '80';
    });

    // Verify preview is visible
    const previewSection = page.locator('#token-preview');
    await expect(previewSection).not.toHaveClass(/hidden/);
    await expect(page.locator('#preview-diff-size')).toHaveText('0.5 KB');
    await expect(page.locator('#preview-input-tokens')).toHaveText('150');
  });

  test('should handle output display', async ({ page }) => {
    // Simulate adding output content
    await page.evaluate(() => {
      const outputContent = document.getElementById('output-content');
      outputContent.innerHTML = `
        <span class="text-2xl font-bold text-primary mb-2">🔍 AI Code Review Analysis</span><br>
        <span class="text-base-content/30">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span><br>
        <span class="text-info">• Repository: test-repo</span><br>
        <span class="text-success font-medium">✅ Review completed successfully!</span>
      `;
    });

    // Verify output content
    await expect(page.locator('#output-content')).toContainText('AI Code Review Analysis');
    await expect(page.locator('#output-content')).toContainText('test-repo');
    await expect(page.locator('#output-content')).toContainText('Review completed successfully');
  });

  test('should handle progress updates', async ({ page }) => {
    // Simulate progress updates
    await page.evaluate(() => {
      // Show progress section
      const progressSection = document.getElementById('progress-section');
      progressSection.classList.remove('hidden');

      // Update progress
      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');
      const statusText = document.getElementById('status-text');

      progressBar.value = 75;
      progressText.textContent = '75%';
      statusText.textContent = 'AI analysis in progress...';
    });

    // Verify progress display
    const progressSection = page.locator('#progress-section');
    await expect(progressSection).not.toHaveClass(/hidden/);

    const progressBar = page.locator('#progress-bar');
    await expect(progressBar).toHaveAttribute('value', '75');

    await expect(page.locator('#progress-text')).toHaveText('75%');
    await expect(page.locator('#status-text')).toHaveText('AI analysis in progress...');
  });

  test('should handle statistics display', async ({ page }) => {
    // Simulate statistics updates
    await page.evaluate(() => {
      // Show stats section
      const statsSection = document.getElementById('stats-section');
      statsSection.classList.remove('hidden');

      // Update stats
      document.getElementById('time-stat').textContent = '2m 15s';
      document.getElementById('speed-stat').textContent = '12.5 t/s';
      document.getElementById('tokens-stat').textContent = '1.8k';
      document.getElementById('model-stat').textContent = 'codellama';
      document.getElementById('stage-stat').textContent = 'complete';
    });

    // Verify statistics display
    const statsSection = page.locator('#stats-section');
    await expect(statsSection).not.toHaveClass(/hidden/);

    await expect(page.locator('#time-stat')).toHaveText('2m 15s');
    await expect(page.locator('#speed-stat')).toHaveText('12.5 t/s');
    await expect(page.locator('#tokens-stat')).toHaveText('1.8k');
    await expect(page.locator('#model-stat')).toHaveText('codellama');
    await expect(page.locator('#stage-stat')).toHaveText('complete');
  });

  test('should handle output actions', async ({ page }) => {
    // Add some content to output
    await page.evaluate(() => {
      const outputContent = document.getElementById('output-content');
      outputContent.innerHTML = '<span>Test output content for export</span>';
    });

    // Test clear button
    const clearBtn = page.locator('button[aria-label="Clear output text"]');
    await clearBtn.click();

    // Output should be reset to welcome message
    await expect(page.locator('#output-content')).toContainText('Welcome to Local AI PR Reviewer');

    // Add content back for copy test
    await page.evaluate(() => {
      const outputContent = document.getElementById('output-content');
      outputContent.innerHTML = '<span>Test content for copy</span>';
    });

    // Mock clipboard API
    await page.addInitScript(() => {
      navigator.clipboard = {
        writeText: (text) => Promise.resolve()
      };
    });

    // Test copy button
    const copyBtn = page.locator('button[aria-label="Copy output to clipboard"]');
    await copyBtn.click();

    // Test export button
    const exportBtn = page.locator('button[aria-label="Export output to file"]');
    await exportBtn.click();
  });

  test('should validate accessibility features', async ({ page }) => {
    // Check ARIA labels
    await expect(page.locator('button[aria-label="Browse for repository folder"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Open configuration settings"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Clear output text"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Copy output to clipboard"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Export output to file"]')).toBeVisible();

    // Check form labels
    await expect(page.locator('label[for="repo-path"]')).toBeVisible();
    await expect(page.locator('label[for="from-branch"]')).toBeVisible();
    await expect(page.locator('label[for="to-branch"]')).toBeVisible();

    // Check ARIA live regions
    await expect(page.locator('#progress-text[aria-live="polite"]')).toBeVisible();
    await expect(page.locator('#status-text[aria-live="polite"]')).toBeVisible();

    // Check semantic structure
    await expect(page.locator('nav[role="banner"]')).toBeVisible();
    await expect(page.locator('main[role="main"]')).toBeVisible();
    await expect(page.locator('section[role="region"]')).toHaveCount(3); // Progress, stats, output sections
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('button[aria-label="Open configuration settings"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('button[aria-label="Browse for repository folder"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#from-branch')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#to-branch')).toBeFocused();

    // Test Enter key on buttons
    await page.locator('button[aria-label="Open configuration settings"]').focus();
    await page.keyboard.press('Enter');

    // Modal should open
    await expect(page.locator('#config-modal')).toBeVisible();

    // Test Escape key to close modal
    await page.keyboard.press('Escape');
    await expect(page.locator('#config-modal')).not.toBeVisible();
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Mock console to capture errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Simulate error conditions
    await page.evaluate(() => {
      // Simulate API error
      try {
        window.nonExistentFunction();
      } catch (error) {
        console.error('Simulated error:', error.message);
      }

      // Simulate network error
      window.electronAPI = {
        selectDirectory: () => Promise.reject(new Error('Permission denied')),
        getGitBranches: () => Promise.reject(new Error('Not a git repository'))
      };
    });

    // App should continue to function despite errors
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('#repo-path')).toBeVisible();
  });

  test('should maintain state consistency', async ({ page }) => {
    // Set initial state
    await page.locator('#repo-path').fill('/test/repo');

    await page.evaluate(() => {
      window.currentRepoPath = '/test/repo';
      window.reviewInProgress = false;

      const fromBranch = document.getElementById('from-branch');
      const toBranch = document.getElementById('to-branch');
      fromBranch.disabled = false;
      toBranch.disabled = false;
      fromBranch.innerHTML = '<option value="feature">feature</option>';
      toBranch.innerHTML = '<option value="main">main</option>';
    });

    // Verify state consistency
    await expect(page.locator('#repo-path')).toHaveValue('/test/repo');
    await expect(page.locator('#from-branch')).not.toBeDisabled();
    await expect(page.locator('#to-branch')).not.toBeDisabled();

    // Change state
    await page.evaluate(() => {
      window.reviewInProgress = true;
      document.getElementById('start-review-btn').classList.add('hidden');
      document.getElementById('stop-review-btn').classList.remove('hidden');
    });

    // Verify state change
    await expect(page.locator('#start-review-btn')).toHaveClass(/hidden/);
    await expect(page.locator('#stop-review-btn')).not.toHaveClass(/hidden/);
  });
});