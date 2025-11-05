/**
 * Minimal n8n API client
 * Lightweight axios wrapper for n8n API calls
 */

import axios, { AxiosInstance } from 'axios';

export interface N8nClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export class N8nClient {
  private client: AxiosInstance;

  constructor(config: N8nClientConfig) {
    this.client = axios.create({
      baseURL: `${config.baseUrl}/api/v1`,
      timeout: config.timeout || 30000,
      headers: {
        'X-N8N-API-KEY': config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    // Error interceptor for common issues
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          throw new Error('Invalid n8n API key');
        }
        if (error.response?.status === 403) {
          throw new Error('n8n API access denied');
        }
        if (error.response?.status === 404) {
          throw new Error('Resource not found');
        }
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
