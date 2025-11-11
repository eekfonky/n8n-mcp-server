/**
 * Comprehensive test suite for n8n MCP v2 tools
 */

import { describe, test, beforeEach, expect } from '@jest/globals';
import { MockN8nClient } from '../testing/MockN8nClient.js';
import { handleDiscover } from './discover.js';
import { handleCreate } from './create.js';
import { handleExecute } from './execute.js';
import { handleInspect } from './inspect.js';
import { handleRemove } from './remove.js';

describe('n8n MCP v2 Tools', () => {
  let client: MockN8nClient;

  beforeEach(() => {
    client = new MockN8nClient();
  });

  describe('n8n_discover', () => {
    test('should discover all workflows', async () => {
      client.addTestWorkflow({ name: 'Workflow 1', active: true });
      client.addTestWorkflow({ name: 'Workflow 2', active: false });

      const request = { params: { arguments: { type: 'workflows' } } };
      const result = await handleDiscover(request, client);

      expect(result.content).toHaveLength(1);
      expect(result.isError).toBeUndefined();
      const text = result.content[0]?.text || '';
      expect(text).toContain('Workflow 1');
      expect(text).toContain('total');
    });

    test('should discover node types', async () => {
      const request = { params: { arguments: { type: 'nodes', limit: 10 } } };
      const result = await handleDiscover(request, client);

      const text = result.content[0]?.text || '';
      expect(text).toContain('manualTrigger');
      expect(text).toContain('total');
    });

    test('should handle unknown discovery type', async () => {
      const request = { params: { arguments: { type: 'invalid' } } };
      const result = await handleDiscover(request, client);

      expect(result.isError).toBe(true);
      const text = result.content[0]?.text || '';
      expect(text).toContain('Error');
    });
  });

  describe('n8n_create', () => {
    test('should create a new workflow', async () => {
      const request = {
        params: { arguments: { type: 'workflow', name: 'New Test Workflow' } }
      };
      const result = await handleCreate(request, client);

      expect(result.isError).toBeUndefined();
      const text = result.content[0]?.text || '';
      expect(text).toContain('New Test Workflow');
      expect(text).toContain('created successfully');
    });

    test('should add a node to existing workflow', async () => {
      const workflow = client.addTestWorkflow({ name: 'Test Workflow' });
      const request = {
        params: {
          arguments: {
            type: 'node',
            name: 'HTTP Request',
            workflowId: workflow.id,
            nodeType: 'n8n-nodes-base.httpRequest',
            parameters: { url: 'https://example.com' },
            position: [250, 300]
          }
        }
      };

      const result = await handleCreate(request, client);
      const text = result.content[0]?.text || '';
      expect(text).toContain('HTTP Request');
      expect(text).toContain('added to workflow');

      const updated = await client.getWorkflow(workflow.id);
      expect(updated.nodes.length).toBe(1);
    });

    test('should fail when creating node without workflowId', async () => {
      const request = {
        params: { arguments: { type: 'node', name: 'HTTP Request', nodeType: 'n8n-nodes-base.httpRequest' } }
      };
      const result = await handleCreate(request, client);

      expect(result.isError).toBe(true);
      const text = result.content[0]?.text || '';
      expect(text).toContain('workflowId is required');
    });
  });

  describe('n8n_execute', () => {
    test('should execute a workflow', async () => {
      const workflow = client.addTestWorkflow({
        name: 'Test Workflow',
        nodes: [{
          id: 'node-1',
          name: 'Start',
          type: 'n8n-nodes-base.manualTrigger',
          typeVersion: 1,
          position: [250, 300],
          parameters: {}
        }]
      });

      const request = { params: { arguments: { workflowId: workflow.id, wait: true } } };
      const result = await handleExecute(request, client);

      const text = result.content[0]?.text || '';
      expect(text).toContain('completed successfully');
      expect(client.getExecutionCount()).toBeGreaterThan(0);
    });

    test('should fail when workflow not found', async () => {
      const request = { params: { arguments: { workflowId: 'nonexistent' } } };
      const result = await handleExecute(request, client);

      expect(result.isError).toBe(true);
      const text = result.content[0]?.text || '';
      expect(text).toContain('not found');
    });
  });

  describe('n8n_inspect', () => {
    test('should inspect a workflow', async () => {
      const workflow = client.addTestWorkflow({
        name: 'Test Workflow',
        active: true,
        tags: ['test'],
        nodes: [{
          id: 'node-1',
          name: 'Start',
          type: 'n8n-nodes-base.manualTrigger',
          typeVersion: 1,
          position: [250, 300],
          parameters: {}
        }]
      });

      const request = { params: { arguments: { type: 'workflow', id: workflow.id } } };
      const result = await handleInspect(request, client);

      const text = result.content[0]?.text || '';
      expect(text).toContain('Test Workflow');
      expect(text).toContain('active');
      expect(text).toContain('Start');
    });

    test('should fail when workflow not found', async () => {
      const request = { params: { arguments: { type: 'workflow', id: 'nonexistent' } } };
      const result = await handleInspect(request, client);

      expect(result.isError).toBe(true);
      const text = result.content[0]?.text || '';
      expect(text).toContain('not found');
    });
  });

  describe('n8n_remove', () => {
    test('should delete a workflow', async () => {
      const workflow = client.addTestWorkflow({ name: 'To Delete' });
      const initialCount = client.getWorkflowCount();

      const request = { params: { arguments: { type: 'workflow', id: workflow.id } } };
      const result = await handleRemove(request, client);

      const text = result.content[0]?.text || '';
      expect(text).toContain('deleted successfully');
      expect(client.getWorkflowCount()).toBe(initialCount - 1);
    });

    test('should remove a node from workflow', async () => {
      const workflow = client.addTestWorkflow({
        name: 'Test Workflow',
        nodes: [
          {
            id: 'node-1',
            name: 'Node 1',
            type: 'n8n-nodes-base.manualTrigger',
            typeVersion: 1,
            position: [250, 300],
            parameters: {}
          },
          {
            id: 'node-2',
            name: 'Node 2',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [450, 300],
            parameters: {}
          }
        ]
      });

      const request = {
        params: { arguments: { type: 'node', workflowId: workflow.id, nodeName: 'Node 2' } }
      };
      const result = await handleRemove(request, client);

      const text = result.content[0]?.text || '';
      expect(text).toContain('removed from workflow');

      const updated = await client.getWorkflow(workflow.id);
      expect(updated.nodes.length).toBe(1);
      expect(updated.nodes[0]?.name).toBe('Node 1');
    });
  });
});
