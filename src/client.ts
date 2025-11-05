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
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

export interface N8nClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export class N8nClient {
  private client: AxiosInstance;

  constructor(config: N8nClientConfig) {
    // n8n API best practice: Use /api/v1 endpoint with API key authentication
    this.client = axios.create({
      baseURL: `${config.baseUrl}/api/v1`,
      timeout: config.timeout || 30000,
      headers: {
        // n8n API authentication standard
        'X-N8N-API-KEY': config.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Error interceptor following n8n API best practices
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Extract meaningful error information
        const status = error.response?.status;
        const errorData = error.response?.data as any;
        const errorMessage = errorData?.message || error.message;

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
  async getWorkflows() {
    const response = await this.client.get('/workflows');
    return response.data.data || response.data;
  }

  async getWorkflow(id: string) {
    const response = await this.client.get(`/workflows/${id}`);
    return response.data.data || response.data;
  }

  async createWorkflow(workflow: any) {
    const response = await this.client.post('/workflows', workflow);
    return response.data.data || response.data;
  }

  async updateWorkflow(id: string, workflow: any) {
    const response = await this.client.patch(`/workflows/${id}`, workflow);
    return response.data.data || response.data;
  }

  async deleteWorkflow(id: string) {
    await this.client.delete(`/workflows/${id}`);
    return { success: true };
  }

  async activateWorkflow(id: string) {
    const response = await this.client.patch(`/workflows/${id}`, { active: true });
    return response.data.data || response.data;
  }

  async deactivateWorkflow(id: string) {
    const response = await this.client.patch(`/workflows/${id}`, { active: false });
    return response.data.data || response.data;
  }

  // Executions
  async executeWorkflow(id: string, data?: any) {
    const response = await this.client.post(`/workflows/${id}/execute`, data || {});
    return response.data.data || response.data;
  }

  async getExecution(id: string) {
    const response = await this.client.get(`/executions/${id}`);
    return response.data.data || response.data;
  }

  async getExecutions(workflowId?: string, limit = 20) {
    const params: any = { limit };
    if (workflowId) params.workflowId = workflowId;

    const response = await this.client.get('/executions', { params });
    return response.data.data || response.data;
  }

  // Node types
  async getNodeTypes() {
    const response = await this.client.get('/node-types');
    return response.data.data || response.data;
  }

  // Credentials
  async getCredentials() {
    const response = await this.client.get('/credentials');
    return response.data.data || response.data;
  }

  // Health check
  async healthCheck() {
    try {
      await axios.get(`${this.client.defaults.baseURL}/../healthz`, {
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }
}
