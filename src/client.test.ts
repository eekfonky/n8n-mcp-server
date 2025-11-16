/**
 * Unit tests for N8nClient
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { N8nClient } from './client.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('N8nClient', () => {
  let client: N8nClient;
  const mockBaseUrl = 'https://n8n.example.com';
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock axios.create to return a mock instance
    const mockInstance = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      defaults: { baseURL: `${mockBaseUrl}/api/v1` },
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    mockedAxios.create.mockReturnValue(mockInstance as any);

    client = new N8nClient({
      baseUrl: mockBaseUrl,
      apiKey: mockApiKey,
    });
  });

  describe('constructor', () => {
    it('should create client with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: `${mockBaseUrl}/api/v1`,
          timeout: 30000,
          headers: expect.objectContaining({
            'X-N8N-API-KEY': mockApiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
        })
      );
    });

    it('should use custom timeout if provided', () => {
      new N8nClient({
        baseUrl: mockBaseUrl,
        apiKey: mockApiKey,
        timeout: 60000,
      });

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 60000,
        })
      );
    });
  });

  describe('getWorkflows', () => {
    it('should fetch workflows successfully', async () => {
      const mockWorkflows = [
        { id: '1', name: 'Workflow 1', active: true },
        { id: '2', name: 'Workflow 2', active: false },
      ];

      const mockAxiosInstance = (client as any).client;
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockWorkflows },
      });

      const result = await client.getWorkflows();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/workflows');
      expect(result).toEqual(mockWorkflows);
    });
  });

  describe('getWorkflow', () => {
    it('should fetch single workflow by ID', async () => {
      const mockWorkflow = {
        id: '123',
        name: 'Test Workflow',
        active: true,
        nodes: [],
        connections: {},
      };

      const mockAxiosInstance = (client as any).client;
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockWorkflow },
      });

      const result = await client.getWorkflow('123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/workflows/123');
      expect(result).toEqual(mockWorkflow);
    });
  });

  describe('createWorkflow', () => {
    it('should create workflow successfully', async () => {
      const newWorkflow = {
        name: 'New Workflow',
        active: false,
        nodes: [],
        connections: {},
      };

      const createdWorkflow = {
        id: '456',
        ...newWorkflow,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockAxiosInstance = (client as any).client;
      mockAxiosInstance.post.mockResolvedValue({
        data: { data: createdWorkflow },
      });

      const result = await client.createWorkflow(newWorkflow);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/workflows', newWorkflow);
      expect(result).toEqual(createdWorkflow);
    });
  });

  describe('updateWorkflow', () => {
    it('should update workflow successfully', async () => {
      const updates = {
        name: 'Updated Workflow',
        active: true,
      };

      const updatedWorkflow = {
        id: '789',
        ...updates,
        nodes: [],
        connections: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      const mockAxiosInstance = (client as any).client;
      mockAxiosInstance.patch.mockResolvedValue({
        data: { data: updatedWorkflow },
      });

      const result = await client.updateWorkflow('789', updates);

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/workflows/789', updates);
      expect(result).toEqual(updatedWorkflow);
    });
  });

  describe('deleteWorkflow', () => {
    it('should delete workflow successfully', async () => {
      const mockAxiosInstance = (client as any).client;
      mockAxiosInstance.delete.mockResolvedValue({ data: {} });

      const result = await client.deleteWorkflow('999');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/workflows/999');
      expect(result).toEqual({ success: true });
    });
  });

  describe('executeWorkflow', () => {
    it('should execute workflow successfully', async () => {
      const executionData = {
        id: 'exec-123',
        finished: true,
        mode: 'manual' as const,
        startedAt: '2024-01-01T00:00:00Z',
        stoppedAt: '2024-01-01T00:01:00Z',
        workflowId: '123',
        status: 'success' as const,
        data: {
          resultData: {
            runData: {},
          },
        },
      };

      const mockAxiosInstance = (client as any).client;
      mockAxiosInstance.post.mockResolvedValue({
        data: { data: executionData },
      });

      const result = await client.executeWorkflow('123');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/workflows/123/execute', {});
      expect(result).toEqual(executionData);
    });

    it('should execute workflow with custom data', async () => {
      const customData = { runData: { key: 'value' } };
      const mockAxiosInstance = (client as any).client;
      mockAxiosInstance.post.mockResolvedValue({
        data: { data: {} },
      });

      await client.executeWorkflow('123', customData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/workflows/123/execute',
        customData
      );
    });
  });

  describe('healthCheck', () => {
    it('should return true when health check passes', async () => {
      mockedAxios.get.mockResolvedValue({ data: { status: 'ok' } });

      const result = await client.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when health check fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Connection failed'));

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      // @ts-expect-error - Mock function type inference issue
      const mockFn: () => Promise<string> = jest.fn().mockResolvedValue('success');

      const result = await client.executeWithRetry(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 error', async () => {
      const error = new Error('Rate limited');
      (error as any).status = 429;

      // @ts-expect-error - Mock function type inference issue
      const mockFn: () => Promise<string> = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const result = await client.executeWithRetry(mockFn, 3, 10);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 error', async () => {
      const error = new Error('Server error');
      (error as any).status = 500;

      // @ts-expect-error - Mock function type inference issue
      const mockFn: () => Promise<string> = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const result = await client.executeWithRetry(mockFn, 3, 10);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 404 error', async () => {
      const error = new Error('Not found');
      (error as any).status = 404;

      // @ts-expect-error - Mock function type inference issue
      const mockFn: () => Promise<unknown> = jest.fn().mockRejectedValue(error);

      await expect(client.executeWithRetry(mockFn, 3, 10)).rejects.toThrow('Not found');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries', async () => {
      const error = new Error('Server error');
      (error as any).status = 500;

      // @ts-expect-error - Mock function type inference issue
      const mockFn: () => Promise<unknown> = jest.fn().mockRejectedValue(error);

      await expect(client.executeWithRetry(mockFn, 3, 10)).rejects.toThrow('Server error');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });
});
