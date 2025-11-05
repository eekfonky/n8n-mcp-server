/**
 * Utility functions for n8n MCP server
 */

import { N8nClient } from './client.js';
import { N8nWorkflow, ToolResult } from './types.js';

/**
 * Format a success response for MCP
 */
export function formatSuccess(text: string): ToolResult {
  return {
    content: [{
      type: 'text',
      text,
    }],
  };
}

/**
 * Format an error response for MCP
 */
export function formatError(error: any): ToolResult {
  const message = error?.message || String(error);
  return {
    content: [{
      type: 'text',
      text: `Error: ${message}`,
    }],
    isError: true,
  };
}

/**
 * Find a workflow by ID or name
 */
export async function findWorkflow(
  client: N8nClient,
  idOrName: string
): Promise<N8nWorkflow | null> {
  // Try as ID first
  try {
    return await client.getWorkflow(idOrName);
  } catch {
    // Not found by ID, search by name
    const workflows = await client.getWorkflows();
    return workflows.find((w: N8nWorkflow) => w.name === idOrName) || null;
  }
}

/**
 * Extract parameters from MCP request
 * Handles both object and array formats
 */
export function extractParams(request: any): Record<string, any> {
  const args = request.params?.arguments || {};

  // If arguments is an array, convert to object
  if (Array.isArray(args)) {
    return args.reduce((acc, item) => ({ ...acc, ...item }), {});
  }

  return args;
}

/**
 * Wait for workflow execution to complete
 */
export async function waitForExecution(
  client: N8nClient,
  executionId: string,
  timeoutSeconds = 60
): Promise<any> {
  const startTime = Date.now();
  const maxTime = timeoutSeconds * 1000;

  while (Date.now() - startTime < maxTime) {
    const execution = await client.getExecution(executionId);

    if (execution.finished) {
      return execution;
    }

    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Execution timeout after ${timeoutSeconds} seconds`);
}
