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
    inspectTool = new N8nInspectTool(mockClient);
    removeTool = new N8nRemoveTool(mockClient);
    modifyTool = new N8nModifyTool(mockClient);
    connectTool = new N8nConnectTool(mockClient, nodeDiscovery);
    controlTool = new N8nControlTool(mockClient);
    searchTool = new N8nSearchTool(mockClient, nodeDiscovery);
    validateTool = new N8nValidateTool(mockClient, nodeDiscovery);
  });

  describe('N8nDiscoverTool', () => {
    test('should discover nodes from workflows', async () => {
      const result = await discoverTool.handleToolCall({
        params: { name: 'discover_nodes', arguments: { target: 'nodes', method: 'workflows' } }
      });

      expect(result.success).toBe(true);
      expect(result.nodes).toBeDefined();
      expect(Array.isArray(result.nodes)).toBe(true);
    });

    test('should discover workflows', async () => {
      const result = await discoverTool.handleToolCall({
        params: { name: 'discover_workflows', arguments: { target: 'workflows' } }
      });

      expect(result.success).toBe(true);
      expect(result.workflows).toBeDefined();
      expect(Array.isArray(result.workflows)).toBe(true);
      expect(result.workflows.length).toBeGreaterThan(0);
    });

    test('should discover credentials', async () => {
      const result = await discoverTool.handleToolCall({
        params: { name: 'discover_credentials', arguments: { target: 'credentials' } }
      });

      expect(result.success).toBe(true);
      expect(result.credentials).toBeDefined();
      expect(Array.isArray(result.credentials)).toBe(true);
    });
  });

  describe('N8nCreateTool', () => {
    test('should create a basic workflow', async () => {
      const result = await createTool.handleToolCall({
        params: {
          name: 'create_workflow',
          arguments: {
            type: 'workflow',
            workflowName: 'Test Workflow',
            template: 'basic'
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.workflow).toBeDefined();
      expect(result.workflow.name).toBe('Test Workflow');
      expect(result.workflow.id).toBeDefined();
    });

    test('should create a webhook workflow', async () => {
      const result = await createTool.handleToolCall({
        params: {
          name: 'create_workflow',
          arguments: {
            type: 'workflow',
            workflowName: 'Webhook Test',
            template: 'webhook'
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.workflow).toBeDefined();
      expect(result.workflow.nodes).toBeDefined();
      expect(result.workflow.nodes.length).toBeGreaterThan(0);
    });

    test('should create a node', async () => {
      // First create a workflow
      const workflowResult = await createTool.handleToolCall({
        params: {
          name: 'create_workflow',
          arguments: {
            type: 'workflow',
            workflowName: 'Test Workflow',
            template: 'basic'
          }
        }
      });

      const result = await createTool.handleToolCall({
        params: {
          name: 'create_node',
          arguments: {
            type: 'node',
            workflowId: workflowResult.workflow.id,
            nodeType: 'n8n-nodes-base.httpRequest',
            nodeName: 'HTTP Request Node'
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.node).toBeDefined();
      expect(result.node.type).toBe('n8n-nodes-base.httpRequest');
    });
  });

  describe('N8nExecuteTool', () => {
    test('should execute a workflow', async () => {
      // Create a test workflow first
      const createResult = await createTool.handleToolCall({
        params: {
          type: 'workflow',
          name: 'Execute Test',
          template: 'basic'
        }
      });

      const result = await executeTool.handleToolCall({
        params: {
          workflowId: createResult.workflow.id,
          data: { test: 'data' }
        }
      });

      expect(result.success).toBe(true);
      expect(result.execution).toBeDefined();
      expect(result.execution.id).toBeDefined();
    });

    test('should handle execution with invalid workflow ID', async () => {
      const result = await executeTool.handleToolCall({
        params: {
          workflowId: 'non-existent-id'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('N8nInspectTool', () => {
    test('should inspect a workflow', async () => {
      const result = await inspectTool.handleToolCall({
        params: {
          target: 'workflow',
          id: 'test-webhook-1'
        }
      });

      expect(result.success).toBe(true);
      expect(result.workflow).toBeDefined();
      expect(result.analysis).toBeDefined();
    });

    test('should inspect an execution', async () => {
      // Create and execute a workflow first
      const createResult = await createTool.handleToolCall({
        params: {
          type: 'workflow',
          name: 'Inspect Test',
          template: 'basic'
        }
      });

      const executeResult = await executeTool.handleToolCall({
        params: {
          workflowId: createResult.workflow.id
        }
      });

      const result = await inspectTool.handleToolCall({
        params: {
          target: 'execution',
          id: executeResult.execution.id
        }
      });

      expect(result.success).toBe(true);
      expect(result.execution).toBeDefined();
      expect(result.analysis).toBeDefined();
    });
  });

  describe('N8nRemoveTool', () => {
    test('should remove a workflow', async () => {
      // Create a test workflow first
      const createResult = await createTool.handleToolCall({
        params: {
          type: 'workflow',
          name: 'Remove Test',
          template: 'basic'
        }
      });

      const result = await removeTool.handleToolCall({
        params: {
          target: 'workflow',
          id: createResult.workflow.id
        }
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('removed');
    });

    test('should handle removing non-existent workflow', async () => {
      const result = await removeTool.handleToolCall({
        params: {
          target: 'workflow',
          id: 'non-existent-id'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('N8nModifyTool', () => {
    test('should modify a workflow', async () => {
      // Create a test workflow first
      const createResult = await createTool.handleToolCall({
        params: {
          type: 'workflow',
          name: 'Modify Test',
          template: 'basic'
        }
      });

      const result = await modifyTool.handleToolCall({
        params: {
          target: 'workflow',
          id: createResult.workflow.id,
          changes: {
            name: 'Modified Workflow Name',
            tags: ['modified', 'test']
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.workflow).toBeDefined();
      expect(result.workflow.name).toBe('Modified Workflow Name');
    });
  });

  describe('N8nConnectTool', () => {
    test('should connect nodes in a workflow', async () => {
      // Create a workflow with multiple nodes
      const createResult = await createTool.handleToolCall({
        params: {
          type: 'workflow',
          name: 'Connect Test',
          template: 'webhook'
        }
      });

      // Add another node
      const nodeResult = await createTool.handleToolCall({
        params: {
          type: 'node',
          workflowId: createResult.workflow.id,
          nodeType: 'n8n-nodes-base.httpRequest',
          name: 'HTTP Request'
        }
      });

      const result = await connectTool.handleToolCall({
        params: {
          workflowId: createResult.workflow.id,
          sourceNode: 'webhook-node',
          targetNode: nodeResult.node.id,
          connectionType: 'main'
        }
      });

      expect(result.success).toBe(true);
      expect(result.connection).toBeDefined();
    });
  });

  describe('N8nControlTool', () => {
    test('should activate a workflow', async () => {
      // Create a test workflow first
      const createResult = await createTool.handleToolCall({
        params: {
          type: 'workflow',
          name: 'Control Test',
          template: 'basic'
        }
      });

      const result = await controlTool.handleToolCall({
        params: {
          action: 'activate',
          workflowId: createResult.workflow.id
        }
      });

      expect(result.success).toBe(true);
      expect(result.workflow.active).toBe(true);
    });

    test('should deactivate a workflow', async () => {
      // Create and activate a workflow first
      const createResult = await createTool.handleToolCall({
        params: {
          type: 'workflow',
          name: 'Control Test',
          template: 'basic'
        }
      });

      await controlTool.handleToolCall({
        params: {
          action: 'activate',
          workflowId: createResult.workflow.id
        }
      });

      const result = await controlTool.handleToolCall({
        params: {
          action: 'deactivate',
          workflowId: createResult.workflow.id
        }
      });

      expect(result.success).toBe(true);
      expect(result.workflow.active).toBe(false);
    });
  });

  describe('N8nSearchTool', () => {
    test('should search workflows', async () => {
      const result = await searchTool.handleToolCall({
        params: {
          target: 'workflows',
          query: 'webhook'
        }
      });

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    test('should search nodes', async () => {
      const result = await searchTool.handleToolCall({
        params: {
          target: 'nodes',
          query: 'http'
        }
      });

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('N8nValidateTool', () => {
    test('should validate a workflow', async () => {
      const result = await validateTool.handleToolCall({
        params: {
          target: 'workflow',
          id: 'test-webhook-1'
        }
      });

      expect(result.success).toBe(true);
      expect(result.validation).toBeDefined();
      expect(result.validation.valid).toBeDefined();
    });

    test('should validate node configuration', async () => {
      const result = await validateTool.handleToolCall({
        params: {
          target: 'node',
          nodeType: 'n8n-nodes-base.webhook',
          config: {
            httpMethod: 'POST',
            path: 'test-webhook'
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.validation).toBeDefined();
      expect(result.validation.valid).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should create, modify, and execute a complete workflow', async () => {
      // 1. Create a webhook workflow
      const createResult = await createTool.handleToolCall({
        params: {
          type: 'workflow',
          name: 'Integration Test Workflow',
          template: 'webhook'
        }
      });
      expect(createResult.success).toBe(true);

      // 2. Add an HTTP Request node
      const nodeResult = await createTool.handleToolCall({
        params: {
          type: 'node',
          workflowId: createResult.workflow.id,
          nodeType: 'n8n-nodes-base.httpRequest',
          name: 'API Call'
        }
      });
      expect(nodeResult.success).toBe(true);

      // 3. Connect the nodes
      const connectResult = await connectTool.handleToolCall({
        params: {
          workflowId: createResult.workflow.id,
          sourceNode: 'webhook-node',
          targetNode: nodeResult.node.id,
          connectionType: 'main'
        }
      });
      expect(connectResult.success).toBe(true);

      // 4. Modify workflow settings
      const modifyResult = await modifyTool.handleToolCall({
        params: {
          target: 'workflow',
          id: createResult.workflow.id,
          changes: {
            tags: ['integration', 'test', 'webhook']
          }
        }
      });
      expect(modifyResult.success).toBe(true);

      // 5. Validate the workflow
      const validateResult = await validateTool.handleToolCall({
        params: {
          target: 'workflow',
          id: createResult.workflow.id
        }
      });
      expect(validateResult.success).toBe(true);

      // 6. Activate the workflow
      const activateResult = await controlTool.handleToolCall({
        params: {
          action: 'activate',
          workflowId: createResult.workflow.id
        }
      });
      expect(activateResult.success).toBe(true);

      // 7. Execute the workflow
      const executeResult = await executeTool.handleToolCall({
        params: {
          workflowId: createResult.workflow.id,
          data: { test: 'integration' }
        }
      });
      expect(executeResult.success).toBe(true);

      // 8. Inspect the execution
      const inspectResult = await inspectTool.handleToolCall({
        params: {
          target: 'execution',
          id: executeResult.execution.id
        }
      });
      expect(inspectResult.success).toBe(true);

      // 9. Search for our workflow
      const searchResult = await searchTool.handleToolCall({
        params: {
          target: 'workflows',
          query: 'Integration Test'
        }
      });
      expect(searchResult.success).toBe(true);
      expect(searchResult.results.length).toBeGreaterThan(0);

      // 10. Clean up - remove the workflow
      const removeResult = await removeTool.handleToolCall({
        params: {
          target: 'workflow',
          id: createResult.workflow.id
        }
      });
      expect(removeResult.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid tool parameters gracefully', async () => {
      const result = await discoverTool.handleToolCall({
        params: { target: 'invalid-target' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle missing required parameters', async () => {
      const result = await createTool.handleToolCall({
        params: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle server errors gracefully', async () => {
      // Simulate server error by using invalid workflow ID
      const result = await executeTool.handleToolCall({
        params: {
          workflowId: 'invalid-id-that-causes-error'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});