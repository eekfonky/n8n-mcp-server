/**
 * Discover tool - Find workflows, nodes, and executions
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nClient } from '../client.js';
import { extractParams, formatSuccess, formatError } from '../utils.js';

export const discoverTool: Tool = {
  name: 'n8n_discover',
  description: 'Discover workflows, available node types, executions, and credentials in n8n',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['workflows', 'nodes', 'executions', 'credentials'],
        description: 'What to discover',
      },
      workflowId: {
        type: 'string',
        description: 'Filter executions by workflow ID (optional)',
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return',
        default: 20,
      },
    },
    required: ['type'],
  },
};

export async function handleDiscover(request: any, client: N8nClient) {
  try {
    const { type, workflowId, limit = 20 } = extractParams(request);

    switch (type) {
      case 'workflows': {
        const workflows = await client.getWorkflows();
        const summary = workflows.map((w: any) => ({
          id: w.id,
          name: w.name,
          active: w.active,
          nodes: w.nodes?.length || 0,
        }));

        return formatSuccess(JSON.stringify({
          total: workflows.length,
          workflows: summary,
        }, null, 2));
      }

      case 'nodes': {
        const nodes = await client.getNodeTypes();
        const summary = nodes.slice(0, limit).map((n: any) => ({
          name: n.name,
          displayName: n.displayName,
          description: n.description,
        }));

        return formatSuccess(JSON.stringify({
          total: nodes.length,
          showing: summary.length,
          nodes: summary,
        }, null, 2));
      }

      case 'executions': {
        const executions = await client.getExecutions(workflowId, limit);
        const summary = executions.map((e: any) => ({
          id: e.id,
          workflowId: e.workflowId,
          finished: e.finished,
          mode: e.mode,
          startedAt: e.startedAt,
        }));

        return formatSuccess(JSON.stringify({
          total: executions.length,
          executions: summary,
        }, null, 2));
      }

      case 'credentials': {
        const credentials = await client.getCredentials();
        const summary = credentials.map((c: any) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        }));

        return formatSuccess(JSON.stringify({
          total: credentials.length,
          credentials: summary,
        }, null, 2));
      }

      default:
        throw new Error(`Unknown discovery type: ${type}`);
    }
  } catch (error) {
    return formatError(error);
  }
}
