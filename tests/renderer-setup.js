// Setup for renderer process tests (JSDOM environment)

// Mock DOM APIs that aren't available in JSDOM
Object.defineProperty(window, 'electronAPI', {
  value: {
    selectDirectory: jest.fn(),
    getGitBranches: jest.fn(),
    getGitDiff: jest.fn(),
    callOllamaAPI: jest.fn(),
    testOllamaConnection: jest.fn(),
    onOllamaProgress: jest.fn()
  },
  writable: true
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn(() => Promise.resolve())
  },
  writable: true
});

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mocked-url');
global.URL.revokeObjectURL = jest.fn();

// Mock document.createElement for download functionality
const originalCreateElement = document.createElement;
document.createElement = jest.fn((tagName) => {
  const element = originalCreateElement.call(document, tagName);
  if (tagName === 'a') {
    element.click = jest.fn();
  }
  return element;
});

// Add showModal and close methods to all dialog elements
const originalGetElementById = document.getElementById;
document.getElementById = function(id) {
  const element = originalGetElementById.call(this, id);
  if (element && element.tagName === 'DIALOG') {
    if (!element.showModal) {
      element.showModal = jest.fn();
    }
    if (!element.close) {
      element.close = jest.fn();
    }
  }
  return element;
};

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));

// Mock window.DEBUG
window.DEBUG = false;

// Add TextEncoder/TextDecoder polyfills for JSDOM
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Helper to create mock DOM elements
global.createMockElement = (tagName, attributes = {}) => {
  const element = document.createElement(tagName);
  Object.keys(attributes).forEach(key => {
    if (key === 'textContent' || key === 'innerHTML') {
      element[key] = attributes[key];
    } else {
      element.setAttribute(key, attributes[key]);
    }
  });
  return element;
};

// Helper to simulate user interactions
global.simulateEvent = (element, eventType, eventData = {}) => {
  const event = new Event(eventType, { bubbles: true });
  Object.keys(eventData).forEach(key => {
    event[key] = eventData[key];
  });
  element.dispatchEvent(event);
  return event;
};