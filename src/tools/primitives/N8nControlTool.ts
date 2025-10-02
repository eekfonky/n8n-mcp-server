import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { N8nWorkflow } from '../../types.js';

export class N8nControlTool {
  constructor(private n8nClient: N8nApiClient) {}

  getTool(): Tool {
    return {
      name: 'n8n_control',
      description: 'Control workflow states - activate, deactivate, and manage lifecycle',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['activate', 'deactivate', 'toggle', 'status', 'batch'],
            description: 'Control action to perform'
          },
          workflow: {
            type: 'string',
            description: 'Workflow ID or name (not required for batch operations)'
          },
          workflows: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of workflow IDs or names for batch operations'
          },
          force: {
            type: 'boolean',
            description: 'Force action even if workflow has issues',
            default: false
          },
          validateFirst: {
            type: 'boolean',
            description: 'Validate workflow before activation',
            default: true
          }
        },
        required: ['action']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<any> {
    const { action, workflow, workflows, force = false, validateFirst = true } = request.params as any;

    try {
      switch (action) {
        case 'activate':
          return await this.activateWorkflow(workflow, force, validateFirst);

        case 'deactivate':
          return await this.deactivateWorkflow(workflow);

        case 'toggle':
          return await this.toggleWorkflow(workflow, force, validateFirst);

        case 'status':
          return await this.getWorkflowStatus(workflow);

        case 'batch':
          return await this.batchControl(workflows, force, validateFirst);

        default:
          throw new Error(`Unknown control action: ${action}`);
      }
    } catch (error: any) {
      return {
        error: true,
        message: error?.message || 'Control operation failed',
        action
      };
    }
  }

  private async activateWorkflow(workflowIdentifier: string, force: boolean, validateFirst: boolean) {
    if (!workflowIdentifier) {
      throw new Error('Workflow identifier is required');
    }

    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    if (workflow.active) {
      return {
        success: true,
        alreadyActive: true,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          active: workflow.active
        },
        message: `Workflow "${workflow.name}" is already active`
      };
    }

    // Validate workflow before activation
    if (validateFirst && !force) {
      const validation = await this.validateWorkflowForActivation(workflow);
      if (!validation.valid) {
        return {
          success: false,
          validation,
          workflow: {
            id: workflow.id,
            name: workflow.name,
            active: workflow.active
          },
          message: `Cannot activate workflow: ${validation.errors.join(', ')}`
        };
      }
    }

    // Activate the workflow
    const updatedWorkflow = await this.n8nClient.updateWorkflow(workflow.id, {
      ...workflow,
      active: true
    });

    return {
      success: true,
      action: 'activate',
      workflow: {
        id: updatedWorkflow.id,
        name: updatedWorkflow.name,
        active: updatedWorkflow.active,
        nodeCount: updatedWorkflow.nodes?.length || 0
      },
      message: `Workflow "${updatedWorkflow.name}" activated successfully`
    };
  }

  private async deactivateWorkflow(workflowIdentifier: string) {
    if (!workflowIdentifier) {
      throw new Error('Workflow identifier is required');
    }

    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    if (!workflow.active) {
      return {
        success: true,
        alreadyInactive: true,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          active: workflow.active
        },
        message: `Workflow "${workflow.name}" is already inactive`
      };
    }

    // Deactivate the workflow
    const updatedWorkflow = await this.n8nClient.updateWorkflow(workflow.id, {
      ...workflow,
      active: false
    });

    return {
      success: true,
      action: 'deactivate',
      workflow: {
        id: updatedWorkflow.id,
        name: updatedWorkflow.name,
        active: updatedWorkflow.active,
        nodeCount: updatedWorkflow.nodes?.length || 0
      },
      message: `Workflow "${updatedWorkflow.name}" deactivated successfully`
    };
  }

  private async toggleWorkflow(workflowIdentifier: string, force: boolean, validateFirst: boolean) {
    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    if (workflow.active) {
      return await this.deactivateWorkflow(workflowIdentifier);
    } else {
      return await this.activateWorkflow(workflowIdentifier, force, validateFirst);
    }
  }

  private async getWorkflowStatus(workflowIdentifier: string) {
    if (!workflowIdentifier) {
      // Return status for all workflows
      const workflows = await this.n8nClient.getWorkflows();
      const activeCount = workflows.filter(wf => wf.active).length;
      const inactiveCount = workflows.length - activeCount;

      return {
        success: true,
        action: 'status',
        summary: {
          total: workflows.length,
          active: activeCount,
          inactive: inactiveCount
        },
        workflows: workflows.map(wf => ({
          id: wf.id,
          name: wf.name,
          active: wf.active,
          nodeCount: wf.nodes?.length || 0
        }))
      };
    }

    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    // Get recent executions for status info
    let recentExecutions: any[] = [];
    try {
      const executions = await this.n8nClient.getExecutions(workflow.id);
      recentExecutions = executions.slice(0, 5).map(exec => ({
        id: exec.id,
        finished: exec.finished,
        startedAt: exec.startedAt,
        mode: exec.mode
      }));
    } catch {
      // Executions may not be available
    }

    return {
      success: true,
      action: 'status',
      workflow: {
        id: workflow.id,
        name: workflow.name,
        active: workflow.active,
        nodeCount: workflow.nodes?.length || 0,
        connectionCount: workflow.connections ? Object.keys(workflow.connections).length : 0,
        tags: workflow.tags || []
      },
      recentExecutions,
      validation: await this.validateWorkflowForActivation(workflow)
    };
  }

  private async batchControl(workflowIdentifiers: string[], force: boolean, validateFirst: boolean) {
    if (!workflowIdentifiers || workflowIdentifiers.length === 0) {
      throw new Error('Workflow identifiers array is required for batch operations');
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const identifier of workflowIdentifiers) {
      try {
        const workflow = await this.getWorkflowByIdOrName(identifier);
        if (!workflow) {
          results.push({
            identifier,
            success: false,
            error: 'Workflow not found'
          });
          errorCount++;
          continue;
        }

        // Toggle each workflow
        const result = await this.toggleWorkflow(identifier, force, validateFirst);
        results.push({
          identifier,
          workflowName: workflow.name,
          success: result.success,
          action: result.action || ((result as any).alreadyActive ? 'already-active' : (result as any).alreadyInactive ? 'already-inactive' : 'unknown'),
          active: result.workflow.active
        });

        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error: any) {
        results.push({
          identifier,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }

    return {
      success: errorCount === 0,
      action: 'batch',
      summary: {
        total: workflowIdentifiers.length,
        successful: successCount,
        failed: errorCount
      },
      results,
      message: `Batch operation completed: ${successCount} successful, ${errorCount} failed`
    };
  }

  private async validateWorkflowForActivation(workflow: N8nWorkflow) {
    const validation = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };

    // Check if workflow has nodes
    if (!workflow.nodes || workflow.nodes.length === 0) {
      validation.valid = false;
      validation.errors.push('Workflow has no nodes');
      return validation;
    }

    // Check for trigger nodes
    const triggerNodes = workflow.nodes.filter(node =>
      node.type.includes('trigger') ||
      node.type.includes('webhook') ||
      node.type.includes('cron') ||
      node.type === 'n8n-nodes-base.manualTrigger'
    );

    if (triggerNodes.length === 0) {
      validation.warnings.push('No trigger nodes found - workflow may not execute automatically');
    }

    // Check for disconnected nodes
    const connectionMap = new Set();
    for (const [fromNode, outputs] of Object.entries(workflow.connections || {})) {
      connectionMap.add(fromNode);
      for (const outputArrays of Object.values(outputs as any)) {
        for (const outputArray of outputArrays as any[]) {
          for (const connection of outputArray) {
            connectionMap.add(connection.node);
          }
        }
      }
    }

    const disconnectedNodes = workflow.nodes.filter(node =>
      !connectionMap.has(node.id) && !triggerNodes.some(t => t.id === node.id)
    );

    if (disconnectedNodes.length > 0) {
      validation.warnings.push(`${disconnectedNodes.length} disconnected nodes found`);
    }

    return validation;
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
}