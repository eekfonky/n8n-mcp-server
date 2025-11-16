/**
 * Unit tests for cache module
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SimpleCache, N8nCacheManager } from './cache.js';

describe('SimpleCache', () => {
  let cache: SimpleCache<string>;

  beforeEach(() => {
    cache = new SimpleCache<string>({ ttl: 1000, maxSize: 3 });
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should overwrite existing values', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('expiration', () => {
    it('should expire values after TTL', async () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(cache.get('key1')).toBeNull();
    });

    it('should support custom TTL per entry', async () => {
      cache.set('key1', 'value1', 500);
      cache.set('key2', 'value2', 2000);

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('maxSize', () => {
    it('should evict oldest entry when max size reached', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // This should evict key1

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired keys', async () => {
      cache.set('key1', 'value1');
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing keys', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
    });

    it('should return false for non-existent keys', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.stats().size).toBe(0);
    });
  });

  describe('stats', () => {
    it('should return correct statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.stats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
      expect(stats.ttl).toBe(1000);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      cache.set('key1', 'value1', 500);
      cache.set('key2', 'value2', 2000);

      await new Promise(resolve => setTimeout(resolve, 600));

      const removed = cache.cleanup();
      expect(removed).toBe(1);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      cache.set('key1', 'cached');

      // @ts-expect-error - Mock function type inference issue
      const fetcher: () => Promise<string> = jest.fn().mockResolvedValue('fetched');
      const result = await cache.getOrSet('key1', fetcher);

      expect(result).toBe('cached');
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should fetch and cache if not exists', async () => {
      // @ts-expect-error - Mock function type inference issue
      const fetcher: () => Promise<string> = jest.fn().mockResolvedValue('fetched');
      const result = await cache.getOrSet('key1', fetcher);

      expect(result).toBe('fetched');
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('fetched');
    });

    it('should fetch again after expiration', async () => {
      // @ts-expect-error - Mock function type inference issue
      const fetcher: () => Promise<string> = jest.fn()
        .mockResolvedValueOnce('first')
        .mockResolvedValueOnce('second');

      const result1 = await cache.getOrSet('key1', fetcher, 500);
      expect(result1).toBe('first');

      await new Promise(resolve => setTimeout(resolve, 600));

      const result2 = await cache.getOrSet('key1', fetcher, 500);
      expect(result2).toBe('second');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });
});

describe('N8nCacheManager', () => {
  let cacheManager: N8nCacheManager;

  beforeEach(() => {
    cacheManager = new N8nCacheManager();
  });

  describe('node types cache', () => {
    it('should cache and retrieve node types', () => {
      const mockNodeTypes = [{ name: 'HttpRequest', displayName: 'HTTP Request' }];
      cacheManager.setNodeTypes(mockNodeTypes);

      const result = cacheManager.getNodeTypes();
      expect(result).toEqual(mockNodeTypes);
    });
  });

  describe('workflows cache', () => {
    it('should cache and retrieve workflows', () => {
      const mockWorkflows = [{ id: '1', name: 'Test' }];
      cacheManager.setWorkflows(mockWorkflows);

      const result = cacheManager.getWorkflows();
      expect(result).toEqual(mockWorkflows);
    });

    it('should cache individual workflows', () => {
      const mockWorkflow = { id: '123', name: 'Test Workflow' };
      cacheManager.setWorkflow('123', mockWorkflow);

      const result = cacheManager.getWorkflow('123');
      expect(result).toEqual(mockWorkflow);
    });

    it('should invalidate workflow cache', () => {
      const mockWorkflow = { id: '123', name: 'Test' };
      const mockWorkflows = [mockWorkflow];

      cacheManager.setWorkflow('123', mockWorkflow);
      cacheManager.setWorkflows(mockWorkflows);

      cacheManager.invalidateWorkflow('123');

      expect(cacheManager.getWorkflow('123')).toBeNull();
      expect(cacheManager.getWorkflows()).toBeNull();
    });
  });

  describe('executions cache', () => {
    it('should cache and retrieve executions', () => {
      const mockExecution = { id: 'exec-1', status: 'success' };
      cacheManager.setExecution('exec-1', mockExecution);

      const result = cacheManager.getExecution('exec-1');
      expect(result).toEqual(mockExecution);
    });

    it('should cache execution lists', () => {
      const mockExecutions = [{ id: 'exec-1' }, { id: 'exec-2' }];
      cacheManager.setExecutions('workflow-123', mockExecutions);

      const result = cacheManager.getExecutions('workflow-123');
      expect(result).toEqual(mockExecutions);
    });
  });

  describe('cache management', () => {
    it('should clear all caches', () => {
      cacheManager.setNodeTypes([{ name: 'Test' }]);
      cacheManager.setWorkflows([{ id: '1' }]);

      cacheManager.clearAll();

      expect(cacheManager.getNodeTypes()).toBeNull();
      expect(cacheManager.getWorkflows()).toBeNull();
    });

    it('should return stats for all caches', () => {
      const stats = cacheManager.stats();

      expect(stats).toHaveProperty('nodeTypes');
      expect(stats).toHaveProperty('workflows');
      expect(stats).toHaveProperty('credentials');
      expect(stats).toHaveProperty('executions');
    });
  });
});
