/**
 * Refactored n8n MCP Server with dependency injection
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  IConfigurationManager,
  ServiceDependencies,
} from './interfaces/index.js';
import { ConfigurationManager } from './config/ConfigurationManager.js';
import { ServiceFactory } from './factory/ServiceFactory.js';

export class N8nMcpServer {
  private server: Server;
  private dependencies: ServiceDependencies;

  constructor(configManager?: IConfigurationManager) {
    // Initialize configuration
    const config = configManager || new ConfigurationManager();

    // Initialize MCP server
    this.server = new Server({
      name: process.env.MCP_SERVER_NAME || 'n8n-mcp-server',
      version: process.env.MCP_SERVER_VERSION || '1.0.0',
    }, {
      capabilities: {
        resources: {},
        tools: {},
      },
    });

    // Create service factory
    const factory = new ServiceFactory();

    // Build dependency graph
    const apiClient = factory.createApiClient(config.getAll());
    const nodeDiscovery = factory.createNodeDiscovery(apiClient);
    const cacheService = factory.createCacheService(config.getAll());
    const healthCheck = factory.createHealthCheck({ apiClient, cacheService });
    const requestHandler = factory.createRequestHandler({
      apiClient,
      nodeDiscovery
    });

    this.dependencies = {
      configManager: config,
      apiClient,
      nodeDiscovery,
      cacheService,
      healthCheck,
      transportManager: factory.createTransportManager(this.server, {
        configManager: config,
        apiClient,
        nodeDiscovery,
        cacheService,
        healthCheck,
        requestHandler,
      } as ServiceDependencies),
      requestHandler,
    };

    this.setupHandlers();
  }

  private setupHandlers() {
    const { requestHandler } = this.dependencies;

    // Tools handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return await requestHandler.handleToolsRequest({});
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await requestHandler.handleToolCall(request);
    });

    // Resources handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
      return await requestHandler.handleResourcesRequest(request);
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return await requestHandler.handleResourceRead(request);
    });

    // Error handler
    this.server.onerror = requestHandler.createErrorHandler();
  }

  async startStdio(): Promise<void> {
    await this.dependencies.transportManager.startStdio();
  }

  async startGateway(port?: number): Promise<unknown> {
    const mcpPort = port || this.dependencies.configManager.get('mcpPort') || 3000;
    return await this.dependencies.transportManager.startGateway(mcpPort);
  }

  async stop(): Promise<void> {
    await this.dependencies.transportManager.stop();
  }

  /**
   * Get health status of the server
   */
  async getHealth() {
    return await this.dependencies.healthCheck.getHealthReport();
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.dependencies.transportManager.isRunning();
  }

  /**
   * Get current transport mode
   */
  getMode(): 'stdio' | 'gateway' | 'stopped' {
    return this.dependencies.transportManager.getMode();
  }

  /**
   * Get configuration manager (for testing/debugging)
   */
  getConfigManager(): IConfigurationManager {
    return this.dependencies.configManager;
  }

  /**
   * Reload configuration
   */
  async reloadConfig(): Promise<void> {
    await this.dependencies.configManager.reload();
  }
}