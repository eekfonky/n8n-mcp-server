/**
 * Comprehensive Test Suite for n8n MCP Primitives
 *
 * Tests all 10 primitive tools using MockN8nServer for reliable testing
 * without requiring a live n8n instance.
 */

import { describe, test, beforeEach, expect } from '@jest/globals';
import { MockN8nServer } from './MockN8nServer.js';
import { EnhancedNodeDiscovery } from '../discovery/EnhancedNodeDiscovery.js';
import { N8nApiClient } from '../n8nClient.js';

// Import all primitive tools
import { N8nDiscoverTool } from '../tools/primitives/N8nDiscoverTool.js';
import { N8nCreateTool } from '../tools/primitives/N8nCreateTool.js';
import { N8nExecuteTool } from '../tools/primitives/N8nExecuteTool.js';
import { N8nInspectTool } from '../tools/primitives/N8nInspectTool.js';
import { N8nRemoveTool } from '../tools/primitives/N8nRemoveTool.js';
import { N8nModifyTool } from '../tools/primitives/N8nModifyTool.js';
import { N8nConnectTool } from '../tools/primitives/N8nConnectTool.js';
import { N8nControlTool } from '../tools/primitives/N8nControlTool.js';
import { N8nSearchTool } from '../tools/primitives/N8nSearchTool.js';
import { N8nValidateTool } from '../tools/primitives/N8nValidateTool.js';

// Mock API Client that uses MockN8nServer
class MockApiClient extends N8nApiClient {
  constructor(private mockServer: MockN8nServer) {
    super({
      baseUrl: 'http://mock-n8n.test',
      apiKey: 'mock-api-key'
    });
  }

  override async healthCheck(): Promise<boolean> {
    return this.mockServer.healthCheck();
  }

  override async getWorkflows() {
    return this.mockServer.getWorkflows();
  }

  override async getWorkflow(id: string) {
    return this.mockServer.getWorkflow(id);
  }

  override async createWorkflow(workflow: any) {
    return this.mockServer.createWorkflow(workflow);
  }

  override async updateWorkflow(id: string, workflow: any) {
    return this.mockServer.updateWorkflow(id, workflow);
  }

  override async deleteWorkflow(id: string) {
    return this.mockServer.deleteWorkflow(id);
  }

  override async executeWorkflow(id: string, data?: any) {
    return this.mockServer.executeWorkflow(id, data);
  }

  override async getExecution(id: string) {
    return this.mockServer.getExecution(id);
  }

  override async getExecutions(workflowId?: string) {
    return this.mockServer.getExecutions(workflowId || '');
  }

  override async getNodeTypes() {
    return this.mockServer.getNodeTypes();
  }

  override async getCredentials() {
    return this.mockServer.getCredentials();
  }

  override async activateWorkflow(id: string) {
    const workflow = await this.mockServer.getWorkflow(id);
    return this.mockServer.updateWorkflow(id, { ...workflow, active: true });
  }

  override async deactivateWorkflow(id: string) {
    const workflow = await this.mockServer.getWorkflow(id);
    return this.mockServer.updateWorkflow(id, { ...workflow, active: false });
  }
}

