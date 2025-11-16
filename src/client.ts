/**
 * Minimal n8n API client
 * Lightweight axios wrapper following n8n API best practices
 *
 * Best Practices Implemented:
 * - X-N8N-API-KEY header authentication (n8n standard)
 * - Proper error handling with status codes
 * - 30-second default timeout (recommended)
 * - Content-Type: application/json (required for POST/PATCH)
 * - Accept header for response format
 * - Strongly typed responses with n8n API types
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import http from 'http';
import https from 'https';
import { logApiCall, logError } from './logger.js';
import type {
  N8nApiResponse,
  N8nApiListResponse,
  WorkflowData,
  WorkflowCreateRequest,
  WorkflowUpdateRequest,
  ExecutionResponse,
  ExecutionSummary,
  ExecuteWorkflowRequest,
  NodeType,
  CredentialData,
  N8nApiError,
} from './types/n8nApi.js';

export interface N8nClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export class N8nClient {
  private client: AxiosInstance;

  constructor(config: N8nClientConfig) {
    // n8n API best practice: Use /api/v1 endpoint with API key authentication
    // Connection pooling: reuse connections for better performance
    const httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60000,
    });

    const httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60000,
    });

    this.client = axios.create({
      baseURL: `${config.baseUrl}/api/v1`,
      timeout: config.timeout || 30000,
      headers: {
        // n8n API authentication standard
        'X-N8N-API-KEY': config.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      httpAgent,
      httpsAgent,
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        (config as any).metadata = { startTime: Date.now() };
        return config;
      },
      (error) => {
        logError(error, { type: 'request' });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - (response.config as any).metadata?.startTime;
        logApiCall(
          response.config.method?.toUpperCase() || 'GET',
          response.config.url || '',
          response.status,
          duration
        );
        return response;
      },
      (error: AxiosError) => {
        // Extract meaningful error information
        const status = error.response?.status;
        const errorData = error.response?.data as any;
        const errorMessage = errorData?.message || error.message;

        // Log the error
        logError(error, {
          status,
          endpoint: error.config?.url,
          method: error.config?.method,
        });

        // Handle common n8n API errors with specific messages
        if (status === 401) {
          const enhancedError = new Error(`n8n API authentication failed: ${errorMessage}`);
          (enhancedError as any).code = 'N8N_AUTH_ERROR';
          (enhancedError as any).status = 401;
          throw enhancedError;
        }

        if (status === 403) {
          const enhancedError = new Error(`n8n API access denied: ${errorMessage}`);
          (enhancedError as any).code = 'N8N_FORBIDDEN';
          (enhancedError as any).status = 403;
          throw enhancedError;
        }

        if (status === 404) {
          const enhancedError = new Error(`n8n resource not found: ${errorMessage}`);
          (enhancedError as any).code = 'N8N_NOT_FOUND';
          (enhancedError as any).status = 404;
          throw enhancedError;
        }

        if (status === 429) {
          // Rate limiting - include Retry-After if available
          const retryAfter = error.response?.headers['retry-after'];
          const enhancedError = new Error(
            `n8n API rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ''}`
          );
          (enhancedError as any).code = 'N8N_RATE_LIMIT';
          (enhancedError as any).status = 429;
          (enhancedError as any).retryAfter = retryAfter;
          throw enhancedError;
        }

        // Preserve original error with additional context
        (error as any).code = error.code || 'N8N_API_ERROR';
        throw error;
      }
    );
  }

  // Workflows
  async getWorkflows(): Promise<WorkflowData[]> {
    const response = await this.client.get<N8nApiListResponse<WorkflowData>>('/workflows');
    return response.data.data || (response.data as any);
  }

  async getWorkflow(id: string): Promise<WorkflowData> {
    const response = await this.client.get<N8nApiResponse<WorkflowData>>(`/workflows/${id}`);
    return response.data.data || (response.data as any);
  }

  async createWorkflow(workflow: WorkflowCreateRequest): Promise<WorkflowData> {
    const response = await this.client.post<N8nApiResponse<WorkflowData>>('/workflows', workflow);
    return response.data.data || (response.data as any);
  }

  async updateWorkflow(id: string, workflow: WorkflowUpdateRequest): Promise<WorkflowData> {
    const response = await this.client.patch<N8nApiResponse<WorkflowData>>(`/workflows/${id}`, workflow);
    return response.data.data || (response.data as any);
  }

  async deleteWorkflow(id: string): Promise<{ success: boolean }> {
    await this.client.delete(`/workflows/${id}`);
    return { success: true };
  }

  async activateWorkflow(id: string): Promise<WorkflowData> {
    const response = await this.client.patch<N8nApiResponse<WorkflowData>>(`/workflows/${id}`, { active: true });
    return response.data.data || (response.data as any);
  }

  async deactivateWorkflow(id: string): Promise<WorkflowData> {
    const response = await this.client.patch<N8nApiResponse<WorkflowData>>(`/workflows/${id}`, { active: false });
    return response.data.data || (response.data as any);
  }

  // Executions
  async executeWorkflow(id: string, data?: ExecuteWorkflowRequest): Promise<ExecutionResponse> {
    const response = await this.client.post<N8nApiResponse<ExecutionResponse>>(
      `/workflows/${id}/execute`,
      data || {}
    );
    return response.data.data || (response.data as any);
  }

  async getExecution(id: string): Promise<ExecutionResponse> {
    const response = await this.client.get<N8nApiResponse<ExecutionResponse>>(`/executions/${id}`);
    return response.data.data || (response.data as any);
  }

  async getExecutions(workflowId?: string, limit = 20): Promise<ExecutionSummary[]> {
    const params: Record<string, any> = { limit };
    if (workflowId) params.workflowId = workflowId;

    const response = await this.client.get<N8nApiListResponse<ExecutionSummary>>('/executions', { params });
    return response.data.data || (response.data as any);
  }

  // Node types
  async getNodeTypes(): Promise<NodeType[]> {
    const response = await this.client.get<N8nApiListResponse<NodeType>>('/node-types');
    return response.data.data || (response.data as any);
  }

  // Credentials
  async getCredentials(): Promise<CredentialData[]> {
    const response = await this.client.get<N8nApiListResponse<CredentialData>>('/credentials');
    return response.data.data || (response.data as any);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await axios.get(`${this.client.defaults.baseURL}/../healthz`, {
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  // Retry helper with exponential backoff
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    backoffMs = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries - 1;
        const isRetryable = error.status === 429 || (error.status && error.status >= 500);

        if (!isRetryable || isLastAttempt) {
          throw error;
        }

        // Use Retry-After header if available for 429 errors
        const delay = error.retryAfter
          ? parseInt(error.retryAfter) * 1000
          : backoffMs * Math.pow(2, attempt);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }
}
