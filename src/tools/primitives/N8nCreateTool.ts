import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { EnhancedNodeDiscovery } from '../../discovery/EnhancedNodeDiscovery.js';
import { N8nWorkflow, N8nNode } from '../../types.js';

export class N8nCreateTool {
  constructor(
    private n8nClient: N8nApiClient,
    private nodeDiscovery: EnhancedNodeDiscovery
  ) {}

  getTool(): Tool {
    return {
      name: 'n8n_create',
      description: 'Create workflows, nodes, and connections iteratively',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['workflow', 'node', 'trigger', 'template'],
            description: 'Type of entity to create'
          },
          workflow: {
            type: 'string',
            description: 'Workflow ID or name (for adding nodes to existing workflow)'
          },
          name: {
            type: 'string',
            description: 'Name for the new entity'
          },
          nodeType: {
            type: 'string',
            description: 'Type of node to create (e.g., n8n-nodes-base.httpRequest)'
          },
          position: {
            type: 'array',
            items: { type: 'number' },
            description: 'Node position [x, y]',
            default: [250, 300]
          },
          parameters: {
            type: 'object',
            description: 'Node parameters configuration',
            additionalProperties: true
          },
          credentials: {
            type: 'object',
            description: 'Credentials configuration for the node',
            additionalProperties: true
          },
          after: {
            type: 'string',
            description: 'Node ID to place this node after (for automatic connection)'
          },
          template: {
            type: 'string',
            description: 'Template type to generate (basic, webhook, scheduler, etc.)'
          }
        },
        required: ['type']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<any> {
    const { type, ...params } = request.params as any;

    try {
      switch (type) {
        case 'workflow':
          return await this.createWorkflow(params);

        case 'node':
          return await this.createNode(params);

        case 'trigger':
          return await this.createTrigger(params);

        case 'template':
          return await this.createFromTemplate(params.name, params.template);

        default:
          throw new Error(`Unknown creation type: ${type}`);
      }
    } catch (error: any) {
      return {
        error: true,
        message: error?.message || 'Creation failed',
        type
      };
    }
  }

  private async createWorkflow(params: any) {
    const { name, nodeType, parameters = {}, template } = params;

    if (template) {
      return await this.createFromTemplate(name, template);
    }

    // Create a basic workflow with optional initial node
    const workflowData: any = {
      name: name || `New Workflow ${Date.now()}`,
      nodes: [],
      connections: {},
      settings: {}
    };

    // Add initial node if specified
    if (nodeType) {
      const nodeInfo = await this.getNodeInfo(nodeType);
      if (!nodeInfo) {
        throw new Error(`Node type ${nodeType} not found`);
      }

      const node: N8nNode = {
        id: 'start-node',
        name: nodeInfo.displayName,
        type: nodeType,
        typeVersion: nodeInfo.typeVersion || 1,
        position: [250, 300],
        parameters: parameters
      };

      workflowData.nodes = [node];
    }

    const workflow = await this.n8nClient.createWorkflow(workflowData);

    return {
      type: 'workflow',
      success: true,
      workflow: {
        id: workflow.id,
        name: workflow.name,
        nodeCount: workflow.nodes?.length || 0,
        active: workflow.active
      },
      message: `Workflow "${workflow.name}" created successfully`
    };
  }

