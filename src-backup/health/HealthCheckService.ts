/**
 * Health check service for monitoring system components
 */

import { IHealthCheckService, IApiClient, ICacheService, HealthStatus, HealthReport } from '../interfaces/index.js';

export class HealthCheckService implements IHealthCheckService {
  private apiClient: IApiClient | undefined;
  private cacheService: ICacheService | undefined;

  constructor(dependencies: { apiClient?: IApiClient | undefined; cacheService?: ICacheService | undefined }) {
    this.apiClient = dependencies.apiClient;
    this.cacheService = dependencies.cacheService;
  }

  async checkOverallHealth(): Promise<HealthStatus> {
    const report = await this.getHealthReport();

    if (report.components.n8n.status === 'unhealthy') {
      return {
        status: 'unhealthy',
        message: 'n8n connectivity failed',
        details: report.components.n8n.details,
      };
    }

    if (report.components.cache.status === 'unhealthy') {
      return {
        status: 'degraded',
        message: 'Cache service unavailable',
        details: report.components.cache.details,
      };
    }

    if (report.components.server.status === 'unhealthy') {
      return {
        status: 'unhealthy',
        message: 'Server configuration invalid',
        details: report.components.server.details,
      };
    }

    return {
      status: 'healthy',
      message: 'All components operational',
    };
  }

  async checkN8nConnectivity(): Promise<boolean> {
    if (!this.apiClient) {
      return false;
    }

    try {
      // Try to get basic info from n8n instance
      await this.apiClient.get('/workflows');
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkCacheHealth(): Promise<boolean> {
    if (!this.cacheService) {
      return true; // Cache is optional
    }

    try {
      // Test cache operations
      const testKey = '__health_check__';
      const testValue = { timestamp: Date.now() };

      await this.cacheService.set(testKey, testValue, 5);
      const retrieved = await this.cacheService.get(testKey);
      await this.cacheService.delete(testKey);

      return retrieved !== null;
    } catch (error) {
      return false;
    }
  }

  async getHealthReport(): Promise<HealthReport> {
    const timestamp = new Date().toISOString();

    // Check n8n connectivity
    const n8nHealthy = await this.checkN8nConnectivity();
    const n8nHealth: HealthStatus = n8nHealthy
      ? { status: 'healthy', message: 'n8n API accessible' }
      : { status: 'unhealthy', message: 'n8n API not accessible', details: { endpoint: 'GET /workflows' } };

    // Check cache health
    const cacheHealthy = await this.checkCacheHealth();
    const cacheHealth: HealthStatus = cacheHealthy
      ? { status: 'healthy', message: 'Cache operations working' }
      : { status: 'unhealthy', message: 'Cache operations failed', details: { test: 'set/get/delete' } };

    // Check server health (basic configuration validation)
    const serverHealth: HealthStatus = this.checkServerHealth();

    // Overall health
    const overallHealth = await this.checkOverallHealth();

    return {
      overall: overallHealth,
      components: {
        n8n: n8nHealth,
        cache: cacheHealth,
        server: serverHealth,
      },
      timestamp,
    };
  }

  private checkServerHealth(): HealthStatus {
    // Basic server health checks
    try {
      const requiredEnvVars = ['N8N_BASE_URL', 'N8N_API_KEY'];
      const missing = requiredEnvVars.filter(key => !process.env[key]);

      if (missing.length > 0) {
        return {
          status: 'unhealthy',
          message: 'Missing required configuration',
          details: { missing },
        };
      }

      // Validate URL format
      try {
        new URL(process.env.N8N_BASE_URL!);
      } catch {
        return {
          status: 'unhealthy',
          message: 'Invalid N8N_BASE_URL format',
          details: { url: process.env.N8N_BASE_URL },
        };
      }

      return {
        status: 'healthy',
        message: 'Server configuration valid',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Server health check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }
}