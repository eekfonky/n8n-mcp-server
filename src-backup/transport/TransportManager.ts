/**
 * Transport management for MCP server
 * Handles stdio and gateway transport modes
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import cors from 'cors';
import { ITransportManager, IConfigurationManager, ServiceDependencies, IHttpServer } from '../interfaces/index.js';
import { validateMCPRequest } from '../middleware/validation.js';

export class TransportManager implements ITransportManager {
  private server: Server;
  private httpServer: IHttpServer | null = null;
  private mode: 'stdio' | 'gateway' | 'stopped' = 'stopped';
  private configManager: IConfigurationManager;

  constructor(server: Server, dependencies: ServiceDependencies) {
    this.server = server;
    this.configManager = dependencies.configManager;
  }

  async startStdio(): Promise<void> {
    if (this.configManager.get('debug')) {
      console.error('Starting n8n MCP Server (stdio)...');
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.mode = 'stdio';

    if (this.configManager.get('debug')) {
      console.error('✓ n8n MCP Server (stdio) started successfully');
    }
  }

  async startGateway(port: number): Promise<IHttpServer> {
    if (this.configManager.get('debug')) {
      console.error(`Starting n8n MCP Server (gateway) on port ${port}...`);
    }

    const app = express();

    // Enable CORS for gateway mode with configurable origins
    const allowedOrigins = this.configManager.get('allowedOrigins');
    app.use(cors({
      origin: allowedOrigins,
      exposedHeaders: ['Mcp-Session-Id'],
      allowedHeaders: ['Content-Type', 'mcp-session-id'],
    }));

    app.use(express.json());

    // Add MCP request validation for all /n8n endpoints
    app.use('/n8n/messages', validateMCPRequest);

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        server: 'n8n-mcp-server',
        version: process.env.MCP_SERVER_VERSION || '1.0.0',
        timestamp: new Date().toISOString()
      });
    });

    // SSE endpoint for gateway integration
    app.get('/n8n', async (req, res) => {
      if (this.configManager.get('debug')) {
        console.error('SSE connection established');
      }

      const transport = new SSEServerTransport('/n8n/messages', res);

      res.on('close', () => {
        if (this.configManager.get('debug')) {
          console.error('SSE connection closed');
        }
      });

      await this.server.connect(transport);
    });

    // Message endpoint for SSE transport
    app.post('/n8n/messages', async (req, res) => {
      if (this.configManager.get('debug')) {
        console.error('SSE message received');
      }

      res.status(200).json({ received: true });
    });

    // Streaming HTTP endpoint (future implementation)
    app.all('/n8n/stream', async (req, res) => {
      res.status(501).json({
        error: 'Streaming HTTP transport not yet implemented',
        supported_transports: ['stdio', 'sse']
      });
    });

    // Start HTTP server
    this.httpServer = app.listen(port, () => {
      if (this.configManager.get('debug')) {
        console.error(`✓ n8n MCP Server (gateway) listening on port ${port}`);
        console.error('Available endpoints:');
        console.error(`  - Health: http://localhost:${port}/health`);
        console.error(`  - SSE: http://localhost:${port}/n8n`);
        console.error(`  - Messages: http://localhost:${port}/n8n/messages`);
      }
    }) as IHttpServer;

    this.mode = 'gateway';
    return this.httpServer;
  }

  async stop(): Promise<void> {
    if (this.configManager.get('debug')) {
      console.error('Stopping n8n MCP Server...');
    }

    await this.server.close();

    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }

    this.mode = 'stopped';

    if (this.configManager.get('debug')) {
      console.error('✓ Server stopped');
    }
  }

  isRunning(): boolean {
    return this.mode !== 'stopped';
  }

  getMode(): 'stdio' | 'gateway' | 'stopped' {
    return this.mode;
  }
}