/**
 * Service factory for creating and wiring dependencies
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  IServiceFactory,
  IApiClient,
  INodeDiscoveryService,
  ICacheService,
  IHealthCheckService,
  ITransportManager,
  IMCPRequestHandler,
  ServerConfig,
  ServiceDependencies,
  IMCPServer,
} from '../interfaces/index.js';
import { N8nApiClient } from '../n8nClient.js';
import { EnhancedNodeDiscovery } from '../discovery/EnhancedNodeDiscovery.js';
import { TransportManager } from '../transport/TransportManager.js';
import { HealthCheckService } from '../health/HealthCheckService.js';
import { WorkflowResources } from '../resources/workflowResources.js';
import { MCPRequestHandler } from '../handlers/MCPRequestHandler.js';
import * as PrimitiveTools from '../tools/primitives/index.js';

export class ServiceFactory {
  createApiClient(config: ServerConfig): N8nApiClient {
    return new N8nApiClient({
      baseUrl: config.n8nBaseUrl,
      apiKey: config.n8nApiKey,
      timeout: 30000,
    });
  }

  createNodeDiscovery(apiClient: N8nApiClient): EnhancedNodeDiscovery {
    return new EnhancedNodeDiscovery(apiClient);
  }

  createCacheService(config: ServerConfig): ICacheService {
    // For now, return a simple in-memory cache
    // TODO: Implement proper cache service with TTL support
    return new InMemoryCacheService(config.cacheTtlSeconds);
  }

  createHealthCheck(dependencies: Partial<ServiceDependencies>): IHealthCheckService {
    return new HealthCheckService({
      apiClient: dependencies.apiClient,
      cacheService: dependencies.cacheService,
    });
  }

  createTransportManager(server: Server, dependencies: ServiceDependencies): TransportManager {
    return new TransportManager(server, dependencies);
  }

  createRequestHandler(dependencies: { apiClient: N8nApiClient; nodeDiscovery: EnhancedNodeDiscovery }): MCPRequestHandler {
    // Create primitive tools - some need nodeDiscovery, some don't
    const discoverTool = new PrimitiveTools.N8nDiscoverTool(dependencies.apiClient, dependencies.nodeDiscovery);
    const createTool = new PrimitiveTools.N8nCreateTool(dependencies.apiClient, dependencies.nodeDiscovery);
    const executeTool = new PrimitiveTools.N8nExecuteTool(dependencies.apiClient);
    const inspectTool = new PrimitiveTools.N8nInspectTool(dependencies.apiClient, dependencies.nodeDiscovery);
    const removeTool = new PrimitiveTools.N8nRemoveTool(dependencies.apiClient);
    const modifyTool = new PrimitiveTools.N8nModifyTool(dependencies.apiClient, dependencies.nodeDiscovery);
    const connectTool = new PrimitiveTools.N8nConnectTool(dependencies.apiClient);
    const controlTool = new PrimitiveTools.N8nControlTool(dependencies.apiClient);
    const searchTool = new PrimitiveTools.N8nSearchTool(dependencies.apiClient, dependencies.nodeDiscovery);
    const validateTool = new PrimitiveTools.N8nValidateTool(dependencies.apiClient, dependencies.nodeDiscovery);

    // Advanced primitive tools (Phase 3)
    const monitorTool = new PrimitiveTools.N8nMonitorTool(dependencies.apiClient);
    const debugTool = new PrimitiveTools.N8nDebugTool(dependencies.apiClient, dependencies.nodeDiscovery);
    const templateTool = new PrimitiveTools.N8nTemplateTool(dependencies.apiClient, dependencies.nodeDiscovery);
    const batchTool = new PrimitiveTools.N8nBatchTool(dependencies.apiClient, dependencies.nodeDiscovery);
    const exportTool = new PrimitiveTools.N8nExportTool(dependencies.apiClient, dependencies.nodeDiscovery);

    const primitiveTools = [
      discoverTool,
      createTool,
      executeTool,
      inspectTool,
      removeTool,
      modifyTool,
      connectTool,
      controlTool,
      searchTool,
      validateTool,
      monitorTool,
      debugTool,
      templateTool,
      batchTool,
      exportTool
    ];

    const workflowResources = new WorkflowResources(
      dependencies.apiClient,
      dependencies.nodeDiscovery
    );

    return new MCPRequestHandler(primitiveTools, workflowResources);
  }
}

/**
 * Simple in-memory cache implementation
 * TODO: Move to separate file and implement proper TTL management
 */
class InMemoryCacheService implements ICacheService {
  private cache = new Map<string, { value: unknown; expires: number }>();
  private defaultTtl: number;

  constructor(defaultTtlSeconds: number) {
    this.defaultTtl = defaultTtlSeconds;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.defaultTtl;
    const expires = Date.now() + (ttl * 1000);
    this.cache.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }
}