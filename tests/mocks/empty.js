// Enhanced mock for TypeScript files with utility functions
const { estimateTokens, formatTokenCount } = require('./tokenEstimation.js');
const { buildPrompt, DEFAULT_BASE_PROMPT } = require('./prompts.js');

module.exports = {
  // Token estimation functions
  estimateTokens,
  formatTokenCount,
  formatBytes: (bytes) => bytes < 1024 ? `${bytes} B` : `${Math.round(bytes/1024)} KB`,
  formatDuration: (seconds) => seconds < 60 ? `${Math.round(seconds)}s` : `${Math.floor(seconds/60)}m`,

  // Prompt functions
  buildPrompt,
  DEFAULT_BASE_PROMPT,

  // Config functions
  getDefaultPrompts: () => ({
    basePrompt: DEFAULT_BASE_PROMPT,
    userPrompt: ''
  }),

  // Types (empty objects for TypeScript interfaces)
  AppState: {},
  AIProviderConfig: {},
  BranchInfo: {},
};