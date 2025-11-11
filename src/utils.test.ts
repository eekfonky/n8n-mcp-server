/**
 * Tests for utility functions
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { formatSuccess, formatError, extractParams, findWorkflow } from './utils.js';
import { MockN8nClient } from './testing/MockN8nClient.js';

describe('utils', () => {
  describe('formatSuccess', () => {
    test('should format success with text only', () => {
      const result = formatSuccess('Operation successful');

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect(result.content[0]?.text).toBe('Operation successful');
      expect(result.isError).toBeUndefined();
    });

    test('should format success with text and structured data', () => {
      const data = { id: '123', name: 'Test' };
      const result = formatSuccess('Success', data);

      expect(result.content[0]?.text).toBe('Success');
      expect((result as any).structuredContent).toEqual(data);
    });
  });

  describe('formatError', () => {
    test('should format error from Error object', () => {
      const error = new Error('Something went wrong');
      const result = formatError(error);

      const text = result.content[0]?.text || '';
      expect(text).toContain('Error:');
      expect(text).toContain('Something went wrong');
      expect(result.isError).toBe(true);
    });

    test('should format error from string', () => {
      const result = formatError('Error message');

      const text = result.content[0]?.text || '';
      expect(text).toContain('Error:');
      expect(text).toContain('Error message');
      expect(result.isError).toBe(true);
    });

    test('should include error code and status', () => {
      const error: any = new Error('Not found');
      error.code = 'N8N_NOT_FOUND';
      error.status = 404;

      const result = formatError(error);

      expect(result.isError).toBe(true);
      expect((result as any).structuredContent).toBeDefined();
      expect((result as any).structuredContent.error.code).toBe('N8N_NOT_FOUND');
    });
  });

  describe('extractParams', () => {
    test('should extract params from object arguments', () => {
      const request = {
        params: {
          arguments: {
            type: 'workflow',
            name: 'Test Workflow'
          }
        }
      };

      const params = extractParams(request);
      expect(params).toEqual({ type: 'workflow', name: 'Test Workflow' });
    });

    test('should extract params from array arguments', () => {
      const request = {
        params: {
          arguments: [
            { type: 'workflow' },
            { name: 'Test Workflow' }
          ]
        }
      };

      const params = extractParams(request);
      expect(params).toEqual({ type: 'workflow', name: 'Test Workflow' });
    });

    test('should handle missing arguments', () => {
      const request = { params: {} };
      const params = extractParams(request);
      expect(params).toEqual({});
    });
  });

  describe('findWorkflow', () => {
    let client: MockN8nClient;

    beforeEach(() => {
      client = new MockN8nClient();
    });

    test('should find workflow by ID', async () => {
      const testWorkflow = client.addTestWorkflow({ name: 'Test Workflow' });
      const found = await findWorkflow(client, testWorkflow.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(testWorkflow.id);
      expect(found?.name).toBe('Test Workflow');
    });

    test('should find workflow by name', async () => {
      client.addTestWorkflow({ name: 'Named Workflow' });
      const found = await findWorkflow(client, 'Named Workflow');

      expect(found).toBeDefined();
      expect(found?.name).toBe('Named Workflow');
    });

    test('should return null when workflow not found', async () => {
      const found = await findWorkflow(client, 'nonexistent');
      expect(found).toBeNull();
    });
  });
});
