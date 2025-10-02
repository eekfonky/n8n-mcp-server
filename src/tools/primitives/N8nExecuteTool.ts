import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { N8nWorkflow } from '../../types.js';
import { extractParameters } from '../../utils/parameterExtraction.js';

export class N8nExecuteTool {
  constructor(private n8nClient: N8nApiClient) {}

  getTool(): Tool {
    return {
      name: 'n8n_execute',
      description: 'Execute workflows manually or with test data',
      inputSchema: {
        type: 'object',
        properties: {
          workflow: {
            type: 'string',
            description: 'Workflow ID or name to execute'
          },
          mode: {
            type: 'string',
            enum: ['manual', 'test', 'production'],
            description: 'Execution mode',
            default: 'manual'
          },
          data: {
            type: 'object',
            description: 'Input data for the workflow execution',
            additionalProperties: true
          },
          node: {
            type: 'string',
            description: 'Specific node to start execution from (optional)'
          },
          wait: {
            type: 'boolean',
            description: 'Wait for execution to complete before returning',
            default: true
          },
          timeout: {
            type: 'number',
            description: 'Timeout in seconds for execution',
            default: 60
          }
        },
        required: ['workflow']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<any> {
    const args = extractParameters(request);
    const { workflow, mode = 'manual', data, node, wait = true, timeout = 60 } = args;

    try {
      // Get the workflow
      const workflowObj = await this.getWorkflowByIdOrName(workflow);
      if (!workflowObj) {
        throw new Error(`Workflow ${workflow} not found`);
      }

      // Validate workflow has nodes
      if (!workflowObj.nodes || workflowObj.nodes.length === 0) {
        throw new Error(`Workflow ${workflow} has no nodes to execute`);
      }

      // Check if workflow is active for production mode
      if (mode === 'production' && !workflowObj.active) {
        throw new Error(`Workflow ${workflow} must be active for production execution`);
      }

      // Execute the workflow
      const execution = await this.n8nClient.executeWorkflow(workflowObj.id, data);

      if (!wait) {
        return {
          success: true,
          execution: {
            id: execution.id,
            status: 'running',
            workflowId: workflowObj.id,
            workflowName: workflowObj.name,
            startedAt: execution.startedAt
          },
          message: `Workflow "${workflowObj.name}" execution started (ID: ${execution.id})`
        };
      }

      // Wait for execution to complete
      const result = await this.waitForExecution(execution.id, timeout);

      return {
        success: result.finished,
        execution: {
          id: execution.id,
          finished: result.finished,
          workflowId: workflowObj.id,
          workflowName: workflowObj.name,
          startedAt: result.startedAt,
          stoppedAt: result.stoppedAt,
          duration: result.stoppedAt && result.startedAt
            ? new Date(result.stoppedAt).getTime() - new Date(result.startedAt).getTime()
            : null
        },
        data: result.data,
        message: this.getExecutionMessage(result.finished, workflowObj.name)
      };

    } catch (error: any) {
      return {
        error: true,
        message: error?.message || 'Execution failed',
        workflow
      };
    }
  }

  private async getWorkflowByIdOrName(identifier: string): Promise<N8nWorkflow | null> {
    try {
      // Try as ID first
      return await this.n8nClient.getWorkflow(identifier);
    } catch {
      // Try finding by name
      const workflows = await this.n8nClient.getWorkflows();
      const found = workflows.find(wf => wf.name === identifier);
      if (found) {
        return await this.n8nClient.getWorkflow(found.id);
      }
      return null;
    }
  }

  private async waitForExecution(executionId: string, timeoutSeconds: number) {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;
    let backoffMs = 100; // Start with 100ms
    const maxBackoffMs = 5000; // Max 5 seconds between polls

    while (Date.now() - startTime < timeoutMs) {
      try {
        const execution = await this.n8nClient.getExecution(executionId);

        if (execution.finished || execution.stoppedAt) {
          return execution;
        }

        // Exponential backoff with jitter for efficiency
        const jitter = Math.random() * 0.1 * backoffMs; // Add up to 10% jitter
        await new Promise(resolve => setTimeout(resolve, backoffMs + jitter));

        // Increase backoff for next iteration, cap at maxBackoffMs
        backoffMs = Math.min(backoffMs * 1.5, maxBackoffMs);
      } catch (error) {
        // If we can't get execution status, use current backoff
        const jitter = Math.random() * 0.1 * backoffMs;
        await new Promise(resolve => setTimeout(resolve, backoffMs + jitter));

        // Don't increase backoff on errors to retry more frequently
      }
    }

    // Timeout reached
    throw new Error(`Execution timeout after ${timeoutSeconds} seconds`);
  }

  private getExecutionMessage(finished: boolean, workflowName: string): string {
    if (finished) {
      return `Workflow "${workflowName}" execution completed`;
    } else {
      return `Workflow "${workflowName}" is still running`;
    }
  }
}