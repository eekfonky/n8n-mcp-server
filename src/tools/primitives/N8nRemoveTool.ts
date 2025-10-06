import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { N8nWorkflow } from '../../types.js';
import { extractParameters } from '../../utils/parameterExtraction.js';

export class N8nRemoveTool {
  constructor(private n8nClient: N8nApiClient) {}

  getTool(): Tool {
    return {
      name: 'n8n_remove',
      description: 'Remove workflows, nodes, connections, and other n8n entities',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['workflow', 'node', 'connection', 'all_workflows'],
            description: 'Type of entity to remove'
          },
          workflow: {
            type: 'string',
            description: 'Workflow ID or name'
          },
          node: {
            type: 'string',
            description: 'Node ID or name to remove from workflow'
          },
          from: {
            type: 'string',
            description: 'Source node for connection removal'
          },
          to: {
            type: 'string',
            description: 'Target node for connection removal'
          },
          confirm: {
            type: 'boolean',
            description: 'Confirmation for destructive operations',
            default: false
          },
          force: {
            type: 'boolean',
            description: 'Force removal even if workflow is active',
            default: false
          }
        },
        required: ['type']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<any> {
    const args = extractParameters(request);
    const { type, workflow, node, from, to, confirm = false, force = false } = args;

    try {
      switch (type) {
        case 'workflow':
          return await this.removeWorkflow(workflow, confirm, force);

        case 'node':
          return await this.removeNode(workflow, node, confirm);

        case 'connection':
          return await this.removeConnection(workflow, from, to, confirm);

        case 'all_workflows':
          return await this.removeAllWorkflows(confirm);

        default:
          throw new Error(`Unknown removal type: ${type}`);
      }
    } catch (error: any) {
      return {
        error: true,
        message: error?.message || 'Removal failed',
        type
      };
    }
  }

  private async removeWorkflow(identifier: string, confirm: boolean, force: boolean) {
    if (!identifier) {
      throw new Error('Workflow ID or name is required');
    }

    if (!confirm) {
      return {
        warning: true,
        message: 'This will permanently delete the workflow. Add "confirm": true to proceed.',
        workflow: identifier
      };
    }

    const workflow = await this.getWorkflowByIdOrName(identifier);
    if (!workflow) {
      throw new Error(`Workflow ${identifier} not found`);
    }

    // Check if workflow is active
    if (workflow.active && !force) {
      return {
        error: true,
        message: 'Cannot delete active workflow. Deactivate first or use "force": true',
        workflow: {
          id: workflow.id,
          name: workflow.name,
          active: workflow.active
        }
      };
    }

    // Deactivate first if it's active and force is true
    if (workflow.active && force) {
      await this.n8nClient.updateWorkflow(workflow.id, {
        ...workflow,
        active: false
      });
    }

    await this.n8nClient.deleteWorkflow(workflow.id);

    return {
      success: true,
      type: 'workflow',
      removed: {
        id: workflow.id,
        name: workflow.name,
        nodeCount: workflow.nodes?.length || 0
      },
      message: `Workflow "${workflow.name}" deleted successfully`
    };
  }

  private async removeNode(workflowIdentifier: string, nodeIdentifier: string, confirm: boolean) {
    if (!workflowIdentifier || !nodeIdentifier) {
      throw new Error('Workflow and node identifiers are required');
    }

    if (!confirm) {
      return {
        warning: true,
        message: 'This will permanently remove the node from the workflow. Add "confirm": true to proceed.',
        workflow: workflowIdentifier,
        node: nodeIdentifier
      };
    }

    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    if (!workflow.nodes || workflow.nodes.length === 0) {
      throw new Error('Workflow has no nodes to remove');
    }

    // Find the node to remove
    const nodeToRemove = workflow.nodes.find(n => n.id === nodeIdentifier || n.name === nodeIdentifier);
    if (!nodeToRemove) {
      throw new Error(`Node ${nodeIdentifier} not found in workflow`);
    }

    // Remove the node
    const updatedNodes = workflow.nodes.filter(n => n.id !== nodeToRemove.id);

    // Remove connections involving this node
    const updatedConnections: Record<string, any> = {};
    for (const [nodeId, connections] of Object.entries(workflow.connections || {})) {
      if (nodeId === nodeToRemove.id) {
        // Skip connections from the removed node
        continue;
      }

      // Filter out connections to the removed node
      const filteredConnections: any = {};
      for (const [outputType, outputs] of Object.entries(connections as any)) {
        const filteredOutputs = (outputs as any[]).map((outputArray: any[]) =>
          outputArray.filter((connection: any) => connection.node !== nodeToRemove.id)
        ).filter(outputArray => outputArray.length > 0);

        if (filteredOutputs.length > 0) {
          filteredConnections[outputType] = filteredOutputs;
        }
      }

      if (Object.keys(filteredConnections).length > 0) {
        updatedConnections[nodeId] = filteredConnections;
      }
    }

    // Update the workflow
    const updatedWorkflow = await this.n8nClient.updateWorkflow(workflow.id, {
      ...workflow,
      nodes: updatedNodes,
      connections: updatedConnections
    });

    return {
      success: true,
      type: 'node',
      removed: {
        id: nodeToRemove.id,
        name: nodeToRemove.name,
        type: nodeToRemove.type
      },
      workflow: {
        id: workflow.id,
        name: workflow.name,
        nodeCount: updatedNodes.length
      },
      message: `Node "${nodeToRemove.name}" removed from workflow "${workflow.name}"`
    };
  }

