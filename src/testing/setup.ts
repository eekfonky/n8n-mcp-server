/**
 * Jest setup file for n8n MCP Server tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DEBUG = 'false';
process.env.RATE_LIMIT_REQUESTS_PER_MINUTE = '1000'; // Higher limit for tests
process.env.CACHE_TTL_SECONDS = '1'; // Shorter cache for tests

// Mock console.error to reduce noise in test output
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Only show errors that are not expected test errors
  const message = args[0]?.toString() || '';
  if (
    !message.includes('Failed to discover n8n nodes') &&
    !message.includes('Node types endpoint not available') &&
    !message.includes('not found')
  ) {
    originalConsoleError(...args);
  }
};

// Global test utilities - moved to avoid TS module augmentation error

// Custom Jest matchers
expect.extend({
  toBeValidToolResult(received) {
    const pass =
      typeof received === 'object' &&
      received !== null &&
      typeof received.success === 'boolean';

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid tool result`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid tool result with 'success' property`,
        pass: false,
      };
    }
  },

  toBeSuccessfulToolResult(received) {
    const pass =
      typeof received === 'object' &&
      received !== null &&
      received.success === true;

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a successful tool result`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a successful tool result`,
        pass: false,
      };
    }
  },

  toBeErrorToolResult(received) {
    const pass =
      typeof received === 'object' &&
      received !== null &&
      received.success === false &&
      typeof received.error === 'string';

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be an error tool result`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be an error tool result with 'error' property`,
        pass: false,
      };
    }
  },
});