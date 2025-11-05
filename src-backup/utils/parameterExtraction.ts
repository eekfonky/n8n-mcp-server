/**
 * Utility functions for extracting parameters from MCP requests
 * Handles both Docker MCP (arguments) and standard MCP (direct params) formats
 */

import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

/**
 * Safely parse JSON string with error handling
 * @param value - String value to parse
 * @returns Parsed object or original value if parsing fails
 */
function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    // Return original value if JSON parsing fails
    return value;
  }
}

/**
 * Extract parameters from MCP request, supporting both Docker MCP and standard MCP formats
 * @param request - The MCP tool call request
 * @returns The extracted parameters object
 */
export function extractParameters(request: CallToolRequest): Record<string, any> {
  // Docker MCP puts parameters in request.params.arguments
  // Standard MCP puts them directly in request.params
  const params = request.params as any;
  const args = (params.arguments) || params;

  // Debug logging if enabled
  if (process.env.DEBUG === 'true') {
    console.error('[DEBUG] Raw params:', JSON.stringify(request.params, null, 2));
    console.error('[DEBUG] Arguments extracted:', JSON.stringify(args, null, 2));
  }

  return args;
}

/**
 * Extract and convert specific parameter types for Docker MCP compatibility
 * @param request - The MCP tool call request
 * @param paramConfig - Configuration for parameter types and defaults
 * @returns Object with converted parameters
 */
export function extractTypedParameters(
  request: CallToolRequest,
  paramConfig: Record<string, { type: 'string' | 'number' | 'boolean' | 'object'; default?: any }>
): Record<string, any> {
  const args = extractParameters(request);
  const result: Record<string, any> = {};

  for (const [key, config] of Object.entries(paramConfig)) {
    const value = args[key];

    if (value === undefined || value === null) {
      result[key] = config.default;
      continue;
    }

    switch (config.type) {
      case 'string':
        result[key] = String(value);
        break;
      case 'number':
        result[key] = typeof value === 'string' ? parseInt(value, 10) || config.default : value;
        break;
      case 'boolean':
        result[key] = typeof value === 'string' ? value === 'true' : Boolean(value);
        break;
      case 'object':
        result[key] = typeof value === 'string' ? safeJsonParse(value) : value;
        break;
      default:
        result[key] = value;
    }
  }

  // Copy any remaining parameters not in config
  for (const [key, value] of Object.entries(args)) {
    if (!(key in result)) {
      result[key] = value;
    }
  }

  return result;
}