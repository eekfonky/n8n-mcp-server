/**
 * Mock n8n Server for Testing
 *
 * Provides a complete mock implementation of the n8n API
 * for reliable testing without requiring a live n8n instance.
 */

import { N8nWorkflow, N8nNode, N8nExecution } from '../types.js';

export interface MockWorkflow extends N8nWorkflow {
  // Add any test-specific properties
}

export interface MockExecution extends N8nExecution {
  // Add any test-specific properties
}

export class MockN8nServer {
  private workflows: Map<string, MockWorkflow> = new Map();
  private executions: Map<string, MockExecution> = new Map();
  private nextWorkflowId = 1;
  private nextExecutionId = 1;

  constructor() {
    this.initializeTestData();
  }

  /**
   * Initialize with some test data
   */
  private initializeTestData() {
    // Add a sample webhook workflow
    const sampleWorkflow: MockWorkflow = {
      id: 'test-webhook-1',
      name: 'Sample Webhook Workflow',
      active: false,
      tags: ['test', 'webhook'],
      nodes: [
        {
          id: 'webhook-node',
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 1,
          position: [150, 300],
          parameters: {
            httpMethod: 'POST',
            path: 'test-webhook'
          }
        },
        {
          id: 'set-node',
          name: 'Set Data',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [350, 300],
          parameters: {
            values: {
              string: [
                {
                  name: 'processed',
                  value: 'true'
                }
              ]
            }
          }
        }
      ],
      connections: {
        'webhook-node': {
          main: [[{
            node: 'set-node',
            type: 'main',
            index: 0
          }]]
        }
      },
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    };

    this.workflows.set(sampleWorkflow.id, sampleWorkflow);
  }

  // Workflow Operations
  async getWorkflows(): Promise<MockWorkflow[]> {
    return Array.from(this.workflows.values());
  }

  async getWorkflow(id: string): Promise<MockWorkflow> {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      throw new Error(`Workflow ${id} not found`);
    }
    return workflow;
  }

  async createWorkflow(data: Partial<N8nWorkflow>): Promise<MockWorkflow> {
    const id = `mock-workflow-${this.nextWorkflowId++}`;
    const now = new Date().toISOString();

    const workflow: MockWorkflow = {
      id,
      name: data.name || `Workflow ${id}`,
      active: data.active || false,
      tags: data.tags || [],
      nodes: data.nodes || [],
      connections: data.connections || {},
      createdAt: now,
      updatedAt: now
    };

    this.workflows.set(id, workflow);
    return workflow;
  }

  async updateWorkflow(id: string, data: Partial<N8nWorkflow>): Promise<MockWorkflow> {
    const existing = this.workflows.get(id);
    if (!existing) {
      throw new Error(`Workflow ${id} not found`);
    }

    const updated: MockWorkflow = {
      ...existing,
      ...data,
      id, // Keep original ID
      updatedAt: new Date().toISOString()
    };

    this.workflows.set(id, updated);
    return updated;
  }

  async deleteWorkflow(id: string): Promise<void> {
    if (!this.workflows.has(id)) {
      throw new Error(`Workflow ${id} not found`);
    }
    this.workflows.delete(id);
  }

  // Execution Operations
  async executeWorkflow(workflowId: string, data?: any): Promise<MockExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = `mock-execution-${this.nextExecutionId++}`;
    const now = new Date().toISOString();

    const execution: MockExecution = {
      id: executionId,
      finished: true,
      mode: 'manual',
      startedAt: now,
      stoppedAt: now,
      workflowData: workflow,
      data: {
        resultData: {
          runData: {
            // Mock successful execution data
            [workflow.nodes[0]?.id || 'node1']: [
              {
                hints: [],
                startTime: Date.now(),
                executionTime: 100,
                source: [],
                data: {
                  main: [[{
                    json: { success: true, input: data },
                    pairedItem: { item: 0 }
                  }]]
                }
              }
            ]
          }
        }
      }
    };

    this.executions.set(executionId, execution);
    return execution;
  }

  async getExecution(id: string): Promise<MockExecution> {
    const execution = this.executions.get(id);
    if (!execution) {
      throw new Error(`Execution ${id} not found`);
    }
    return execution;
  }

  async getExecutions(workflowId: string): Promise<MockExecution[]> {
    return Array.from(this.executions.values())
      .filter(exec => exec.workflowData.id === workflowId);
  }

  // Node Type Operations
  async getNodeTypes(): Promise<any[]> {
    return [
      {
        name: 'n8n-nodes-base.webhook',
        displayName: 'Webhook',
        description: 'Webhook trigger node',
        version: 1,
        group: ['trigger'],
        codex: {
          categories: ['Triggers']
        }
      },
      {
        name: 'n8n-nodes-base.set',
        displayName: 'Set',
        description: 'Set data values',
        version: 1,
        group: ['transform'],
        codex: {
          categories: ['Data Processing']
        }
      },
      {
        name: 'n8n-nodes-base.httpRequest',
        displayName: 'HTTP Request',
        description: 'Make HTTP requests',
        version: 1,
        group: ['communication'],
        codex: {
          categories: ['Communication']
        }
      },
      {
        name: 'n8n-nodes-base.manualTrigger',
        displayName: 'Manual Trigger',
        description: 'Manual trigger for workflows',
        version: 1,
        group: ['trigger'],
        codex: {
          categories: ['Triggers']
        }
      }
    ];
  }

  // Credential Operations
  async getCredentials(): Promise<any[]> {
    return [
      {
        id: 'test-cred-1',
        name: 'Test HTTP Auth',
        type: 'httpBasicAuth',
        data: { username: 'test', password: 'secret' }
      }
    ];
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    return true;
  }

  // Utility Methods for Testing
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
      tags: workflow.tags || [],
      nodes: workflow.nodes || [],
      connections: workflow.connections || {},
      createdAt: workflow.createdAt || now,
      updatedAt: workflow.updatedAt || now
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