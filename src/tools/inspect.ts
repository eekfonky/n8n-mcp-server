/**
 * Inspect tool - Get detailed information about workflows and executions
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nClient } from '../client.js';
import { extractParams, formatSuccess, formatError, findWorkflow } from '../utils.js';

export const inspectTool: Tool = {
  name: 'n8n_inspect',
  description: 'Get detailed information about a workflow, execution, or node',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['workflow', 'execution', 'node'],
        description: 'What to inspect',
      },
      id: {
        type: 'string',
        description: 'ID or name of the item to inspect',
      },
      executionId: {
        type: 'string',
        description: 'Execution ID (for execution type)',
      },
      nodeName: {
        type: 'string',
        description: 'Node name within workflow (for node type)',
      },
    },
    required: ['type'],
  },
};

export async function handleInspect(request: any, client: N8nClient) {
  try {
    const { type, id, executionId, nodeName } = extractParams(request);

    if (type === 'workflow') {
      if (!id) {
        throw new Error('id is required for workflow inspection');
      }

      const workflow = await findWorkflow(client, id);
      if (!workflow) {
        throw new Error(`Workflow "${id}" not found`);
      }

      // Get detailed workflow info
      const summary = {
        id: workflow.id,
        name: workflow.name,
        active: workflow.active,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        tags: workflow.tags,
        nodeCount: workflow.nodes?.length || 0,
        nodes: workflow.nodes?.map(n => ({
          id: n.id,
          name: n.name,
          type: n.type,
          position: n.position,
          disabled: n.disabled,
        })) || [],
        connections: workflow.connections,
      };

      return formatSuccess(JSON.stringify(summary, null, 2));
    }

    if (type === 'execution') {
      if (!executionId) {
        throw new Error('executionId is required for execution inspection');
      }

      const execution = await client.getExecution(executionId);

      const summary = {
        id: execution.id,
        finished: execution.finished,
        mode: execution.mode,
        startedAt: execution.startedAt,
        stoppedAt: execution.stoppedAt,
        workflowId: execution.workflowId,
        duration: execution.stoppedAt
          ? new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime()
          : null,
        data: execution.data,
      };

      return formatSuccess(JSON.stringify(summary, null, 2));
    }

    if (type === 'node') {
      if (!id) {
        throw new Error('id is required for node inspection (workflow ID or name)');
      }

      if (!nodeName) {
        throw new Error('nodeName is required for node inspection');
      }

      const workflow = await findWorkflow(client, id);
      if (!workflow) {
        throw new Error(`Workflow "${id}" not found`);
      }

      const node = workflow.nodes?.find(n => n.name === nodeName || n.id === nodeName);
      if (!node) {
        throw new Error(`Node "${nodeName}" not found in workflow "${workflow.name}"`);
      }

      return formatSuccess(JSON.stringify(node, null, 2));
    }

    throw new Error(`Unknown inspection type: ${type}`);
  } catch (error) {
    return formatError(error);
  }
}