  private async removeConnection(workflowIdentifier: string, fromNode: string, toNode: string, confirm: boolean) {
    if (!workflowIdentifier || !fromNode || !toNode) {
      throw new Error('Workflow, from node, and to node are required');
    }

    if (!confirm) {
      return {
        warning: true,
        message: 'This will remove the connection between nodes. Add "confirm": true to proceed.',
        workflow: workflowIdentifier,
        from: fromNode,
        to: toNode
      };
    }

    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    // Find the nodes
    const fromNodeObj = workflow.nodes?.find(n => n.id === fromNode || n.name === fromNode);
    const toNodeObj = workflow.nodes?.find(n => n.id === toNode || n.name === toNode);

    if (!fromNodeObj) {
      throw new Error(`From node ${fromNode} not found`);
    }
    if (!toNodeObj) {
      throw new Error(`To node ${toNode} not found`);
    }

    // Remove the connection
    const updatedConnections = { ...workflow.connections } as Record<string, Record<string, unknown[]>>;
    let connectionRemoved = false;

    const fromConnections = updatedConnections[fromNodeObj.id];
    if (fromConnections) {
      for (const [outputType, outputs] of Object.entries(fromConnections)) {
        const filteredOutputs = (outputs as unknown[][]).map((outputArray: unknown[]) =>
          outputArray.filter((connection: unknown) => {
            const conn = connection as { node?: string };
            return conn.node !== toNodeObj.id;
          })
        );

        // Check if any connections were removed
        const originalLength = (outputs as unknown[][]).reduce((sum, arr) => sum + arr.length, 0);
        const newLength = filteredOutputs.reduce((sum, arr) => sum + arr.length, 0);
        if (originalLength > newLength) {
          connectionRemoved = true;
        }

        // Only keep non-empty output arrays
        const nonEmptyOutputs = filteredOutputs.filter(outputArray => outputArray.length > 0);

        if (nonEmptyOutputs.length > 0) {
          fromConnections[outputType] = nonEmptyOutputs;
        } else {
          delete fromConnections[outputType];
        }
      }

      // Remove the node entry if no connections remain
      if (Object.keys(fromConnections).length === 0) {
        delete updatedConnections[fromNodeObj.id];
      }
    }

    if (!connectionRemoved) {
      throw new Error(`No connection found between ${fromNode} and ${toNode}`);
    }

    // Update the workflow
    await this.n8nClient.updateWorkflow(workflow.id, {
      ...workflow,
      connections: updatedConnections
    });

    return {
      success: true,
      type: 'connection',
      removed: {
        from: fromNodeObj.name,
        to: toNodeObj.name
      },
      workflow: {
        id: workflow.id,
        name: workflow.name
      },
      message: `Connection removed between "${fromNodeObj.name}" and "${toNodeObj.name}"`
    };
  }

  private async removeAllWorkflows(confirm: boolean) {
    if (!confirm) {
      return {
        warning: true,
        message: 'This will permanently delete ALL workflows. Add "confirm": true to proceed.',
        destructive: true
      };
    }

    const workflows = await this.n8nClient.getWorkflows();

    if (workflows.length === 0) {
      return {
        success: true,
        message: 'No workflows to remove',
        removed: []
      };
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const workflow of workflows) {
      try {
        // Deactivate if active
        if (workflow.active) {
          await this.n8nClient.updateWorkflow(workflow.id, {
            ...workflow,
            active: false
          });
        }

        await this.n8nClient.deleteWorkflow(workflow.id);
        results.push({
          id: workflow.id,
          name: workflow.name,
          status: 'deleted'
        });
        successCount++;
      } catch (error: any) {
        results.push({
          id: workflow.id,
          name: workflow.name,
          status: 'failed',
          error: error.message
        });
        failureCount++;
      }
    }

    return {
      success: failureCount === 0,
      type: 'all_workflows',
      summary: {
        total: workflows.length,
        deleted: successCount,
        failed: failureCount
      },
      results,
      message: `Deleted ${successCount} of ${workflows.length} workflows`
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
}