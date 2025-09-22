// Unit tests for token estimation functionality

// Import the renderer file to test its functions
const fs = require('fs');
const path = require('path');

// Read the renderer.js file and extract the token estimation function
const rendererPath = path.join(__dirname, '../../renderer.js');
const rendererContent = fs.readFileSync(rendererPath, 'utf8');

// Create a mock environment for the functions
const mockWindow = { DEBUG: false };
global.window = mockWindow;
global.console = { log: jest.fn() };

// Extract and eval the functions we need to test
const estimateTokensMatch = rendererContent.match(/function estimateTokens\([\s\S]*?\n}/);
const formatTokenCountMatch = rendererContent.match(/function formatTokenCount\([\s\S]*?\n}/);
const buildPromptMatch = rendererContent.match(/function buildPrompt\([\s\S]*?\n}/);

if (!estimateTokensMatch || !formatTokenCountMatch || !buildPromptMatch) {
  throw new Error('Could not extract functions from renderer.js');
}

// Eval the functions in our test environment
eval(estimateTokensMatch[0]);
eval(formatTokenCountMatch[0]);
eval(buildPromptMatch[0]);

// Add the DEFAULT_BASE_PROMPT constant
const DEFAULT_BASE_PROMPT = `You are an expert code reviewer. Analyze the following code changes (diff format).
Identify potential bugs, security vulnerabilities, performance issues, and suggest improvements
based on best practices. Focus on the *newly added or modified lines*.
Provide concise, actionable feedback. If no issues, state 'No major issues found.'.

Consider the context of a C# and SQL development environment.
The feedback should be formatted clearly, focusing on specific lines if possible.`;

