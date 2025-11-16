/**
 * Unit tests for validation schemas
 */

import { describe, it, expect } from '@jest/globals';
import {
  discoverSchema,
  createSchema,
  executeSchema,
  inspectSchema,
  removeSchema,
  validateInput,
} from './validation.js';

describe('Validation Schemas', () => {
  describe('discoverSchema', () => {
    it('should validate correct discover params', () => {
      const validParams = {
        type: 'workflows' as const,
        limit: 10,
      };

      const result = discoverSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const invalidParams = {
        type: 'invalid',
      };

      const result = discoverSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should use default limit', () => {
      const params = {
        type: 'workflows' as const,
      };

      const result = discoverSchema.parse(params);
      expect(result.limit).toBe(20);
    });

    it('should reject limit out of range', () => {
      const invalidParams = {
        type: 'workflows' as const,
        limit: 1000,
      };

      const result = discoverSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });
  });

  describe('createSchema', () => {
    it('should validate workflow creation', () => {
      const validParams = {
        action: 'workflow' as const,
        name: 'Test Workflow',
        active: false,
      };

      const result = createSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should validate node creation', () => {
      const validParams = {
        action: 'node' as const,
        workflowId: 'wf-123',
        nodeType: 'n8n-nodes-base.httpRequest',
        nodeName: 'HTTP Request',
      };

      const result = createSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should reject workflow creation without name', () => {
      const invalidParams = {
        action: 'workflow' as const,
      };

      const result = createSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should reject node creation without required fields', () => {
      const invalidParams = {
        action: 'node' as const,
        workflowId: 'wf-123',
      };

      const result = createSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should use default values for optional fields', () => {
      const params = {
        action: 'node' as const,
        workflowId: 'wf-123',
        nodeType: 'httpRequest',
        nodeName: 'HTTP',
      };

      const result = createSchema.parse(params);
      if (result.action === 'node') {
        expect(result.parameters).toEqual({});
      }
    });
  });

  describe('executeSchema', () => {
    it('should validate execute params', () => {
      const validParams = {
        workflowId: 'wf-123',
      };

      const result = executeSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const params = {
        workflowId: 'wf-123',
      };

      const result = executeSchema.parse(params);
      expect(result.waitForCompletion).toBe(true);
      expect(result.timeout).toBe(30000);
    });

    it('should reject empty workflow ID', () => {
      const invalidParams = {
        workflowId: '',
      };

      const result = executeSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should reject timeout out of range', () => {
      const invalidParams = {
        workflowId: 'wf-123',
        timeout: 500000,
      };

      const result = executeSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });
  });

  describe('inspectSchema', () => {
    it('should validate workflow inspection', () => {
      const validParams = {
        type: 'workflow' as const,
        id: 'wf-123',
      };

      const result = inspectSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should validate execution inspection', () => {
      const validParams = {
        type: 'execution' as const,
        id: 'exec-456',
      };

      const result = inspectSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should validate node inspection', () => {
      const validParams = {
        type: 'node' as const,
        nodeType: 'httpRequest',
      };

      const result = inspectSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should use default values for boolean flags', () => {
      const params = {
        type: 'workflow' as const,
        id: 'wf-123',
      };

      const result = inspectSchema.parse(params);
      if (result.type === 'workflow') {
        expect(result.includeNodes).toBe(true);
        expect(result.includeConnections).toBe(true);
      }
    });
  });

  describe('removeSchema', () => {
    it('should validate workflow removal', () => {
      const validParams = {
        action: 'workflow' as const,
        workflowId: 'wf-123',
      };

      const result = removeSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should validate node removal', () => {
      const validParams = {
        action: 'node' as const,
        workflowId: 'wf-123',
        nodeId: 'node-456',
      };

      const result = removeSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should use default force value', () => {
      const params = {
        action: 'workflow' as const,
        workflowId: 'wf-123',
      };

      const result = removeSchema.parse(params);
      if (result.action === 'workflow') {
        expect(result.force).toBe(false);
      }
    });
  });

  describe('validateInput helper', () => {
    it('should return success for valid input', () => {
      const input = {
        workflowId: 'wf-123',
      };

      const result = validateInput(executeSchema, input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.workflowId).toBe('wf-123');
      }
    });

    it('should return error for invalid input', () => {
      const input = {
        workflowId: '',
      };

      const result = validateInput(executeSchema, input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('workflowId');
      }
    });

    it('should format multiple errors', () => {
      const input = {
        action: 'node' as const,
        workflowId: '',
        nodeType: '',
        nodeName: '',
      };

      const result = validateInput(createSchema, input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('workflowId');
        expect(result.error).toContain('nodeType');
        expect(result.error).toContain('nodeName');
      }
    });
  });
});
