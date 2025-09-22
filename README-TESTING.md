# Testing Guide for PR Reviewer

This document provides comprehensive information about testing the PR Reviewer Electron application.

## Test Structure

```
tests/
├── setup.js                 # Global test setup
├── renderer-setup.js        # Renderer-specific setup
├── unit/                    # Unit tests
│   └── token-estimation.test.js
├── integration/             # Integration tests
│   ├── git-operations.test.js
│   └── ollama-api.test.js
├── renderer/                # UI component tests
│   └── ui-components.test.js
└── e2e/                     # End-to-end tests
    ├── global-setup.js
    ├── global-teardown.js
    ├── electron-app.spec.js
    └── renderer-integration.spec.js
```

## Test Types

### 1. Unit Tests (`tests/unit/`)

Tests individual functions and components in isolation.

- **Token Estimation**: Tests the improved token counting algorithm
- **Configuration Management**: Tests settings save/load functionality
- **Utility Functions**: Tests helper functions and formatters

**Run unit tests:**
```bash
npm run test:unit
```

### 2. Integration Tests (`tests/integration/`)

Tests interaction between different components and external services.

- **Git Operations**: Tests Git command execution and error handling
- **Ollama API**: Tests API communication and streaming responses
- **File System Operations**: Tests repository reading and diff generation

**Run integration tests:**
```bash
npm run test:integration
```

### 3. Renderer Tests (`tests/renderer/`)

Tests UI components and user interactions using JSDOM.

- **Component Rendering**: Tests DOM element creation and updates
- **Event Handling**: Tests user interactions and form submissions
- **State Management**: Tests application state changes
- **Accessibility**: Tests ARIA attributes and keyboard navigation

**Run renderer tests:**
```bash
npm run test:renderer
```

### 4. End-to-End Tests (`tests/e2e/`)

Tests the complete application workflow using Playwright.

- **Application Lifecycle**: Tests app startup and shutdown
- **User Workflows**: Tests complete review process
- **Error Scenarios**: Tests error handling and recovery
- **Performance**: Tests application performance metrics

**Run E2E tests:**
```bash
npm run test:e2e
```

## Running Tests

### Quick Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test type
npm run test:unit
npm run test:integration
npm run test:e2e

# Run custom test runner
node test-runner.js [test-type]
```

### Test Runner Options

The custom test runner supports various test types:

```bash
# Run specific test suites
node test-runner.js unit
node test-runner.js integration
node test-runner.js renderer
node test-runner.js e2e

# Run test combinations
node test-runner.js quick     # unit + integration
node test-runner.js all       # all test suites

# Run with coverage
node test-runner.js coverage

# Run in watch mode
node test-runner.js watch

# Run in CI mode
node test-runner.js ci
```

## Test Configuration

### Jest Configuration (`jest.config.js`)

- **Multi-project setup**: Separate configurations for different test types
- **Coverage thresholds**: 80% minimum coverage requirement
- **Custom matchers**: Additional test utilities for token estimation
- **Setup files**: Global and environment-specific setup

### Playwright Configuration (`playwright.config.js`)

- **Cross-platform testing**: Windows, macOS, Linux support
- **Multiple browsers**: Chromium-based testing for Electron
- **Retries and timeouts**: Robust test execution
- **Artifacts**: Screenshots, videos, and traces on failure

## Mock and Test Data

### Mock Objects

- **Git Repository**: Mock repository with test branches and commits
- **Ollama API**: Mock streaming responses and error conditions
- **Electron APIs**: Mock IPC communication and file system access
- **DOM Environment**: JSDOM for renderer testing

### Test Fixtures

- **Sample Diffs**: Various code change scenarios
- **Configuration Data**: Test settings and preferences
- **Error Responses**: API error conditions
- **Git Repositories**: Real Git repos for integration testing

## Coverage Requirements

- **Minimum Coverage**: 80% for branches, functions, lines, and statements
- **Coverage Reports**: HTML, LCOV, and text formats
- **Local Coverage**: Run `npm run test:coverage` to generate reports

## Writing Tests

### Best Practices

1. **Descriptive Test Names**: Use clear, specific test descriptions
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
3. **Mock External Dependencies**: Use mocks for Git, Ollama API, and file system
4. **Test Error Conditions**: Include negative test cases
5. **Maintain Independence**: Tests should not depend on each other

### Custom Matchers

The test suite includes custom Jest matchers:

```javascript
// Token estimation accuracy
expect(result).toBeValidTokenEstimate(expected, tolerance);

// Error message content
expect(error).toHaveErrorMessage(expectedMessage);
```

### Example Test Structure

```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  test('should perform expected behavior', async () => {
    // Arrange
    const input = 'test data';

    // Act
    const result = await functionUnderTest(input);

    // Assert
    expect(result).toBe('expected output');
  });

  test('should handle error conditions', async () => {
    // Test error scenarios
    await expect(functionUnderTest(invalidInput))
      .rejects
      .toThrow('Expected error message');
  });
});
```

## Test Data Management

### Git Test Repository

The E2E tests automatically create a test Git repository with:
- Initial commit with sample files
- Feature branch with modifications
- Realistic diff content for testing

### Cleanup

- **Automatic Cleanup**: Test fixtures are cleaned up after test runs
- **Isolation**: Each test runs in isolated environment
- **No Side Effects**: Tests don't affect the real file system

## Debugging Tests

### Debug Commands

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test token-estimation.test.js

# Debug with Node.js debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Playwright debug mode
npx playwright test --debug
```

### Common Issues

1. **Test Timeouts**: Increase timeout for slow operations
2. **Mock Failures**: Ensure mocks are properly reset between tests
3. **File Permissions**: Check file system access in test environment
4. **Dependencies**: Ensure test dependencies are installed

## Performance Testing

### Metrics Tracked

- **Test Execution Time**: Individual and suite timing
- **Memory Usage**: Heap usage during test execution
- **Token Estimation Accuracy**: Comparison with expected values
- **API Response Times**: Mock API latency simulation

### Performance Thresholds

- **Unit Tests**: < 100ms per test
- **Integration Tests**: < 5s per test
- **E2E Tests**: < 30s per test
- **Coverage Generation**: < 10s total

## Security Testing

### Security Checks

- **Dependency Auditing**: npm audit integration
- **Code Injection Prevention**: Input validation testing
- **File System Access**: Restricted path testing
- **API Security**: Mock malicious responses

### Privacy Validation

- **No External Calls**: Verify tests don't make real API calls
- **Data Isolation**: Ensure test data doesn't leak
- **Mock Verification**: Confirm all external dependencies are mocked