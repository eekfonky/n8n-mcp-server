#!/usr/bin/env node

/**
 * Minimal n8n MCP Server
 * Lightweight server with 5 core tools and lazy loading
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { N8nClient } from './client.js';

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

  if (!loader) {
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

    // Call the appropriate handler
    switch (toolName) {
      case 'n8n_discover':
        return await module.handleDiscover(request, client);
      case 'n8n_create':
        return await module.handleCreate(request, client);
      case 'n8n_execute':
        return await module.handleExecute(request, client);
      case 'n8n_inspect':
        return await module.handleInspect(request, client);
      case 'n8n_remove':
        return await module.handleRemove(request, client);
      default:
        return {
          content: [{
            type: 'text',
            text: `No handler for tool: ${toolName}`,
          }],
          isError: true,
        };
    }
  } catch (error: any) {
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
  console.error('[MCP Error]', error);
};

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  if (process.env.DEBUG === 'true') {
    console.error('n8n MCP Server running on stdio');
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (process.env.DEBUG === 'true') {
    console.error('\nShutting down gracefully...');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (process.env.DEBUG === 'true') {
    console.error('\nShutting down gracefully...');
  }
  process.exit(0);
});

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
