import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { EnhancedNodeDiscovery } from '../../discovery/EnhancedNodeDiscovery.js';
import { N8nWorkflow, N8nNode } from '../../types.js';

export class N8nModifyTool {
  constructor(
    private n8nClient: N8nApiClient,
    private nodeDiscovery: EnhancedNodeDiscovery
  ) {}

  getTool(): Tool {
    return {
      name: 'n8n_modify',
      description: 'Update and edit existing workflows, nodes, and configurations',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['workflow', 'node', 'parameters', 'position', 'name'],
            description: 'Type of modification to perform'
          },
          workflow: {
            type: 'string',
            description: 'Workflow ID or name to modify'
          },
          node: {
            type: 'string',
            description: 'Node ID or name to modify (for node modifications)'
          },
          name: {
            type: 'string',
            description: 'New name for workflow or node'
          },
          parameters: {
            type: 'object',
            description: 'New parameters for node',
            additionalProperties: true
          },
          position: {
            type: 'array',
            items: { type: 'number' },
            description: 'New position [x, y] for node'
          },
          active: {
            type: 'boolean',
            description: 'New active state for workflow'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'New tags for workflow'
          },
          merge: {
            type: 'boolean',
            description: 'Merge parameters instead of replacing',
            default: true
          }
        },
        required: ['type', 'workflow']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<any> {
    const { type, workflow, node, name, parameters, position, active, tags, merge = true } = request.params as any;

    try {
      switch (type) {
        case 'workflow':
          return await this.modifyWorkflow(workflow, { name, active, tags });

        case 'node':
          return await this.modifyNode(workflow, node, { name, parameters, position, merge });

        case 'parameters':
          return await this.modifyNodeParameters(workflow, node, parameters, merge);

        case 'position':
          return await this.modifyNodePosition(workflow, node, position);

        case 'name':
          if (node) {
            return await this.modifyNodeName(workflow, node, name);
          } else {
            return await this.modifyWorkflowName(workflow, name);
          }

        default:
          throw new Error(`Unknown modification type: ${type}`);
      }
    } catch (error: any) {
      return {
        error: true,
        message: error?.message || 'Modification failed',
        type
      };
    }
  }

  private async modifyWorkflow(workflowIdentifier: string, changes: any) {
    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    const updates: Partial<N8nWorkflow> = { ...workflow };

    if (changes.name !== undefined) {
      updates.name = changes.name;
    }
    if (changes.active !== undefined) {
      updates.active = changes.active;
    }
    if (changes.tags !== undefined) {
      updates.tags = changes.tags;
    }

    const updatedWorkflow = await this.n8nClient.updateWorkflow(workflow.id, updates);

    return {
      success: true,
      type: 'workflow',
      workflow: {
        id: updatedWorkflow.id,
        name: updatedWorkflow.name,
        active: updatedWorkflow.active,
        tags: updatedWorkflow.tags
      },
      changes: changes,
      message: `Workflow "${updatedWorkflow.name}" updated successfully`
    };
  }

  private async modifyNode(workflowIdentifier: string, nodeIdentifier: string, changes: any) {
    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    if (!workflow.nodes || workflow.nodes.length === 0) {
      throw new Error('Workflow has no nodes to modify');
    }

    const nodeIndex = workflow.nodes.findIndex(n => n.id === nodeIdentifier || n.name === nodeIdentifier);
    if (nodeIndex === -1) {
      throw new Error(`Node ${nodeIdentifier} not found in workflow`);
    }

    const node = workflow.nodes[nodeIndex]!;
    const updatedNode = { ...node };

    if (changes.name !== undefined) {
      updatedNode.name = changes.name;
    }
    if (changes.parameters !== undefined) {
      if (changes.merge && node.parameters) {
        updatedNode.parameters = { ...node.parameters, ...changes.parameters };
      } else {
        updatedNode.parameters = changes.parameters;
      }
    }
    if (changes.position !== undefined) {
      updatedNode.position = changes.position;
    }

    // Update the workflow with the modified node
    const updatedNodes = [...workflow.nodes];
    updatedNodes[nodeIndex] = updatedNode as N8nNode;

    const updatedWorkflow = await this.n8nClient.updateWorkflow(workflow.id, {
      ...workflow,
      nodes: updatedNodes
    });

    return {
      success: true,
      type: 'node',
      node: {
        id: updatedNode.id,
        name: updatedNode.name,
        type: updatedNode.type,
        position: updatedNode.position
      },
      workflow: {
        id: workflow.id,
        name: workflow.name
      },
      changes: changes,
      message: `Node "${updatedNode.name}" updated successfully`
    };
  }

  private async modifyNodeParameters(workflowIdentifier: string, nodeIdentifier: string, parameters: any, merge: boolean) {
    return await this.modifyNode(workflowIdentifier, nodeIdentifier, { parameters, merge });
  }

  private async modifyNodePosition(workflowIdentifier: string, nodeIdentifier: string, position: [number, number]) {
    if (!Array.isArray(position) || position.length !== 2) {
      throw new Error('Position must be an array of two numbers [x, y]');
    }

    return await this.modifyNode(workflowIdentifier, nodeIdentifier, { position });
  }

  private async modifyNodeName(workflowIdentifier: string, nodeIdentifier: string, name: string) {
    if (!name || typeof name !== 'string') {
      throw new Error('Name must be a non-empty string');
    }

    return await this.modifyNode(workflowIdentifier, nodeIdentifier, { name });
  }

  private async modifyWorkflowName(workflowIdentifier: string, name: string) {
    if (!name || typeof name !== 'string') {
      throw new Error('Name must be a non-empty string');
    }

    return await this.modifyWorkflow(workflowIdentifier, { name });
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