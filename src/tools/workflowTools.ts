import { CallToolRequest, ListToolsRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../n8nClient.js';
import { NodeDiscoveryService } from '../nodeDiscovery.js';

export class WorkflowTools {
  constructor(
    private n8nClient: N8nApiClient,
    private nodeDiscovery: NodeDiscoveryService
  ) {}

  getTools(): Tool[] {
    return [
      {
        name: 'list_workflows',
        description: 'List all workflows in the n8n instance',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_workflow',
        description: 'Get detailed information about a specific workflow',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The workflow ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'execute_workflow',
        description: 'Execute a workflow manually',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The workflow ID to execute',
            },
            data: {
              type: 'object',
              description: 'Optional input data for the workflow',
              additionalProperties: true,
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_execution',
        description: 'Get details about a specific workflow execution',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The execution ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_executions',
        description: 'Get list of workflow executions',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: {
              type: 'string',
              description: 'Filter by workflow ID (optional)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of executions to return',
              default: 20,
            },
          },
        },
      },
      {
        name: 'activate_workflow',
        description: 'Activate a workflow to enable automatic execution',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The workflow ID to activate',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'deactivate_workflow',
        description: 'Deactivate a workflow to stop automatic execution',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The workflow ID to deactivate',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'create_workflow',
        description: 'Create a new workflow',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The workflow name',
            },
            nodes: {
              type: 'array',
              description: 'Array of workflow nodes',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  type: { type: 'string' },
                  position: {
                    type: 'array',
                    items: { type: 'number' },
                    minItems: 2,
                    maxItems: 2,
                  },
                  parameters: { type: 'object' },
                },
                required: ['id', 'name', 'type', 'position'],
              },
            },
            connections: {
              type: 'object',
              description: 'Node connections configuration',
            },
            tags: {
              type: 'array',
              description: 'Workflow tags',
              items: { type: 'string' },
            },
          },
          required: ['name', 'nodes'],
        },
      },
      {
        name: 'update_workflow',
        description: 'Update an existing workflow',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The workflow ID to update',
            },
            name: {
              type: 'string',
              description: 'Updated workflow name',
            },
            nodes: {
              type: 'array',
              description: 'Updated array of workflow nodes',
              items: {
                type: 'object',
              },
            },
            connections: {
              type: 'object',
              description: 'Updated node connections',
            },
            tags: {
              type: 'array',
              description: 'Updated workflow tags',
              items: { type: 'string' },
            },
            active: {
              type: 'boolean',
              description: 'Whether the workflow should be active',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_workflow',
        description: 'Delete a workflow permanently',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The workflow ID to delete',
            },
          },
          required: ['id'],
        },
      },
    ];
  }

  async handleToolCall(request: CallToolRequest): Promise<any> {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'list_workflows':
          return await this.listWorkflows();

        case 'get_workflow':
          return await this.getWorkflow(args.id);

        case 'execute_workflow':
          return await this.executeWorkflow(args.id, args.data);

        case 'get_execution':
          return await this.getExecution(args.id);

        case 'get_executions':
          return await this.getExecutions(args.workflowId, args.limit);

        case 'activate_workflow':
          return await this.activateWorkflow(args.id);

        case 'deactivate_workflow':
          return await this.deactivateWorkflow(args.id);

        case 'create_workflow':
          return await this.createWorkflow(args);

        case 'update_workflow':
          return await this.updateWorkflow(args);

        case 'delete_workflow':
          return await this.deleteWorkflow(args.id);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return {
        error: true,
        message: error.message || 'Unknown error occurred',
        tool: name,
      };
    }
  }

  private async listWorkflows() {
    const workflows = await this.n8nClient.getWorkflows();
    return {
      workflows: workflows.map(wf => ({
        id: wf.id,
        name: wf.name,
        active: wf.active,
        tags: wf.tags,
        nodeCount: wf.nodes?.length || 0,
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
      })),
      total: workflows.length,
    };
  }

  private async getWorkflow(id: string) {
    const workflow = await this.n8nClient.getWorkflow(id);
    
    // Enhance with node information
    const nodeTypes = await this.nodeDiscovery.discoverNodes();
    const enhancedNodes = workflow.nodes?.map(node => {
      const nodeType = nodeTypes.find(nt => nt.name === node.type);
      return {
        ...node,
        nodeInfo: nodeType ? {
          displayName: nodeType.displayName,
          description: nodeType.description,
          category: nodeType.category,
          isCustom: nodeType.isCustom,
        } : null,
      };
    });

    return {
      ...workflow,
      nodes: enhancedNodes,
      statistics: {
        nodeCount: workflow.nodes?.length || 0,
        connectionCount: Object.keys(workflow.connections || {}).length,
        customNodeCount: enhancedNodes?.filter(n => n.nodeInfo?.isCustom).length || 0,
      },
    };
  }

  private async executeWorkflow(id: string, data?: any) {
    const execution = await this.n8nClient.executeWorkflow(id, data);
    return {
      executionId: execution.id,
      status: execution.finished ? 'completed' : 'running',
      startedAt: execution.startedAt,
      workflowId: id,
      message: execution.finished 
        ? 'Workflow execution completed' 
        : 'Workflow execution started',
    };
  }

  private async getExecution(id: string) {
    const execution = await this.n8nClient.getExecution(id);
    return {
      id: execution.id,
      workflowId: execution.workflowData?.id,
      workflowName: execution.workflowData?.name,
      status: execution.finished ? 'completed' : 'running',
      mode: execution.mode,
      startedAt: execution.startedAt,
      stoppedAt: execution.stoppedAt,
      duration: execution.stoppedAt && execution.startedAt 
        ? new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime()
        : null,
      hasData: !!execution.data,
    };
  }

  private async getExecutions(workflowId?: string, limit = 20) {
    const executions = await this.n8nClient.getExecutions(workflowId, limit);
    return {
      executions: executions.map(exec => ({
        id: exec.id,
        workflowId: exec.workflowData?.id,
        workflowName: exec.workflowData?.name,
        status: exec.finished ? 'completed' : 'running',
        startedAt: exec.startedAt,
        stoppedAt: exec.stoppedAt,
        mode: exec.mode,
      })),
      total: executions.length,
      filtered: !!workflowId,
    };
  }

  private async activateWorkflow(id: string) {
    const workflow = await this.n8nClient.activateWorkflow(id);
    return {
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      message: 'Workflow activated successfully',
    };
  }

  private async deactivateWorkflow(id: string) {
    const workflow = await this.n8nClient.deactivateWorkflow(id);
    return {
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      message: 'Workflow deactivated successfully',
    };
  }

  private async createWorkflow(data: any) {
    const workflow = await this.n8nClient.createWorkflow({
      name: data.name,
      nodes: data.nodes,
      connections: data.connections || {},
      tags: data.tags || [],
      active: false,
    });

    return {
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      nodeCount: workflow.nodes?.length || 0,
      message: 'Workflow created successfully',
    };
  }

  private async updateWorkflow(data: any) {
    const updateData: any = {};
    
    if (data.name) updateData.name = data.name;
    if (data.nodes) updateData.nodes = data.nodes;
    if (data.connections) updateData.connections = data.connections;
    if (data.tags) updateData.tags = data.tags;
    if (typeof data.active === 'boolean') updateData.active = data.active;

    const workflow = await this.n8nClient.updateWorkflow(data.id, updateData);
    
    return {
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      nodeCount: workflow.nodes?.length || 0,
      message: 'Workflow updated successfully',
    };
  }

  private async deleteWorkflow(id: string) {
    await this.n8nClient.deleteWorkflow(id);
    return {
      id,
      message: 'Workflow deleted successfully',
    };
  }
}