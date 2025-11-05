/**
 * Execute tool - Run workflows
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nClient } from '../client.js';
import { extractParams, formatSuccess, formatError, findWorkflow, waitForExecution } from '../utils.js';

export const executeTool: Tool = {
  name: 'n8n_execute',
  description: 'Execute a workflow manually with optional input data',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'Workflow ID or name to execute',
      },
      data: {
        type: 'object',
        description: 'Input data for the workflow (optional)',
        additionalProperties: true,
      },
      wait: {
        type: 'boolean',
        description: 'Wait for execution to complete',
        default: true,
      },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds when waiting',
        default: 60,
      },
    },
    required: ['workflowId'],
  },
};

export async function handleExecute(request: any, client: N8nClient) {
  try {
    const {
      workflowId,
      data,
      wait = true,
      timeout = 60,
    } = extractParams(request);

    // Find the workflow
    const workflow = await findWorkflow(client, workflowId);
    if (!workflow) {
      throw new Error(`Workflow "${workflowId}" not found`);
    }

    // Validate workflow has nodes
    if (!workflow.nodes || workflow.nodes.length === 0) {
      throw new Error(`Workflow "${workflow.name}" has no nodes to execute`);
    }

    // Execute the workflow
    const execution = await client.executeWorkflow(workflow.id, data);

    if (!wait) {
      return formatSuccess(JSON.stringify({
        success: true,
        execution: {
          id: execution.id,
          status: 'running',
          workflowId: workflow.id,
          workflowName: workflow.name,
          startedAt: execution.startedAt,
        },
        message: `Workflow "${workflow.name}" started (execution ID: ${execution.id})`,
      }, null, 2));
    }

    // Wait for completion
    const result = await waitForExecution(client, execution.id, timeout);

    return formatSuccess(JSON.stringify({
      success: result.finished,
      execution: {
        id: result.id,
        finished: result.finished,
        workflowId: workflow.id,
        workflowName: workflow.name,
        startedAt: result.startedAt,
        stoppedAt: result.stoppedAt,
        duration: result.stoppedAt
          ? new Date(result.stoppedAt).getTime() - new Date(result.startedAt).getTime()
          : null,
      },
      message: result.finished
        ? `Workflow "${workflow.name}" completed successfully`
        : `Workflow "${workflow.name}" did not finish`,
    }, null, 2));
  } catch (error) {
    return formatError(error);
  }
}
