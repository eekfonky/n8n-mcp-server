import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { 
  N8nConfig, 
  N8nWorkflow, 
  N8nExecution, 
  N8nNodeType, 
  N8nCredential,
  CacheEntry,
  RateLimiter
} from './types.js';

export class N8nApiClient {
  private client: AxiosInstance;
  private cache = new Map<string, CacheEntry<any>>();
  private rateLimiter: RateLimiter;
  private readonly cacheTtl: number;
  private readonly maxCacheSize: number;

  constructor(private config: N8nConfig) {
    this.client = axios.create({
      baseURL: `${config.baseUrl}/api/v1`,
      timeout: config.timeout || 30000,
      headers: {
        'X-N8N-API-KEY': config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    // Rate limiting setup
    this.rateLimiter = {
      requests: 0,
      windowStart: Date.now(),
      windowSize: 60000, // 1 minute
      maxRequests: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '60', 10),
    };

    this.cacheTtl = parseInt(process.env.CACHE_TTL_SECONDS || '300', 10) * 1000;
    this.maxCacheSize = parseInt(process.env.MAX_CACHE_SIZE || '100', 10);

    // Request interceptor for rate limiting
    this.client.interceptors.request.use((config) => {
      this.checkRateLimit();
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          throw new Error('Invalid n8n API key. Please check your N8N_API_KEY environment variable.');
        }
        if (error.response?.status === 403) {
          throw new Error('n8n API access denied. Check your API key permissions.');
        }
        if (error.response?.status === 404) {
          throw new Error('n8n API endpoint not found. Check your N8N_BASE_URL configuration.');
        }
        throw error;
      }
    );
  }

  private checkRateLimit(): void {
    const now = Date.now();
    
    // Reset window if needed
    if (now - this.rateLimiter.windowStart >= this.rateLimiter.windowSize) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.windowStart = now;
    }

    // Check rate limit
    if (this.rateLimiter.requests >= this.rateLimiter.maxRequests) {
      throw new Error('Rate limit exceeded. Please wait before making more requests.');
    }

    this.rateLimiter.requests++;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl?: number): void {
    // Implement LRU eviction: if cache is full, remove oldest entry
    if (this.cache.size >= this.maxCacheSize && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.cacheTtl,
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Health endpoint is at root level, not under /api/v1
      await this.client.get('../healthz');
      return true;
    } catch {
      return false;
    }
  }

  async getWorkflows(): Promise<N8nWorkflow[]> {
    const cacheKey = 'workflows';
    const cached = this.getCached<N8nWorkflow[]>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get('/workflows');
    const workflows = response.data.data || response.data;
    
    this.setCache(cacheKey, workflows);
    return workflows;
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    const cacheKey = `workflow:${id}`;
    const cached = this.getCached<N8nWorkflow>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get(`/workflows/${id}`);
    const workflow = response.data.data || response.data;
    
    this.setCache(cacheKey, workflow);
    return workflow;
  }

  async executeWorkflow(id: string, data?: Record<string, any>): Promise<N8nExecution> {
    const payload: AxiosRequestConfig = {
      method: 'POST',
      url: `/workflows/${id}/execute`,
    };

    if (data) {
      payload.data = data;
    }

    const response = await this.client.request(payload);
    return response.data.data || response.data;
  }

  async getExecution(id: string): Promise<N8nExecution> {
    const response = await this.client.get(`/executions/${id}`);
    return response.data.data || response.data;
  }

  async getExecutions(workflowId?: string, limit = 20): Promise<N8nExecution[]> {
    const params = new URLSearchParams();
    if (workflowId) params.append('workflowId', workflowId);
    params.append('limit', limit.toString());

    const response = await this.client.get(`/executions?${params}`);
    return response.data.data || response.data;
  }

  async getNodeTypes(): Promise<N8nNodeType[]> {
    const cacheKey = 'nodeTypes';
    const cached = this.getCached<N8nNodeType[]>(cacheKey);
    if (cached) return cached;

    try {
      // Try different endpoints and methods for node types
      let response;

      try {
        response = await this.client.get('/node-types');
      } catch (getError) {
        try {
          response = await this.client.put('/node-types', {});
        } catch (putError) {
          try {
            response = await this.client.post('/node-types', {});
          } catch (postError) {
            // If no node types endpoint works, return empty array
            console.error('[N8nClient] Node types endpoint not available, returning empty array');
            return [];
          }
        }
      }

      const nodeTypes = response.data.data || response.data;

      // Ensure we return an array
      const nodeTypesArray = Array.isArray(nodeTypes) ? nodeTypes : [];

      // Cache for longer since node types change less frequently
      this.setCache(cacheKey, nodeTypesArray, this.cacheTtl * 4);
      return nodeTypesArray;
    } catch (error: any) {
      console.error('[N8nClient] Failed to fetch node types:', error?.message || 'Unknown error');
      return [];
    }
  }

  async getCredentials(): Promise<N8nCredential[]> {
    const response = await this.client.get('/credentials');
    return response.data.data || response.data;
  }

  async createWorkflow(workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    const response = await this.client.post('/workflows', workflow);
    
    // Invalidate workflows cache
    this.cache.delete('workflows');
    
    return response.data.data || response.data;
  }

  async updateWorkflow(id: string, workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    const response = await this.client.put(`/workflows/${id}`, workflow);
    
    // Invalidate caches
    this.cache.delete('workflows');
    this.cache.delete(`workflow:${id}`);
    
    return response.data.data || response.data;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.client.delete(`/workflows/${id}`);
    
    // Invalidate caches
    this.cache.delete('workflows');
    this.cache.delete(`workflow:${id}`);
  }

  async activateWorkflow(id: string): Promise<N8nWorkflow> {
    const response = await this.client.post(`/workflows/${id}/activate`);
    
    // Invalidate caches
    this.cache.delete('workflows');
    this.cache.delete(`workflow:${id}`);
    
    return response.data.data || response.data;
  }

  async deactivateWorkflow(id: string): Promise<N8nWorkflow> {
    const response = await this.client.post(`/workflows/${id}/deactivate`);
    
    // Invalidate caches
    this.cache.delete('workflows');
    this.cache.delete(`workflow:${id}`);
    
    return response.data.data || response.data;
  }

  // Utility method to check if n8n instance is accessible
  async validateConnection(): Promise<{ valid: boolean; version?: string; error?: string }> {
    try {
      const isHealthy = await this.healthCheck();
      if (!isHealthy) {
        return { valid: false, error: 'n8n instance health check failed' };
      }

      // Try to get workflows to verify API key works
      await this.getWorkflows();
      
      return { valid: true };
    } catch (error: any) {
      return { 
        valid: false, 
        error: error.message || 'Unknown connection error' 
      };
    }
  }

  // Clear all cached data
  clearCache(): void {
    this.cache.clear();
  }

  // Get cache statistics
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}