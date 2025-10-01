#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequest,
  ListResourcesRequest,
  ListToolsRequest,
  ReadResourceRequest,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

import { N8nApiClient } from './n8nClient.js';
import { NodeDiscoveryService } from './nodeDiscovery.js';
import { WorkflowTools } from './tools/workflowTools.js';
import { NodeTools } from './tools/nodeTools.js';
import { WorkflowResources } from './resources/workflowResources.js';

// Load environment variables
dotenv.config();

class N8nMcpServer {
  private server: Server;
  private n8nClient: N8nApiClient;
  private nodeDiscovery: NodeDiscoveryService;
  private workflowTools: WorkflowTools;
  private nodeTools: NodeTools;
  private workflowResources: WorkflowResources;

  constructor() {
    // Validate required environment variables
    this.validateEnvironment();

    // Initialize server
    this.server = new Server({
      name: process.env.MCP_SERVER_NAME || 'n8n-mcp-server',
      version: process.env.MCP_SERVER_VERSION || '1.0.0',
    }, {
      capabilities: {
        resources: {},
        tools: {},
      },
    });

    // Initialize n8n client
    this.n8nClient = new N8nApiClient({
      baseUrl: process.env.N8N_BASE_URL!,
      apiKey: process.env.N8N_API_KEY!,
      timeout: 30000,
    });

    // Initialize services
    this.nodeDiscovery = new NodeDiscoveryService(this.n8nClient);
    this.workflowTools = new WorkflowTools(this.n8nClient, this.nodeDiscovery);
    this.nodeTools = new NodeTools(this.n8nClient, this.nodeDiscovery);
    this.workflowResources = new WorkflowResources(this.n8nClient, this.nodeDiscovery);

    this.setupHandlers();
  }

  private validateEnvironment() {
    const required = ['N8N_BASE_URL', 'N8N_API_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('Missing required environment variables:', missing.join(', '));
      console.error('Please check your .env file or environment configuration.');
      process.exit(1);
    }

    // Validate URL format
    try {
      new URL(process.env.N8N_BASE_URL!);
    } catch {
      console.error('Invalid N8N_BASE_URL format. Please provide a valid URL.');
      process.exit(1);
    }
  }

  private setupHandlers() {
    // Tools handlers
    this.server.setRequestHandler(ListToolsRequest, async () => {
      const workflowTools = this.workflowTools.getTools();
      const nodeTools = this.nodeTools.getTools();
      
      return {
        tools: [...workflowTools, ...nodeTools],
      };
    });

    this.server.setRequestHandler(CallToolRequest, async (request) => {
      const toolName = request.params.name;
      
      // Route to appropriate tool handler
      const workflowToolNames = this.workflowTools.getTools().map(t => t.name);
      const nodeToolNames = this.nodeTools.getTools().map(t => t.name);
      
      if (workflowToolNames.includes(toolName)) {
        const result = await this.workflowTools.handleToolCall(request);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      
      if (nodeToolNames.includes(toolName)) {
        const result = await this.nodeTools.handleToolCall(request);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      
      throw new Error(`Unknown tool: ${toolName}`);
    });

    // Resources handlers
    this.server.setRequestHandler(ListResourcesRequest, async (request) => {
      const resources = await this.workflowResources.listResources(request);
      return { resources };
    });

    this.server.setRequestHandler(ReadResourceRequest, async (request) => {
      return await this.workflowResources.readResource(request);
    });

    // Error handler
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };
  }

  async start() {
    // Silent startup for MCP protocol compliance - stdout must be clean
    if (process.env.DEBUG === 'true') {
      console.error('Starting n8n MCP Server...');
    }

    // Start server immediately - validation and discovery are now lazy-loaded
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    if (process.env.DEBUG === 'true') {
      console.error('✓ n8n MCP Server started successfully');
      console.error('Server capabilities:');
      console.error('  - Workflow management (list, create, execute, manage)');
      console.error('  - Node discovery (core and community nodes)');
      console.error('  - Execution monitoring');
      console.error('  - Resource access (workflows, nodes, statistics)');
      console.error('Waiting for requests...');
    }
  }

  async stop() {
    if (process.env.DEBUG === 'true') {
      console.error('Stopping n8n MCP Server...');
    }
    await this.server.close();
    if (process.env.DEBUG === 'true') {
      console.error('✓ Server stopped');
    }
  }
}

// Handle graceful shutdown
async function main() {
  const server = new N8nMcpServer();
  
  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    if (process.env.DEBUG === 'true') {
      console.error(`\nReceived ${signal}, shutting down gracefully...`);
    }
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Server startup failed:', error);
    process.exit(1);
  });
}