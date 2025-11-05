/**
 * Create tool - Create workflows and add nodes
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nClient } from '../client.js';
import { extractParams, formatSuccess, formatError, findWorkflow } from '../utils.js';
import { randomUUID } from 'crypto';

export const createTool: Tool = {
  name: 'n8n_create',
  description: 'Create new workflows or add nodes to existing workflows',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['workflow', 'node'],
        description: 'What to create: workflow or node',
      },
      name: {
        type: 'string',
        description: 'Name for the workflow or node',
      },
      workflowId: {
        type: 'string',
        description: 'Workflow ID or name (required when creating a node)',
      },
      nodeType: {
        type: 'string',
        description: 'Node type (e.g., n8n-nodes-base.httpRequest)',
      },
      parameters: {
        type: 'object',
        description: 'Node parameters',
        additionalProperties: true,
      },
      position: {
        type: 'array',
        items: { type: 'number' },
        description: 'Node position [x, y]',
        default: [250, 300],
      },
    },
    required: ['type', 'name'],
  },
};

export async function handleCreate(request: any, client: N8nClient) {
  try {
    const {
      type,
      name,
      workflowId,
      nodeType,
      parameters = {},
      position = [250, 300],
    } = extractParams(request);

    if (type === 'workflow') {
      // Create a new workflow
      const workflow = {
        name,
        nodes: [],
        connections: {},
        active: false,
        settings: {},
      };

      const created = await client.createWorkflow(workflow);

      return formatSuccess(JSON.stringify({
        success: true,
        workflow: {
          id: created.id,
          name: created.name,
          active: created.active,
        },
        message: `Workflow "${name}" created successfully`,
      }, null, 2));
    }

    if (type === 'node') {
      // Add node to existing workflow
      if (!workflowId) {
        throw new Error('workflowId is required when creating a node');
      }

      if (!nodeType) {
        throw new Error('nodeType is required when creating a node');
      }

      const workflow = await findWorkflow(client, workflowId);
      if (!workflow) {
        throw new Error(`Workflow "${workflowId}" not found`);
      }

      // Create new node
      const newNode = {
        id: randomUUID(),
        name,
        type: nodeType,
        typeVersion: 1,
        position,
        parameters,
      };

      // Add node to workflow
      workflow.nodes = workflow.nodes || [];
      workflow.nodes.push(newNode);

      const updated = await client.updateWorkflow(workflow.id, workflow);

      return formatSuccess(JSON.stringify({
        success: true,
        node: {
          id: newNode.id,
          name: newNode.name,
          type: newNode.type,
        },
        workflow: {
          id: updated.id,
          name: updated.name,
          totalNodes: updated.nodes.length,
        },
        message: `Node "${name}" added to workflow "${workflow.name}"`,
      }, null, 2));
    }

    throw new Error(`Unknown creation type: ${type}`);
  } catch (error) {
    return formatError(error);
  }
}
