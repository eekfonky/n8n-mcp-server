/**
 * Simple in-memory cache for n8n API responses
 *
 * Reduces API calls for frequently accessed data like:
 * - Node types (rarely change)
 * - Workflow lists (when browsing)
 * - Credentials list
 */

export interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
}

export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly ttl: number;
  private readonly maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl || 300000; // 5 minutes default
    this.maxSize = options.maxSize || 100;
  }

  /**
   * Get cached value if it exists and hasn't expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached value with TTL
   */
  set(key: string, data: T, customTtl?: number): void {
    // Enforce max size by removing oldest entries
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const ttl = customTtl || this.ttl;
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
  }

  /**
   * Check if key exists and hasn't expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get or set pattern: fetch from cache or compute and cache
   */
  async getOrSet(
    key: string,
    fetcher: () => Promise<T>,
    customTtl?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, customTtl);
    return data;
  }
}

/**
 * Cache manager for n8n API responses
 */
export class N8nCacheManager {
  private nodeTypesCache: SimpleCache<any>;
  private workflowsCache: SimpleCache<any>;
  private credentialsCache: SimpleCache<any>;
  private executionsCache: SimpleCache<any>;

  constructor() {
    // Node types rarely change - cache for 1 hour
    this.nodeTypesCache = new SimpleCache({ ttl: 3600000, maxSize: 50 });

    // Workflows change frequently - cache for 2 minutes
    this.workflowsCache = new SimpleCache({ ttl: 120000, maxSize: 100 });

    // Credentials change infrequently - cache for 10 minutes
    this.credentialsCache = new SimpleCache({ ttl: 600000, maxSize: 50 });

    // Executions are ephemeral - cache for 30 seconds
    this.executionsCache = new SimpleCache({ ttl: 30000, maxSize: 200 });
  }

  // Node types
  getNodeTypes(key = 'all'): any | null {
    return this.nodeTypesCache.get(key);
  }

  setNodeTypes(data: any, key = 'all'): void {
    this.nodeTypesCache.set(key, data);
  }

  // Workflows
  getWorkflows(key = 'all'): any | null {
    return this.workflowsCache.get(key);
  }

  setWorkflows(data: any, key = 'all'): void {
    this.workflowsCache.set(key, data);
  }

  getWorkflow(id: string): any | null {
    return this.workflowsCache.get(`workflow:${id}`);
  }

  setWorkflow(id: string, data: any): void {
    this.workflowsCache.set(`workflow:${id}`, data);
  }

  invalidateWorkflow(id: string): void {
    this.workflowsCache.delete(`workflow:${id}`);
    this.workflowsCache.delete('all'); // Invalidate list too
  }

  // Credentials
  getCredentials(key = 'all'): any | null {
    return this.credentialsCache.get(key);
  }

  setCredentials(data: any, key = 'all'): void {
    this.credentialsCache.set(key, data);
  }

  // Executions
  getExecution(id: string): any | null {
    return this.executionsCache.get(`execution:${id}`);
  }

  setExecution(id: string, data: any): void {
    this.executionsCache.set(`execution:${id}`, data);
  }

  getExecutions(key: string): any | null {
    return this.executionsCache.get(key);
  }

  setExecutions(key: string, data: any): void {
    this.executionsCache.set(key, data);
  }

  // Cache management
  clearAll(): void {
    this.nodeTypesCache.clear();
    this.workflowsCache.clear();
    this.credentialsCache.clear();
    this.executionsCache.clear();
  }

  cleanup(): void {
    this.nodeTypesCache.cleanup();
    this.workflowsCache.cleanup();
    this.credentialsCache.cleanup();
    this.executionsCache.cleanup();
  }

  stats(): Record<string, any> {
    return {
      nodeTypes: this.nodeTypesCache.stats(),
      workflows: this.workflowsCache.stats(),
      credentials: this.credentialsCache.stats(),
      executions: this.executionsCache.stats(),
    };
  }
}
