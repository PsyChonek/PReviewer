// Global test setup for all tests

// Extend Jest matchers
expect.extend({
  toBeValidTokenEstimate(received, expected, tolerance = 0.2) {
    const diff = Math.abs(received - expected);
    const maxDiff = expected * tolerance;

    const pass = diff <= maxDiff;

    if (pass) {
      return {
        message: () => `Expected ${received} not to be within ${tolerance * 100}% of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be within ${tolerance * 100}% of ${expected} (difference: ${diff})`,
        pass: false,
      };
    }
  },

  toHaveErrorMessage(received, expectedMessage) {
    const pass = received.message.includes(expectedMessage);

    if (pass) {
      return {
        message: () => `Expected error message not to contain "${expectedMessage}"`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected error message to contain "${expectedMessage}", but got "${received.message}"`,
        pass: false,
      };
    }
  }
});

// Global test helpers
global.createMockGitRepo = () => {
  return {
    path: '/mock/repo/path',
    branches: ['main', 'feature-branch', 'develop'],
    commits: {
      'main': 'abc123',
      'feature-branch': 'def456',
      'develop': 'ghi789'
    }
  };
};

global.createMockDiff = (type = 'mixed') => {
  const diffs = {
    code: `diff --git a/src/main.js b/src/main.js
index 1234567..abcdefg 100644
--- a/src/main.js
+++ b/src/main.js
@@ -1,10 +1,12 @@
 const express = require('express');
 const app = express();
+const cors = require('cors');

+app.use(cors());
 app.get('/', (req, res) => {
-  res.send('Hello World');
+  res.json({ message: 'Hello World' });
 });

 app.listen(3000, () => {
   console.log('Server running on port 3000');
 });`,

    mixed: `diff --git a/README.md b/README.md
index 1234567..abcdefg 100644
--- a/README.md
+++ b/README.md
@@ -1,5 +1,8 @@
 # PR Reviewer

+A local AI-powered pull request reviewer.
+
 ## Installation

-Run \`npm install\`
+Run \`npm install\` to install dependencies.
+Then run \`npm start\` to launch the application.`,

    large: Array(1000).fill('+ console.log("debug line");').join('\n')
  };

  return diffs[type] || diffs.mixed;
};

// Console helpers for tests
global.mockConsole = () => {
  const originalConsole = global.console;
  global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };

  return () => {
    global.console = originalConsole;
  };
};

// Environment setup
process.env.NODE_ENV = 'test';