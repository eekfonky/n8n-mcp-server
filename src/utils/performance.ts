/**
 * Performance utilities for n8n MCP Server
 * Provides efficient deep cloning, memory management, and array operations
 */

/**
 * Efficient deep cloning using structuredClone when available, fallback to JSON for simple objects
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Use structuredClone if available (Node.js 17+)
  if (typeof structuredClone !== 'undefined') {
    try {
      return structuredClone(obj);
    } catch {
      // Fallback if structuredClone fails (e.g., with functions)
    }
  }

  // For arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }

  // For objects
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
}

/**
 * Selective cloning - only clone specified properties to reduce memory usage
 */
export function selectiveClone<T extends Record<string, any>>(
  obj: T,
  includeKeys: (keyof T)[],
  excludeKeys: (keyof T)[] = []
): Partial<T> {
  const result: Partial<T> = {};

  for (const key of includeKeys) {
    if (excludeKeys.includes(key)) continue;
    if (key in obj) {
      result[key] = deepClone(obj[key]);
    }
  }

  return result;
}

/**
 * Memory-efficient array operations
 */
export class ArrayOptimizer {
  /**
   * Process large arrays in chunks to prevent memory spikes
   */
  static async processInChunks<T, R>(
    array: T[],
    processor: (chunk: T[]) => Promise<R[]> | R[],
    chunkSize: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < array.length; i += chunkSize) {
      const chunk = array.slice(i, i + chunkSize);
      const chunkResults = await processor(chunk);
      results.push(...chunkResults);
      
      // Allow garbage collection between chunks
      if (i % (chunkSize * 10) === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    return results;
  }

  /**
   * Efficient array deduplication
   */
  static deduplicate<T>(array: T[], keySelector?: (item: T) => string | number): T[] {
    if (!keySelector) {
      return [...new Set(array)];
    }

    const seen = new Set<string | number>();
    return array.filter(item => {
      const key = keySelector(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Efficient array grouping
   */
  static groupBy<T>(array: T[], keySelector: (item: T) => string): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const key = keySelector(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  /**
   * Combine multiple array operations efficiently
   */
  static pipeline<T>(...operations: Array<(array: T[]) => T[]>) {
    return (array: T[]): T[] => {
      return operations.reduce((acc, operation) => operation(acc), array);
    };
  }
}

/**
 * Memory monitoring and cleanup utilities
 */
export class MemoryManager {
  private static readonly MB = 1024 * 1024;

  static getMemoryUsage(): { used: number; total: number; percentage: number } {
    const usage = process.memoryUsage();
    const used = usage.heapUsed;
    const total = usage.heapTotal;
    
    return {
      used: Math.round(used / this.MB),
      total: Math.round(total / this.MB),
      percentage: Math.round((used / total) * 100)
    };
  }

  static forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
    }
  }

  static async withMemoryLimit<T>(
    operation: () => Promise<T>,
    limitMB: number = 512
  ): Promise<T> {
    const startMemory = this.getMemoryUsage();
    
    try {
      const result = await operation();
      
      const endMemory = this.getMemoryUsage();
      const memoryIncrease = endMemory.used - startMemory.used;
      
      if (memoryIncrease > limitMB) {
        console.warn(`Operation exceeded memory limit: ${memoryIncrease}MB > ${limitMB}MB`);
        this.forceGarbageCollection();
      }
      
      return result;
    } finally {
      // Cleanup after operation
      this.forceGarbageCollection();
    }
  }
}

/**
 * Async operations with proper concurrency control
 */
export class ConcurrencyController {
  private running = 0;
  private queue: Array<() => Promise<any>> = [];

  constructor(private maxConcurrency: number = 3) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedOperation = async () => {
        try {
          this.running++;
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      };

      if (this.running < this.maxConcurrency) {
        wrappedOperation();
      } else {
        this.queue.push(wrappedOperation);
      }
    });
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.running < this.maxConcurrency) {
      const nextOperation = this.queue.shift();
      if (nextOperation) {
        nextOperation();
      }
    }
  }

  async drain(): Promise<void> {
    while (this.running > 0 || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}

/**
 * Performance monitoring and timing utilities
 */
export class PerformanceTracker {
  private static timers = new Map<string, number>();

  static startTimer(label: string): void {
    this.timers.set(label, performance.now());
  }

  static endTimer(label: string): number {
    const start = this.timers.get(label);
    if (!start) {
      throw new Error(`Timer '${label}' was not started`);
    }
    
    const duration = performance.now() - start;
    this.timers.delete(label);
    return Math.round(duration * 100) / 100; // Round to 2 decimal places
  }

  static async measure<T>(label: string, operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    this.startTimer(label);
    try {
      const result = await operation();
      const duration = this.endTimer(label);
      return { result, duration };
    } catch (error) {
      this.endTimer(label);
      throw error;
    }
  }
}

/**
 * Efficient data transformation utilities
 */
export class DataTransformer {
  /**
   * Clean workflow data by removing unnecessary properties
   */
  static cleanWorkflow(workflow: any): any {
    return selectiveClone(workflow, [
      'id', 'name', 'active', 'nodes', 'connections', 'settings', 'tags'
    ], ['createdAt', 'updatedAt', 'versionId']);
  }

  /**
   * Extract minimal execution data
   */
  static minimizeExecution(execution: any): any {
    return selectiveClone(execution, [
      'id', 'workflowId', 'mode', 'startedAt', 'stoppedAt', 'finished'
    ], ['data', 'waitTill']);
  }

  /**
   * Sanitize sensitive data from objects
   */
  static sanitize(obj: any): any {
    const sensitive = ['password', 'token', 'secret', 'key', 'credential'];
    
    function sanitizeRecursive(item: any): any {
      if (Array.isArray(item)) {
        return item.map(sanitizeRecursive);
      }
      
      if (item && typeof item === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(item)) {
          if (sensitive.some(s => key.toLowerCase().includes(s))) {
            sanitized[key] = '[REDACTED]';
          } else {
            sanitized[key] = sanitizeRecursive(value);
          }
        }
        return sanitized;
      }
      
      return item;
    }

    return sanitizeRecursive(obj);
  }
}