describe('n8n MCP Primitives Test Suite', () => {
  let mockServer: MockN8nServer;
  let mockClient: MockApiClient;
  let nodeDiscovery: EnhancedNodeDiscovery;

  // Tool instances
  let discoverTool: N8nDiscoverTool;
  let createTool: N8nCreateTool;
  let executeTool: N8nExecuteTool;
  let inspectTool: N8nInspectTool;
  let removeTool: N8nRemoveTool;
  let modifyTool: N8nModifyTool;
  let connectTool: N8nConnectTool;
  let controlTool: N8nControlTool;
  let searchTool: N8nSearchTool;
  let validateTool: N8nValidateTool;

  beforeEach(() => {
    // Reset mock server for each test
    mockServer = new MockN8nServer();
    mockClient = new MockApiClient(mockServer);
    nodeDiscovery = new EnhancedNodeDiscovery(mockClient);

    // Initialize all tools
    discoverTool = new N8nDiscoverTool(mockClient, nodeDiscovery);
    createTool = new N8nCreateTool(mockClient, nodeDiscovery);
    executeTool = new N8nExecuteTool(mockClient);
    inspectTool = new N8nInspectTool(mockClient, nodeDiscovery);
    removeTool = new N8nRemoveTool(mockClient);
    modifyTool = new N8nModifyTool(mockClient, nodeDiscovery);
    connectTool = new N8nConnectTool(mockClient);
    controlTool = new N8nControlTool(mockClient);
    searchTool = new N8nSearchTool(mockClient, nodeDiscovery);
    validateTool = new N8nValidateTool(mockClient, nodeDiscovery);
  });

  describe('N8nDiscoverTool', () => {
    test('should discover nodes from workflows', async () => {
      const result = await discoverTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_discover',
          arguments: { type: 'nodes' }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.nodes).toBeDefined();
      expect(Array.isArray(result.nodes)).toBe(true);
    });

    test('should discover workflows', async () => {
      const result = await discoverTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_discover',
          arguments: { type: 'workflows' }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.workflows).toBeDefined();
      expect(Array.isArray(result.workflows)).toBe(true);
      expect(result.workflows.length).toBeGreaterThan(0);
    });

    test('should discover credentials', async () => {
      const result = await discoverTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_discover',
          arguments: { type: 'credentials' }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.credentials).toBeDefined();
      expect(Array.isArray(result.credentials)).toBe(true);
    });
  });

  describe('N8nCreateTool', () => {
    test('should create a basic workflow', async () => {
      const result = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'workflow',
            name: 'Test Workflow',
            template: 'basic'
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.workflow).toBeDefined();
      expect(result.workflow.name).toBe('Test Workflow');
      expect(result.workflow.id).toBeDefined();
    });

    test('should create a webhook workflow', async () => {
      const result = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'workflow',
            name: 'Webhook Test',
            template: 'webhook'
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.workflow).toBeDefined();
      expect(result.workflow.nodeCount).toBeGreaterThan(0);
    });

    test('should create a node', async () => {
      // First create a workflow
      const workflowResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'workflow',
            name: 'Test Workflow',
            template: 'basic'
          }
        }
      });

      const result = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'node',
            workflow: workflowResult.workflow.id,
            nodeType: 'n8n-nodes-base.httpRequest',
            name: 'HTTP Request Node'
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.node).toBeDefined();
      expect(result.node.type).toBe('n8n-nodes-base.httpRequest');
    });
  });

  describe('N8nExecuteTool', () => {
    test('should execute a workflow', async () => {
      // Create a test workflow first
      const createResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'workflow',
            name: 'Execute Test',
            template: 'basic'
          }
        }
      });

      const result = await executeTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_execute',
          arguments: {
            workflow: createResult.workflow.id,
            data: { test: 'data' }
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.execution).toBeDefined();
      expect(result.execution.id).toBeDefined();
    });

    test('should handle execution with invalid workflow ID', async () => {
      const result = await executeTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_execute',
          arguments: {
            workflow: 'non-existent-id'
          }
        }
      });

      expect(result.error).toBe(true);
    });
  });

  describe('N8nInspectTool', () => {
    test('should inspect a workflow', async () => {
      const result = await inspectTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_inspect',
          arguments: {
            type: 'workflow',
            id: 'test-webhook-1'
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.type).toBe('workflow');
      expect(result.id).toBeDefined();
    });

    test('should inspect an execution', async () => {
      // Create and execute a workflow first
      const createResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'workflow',
            name: 'Inspect Test',
            template: 'basic'
          }
        }
      });

      const executeResult = await executeTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_execute',
          arguments: {
            workflow: createResult.workflow.id
          }
        }
      });

      const result = await inspectTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_inspect',
          arguments: {
            type: 'execution',
            id: executeResult.execution.id
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.type).toBe('execution');
      expect(result.id).toBeDefined();
    });
  });

  describe('N8nRemoveTool', () => {
    test('should remove a workflow', async () => {
      // Create a test workflow first
      const createResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'workflow',
            name: 'Remove Test',
            template: 'basic'
          }
        }
      });

      const result = await removeTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_remove',
          arguments: {
            type: 'workflow',
            workflow: createResult.workflow.id,
            confirm: true
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.message).toContain('deleted');
    });

    test('should handle removing non-existent workflow', async () => {
      const result = await removeTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_remove',
          arguments: {
            type: 'workflow',
            workflow: 'non-existent-id',
            confirm: true
          }
        }
      });

      expect(result.error).toBe(true);
    });
  });

  describe('N8nModifyTool', () => {
    test('should modify a workflow', async () => {
      // Create a test workflow first
      const createResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'workflow',
            name: 'Modify Test',
            template: 'basic'
          }
        }
      });

      const result = await modifyTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_modify',
          arguments: {
            type: 'workflow',
            workflow: createResult.workflow.id,
            name: 'Modified Workflow Name',
            tags: ['modified', 'test']
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.workflow).toBeDefined();
      expect(result.workflow.name).toBe('Modified Workflow Name');
    });
  });

  describe('N8nConnectTool', () => {
    test('should connect nodes in a workflow', async () => {
      // Create a workflow with multiple nodes
      const createResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'workflow',
            name: 'Connect Test',
            template: 'webhook'
          }
        }
      });

      // Add another node
      const nodeResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'node',
            workflow: createResult.workflow.id,
            nodeType: 'n8n-nodes-base.httpRequest',
            name: 'HTTP Request'
          }
        }
      });

      const result = await connectTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_connect',
          arguments: {
            action: 'add',
            workflow: createResult.workflow.id,
            from: 'webhook',
            to: nodeResult.node.id
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.connection).toBeDefined();
    });
  });

  describe('N8nControlTool', () => {
    test('should activate a workflow', async () => {
      // Create a test workflow first
      const createResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'workflow',
            name: 'Control Test',
            template: 'basic'
          }
        }
      });

      const result = await controlTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_control',
          arguments: {
            action: 'activate',
            workflow: createResult.workflow.id
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.workflow.active).toBe(true);
    });

    test('should deactivate a workflow', async () => {
      // Create and activate a workflow first
      const createResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'workflow',
            name: 'Control Test',
            template: 'basic'
          }
        }
      });

      await controlTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_control',
          arguments: {
            action: 'activate',
            workflow: createResult.workflow.id
          }
        }
      });

      const result = await controlTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_control',
          arguments: {
            action: 'deactivate',
            workflow: createResult.workflow.id
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.workflow.active).toBe(false);
    });
  });

  describe('N8nSearchTool', () => {
    test('should search workflows', async () => {
      const result = await searchTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_search',
          arguments: {
            query: 'webhook',
            type: 'workflows'
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.categories).toBeDefined();
      expect(typeof result.categories).toBe('object');
    });

    test('should search nodes', async () => {
      const result = await searchTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_search',
          arguments: {
            query: 'http',
            type: 'nodes'
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.categories).toBeDefined();
      expect(typeof result.categories).toBe('object');
    });
  });

  describe('N8nValidateTool', () => {
    test('should validate a workflow', async () => {
      const result = await validateTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_validate',
          arguments: {
            type: 'workflow',
            workflow: 'test-webhook-1'
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.validation).toBeDefined();
      expect(result.validation.valid).toBeDefined();
    });

    test('should validate node configuration', async () => {
      const result = await validateTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_validate',
          arguments: {
            type: 'parameters',
            nodeType: 'n8n-nodes-base.webhook',
            parameters: {
              httpMethod: 'POST',
              path: 'test-webhook'
            }
          }
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.validation).toBeDefined();
      expect(result.validation.valid).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should create, modify, and execute a complete workflow', async () => {
      // 1. Create a webhook workflow
      const createResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'workflow',
            name: 'Integration Test Workflow',
            template: 'webhook'
          }
        }
      });
      expect(createResult.error).toBeUndefined();

      // 2. Add an HTTP Request node
      const nodeResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {
            type: 'node',
            workflow: createResult.workflow.id,
            nodeType: 'n8n-nodes-base.httpRequest',
            name: 'API Call'
          }
        }
      });
      expect(nodeResult.error).toBeUndefined();

      // 3. Connect the nodes
      const connectResult = await connectTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_connect',
          arguments: {
            action: 'add',
            workflow: createResult.workflow.id,
            from: 'webhook',
            to: nodeResult.node.id
          }
        }
      });
      expect(connectResult.error).toBeUndefined();

      // 4. Modify workflow settings
      const modifyResult = await modifyTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_modify',
          arguments: {
            type: 'workflow',
            workflow: createResult.workflow.id,
            tags: ['integration', 'test', 'webhook']
          }
        }
      });
      expect(modifyResult.error).toBeUndefined();

      // 5. Validate the workflow
      const validateResult = await validateTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_validate',
          arguments: {
            type: 'workflow',
            workflow: createResult.workflow.id
          }
        }
      });
      expect(validateResult.error).toBeUndefined();

      // 6. Activate the workflow
      const activateResult = await controlTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_control',
          arguments: {
            action: 'activate',
            workflow: createResult.workflow.id
          }
        }
      });
      expect(activateResult.error).toBeUndefined();

      // 7. Execute the workflow
      const executeResult = await executeTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_execute',
          arguments: {
            workflow: createResult.workflow.id,
            data: { test: 'integration' }
          }
        }
      });
      expect(executeResult.error).toBeUndefined();

      // 8. Inspect the execution
      const inspectResult = await inspectTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_inspect',
          arguments: {
            type: 'execution',
            id: executeResult.execution.id
          }
        }
      });
      expect(inspectResult.error).toBeUndefined();
      expect(inspectResult.type).toBe('execution');

      // 9. Search for our workflow
      const searchResult = await searchTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_search',
          arguments: {
            query: 'Integration Test',
            type: 'workflows'
          }
        }
      });
      expect(searchResult.error).toBeUndefined();
      expect(Object.keys(searchResult.categories).length).toBeGreaterThan(0);

      // 10. Clean up - remove the workflow
      const removeResult = await removeTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_remove',
          arguments: {
            type: 'workflow',
            workflow: createResult.workflow.id,
            confirm: true,
            force: true
          }
        }
      });
      expect(removeResult.error).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid tool parameters gracefully', async () => {
      const result = await discoverTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_discover',
          arguments: { type: 'invalid-target' }
        }
      });

      expect(result.error).toBe(true);
    });

    test('should handle missing required parameters', async () => {
      const result = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: {}
        }
      });

      expect(result.error).toBe(true);
    });

    test('should handle server errors gracefully', async () => {
      // Simulate server error by using invalid workflow ID
      const result = await executeTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_execute',
          arguments: {
            workflow: 'invalid-id-that-causes-error'
          }
        }
      });

      expect(result.error).toBe(true);
    });
  });

  describe('N8nBatchTool', () => {
    let batchTool: any;

    beforeEach(() => {
      const { N8nBatchTool } = require('../tools/primitives/N8nBatchTool.js');
      batchTool = new N8nBatchTool(mockClient, nodeDiscovery);
    });

    test('should perform batch activation', async () => {
      // Create multiple workflows
      const wf1 = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: { type: 'workflow', name: 'Batch Test 1', template: 'basic' }
        }
      });

      const wf2 = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: { type: 'workflow', name: 'Batch Test 2', template: 'basic' }
        }
      });

      const result = await batchTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_batch',
          arguments: {
            action: 'execute',
            items: [wf1.workflow.id, wf2.workflow.id]
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('N8nDebugTool', () => {
    let debugTool: any;

    beforeEach(() => {
      const { N8nDebugTool } = require('../tools/primitives/N8nDebugTool.js');
      debugTool = new N8nDebugTool(mockClient, nodeDiscovery);
    });

    test('should analyze workflow execution', async () => {
      // Create and execute a workflow
      const createResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: { type: 'workflow', name: 'Debug Test', template: 'basic' }
        }
      });

      const executeResult = await executeTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_execute',
          arguments: { workflow: createResult.workflow.id }
        }
      });

      const result = await debugTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_debug',
          arguments: {
            action: 'analyze',
            target: {
              executionId: executeResult.execution.id
            }
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('N8nExportTool', () => {
    let exportTool: any;

    beforeEach(() => {
      const { N8nExportTool } = require('../tools/primitives/N8nExportTool.js');
      exportTool = new N8nExportTool(mockClient);
    });

    test('should export workflow as JSON', async () => {
      const createResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: { type: 'workflow', name: 'Export Test', template: 'basic' }
        }
      });

      const result = await exportTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_export',
          arguments: {
            action: 'export',
            target: {
              workflowIds: [createResult.workflow.id]
            },
            format: 'json'
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('N8nMonitorTool', () => {
    let monitorTool: any;

    beforeEach(() => {
      const { N8nMonitorTool } = require('../tools/primitives/N8nMonitorTool.js');
      monitorTool = new N8nMonitorTool(mockClient);
    });

    test('should check execution status', async () => {
      const createResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: { type: 'workflow', name: 'Monitor Test', template: 'basic' }
        }
      });

      const executeResult = await executeTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_execute',
          arguments: { workflow: createResult.workflow.id }
        }
      });

      const result = await monitorTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_monitor',
          arguments: {
            action: 'status',
            executionId: executeResult.execution.id
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('N8nTemplateTool', () => {
    let templateTool: any;

    beforeEach(() => {
      const { N8nTemplateTool } = require('../tools/primitives/N8nTemplateTool.js');
      templateTool = new N8nTemplateTool(mockClient, nodeDiscovery);
    });

    test('should list available templates', async () => {
      const result = await templateTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_template',
          arguments: {
            action: 'browse'
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.templates).toBeDefined();
    });

    test('should create template from workflow', async () => {
      const createResult = await createTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_create',
          arguments: { type: 'workflow', name: 'Template Source', template: 'webhook' }
        }
      });

      const result = await templateTool.handleToolCall({
        method: "tools/call" as const,
        params: {
          name: 'n8n_template',
          arguments: {
            action: 'analyze',
            workflowId: createResult.workflow.id
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });
});
