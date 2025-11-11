/**
 * Jest setup file for n8n MCP Server v2 tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.N8N_BASE_URL = 'http://mock-n8n.test';
process.env.N8N_API_KEY = 'mock-api-key';

// Mock console.error to reduce noise in test output
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args[0]?.toString() || '';
  // Filter out expected test errors
  if (
    !message.includes('n8n API') &&
    !message.includes('not found') &&
    !message.includes('Error:')
  ) {
    originalConsoleError(...args);
  }
};