  private async createNode(params: any) {
    const { workflow, nodeType, name, position = [250, 300], parameters = {}, credentials, after } = params;

    if (!workflow || !nodeType) {
      throw new Error('Workflow and nodeType are required for node creation');
    }

    // Get the workflow
    const workflowObj = await this.getWorkflowByIdOrName(workflow);
    if (!workflowObj) {
      throw new Error(`Workflow ${workflow} not found`);
    }

    // Get node information
    const nodeInfo = await this.getNodeInfo(nodeType);
    if (!nodeInfo) {
      throw new Error(`Node type ${nodeType} not found`);
    }

    // Generate unique node ID
    const nodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate position (offset if placing after another node)
    let nodePosition = position;
    if (after && workflowObj.nodes) {
      const afterNode = workflowObj.nodes.find(n => n.id === after || n.name === after);
      if (afterNode) {
        nodePosition = [afterNode.position[0] + 200, afterNode.position[1]];
      }
    }

    // Create the new node
    const newNode: N8nNode = {
      id: nodeId,
      name: name || nodeInfo.displayName,
      type: nodeType,
      typeVersion: nodeInfo.typeVersion || 1,
      position: nodePosition,
      parameters: parameters
    };

    if (credentials) {
      newNode.credentials = credentials;
    }

    // Add node to workflow
    const updatedNodes = [...(workflowObj.nodes || []), newNode];

    // Auto-connect if 'after' is specified
    let updatedConnections = workflowObj.connections || {};
    if (after && workflowObj.nodes) {
      const afterNode = workflowObj.nodes.find(n => n.id === after || n.name === after);
      if (afterNode) {
        updatedConnections = {
          ...updatedConnections,
          [afterNode.id]: {
            main: [[{ node: nodeId, type: 'main', index: 0 }]]
          }
        };
      }
    }

    // Update workflow
    const updatedWorkflow = await this.n8nClient.updateWorkflow(workflowObj.id, {
      ...workflowObj,
      nodes: updatedNodes,
      connections: updatedConnections
    });

    return {
      type: 'node',
      success: true,
      node: {
        id: nodeId,
        name: newNode.name,
        type: nodeType,
        position: nodePosition
      },
      workflow: {
        id: workflowObj.id,
        name: workflowObj.name,
        nodeCount: updatedNodes.length
      },
      autoConnected: !!after,
      message: `Node "${newNode.name}" added to workflow "${workflowObj.name}"`
    };
  }

  private async createTrigger(params: any) {
    const { workflow, nodeType = 'n8n-nodes-base.manualTrigger', name, parameters = {} } = params;

    // Determine appropriate trigger type if not specified
    let triggerType = nodeType;
    if (!triggerType.includes('trigger') && !triggerType.includes('webhook')) {
      triggerType = 'n8n-nodes-base.manualTrigger'; // Default safe trigger
    }

    return await this.createNode({
      workflow,
      nodeType: triggerType,
      name: name || 'Trigger',
      position: [150, 300], // Triggers typically go on the left
      parameters
    });
  }

  private async createFromTemplate(name: string, template: string) {
    const templates: Record<string, any> = {
      basic: {
        name: name || 'Basic Workflow',
        nodes: [
          {
            id: 'manual-trigger',
            name: 'Manual Trigger',
            type: 'n8n-nodes-base.manualTrigger',
            typeVersion: 1,
            position: [150, 300],
            parameters: {}
          }
        ],
        connections: {},
        settings: {}
      },
      webhook: {
        name: name || 'Webhook Workflow',
        nodes: [
          {
            id: 'webhook',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            typeVersion: 1,
            position: [150, 300],
            parameters: {
              httpMethod: 'POST',
              path: 'webhook'
            }
          }
        ],
        connections: {},
        settings: {}
      },
      scheduler: {
        name: name || 'Scheduled Workflow',
        nodes: [
          {
            id: 'cron',
            name: 'Cron',
            type: 'n8n-nodes-base.cron',
            typeVersion: 1,
            position: [150, 300],
            parameters: {
              triggerTimes: {
                item: [
                  {
                    mode: 'everyMinute'
                  }
                ]
              }
            }
          }
        ],
        connections: {},
        settings: {}
      }
    };

    const templateData = templates[template];
    if (!templateData) {
      throw new Error(`Unknown template: ${template}. Available: ${Object.keys(templates).join(', ')}`);
    }

    const workflow = await this.n8nClient.createWorkflow(templateData);

    return {
      type: 'template',
      success: true,
      template,
      workflow: {
        id: workflow.id,
        name: workflow.name,
        nodeCount: workflow.nodes?.length || 0,
        active: workflow.active
      },
      message: `Workflow "${workflow.name}" created from ${template} template`
    };
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

  private async getNodeInfo(nodeType: string) {
    const nodeDetails = this.nodeDiscovery.getNodeDetails(nodeType);
    if (nodeDetails) {
      return nodeDetails;
    }

    // If not found in discovery, try to get basic info
    return {
      type: nodeType,
      displayName: nodeType.split('.').pop() || nodeType,
      typeVersion: 1,
      description: `${nodeType} node`,
      category: 'Other'
    };
  }
}