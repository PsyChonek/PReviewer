// React Testing Library setup
require('@testing-library/jest-dom');

// Mock electron APIs for React components
global.window.electronAPI = {
  selectDirectory: jest.fn(),
  getGitBranches: jest.fn(),
  getGitDiff: jest.fn(),
  callOllamaAPI: jest.fn(),
  callAzureAI: jest.fn(),
  testOllamaConnection: jest.fn(),
  testAzureAIConnection: jest.fn(),
  onOllamaProgress: jest.fn(() => () => {}), // Return cleanup function
  onAzureAIProgress: jest.fn(() => () => {}), // Return cleanup function
};

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;