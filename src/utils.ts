/**
 * Utility functions for n8n MCP server
 * Following MCP best practices for response formatting
 */

import { N8nClient } from './client.js';
import { N8nWorkflow, ToolResult } from './types.js';

/**
 * Format a success response for MCP
 * Follows MCP best practice of returning both text and structured content
 *
 * @param text - Human-readable success message
 * @param data - Optional structured data for AI parsing
 */
export function formatSuccess(text: string, data?: any): ToolResult {
  const result: ToolResult = {
    content: [{
      type: 'text',
      text,
    }],
  };

  // Include structured content if provided (MCP best practice)
  if (data !== undefined) {
    try {
      // Validate JSON serializable
      JSON.parse(JSON.stringify(data));
      (result as any).structuredContent = data;
    } catch {
      // If data is not serializable, skip structured content
      console.error('[Warning] Data not JSON-serializable, omitting structuredContent');
    }
  }

  return result;
}

/**
 * Format an error response for MCP
 * Includes error code and details for better client-side handling
 *
 * @param error - Error object or message
 */
export function formatError(error: any): ToolResult {
  const message = error?.message || String(error);
  const errorCode = error?.code || error?.status || 'UNKNOWN_ERROR';

  return {
    content: [{
      type: 'text',
      text: `Error: ${message}`,
    }],
    isError: true,
    // Include structured error info (MCP best practice)
    ...(error && typeof error === 'object' && {
      structuredContent: {
        error: {
          code: errorCode,
          message,
          ...(error.response?.data && { details: error.response.data }),
        },
      },
    } as any),
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
