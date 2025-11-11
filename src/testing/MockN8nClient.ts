/**
 * Mock n8n Client for Testing v2
 *
 * Simplified mock implementation for v2's minimal API surface
 */

import { N8nClient } from '../client.js';

export interface MockWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: any[];
  connections: any;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  settings?: any;
}

export interface MockExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  data?: any;
}

export class MockN8nClient extends N8nClient {
  private workflows: Map<string, MockWorkflow> = new Map();
  private executions: Map<string, MockExecution> = new Map();
  private nextWorkflowId = 1;
  private nextExecutionId = 1;

  constructor() {
    super({
      baseUrl: 'http://mock-n8n.test',
      apiKey: 'mock-api-key',
    });
    this.initializeTestData();
  }

  /**
   * Initialize with test data
   */
  private initializeTestData() {
    // Add a sample workflow
    const sampleWorkflow: MockWorkflow = {
      id: 'test-workflow-1',
      name: 'Sample Workflow',
      active: false,
      nodes: [
        {
          id: 'node-1',
          name: 'Start',
          type: 'n8n-nodes-base.manualTrigger',
          typeVersion: 1,
          position: [250, 300],
          parameters: {},
        },
      ],
      connections: {},
      tags: ['test'],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    this.workflows.set(sampleWorkflow.id, sampleWorkflow);
  }

  // Override all methods to use in-memory storage
  override async getWorkflows(): Promise<MockWorkflow[]> {
    return Array.from(this.workflows.values());
  }

  override async getWorkflow(id: string): Promise<MockWorkflow> {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      const error: any = new Error(`Workflow ${id} not found`);
      error.status = 404;
      error.code = 'N8N_NOT_FOUND';
      throw error;
    }
    return workflow;
  }

  override async createWorkflow(data: any): Promise<MockWorkflow> {
    const id = `workflow-${this.nextWorkflowId++}`;
    const now = new Date().toISOString();

    const workflow: MockWorkflow = {
      id,
      name: data.name || `Workflow ${id}`,
      active: data.active || false,
      nodes: data.nodes || [],
      connections: data.connections || {},
      tags: data.tags || [],
      settings: data.settings || {},
      createdAt: now,
      updatedAt: now,
    };

    this.workflows.set(id, workflow);
    return workflow;
  }

  override async updateWorkflow(id: string, data: any): Promise<MockWorkflow> {
    const existing = this.workflows.get(id);
    if (!existing) {
      const error: any = new Error(`Workflow ${id} not found`);
      error.status = 404;
      error.code = 'N8N_NOT_FOUND';
      throw error;
    }

    const updated: MockWorkflow = {
      ...existing,
      ...data,
      id, // Keep original ID
      updatedAt: new Date().toISOString(),
    };

    this.workflows.set(id, updated);
    return updated;
  }

  override async deleteWorkflow(id: string): Promise<{ success: boolean }> {
    if (!this.workflows.has(id)) {
      const error: any = new Error(`Workflow ${id} not found`);
      error.status = 404;
      error.code = 'N8N_NOT_FOUND';
      throw error;
    }
    this.workflows.delete(id);
    return { success: true };
  }

  override async activateWorkflow(id: string): Promise<MockWorkflow> {
    const workflow = await this.getWorkflow(id);
    return this.updateWorkflow(id, { ...workflow, active: true });
  }

  override async deactivateWorkflow(id: string): Promise<MockWorkflow> {
    const workflow = await this.getWorkflow(id);
    return this.updateWorkflow(id, { ...workflow, active: false });
  }

  override async executeWorkflow(id: string, data?: any): Promise<MockExecution> {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      const error: any = new Error(`Workflow ${id} not found`);
      error.status = 404;
      error.code = 'N8N_NOT_FOUND';
      throw error;
    }

    const executionId = `execution-${this.nextExecutionId++}`;
    const now = new Date().toISOString();

    const execution: MockExecution = {
      id: executionId,
      workflowId: id,
      finished: true,
      mode: 'manual',
      startedAt: now,
      stoppedAt: now,
      data: {
        resultData: {
          runData: {},
        },
        executionData: {
          contextData: {},
          nodeExecutionStack: [],
          waitingExecution: {},
        },
      },
    };

    this.executions.set(executionId, execution);
    return execution;
  }

  override async getExecution(id: string): Promise<MockExecution> {
    const execution = this.executions.get(id);
    if (!execution) {
      const error: any = new Error(`Execution ${id} not found`);
      error.status = 404;
      error.code = 'N8N_NOT_FOUND';
      throw error;
    }
    return execution;
  }

  override async getExecutions(workflowId?: string, limit = 20): Promise<MockExecution[]> {
    let executions = Array.from(this.executions.values());

    if (workflowId) {
      executions = executions.filter(exec => exec.workflowId === workflowId);
    }

    return executions.slice(0, limit);
  }

  override async getNodeTypes(): Promise<any[]> {
    return [
      {
        name: 'n8n-nodes-base.manualTrigger',
        displayName: 'Manual Trigger',
        description: 'Manual trigger node',
        version: 1,
      },
      {
        name: 'n8n-nodes-base.httpRequest',
        displayName: 'HTTP Request',
        description: 'Make HTTP requests',
        version: 1,
      },
      {
        name: 'n8n-nodes-base.set',
        displayName: 'Set',
        description: 'Set data values',
        version: 1,
      },
      {
        name: 'n8n-nodes-base.webhook',
        displayName: 'Webhook',
        description: 'Webhook trigger',
        version: 1,
      },
    ];
  }

  override async getCredentials(): Promise<any[]> {
    return [
      {
        id: 'cred-1',
        name: 'Test HTTP Auth',
        type: 'httpBasicAuth',
      },
      {
        id: 'cred-2',
        name: 'Test API Key',
        type: 'httpHeaderAuth',
      },
    ];
  }

  override async healthCheck(): Promise<boolean> {
    return true;
  }

  // Test utility methods
  reset(): void {
    this.workflows.clear();
    this.executions.clear();
    this.nextWorkflowId = 1;
    this.nextExecutionId = 1;
    this.initializeTestData();
  }

  addTestWorkflow(workflow: Partial<MockWorkflow>): MockWorkflow {
    const id = workflow.id || `test-workflow-${this.nextWorkflowId++}`;
    const now = new Date().toISOString();

    const testWorkflow: MockWorkflow = {
      id,
      name: workflow.name || `Test Workflow ${id}`,
      active: workflow.active || false,
      nodes: workflow.nodes || [],
      connections: workflow.connections || {},
      tags: workflow.tags || [],
      createdAt: workflow.createdAt || now,
      updatedAt: workflow.updatedAt || now,
    };

    this.workflows.set(id, testWorkflow);
    return testWorkflow;
  }

  getWorkflowCount(): number {
    return this.workflows.size;
  }

  getExecutionCount(): number {
    return this.executions.size;
  }
}
