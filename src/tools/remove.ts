/**
 * Remove tool - Delete workflows and nodes
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nClient } from '../client.js';
import { extractParams, formatSuccess, formatError, findWorkflow } from '../utils.js';

export const removeTool: Tool = {
  name: 'n8n_remove',
  description: 'Delete workflows or remove nodes from workflows',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['workflow', 'node'],
        description: 'What to remove: workflow or node',
      },
      id: {
        type: 'string',
        description: 'Workflow ID or name to delete',
      },
      workflowId: {
        type: 'string',
        description: 'Workflow ID or name (when removing a node)',
      },
      nodeName: {
        type: 'string',
        description: 'Node name or ID to remove from workflow',
      },
    },
    required: ['type'],
  },
};

export async function handleRemove(request: any, client: N8nClient) {
  try {
    const { type, id, workflowId, nodeName } = extractParams(request);

    if (type === 'workflow') {
      if (!id) {
        throw new Error('id is required to delete a workflow');
      }

      const workflow = await findWorkflow(client, id);
      if (!workflow) {
        throw new Error(`Workflow "${id}" not found`);
      }

      // Deactivate if active
      if (workflow.active) {
        await client.deactivateWorkflow(workflow.id);
      }

      // Delete the workflow
      await client.deleteWorkflow(workflow.id);

      return formatSuccess(JSON.stringify({
        success: true,
        workflow: {
          id: workflow.id,
          name: workflow.name,
        },
        message: `Workflow "${workflow.name}" deleted successfully`,
      }, null, 2));
    }

    if (type === 'node') {
      if (!workflowId) {
        throw new Error('workflowId is required when removing a node');
      }

      if (!nodeName) {
        throw new Error('nodeName is required when removing a node');
      }

      const workflow = await findWorkflow(client, workflowId);
      if (!workflow) {
        throw new Error(`Workflow "${workflowId}" not found`);
      }

      // Find and remove the node
      const nodeIndex = workflow.nodes?.findIndex(
        n => n.name === nodeName || n.id === nodeName
      );

      if (nodeIndex === undefined || nodeIndex === -1) {
        throw new Error(`Node "${nodeName}" not found in workflow "${workflow.name}"`);
      }

      const removedNode = workflow.nodes![nodeIndex];

      if (!removedNode) {
        throw new Error(`Node "${nodeName}" not found in workflow "${workflow.name}"`);
      }

      workflow.nodes!.splice(nodeIndex, 1);

      // Remove connections to/from this node
      const connections = workflow.connections || {};
      delete connections[removedNode.name];

      for (const sourceNode in connections) {
        const outputs = connections[sourceNode];
        for (const output in outputs) {
          connections[sourceNode][output] = outputs[output].filter(
            (conn: any) => conn.node !== removedNode.name
          );
        }
      }

      workflow.connections = connections;

      // Update workflow
      const updated = await client.updateWorkflow(workflow.id, workflow);

      return formatSuccess(JSON.stringify({
        success: true,
        node: {
          id: removedNode.id,
          name: removedNode.name,
          type: removedNode.type,
        },
        workflow: {
          id: updated.id,
          name: updated.name,
          remainingNodes: updated.nodes.length,
        },
        message: `Node "${removedNode.name}" removed from workflow "${workflow.name}"`,
      }, null, 2));
    }

    throw new Error(`Unknown removal type: ${type}`);
  } catch (error) {
    return formatError(error);
  }
}
