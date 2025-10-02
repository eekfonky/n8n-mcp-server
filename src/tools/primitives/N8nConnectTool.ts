import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { N8nWorkflow } from '../../types.js';

export class N8nConnectTool {
  constructor(private n8nClient: N8nApiClient) {}

  getTool(): Tool {
    return {
      name: 'n8n_connect',
      description: 'Manage connections between nodes in workflows',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['add', 'remove', 'replace', 'list'],
            description: 'Connection action to perform'
          },
          workflow: {
            type: 'string',
            description: 'Workflow ID or name'
          },
          from: {
            type: 'string',
            description: 'Source node ID or name'
          },
          to: {
            type: 'string',
            description: 'Target node ID or name'
          },
          fromOutput: {
            type: 'string',
            description: 'Output type from source node',
            default: 'main'
          },
          fromIndex: {
            type: 'number',
            description: 'Output index from source node',
            default: 0
          },
          toInput: {
            type: 'string',
            description: 'Input type to target node',
            default: 'main'
          },
          toIndex: {
            type: 'number',
            description: 'Input index to target node',
            default: 0
          },
          connections: {
            type: 'array',
            description: 'Array of connections for batch operations',
            items: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                fromOutput: { type: 'string', default: 'main' },
                fromIndex: { type: 'number', default: 0 },
                toInput: { type: 'string', default: 'main' },
                toIndex: { type: 'number', default: 0 }
              },
              required: ['from', 'to']
            }
          }
        },
        required: ['action', 'workflow']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<any> {
    const { action, workflow, from, to, fromOutput = 'main', fromIndex = 0, toInput = 'main', toIndex = 0, connections } = request.params as any;

    try {
      switch (action) {
        case 'add':
          return await this.addConnection(workflow, from, to, fromOutput, fromIndex, toInput, toIndex);

        case 'remove':
          return await this.removeConnection(workflow, from, to, fromOutput, fromIndex, toInput, toIndex);

        case 'replace':
          return await this.replaceConnections(workflow, connections || []);

        case 'list':
          return await this.listConnections(workflow);

        default:
          throw new Error(`Unknown connection action: ${action}`);
      }
    } catch (error: any) {
      return {
        error: true,
        message: error?.message || 'Connection operation failed',
        action
      };
    }
  }

  private async addConnection(
    workflowIdentifier: string,
    fromNode: string,
    toNode: string,
    fromOutput: string,
    fromIndex: number,
    toInput: string,
    toIndex: number
  ) {
    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    // Find the nodes
    const fromNodeObj = workflow.nodes?.find(n => n.id === fromNode || n.name === fromNode);
    const toNodeObj = workflow.nodes?.find(n => n.id === toNode || n.name === toNode);

    if (!fromNodeObj) {
      throw new Error(`Source node ${fromNode} not found`);
    }
    if (!toNodeObj) {
      throw new Error(`Target node ${toNode} not found`);
    }

    // Create the connection
    const updatedConnections = { ...workflow.connections };

    if (!updatedConnections[fromNodeObj.id]) {
      updatedConnections[fromNodeObj.id] = {};
    }
    if (!updatedConnections[fromNodeObj.id][fromOutput]) {
      updatedConnections[fromNodeObj.id][fromOutput] = [];
    }

    // Ensure the output array exists at the specified index
    while (updatedConnections[fromNodeObj.id][fromOutput].length <= fromIndex) {
      updatedConnections[fromNodeObj.id][fromOutput].push([]);
    }

    // Add the connection
    const connection = {
      node: toNodeObj.id,
      type: toInput,
      index: toIndex
    };

    // Check if connection already exists
    const existingConnections = updatedConnections[fromNodeObj.id][fromOutput][fromIndex];
    const connectionExists = existingConnections.some(
      (conn: any) => conn.node === connection.node && conn.type === connection.type && conn.index === connection.index
    );

    if (connectionExists) {
      return {
        success: false,
        message: `Connection already exists between ${fromNodeObj.name} and ${toNodeObj.name}`,
        connection: {
          from: fromNodeObj.name,
          to: toNodeObj.name,
          output: fromOutput,
          input: toInput
        }
      };
    }

    updatedConnections[fromNodeObj.id][fromOutput][fromIndex].push(connection);

    // Update the workflow
    await this.n8nClient.updateWorkflow(workflow.id, {
      ...workflow,
      connections: updatedConnections
    });

    return {
      success: true,
      action: 'add',
      connection: {
        from: fromNodeObj.name,
        to: toNodeObj.name,
        output: fromOutput,
        input: toInput
      },
      workflow: {
        id: workflow.id,
        name: workflow.name
      },
      message: `Connection added from "${fromNodeObj.name}" to "${toNodeObj.name}"`
    };
  }

  private async removeConnection(
    workflowIdentifier: string,
    fromNode: string,
    toNode: string,
    fromOutput: string,
    fromIndex: number,
    toInput: string,
    toIndex: number
  ) {
    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    // Find the nodes
    const fromNodeObj = workflow.nodes?.find(n => n.id === fromNode || n.name === fromNode);
    const toNodeObj = workflow.nodes?.find(n => n.id === toNode || n.name === toNode);

    if (!fromNodeObj) {
      throw new Error(`Source node ${fromNode} not found`);
    }
    if (!toNodeObj) {
      throw new Error(`Target node ${toNode} not found`);
    }

    // Remove the connection
    const updatedConnections = { ...workflow.connections };
    let connectionRemoved = false;

    if (updatedConnections[fromNodeObj.id] && updatedConnections[fromNodeObj.id][fromOutput]) {
      const outputConnections = updatedConnections[fromNodeObj.id][fromOutput];

      if (outputConnections[fromIndex]) {
        const filteredConnections = outputConnections[fromIndex].filter((conn: any) =>
          !(conn.node === toNodeObj.id && conn.type === toInput && conn.index === toIndex)
        );

        if (filteredConnections.length < outputConnections[fromIndex].length) {
          connectionRemoved = true;
          outputConnections[fromIndex] = filteredConnections;

          // Clean up empty arrays and objects
          if (filteredConnections.length === 0) {
            outputConnections.splice(fromIndex, 1);
          }
          if (outputConnections.length === 0) {
            delete updatedConnections[fromNodeObj.id][fromOutput];
          }
          if (Object.keys(updatedConnections[fromNodeObj.id]).length === 0) {
            delete updatedConnections[fromNodeObj.id];
          }
        }
      }
    }

    if (!connectionRemoved) {
      return {
        success: false,
        message: `No connection found between ${fromNodeObj.name} and ${toNodeObj.name}`,
        connection: {
          from: fromNodeObj.name,
          to: toNodeObj.name,
          output: fromOutput,
          input: toInput
        }
      };
    }

    // Update the workflow
    await this.n8nClient.updateWorkflow(workflow.id, {
      ...workflow,
      connections: updatedConnections
    });

    return {
      success: true,
      action: 'remove',
      connection: {
        from: fromNodeObj.name,
        to: toNodeObj.name,
        output: fromOutput,
        input: toInput
      },
      workflow: {
        id: workflow.id,
        name: workflow.name
      },
      message: `Connection removed from "${fromNodeObj.name}" to "${toNodeObj.name}"`
    };
  }

  private async replaceConnections(workflowIdentifier: string, connections: any[]) {
    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    // Clear all existing connections and rebuild
    const newConnections: Record<string, any> = {};

    for (const conn of connections) {
      const fromNodeObj = workflow.nodes?.find(n => n.id === conn.from || n.name === conn.from);
      const toNodeObj = workflow.nodes?.find(n => n.id === conn.to || n.name === conn.to);

      if (!fromNodeObj || !toNodeObj) {
        console.warn(`Skipping connection: node not found (${conn.from} -> ${conn.to})`);
        continue;
      }

      const fromOutput = conn.fromOutput || 'main';
      const fromIndex = conn.fromIndex || 0;
      const toInput = conn.toInput || 'main';
      const toIndex = conn.toIndex || 0;

      if (!newConnections[fromNodeObj.id]) {
        newConnections[fromNodeObj.id] = {};
      }
      if (!newConnections[fromNodeObj.id][fromOutput]) {
        newConnections[fromNodeObj.id][fromOutput] = [];
      }

      // Ensure the output array exists at the specified index
      while (newConnections[fromNodeObj.id][fromOutput].length <= fromIndex) {
        newConnections[fromNodeObj.id][fromOutput].push([]);
      }

      newConnections[fromNodeObj.id][fromOutput][fromIndex].push({
        node: toNodeObj.id,
        type: toInput,
        index: toIndex
      });
    }

    // Update the workflow
    await this.n8nClient.updateWorkflow(workflow.id, {
      ...workflow,
      connections: newConnections
    });

    return {
      success: true,
      action: 'replace',
      connectionsCount: connections.length,
      workflow: {
        id: workflow.id,
        name: workflow.name
      },
      message: `Replaced all connections with ${connections.length} new connections`
    };
  }

  private async listConnections(workflowIdentifier: string) {
    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    const connections: any[] = [];
    const nodeMap = new Map(workflow.nodes?.map(n => [n.id, n.name]) || []);

    for (const [fromNodeId, outputs] of Object.entries(workflow.connections || {})) {
      for (const [outputType, outputArrays] of Object.entries(outputs as any)) {
        (outputArrays as any[]).forEach((outputArray, outputIndex) => {
          outputArray.forEach((connection: any) => {
            connections.push({
              from: {
                id: fromNodeId,
                name: nodeMap.get(fromNodeId) || fromNodeId,
                output: outputType,
                index: outputIndex
              },
              to: {
                id: connection.node,
                name: nodeMap.get(connection.node) || connection.node,
                input: connection.type,
                index: connection.index
              }
            });
          });
        });
      }
    }

    return {
      success: true,
      action: 'list',
      workflow: {
        id: workflow.id,
        name: workflow.name,
        nodeCount: workflow.nodes?.length || 0
      },
      connections,
      connectionCount: connections.length
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