describe('Token Estimation', () => {
  beforeEach(() => {
    mockWindow.DEBUG = false;
    jest.clearAllMocks();
  });

  describe('estimateTokens', () => {
    test('should estimate tokens for simple text', () => {
      const text = 'Hello world';
      const result = estimateTokens(text);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(10);
    });

    test('should estimate tokens for code content', () => {
      const codeText = `
function example() {
  const variable = "value";
  if (condition) {
    return variable;
  }
}`;

      const result = estimateTokens(codeText);
      expect(result).toBeValidTokenEstimate(25, 0.3);
    });

    test('should estimate tokens for diff content', () => {
      const diffText = `
@@ -1,5 +1,7 @@
 function example() {
-  const old = "value";
+  const newVar = "updated value";
+  const another = "addition";
   return old;
 }`;

      const result = estimateTokens(diffText);
      expect(result).toBeValidTokenEstimate(35, 0.3);
    });

    test('should estimate tokens for natural language', () => {
      const naturalText = `
This is a natural language description of the changes made in this pull request.
The developer has updated the authentication system to use JWT tokens instead of
session-based authentication, which improves security and scalability.`;

      const result = estimateTokens(naturalText);
      expect(result).toBeValidTokenEstimate(45, 0.3);
    });

    test('should handle large content with scaling', () => {
      const largeText = 'console.log("test"); '.repeat(10000); // ~200KB
      const result = estimateTokens(largeText);

      // Should apply scaling for large content
      expect(result).toBeGreaterThan(1000);
      expect(result).toBeLessThan(50000);
    });

    test('should handle empty text', () => {
      const result = estimateTokens('');
      expect(result).toBe(1); // Minimum floor
    });

    test('should handle whitespace-only text', () => {
      const result = estimateTokens('   \n\t  ');
      expect(result).toBe(1); // Minimum floor
    });

    test('should provide different estimates for different content types', () => {
      const codeResult = estimateTokens('const x = function() { return "code"; };');
      const diffResult = estimateTokens('+ const x = function() { return "diff"; };');
      const textResult = estimateTokens('This is natural language text content here.');

      // Different content types should have different token densities
      expect(codeResult).not.toBe(diffResult);
      expect(diffResult).not.toBe(textResult);
    });

    test('should enable debug logging when window.DEBUG is true', () => {
      mockWindow.DEBUG = true;
      const consoleSpy = jest.spyOn(console, 'log');

      estimateTokens('test content');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Enhanced Token Estimation Debug'));
    });

    test('should not log debug info when window.DEBUG is false', () => {
      mockWindow.DEBUG = false;
      const consoleSpy = jest.spyOn(console, 'log');

      estimateTokens('test content');

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('formatTokenCount', () => {
    test('should format small numbers', () => {
      expect(formatTokenCount(5)).toBe('5');
      expect(formatTokenCount(999)).toBe('999');
    });

    test('should format thousands', () => {
      expect(formatTokenCount(1000)).toBe('1.0K');
      expect(formatTokenCount(1500)).toBe('1.5K');
      expect(formatTokenCount(999999)).toBe('1000.0K');
    });

    test('should format millions', () => {
      expect(formatTokenCount(1000000)).toBe('1.0M');
      expect(formatTokenCount(1500000)).toBe('1.5M');
      expect(formatTokenCount(2750000)).toBe('2.8M');
    });

    test('should handle zero', () => {
      expect(formatTokenCount(0)).toBe('0');
    });

    test('should handle decimal precision', () => {
      expect(formatTokenCount(1234)).toBe('1.2K');
      expect(formatTokenCount(1678)).toBe('1.7K');
    });
  });

  describe('buildPrompt', () => {
    const testDiff = 'diff --git a/test.js\n+ console.log("test");';

    test('should build prompt with default base prompt', () => {
      const result = buildPrompt(testDiff);

      expect(result).toContain(DEFAULT_BASE_PROMPT);
      expect(result).toContain(testDiff);
      expect(result).toContain('---\nDiff:\n');
      expect(result).toContain('\n---\nReview:\n');
    });

    test('should build prompt with custom base prompt', () => {
      const customBase = 'Custom review instructions';
      const result = buildPrompt(testDiff, customBase);

      expect(result).toContain(customBase);
      expect(result).not.toContain(DEFAULT_BASE_PROMPT);
      expect(result).toContain(testDiff);
    });

    test('should include user prompt when provided', () => {
      const userPrompt = 'Focus on security issues';
      const result = buildPrompt(testDiff, null, userPrompt);

      expect(result).toContain(DEFAULT_BASE_PROMPT);
      expect(result).toContain('Additional Instructions:');
      expect(result).toContain(userPrompt);
      expect(result).toContain(testDiff);
    });

    test('should handle both custom base and user prompts', () => {
      const customBase = 'Custom base prompt';
      const userPrompt = 'Additional user instructions';
      const result = buildPrompt(testDiff, customBase, userPrompt);

      expect(result).toContain(customBase);
      expect(result).toContain('Additional Instructions:');
      expect(result).toContain(userPrompt);
      expect(result).toContain(testDiff);
    });

    test('should ignore empty user prompt', () => {
      const result = buildPrompt(testDiff, null, '');

      expect(result).not.toContain('Additional Instructions:');
      expect(result).toContain(DEFAULT_BASE_PROMPT);
    });

    test('should ignore whitespace-only user prompt', () => {
      const result = buildPrompt(testDiff, null, '   \n\t  ');

      expect(result).not.toContain('Additional Instructions:');
      expect(result).toContain(DEFAULT_BASE_PROMPT);
    });

    test('should replace diff placeholder correctly', () => {
      const testDiff = 'special diff content';
      const result = buildPrompt(testDiff);

      expect(result).toContain(`Diff:\n${testDiff}\n`);
      expect(result).not.toContain('{diff}');
    });
  });

  describe('Token estimation accuracy', () => {
    // Real-world examples for validation
    const examples = [
      {
        name: 'small JavaScript function',
        content: 'function add(a, b) { return a + b; }',
        expectedRange: [8, 15]
      },
      {
        name: 'medium Git diff',
        content: createMockDiff('code'),
        expectedRange: [100, 200]
      },
      {
        name: 'documentation update',
        content: createMockDiff('mixed'),
        expectedRange: [50, 100]
      }
    ];

    test.each(examples)('should provide reasonable estimate for $name', ({ content, expectedRange }) => {
      const result = estimateTokens(content);
      const [min, max] = expectedRange;

      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThanOrEqual(max);
    });
  });

  describe('Edge cases', () => {
    test('should handle very long lines', () => {
      const longLine = 'a'.repeat(10000);
      const result = estimateTokens(longLine);

      expect(result).toBeGreaterThan(1000);
      expect(result).toBeLessThan(5000);
    });

    test('should handle special characters', () => {
      const specialChars = '!@#$%^&*(){}[]|\\:";\'<>?,./~`';
      const result = estimateTokens(specialChars);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(50);
    });

    test('should handle mixed language content', () => {
      const mixedContent = `
        // English comment
        const français = "bonjour";
        // 中文注释
        const 変数 = "日本語";
        // Комментарий на русском
      `;

      const result = estimateTokens(mixedContent);
      expect(result).toBeGreaterThan(0);
    });

    test('should handle only newlines', () => {
      const result = estimateTokens('\n\n\n\n');
      expect(result).toBe(1);
    });
  });
});