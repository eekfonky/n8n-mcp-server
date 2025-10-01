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
import { NodeDiscoveryService } from '../nodeDiscovery.js';
import { TransportManager } from '../transport/TransportManager.js';
import { HealthCheckService } from '../health/HealthCheckService.js';
import { MCPRequestHandler } from '../handlers/MCPRequestHandler.js';
import { WorkflowTools } from '../tools/workflowTools.js';
import { NodeTools } from '../tools/nodeTools.js';
import { WorkflowResources } from '../resources/workflowResources.js';

export class ServiceFactory {
  createApiClient(config: ServerConfig): N8nApiClient {
    return new N8nApiClient({
      baseUrl: config.n8nBaseUrl,
      apiKey: config.n8nApiKey,
      timeout: 30000,
    });
  }

  createNodeDiscovery(apiClient: N8nApiClient): NodeDiscoveryService {
    return new NodeDiscoveryService(apiClient);
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

  createRequestHandler(dependencies: { apiClient: N8nApiClient; nodeDiscovery: NodeDiscoveryService }): MCPRequestHandler {
    const workflowTools = new WorkflowTools(
      dependencies.apiClient,
      dependencies.nodeDiscovery
    );

    const nodeTools = new NodeTools(
      dependencies.apiClient,
      dependencies.nodeDiscovery
    );

    const workflowResources = new WorkflowResources(
      dependencies.apiClient,
      dependencies.nodeDiscovery
    );

    return new MCPRequestHandler(workflowTools, nodeTools, workflowResources);
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