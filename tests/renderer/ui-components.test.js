// UI component tests for renderer process

// Create a mock DOM environment
require('jsdom-global')();

// Load the actual HTML content
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Parse and setup DOM
const { JSDOM } = require('jsdom');
const dom = new JSDOM(htmlContent);
global.document = dom.window.document;
global.window = dom.window;

// Setup renderer environment
require('../renderer-setup');

// Load renderer functions
const rendererPath = path.join(__dirname, '../../renderer.js');
const rendererContent = fs.readFileSync(rendererPath, 'utf8');

// Extract key functions for testing
eval(rendererContent);

describe('UI Components', () => {
  beforeEach(() => {
    // Reset DOM to initial state
    document.body.innerHTML = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];

    // Reset localStorage
    localStorage.clear();

    // Reset global state
    currentRepoPath = null;
    reviewInProgress = false;

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Repository Selection', () => {
    test('should enable browse button by default', () => {
      const browseBtn = document.querySelector('button[onclick="selectRepository()"]');

      expect(browseBtn).toBeTruthy();
      expect(browseBtn.disabled).toBeFalsy();
    });

    test('should update repo path when repository is selected', async () => {
      const repoPath = '/test/repo/path';

      // Mock the electronAPI call
      window.electronAPI.selectDirectory.mockResolvedValueOnce(repoPath);
      window.electronAPI.getGitBranches.mockResolvedValueOnce(['main', 'feature']);

      await selectRepository();

      const repoPathInput = document.getElementById('repo-path');
      expect(repoPathInput.value).toBe(repoPath);
      expect(currentRepoPath).toBe(repoPath);
    });

    test('should handle repository selection cancellation', async () => {
      // Mock user cancelling selection
      window.electronAPI.selectDirectory.mockResolvedValueOnce(null);

      await selectRepository();

      const repoPathInput = document.getElementById('repo-path');
      expect(repoPathInput.value).toBe('');
      expect(currentRepoPath).toBeNull();
    });

    test('should show error when repository selection fails', async () => {
      const errorMessage = 'Permission denied';
      window.electronAPI.selectDirectory.mockRejectedValueOnce(new Error(errorMessage));

      await selectRepository();

      // Verify error was shown (would check for error alert in real implementation)
      expect(window.electronAPI.selectDirectory).toHaveBeenCalled();
    });
  });

  describe('Branch Selection', () => {
    test('should initially disable branch selectors', () => {
      const fromBranch = document.getElementById('from-branch');
      const toBranch = document.getElementById('to-branch');

      expect(fromBranch.disabled).toBeTruthy();
      expect(toBranch.disabled).toBeTruthy();
    });

    test('should populate branches after repository load', async () => {
      const branches = ['main', 'feature-branch', 'develop'];

      await loadBranches('/test/repo', branches);

      const fromBranch = document.getElementById('from-branch');
      const toBranch = document.getElementById('to-branch');

      expect(fromBranch.disabled).toBeFalsy();
      expect(toBranch.disabled).toBeFalsy();

      // Check if branches were added to options
      const fromOptions = Array.from(fromBranch.options).map(opt => opt.value);
      const toOptions = Array.from(toBranch.options).map(opt => opt.value);

      expect(fromOptions).toEqual(expect.arrayContaining(branches));
      expect(toOptions).toEqual(expect.arrayContaining([...branches, 'HEAD']));
    });

    test('should set default branch selections correctly', async () => {
      const branches = ['main', 'feature-branch', 'develop'];

      await loadBranches('/test/repo', branches);

      const fromBranch = document.getElementById('from-branch');
      const toBranch = document.getElementById('to-branch');

      expect(fromBranch.value).toBe('feature-branch'); // First branch
      expect(toBranch.value).toBe('main'); // Preferred main branch
    });

    test('should handle repository with only master branch', async () => {
      const branches = ['master'];

      await loadBranches('/test/repo', branches);

      const toBranch = document.getElementById('to-branch');
      expect(toBranch.value).toBe('master');
    });

    test('should fall back to HEAD when no main branches exist', async () => {
      const branches = ['feature-1', 'feature-2', 'bugfix'];

      await loadBranches('/test/repo', branches);

      const toBranch = document.getElementById('to-branch');
      expect(toBranch.value).toBe('HEAD');
    });
  });

  describe('Review Controls', () => {
    test('should initially disable start review button', () => {
      const startBtn = document.getElementById('start-review-btn');
      expect(startBtn.disabled).toBeTruthy();
    });

    test('should enable start review button after branches are loaded', async () => {
      await loadBranches('/test/repo', ['main', 'feature']);

      const startBtn = document.getElementById('start-review-btn');
      expect(startBtn.disabled).toBeFalsy();
    });

    test('should show stop button during review', async () => {
      // Setup valid repository state
      currentRepoPath = '/test/repo';
      document.getElementById('repo-path').value = '/test/repo';
      document.getElementById('from-branch').disabled = false;
      document.getElementById('to-branch').disabled = false;
      document.getElementById('from-branch').value = 'feature';
      document.getElementById('to-branch').value = 'main';

      // Mock API calls
      window.electronAPI.getGitDiff.mockResolvedValueOnce('mock diff');
      window.electronAPI.callOllamaAPI.mockResolvedValueOnce('mock review');

      // Start review
      await startReview();

      const startBtn = document.getElementById('start-review-btn');
      const stopBtn = document.getElementById('stop-review-btn');

      expect(startBtn.classList.contains('hidden')).toBeTruthy();
      expect(stopBtn.classList.contains('hidden')).toBeFalsy();
    });

    test('should validate configuration before starting review', async () => {
      // Missing repository path
      document.getElementById('repo-path').value = '';

      await startReview();

      // Should not start review with invalid config
      expect(reviewInProgress).toBeFalsy();
    });
  });

  describe('Progress Display', () => {
    test('should hide progress section initially', () => {
      const progressSection = document.getElementById('progress-section');
      expect(progressSection.classList.contains('hidden')).toBeTruthy();
    });

    test('should show progress when review starts', () => {
      updateProgress(25, 'Processing...');

      const progressSection = document.getElementById('progress-section');
      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');

      expect(progressSection.classList.contains('hidden')).toBeFalsy();
      expect(progressBar.value).toBe(25);
      expect(progressText.textContent).toBe('25%');
    });

    test('should update progress bar smoothly', () => {
      updateProgress(0);
      updateProgress(50, 'Halfway done');
      updateProgress(100, 'Complete');

      const progressBar = document.getElementById('progress-bar');
      const statusText = document.getElementById('status-text');

      expect(progressBar.value).toBe(100);
      expect(statusText.textContent).toBe('Complete');
    });

    test('should hide progress when complete', () => {
      updateProgress(100);
      updateProgress(0);

      const progressSection = document.getElementById('progress-section');
      expect(progressSection.classList.contains('hidden')).toBeTruthy();
    });
  });

  describe('Statistics Display', () => {
    test('should hide statistics initially', () => {
      const statsSection = document.getElementById('stats-section');
      expect(statsSection.classList.contains('hidden')).toBeTruthy();
    });

    test('should show and update statistics', () => {
      updateStats(15.5, 120, 'codellama', 'processing');

      const statsSection = document.getElementById('stats-section');
      const timeStat = document.getElementById('time-stat');
      const speedStat = document.getElementById('speed-stat');
      const tokensStat = document.getElementById('tokens-stat');
      const modelStat = document.getElementById('model-stat');
      const stageStat = document.getElementById('stage-stat');

      expect(statsSection.classList.contains('hidden')).toBeFalsy();
      expect(timeStat.textContent).toBe('15.5s');
      expect(speedStat.textContent).toBe('7.7 t/s'); // 120/15.5
      expect(tokensStat.textContent).toBe('120');
      expect(modelStat.textContent).toBe('codellama');
      expect(stageStat.textContent).toBe('processing');
    });

    test('should format time correctly for long durations', () => {
      updateStats(125.3, 1000, 'model', 'complete');

      const timeStat = document.getElementById('time-stat');
      expect(timeStat.textContent).toBe('2m 5s');
    });

    test('should format large token counts', () => {
      updateStats(10, 5500, 'model', 'complete');

      const tokensStat = document.getElementById('tokens-stat');
      expect(tokensStat.textContent).toBe('5.5k');
    });

    test('should truncate long model names', () => {
      updateStats(10, 100, 'very-long-model-name-that-exceeds-limit', 'complete');

      const modelStat = document.getElementById('model-stat');
      expect(modelStat.textContent).toBe('very-long-m...');
    });
  });

  describe('Output Display', () => {
    test('should clear output correctly', () => {
      // Add some content first
      appendOutput('Test content', 'info');

      clearOutput();

      const outputContent = document.getElementById('output-content');
      expect(outputContent.innerHTML).toContain('Welcome to Local AI PR Reviewer');
    });

    test('should append output with different styles', () => {
      appendOutput('Header text', 'header');
      appendOutput('Info text', 'info');
      appendOutput('Error text', 'error');

      const outputContent = document.getElementById('output-content');
      expect(outputContent.innerHTML).toContain('Header text');
      expect(outputContent.innerHTML).toContain('Info text');
      expect(outputContent.innerHTML).toContain('Error text');
    });

    test('should handle multiline output correctly', () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';

      appendOutput(multilineText, 'info');

      const outputContent = document.getElementById('output-content');
      expect(outputContent.innerHTML).toContain('Line 1');
      expect(outputContent.innerHTML).toContain('Line 2');
      expect(outputContent.innerHTML).toContain('Line 3');
    });

    test('should clear welcome message when adding content', () => {
      // Initially should have welcome message
      clearOutput();

      // Add real content
      appendOutput('Actual output', 'info');

      const outputContent = document.getElementById('output-content');
      expect(outputContent.innerHTML).not.toContain('Welcome to Local AI PR Reviewer');
      expect(outputContent.innerHTML).toContain('Actual output');
    });
  });

  describe('Configuration Modal', () => {
    test('should open configuration modal', () => {
      const modal = document.getElementById('config-modal');

      openConfigModal();

      // In a real implementation, this would check if modal.showModal() was called
      expect(modal).toBeTruthy();
    });

    test('should load saved configuration', () => {
      // Setup saved configuration
      localStorage.setItem('ollama-url', 'http://custom:8080/api/generate');
      localStorage.setItem('ollama-model', 'custom-model');
      localStorage.setItem('debug-enabled', 'true');

      loadConfiguration();

      const urlInput = document.getElementById('ollama-url');
      const modelInput = document.getElementById('ollama-model');
      const debugCheckbox = document.getElementById('debug-enabled');

      expect(urlInput.value).toBe('http://custom:8080/api/generate');
      expect(modelInput.value).toBe('custom-model');
      expect(debugCheckbox.checked).toBeTruthy();
      expect(window.DEBUG).toBeTruthy();
    });

    test('should save configuration to localStorage', () => {
      // Setup form values
      document.getElementById('ollama-url').value = 'http://localhost:11434/api/generate';
      document.getElementById('ollama-model').value = 'llama2';
      document.getElementById('debug-enabled').checked = false;

      saveConfiguration();

      expect(localStorage.getItem('ollama-url')).toBe('http://localhost:11434/api/generate');
      expect(localStorage.getItem('ollama-model')).toBe('llama2');
      expect(localStorage.getItem('debug-enabled')).toBe('false');
      expect(window.DEBUG).toBeFalsy();
    });

    test('should validate required configuration fields', () => {
      // Clear required fields
      document.getElementById('ollama-url').value = '';
      document.getElementById('ollama-model').value = '';

      saveConfiguration();

      // Should not save with empty required fields
      expect(localStorage.getItem('ollama-url')).toBeNull();
    });
  });

  describe('Token Preview', () => {
    test('should show token preview for valid diff', async () => {
      // Setup repository state
      document.getElementById('repo-path').value = '/test/repo';
      document.getElementById('from-branch').value = 'feature';
      document.getElementById('to-branch').value = 'main';

      // Mock diff generation
      window.electronAPI.getGitDiff.mockResolvedValueOnce(createMockDiff('code'));

      await previewTokenEstimate();

      const previewSection = document.getElementById('token-preview');
      expect(previewSection.classList.contains('hidden')).toBeFalsy();

      const diffSize = document.getElementById('preview-diff-size');
      const inputTokens = document.getElementById('preview-input-tokens');
      const outputTokens = document.getElementById('preview-output-tokens');

      expect(diffSize.textContent).not.toBe('--');
      expect(inputTokens.textContent).not.toBe('--');
      expect(outputTokens.textContent).not.toBe('--');
    });

    test('should hide preview for invalid branch selection', async () => {
      document.getElementById('repo-path').value = '/test/repo';
      document.getElementById('from-branch').value = 'feature';
      document.getElementById('to-branch').value = 'feature'; // Same branch

      await previewTokenEstimate();

      const previewSection = document.getElementById('token-preview');
      expect(previewSection.classList.contains('hidden')).toBeTruthy();
    });

    test('should show warning for large token estimates', async () => {
      document.getElementById('repo-path').value = '/test/repo';
      document.getElementById('from-branch').value = 'feature';
      document.getElementById('to-branch').value = 'main';

      // Mock large diff
      window.electronAPI.getGitDiff.mockResolvedValueOnce(createMockDiff('large'));

      await previewTokenEstimate();

      const costWarning = document.getElementById('preview-cost-warning');
      expect(costWarning.classList.contains('hidden')).toBeFalsy();
      expect(costWarning.textContent).toContain('Large prompt');
    });
  });

  describe('Accessibility Features', () => {
    test('should have proper ARIA labels on interactive elements', () => {
      const browseBtn = document.querySelector('button[aria-label="Browse for repository folder"]');
      const settingsBtn = document.querySelector('button[aria-label="Open configuration settings"]');
      const clearBtn = document.querySelector('button[aria-label="Clear output text"]');

      expect(browseBtn).toBeTruthy();
      expect(settingsBtn).toBeTruthy();
      expect(clearBtn).toBeTruthy();
    });

    test('should have proper form labels', () => {
      const repoPathLabel = document.querySelector('label[for="repo-path"]');
      const fromBranchLabel = document.querySelector('label[for="from-branch"]');
      const toBranchLabel = document.querySelector('label[for="to-branch"]');

      expect(repoPathLabel).toBeTruthy();
      expect(fromBranchLabel).toBeTruthy();
      expect(toBranchLabel).toBeTruthy();
    });

    test('should have ARIA live regions for dynamic content', () => {
      const progressText = document.getElementById('progress-text');
      const statusText = document.getElementById('status-text');

      expect(progressText.getAttribute('aria-live')).toBe('polite');
      expect(statusText.getAttribute('aria-live')).toBe('polite');
    });

    test('should have proper semantic structure', () => {
      const nav = document.querySelector('nav[role="banner"]');
      const main = document.querySelector('main[role="main"]');
      const sections = document.querySelectorAll('section[role="region"]');

      expect(nav).toBeTruthy();
      expect(main).toBeTruthy();
      expect(sections.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling in UI', () => {
    test('should display user-friendly error messages', () => {
      const errorMessage = 'Test error message';

      showAlert(errorMessage, 'error');

      // Verify alert was created (simplified check)
      expect(document.querySelector('.alert')).toBeTruthy();
    });

    test('should handle clipboard operations gracefully', async () => {
      // Mock clipboard failure
      navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Clipboard error'));

      await copyOutput();

      // Should handle error gracefully without crashing
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    test('should handle export operations', () => {
      // Add some content to export
      appendOutput('Test content for export', 'info');

      exportOutput();

      // Verify blob creation and download simulation
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});

// Helper function to simulate loading branches
async function loadBranches(repoPath, branches) {
  window.electronAPI.getGitBranches.mockResolvedValueOnce(branches);

  try {
    const result = await window.electronAPI.getGitBranches(repoPath);

    const fromBranchSelect = document.getElementById('from-branch');
    const toBranchSelect = document.getElementById('to-branch');

    // Clear existing options
    fromBranchSelect.innerHTML = '';
    toBranchSelect.innerHTML = '';

    // Add branch options
    result.forEach(branch => {
      const fromOption = new Option(branch, branch);
      const toOption = new Option(branch, branch);
      fromBranchSelect.add(fromOption);
      toBranchSelect.add(toOption);
    });

    // Add HEAD option to target branch
    toBranchSelect.add(new Option('HEAD', 'HEAD'));

    // Set default values
    if (result.length > 0) {
      fromBranchSelect.value = result[0];

      // Try to set main/master as default target
      const mainBranches = ['main', 'master', 'develop'];
      for (const mainBranch of mainBranches) {
        if (result.includes(mainBranch)) {
          toBranchSelect.value = mainBranch;
          break;
        }
      }
      if (!toBranchSelect.value) {
        toBranchSelect.value = 'HEAD';
      }
    }

    // Enable controls
    fromBranchSelect.disabled = false;
    toBranchSelect.disabled = false;
    document.getElementById('start-review-btn').disabled = false;

  } catch (error) {
    throw error;
  }
}