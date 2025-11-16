#!/usr/bin/env node

/**
 * Minimal n8n MCP Server v2.0.0
 *
 * A lightweight Model Context Protocol server for n8n workflow automation.
 * Built following current MCP SDK and n8n API best practices.
 *
 * MCP Best Practices Implemented:
 * - Uses Server class with setRequestHandler (current MCP SDK pattern)
 * - Structured error responses with both text and structured content
 * - Connection cleanup handlers for graceful shutdown
 * - Lazy-loaded tools to minimize startup time
 * - StdioServerTransport for subprocess communication
 * - Proper error handling with MCP error types
 *
 * n8n API Best Practices Implemented:
 * - X-N8N-API-KEY header authentication
 * - Proper HTTP status code handling (401, 403, 404, 429)
 * - Rate limit detection with Retry-After header support
 * - 30-second request timeout (recommended)
 * - Content-Type and Accept headers
 *
 * Architecture:
 * - 5 core tools: discover, create, execute, inspect, remove
 * - Lazy loading: Tools loaded on first use for faster startup
 * - Minimal dependencies: Only MCP SDK, axios, and dotenv
 * - Type-safe: Full TypeScript with strict mode
 *
 * @see https://github.com/modelcontextprotocol/typescript-sdk
 * @see https://docs.n8n.io/api/
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { N8nClient } from './client.js';
import { loggers, logToolExecution, logPerformance } from './logger.js';

// Load environment variables
dotenv.config();

// Validate required env vars
const N8N_BASE_URL = process.env.N8N_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_BASE_URL || !N8N_API_KEY) {
  console.error('Error: N8N_BASE_URL and N8N_API_KEY environment variables are required');
  process.exit(1);
}

// Initialize n8n client
const client = new N8nClient({
  baseUrl: N8N_BASE_URL,
  apiKey: N8N_API_KEY,
});

// Initialize MCP server
const server = new Server(
  {
    name: 'n8n-mcp-server',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Lazy-loaded tool handlers
const toolHandlers: Record<string, () => Promise<any>> = {
  n8n_discover: () => import('./tools/discover.js'),
  n8n_create: () => import('./tools/create.js'),
  n8n_execute: () => import('./tools/execute.js'),
  n8n_inspect: () => import('./tools/inspect.js'),
  n8n_remove: () => import('./tools/remove.js'),
};

// List all available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const modules = await Promise.all([
    import('./tools/discover.js'),
    import('./tools/create.js'),
    import('./tools/execute.js'),
    import('./tools/inspect.js'),
    import('./tools/remove.js'),
  ]);

  return {
    tools: [
      modules[0].discoverTool,
      modules[1].createTool,
      modules[2].executeTool,
      modules[3].inspectTool,
      modules[4].removeTool,
    ],
  };
});

// Handle tool calls with lazy loading
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const loader = toolHandlers[toolName];
  const startTime = Date.now();

  if (!loader) {
    loggers.tool.warn({ toolName }, `Unknown tool: ${toolName}`);
    return {
      content: [{
        type: 'text',
        text: `Unknown tool: ${toolName}`,
      }],
      isError: true,
    };
  }

  try {
    const module = await loader();
    let result;

    // Call the appropriate handler
    switch (toolName) {
      case 'n8n_discover':
        result = await module.handleDiscover(request, client);
        break;
      case 'n8n_create':
        result = await module.handleCreate(request, client);
        break;
      case 'n8n_execute':
        result = await module.handleExecute(request, client);
        break;
      case 'n8n_inspect':
        result = await module.handleInspect(request, client);
        break;
      case 'n8n_remove':
        result = await module.handleRemove(request, client);
        break;
      default:
        loggers.tool.warn({ toolName }, `No handler for tool: ${toolName}`);
        return {
          content: [{
            type: 'text',
            text: `No handler for tool: ${toolName}`,
          }],
          isError: true,
        };
    }

    const duration = Date.now() - startTime;
    logToolExecution(toolName, request.params.arguments || {}, duration, true);
    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logToolExecution(toolName, request.params.arguments || {}, duration, false);
    loggers.tool.error({ error, toolName }, `Tool execution failed: ${error?.message}`);

    return {
      content: [{
        type: 'text',
        text: `Error: ${error?.message || String(error)}`,
      }],
      isError: true,
    };
  }
});

// Error handler
server.onerror = (error) => {
  loggers.server.error({ error }, 'MCP Server Error');
};

// Start server
async function main() {
  const transport = new StdioServerTransport();

  // Connection cleanup handler (MCP best practice)
  transport.onclose = async () => {
    loggers.server.info('Connection closed, cleaning up...');
  };

  await server.connect(transport);

  loggers.server.info(
    { version: '2.0.0', n8nUrl: N8N_BASE_URL },
    'n8n MCP Server started successfully'
  );
}

// Graceful shutdown handler
let isShuttingDown = false;
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  loggers.server.info({ signal }, 'Received shutdown signal, shutting down gracefully...');

  try {
    // Give time for any in-flight requests to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    loggers.server.info('Shutdown complete');
  } catch (error) {
    loggers.server.error({ error }, 'Error during shutdown');
  }

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
