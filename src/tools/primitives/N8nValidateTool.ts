import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { EnhancedNodeDiscovery } from '../../discovery/EnhancedNodeDiscovery.js';
import { N8nWorkflow, N8nNode } from '../../types.js';

export class N8nValidateTool {
  constructor(
    private n8nClient: N8nApiClient,
    private nodeDiscovery: EnhancedNodeDiscovery
  ) {}

  getTool(): Tool {
    return {
      name: 'n8n_validate',
      description: 'Validate workflows, nodes, connections, and configurations',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['workflow', 'node', 'connections', 'parameters', 'credentials', 'execution-readiness'],
            description: 'Type of validation to perform'
          },
          workflow: {
            type: 'string',
            description: 'Workflow ID or name to validate'
          },
          node: {
            type: 'string',
            description: 'Node ID or name to validate (for node validation)'
          },
          nodeType: {
            type: 'string',
            description: 'Node type to validate parameters against'
          },
          parameters: {
            type: 'object',
            description: 'Parameters to validate',
            additionalProperties: true
          },
          strict: {
            type: 'boolean',
            description: 'Enable strict validation mode',
            default: false
          },
          fix: {
            type: 'boolean',
            description: 'Attempt to fix issues automatically',
            default: false
          }
        },
        required: ['type']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<any> {
    const { type, workflow, node, nodeType, parameters, strict = false, fix = false } = request.params as any;

    try {
      switch (type) {
        case 'workflow':
          return await this.validateWorkflow(workflow, strict, fix);

        case 'node':
          return await this.validateNode(workflow, node, strict);

        case 'connections':
          return await this.validateConnections(workflow, strict, fix);

        case 'parameters':
          return await this.validateParameters(nodeType, parameters, strict);

        case 'credentials':
          return await this.validateCredentials(workflow, node);

        case 'execution-readiness':
          return await this.validateExecutionReadiness(workflow, strict);

        default:
          throw new Error(`Unknown validation type: ${type}`);
      }
    } catch (error: any) {
      return {
        error: true,
        message: error?.message || 'Validation failed',
        type
      };
    }
  }

  private async validateWorkflow(workflowIdentifier: string, strict: boolean, fix: boolean) {
    if (!workflowIdentifier) {
      throw new Error('Workflow identifier is required');
    }

    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    const validation = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      suggestions: [] as string[],
      details: {
        nodeValidation: null as any,
        connectionValidation: null as any,
        executionReadiness: null as any
      }
    };

    // Basic workflow structure validation
    if (!workflow.name || workflow.name.trim().length === 0) {
      validation.errors.push('Workflow name is empty or missing');
      validation.valid = false;
    }

    if (!workflow.nodes || workflow.nodes.length === 0) {
      validation.errors.push('Workflow has no nodes');
      validation.valid = false;
      return {
        success: true,
        validation,
        workflow: { id: workflow.id, name: workflow.name }
      };
    }

    // Validate individual nodes
    validation.details.nodeValidation = await this.validateAllNodes(workflow, strict);
    if (!validation.details.nodeValidation.valid) {
      validation.valid = false;
      validation.errors.push(...validation.details.nodeValidation.errors);
      validation.warnings.push(...validation.details.nodeValidation.warnings);
    }

    // Validate connections
    validation.details.connectionValidation = await this.validateAllConnections(workflow, strict);
    if (!validation.details.connectionValidation.valid) {
      validation.valid = false;
      validation.errors.push(...validation.details.connectionValidation.errors);
      validation.warnings.push(...validation.details.connectionValidation.warnings);
    }

    // Validate execution readiness
    validation.details.executionReadiness = await this.validateWorkflowExecutionReadiness(workflow, strict);
    if (!validation.details.executionReadiness.valid) {
      if (strict) {
        validation.valid = false;
        validation.errors.push(...validation.details.executionReadiness.errors);
      } else {
        validation.warnings.push(...validation.details.executionReadiness.warnings);
      }
    }

    // Generate suggestions
    if (validation.details.nodeValidation.suggestions) {
      validation.suggestions.push(...validation.details.nodeValidation.suggestions);
    }
    if (validation.details.connectionValidation.suggestions) {
      validation.suggestions.push(...validation.details.connectionValidation.suggestions);
    }

    return {
      success: true,
      validation,
      workflow: {
        id: workflow.id,
        name: workflow.name,
        active: workflow.active,
        nodeCount: workflow.nodes.length
      }
    };
  }

  private async validateNode(workflowIdentifier: string, nodeIdentifier: string, strict: boolean) {
    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    const node = workflow.nodes?.find(n => n.id === nodeIdentifier || n.name === nodeIdentifier);
    if (!node) {
      throw new Error(`Node ${nodeIdentifier} not found in workflow`);
    }

    const validation = await this.validateSingleNode(node, strict);

    return {
      success: true,
      validation,
      node: {
        id: node.id,
        name: node.name,
        type: node.type
      },
      workflow: {
        id: workflow.id,
        name: workflow.name
      }
    };
  }

  private async validateConnections(workflowIdentifier: string, strict: boolean, fix: boolean) {
    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    return {
      success: true,
      validation: await this.validateAllConnections(workflow, strict),
      workflow: {
        id: workflow.id,
        name: workflow.name
      }
    };
  }

  private async validateParameters(nodeType: string, parameters: any, strict: boolean) {
    if (!nodeType) {
      throw new Error('Node type is required for parameter validation');
    }

    // Get node type information
    const nodeInfo = this.nodeDiscovery.getNodeDetails(nodeType);

    const validation = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      suggestions: [] as string[]
    };

    if (!nodeInfo) {
      validation.warnings.push(`Unknown node type: ${nodeType}. Cannot validate parameters.`);
      return {
        success: true,
        validation,
        nodeType
      };
    }

    // Validate parameters against known structure
    if (nodeInfo.parameters) {
      for (const [key, value] of Object.entries(nodeInfo.parameters)) {
        if (typeof value === 'object' && (value as any).required) {
          if (!(key in parameters)) {
            validation.errors.push(`Required parameter '${key}' is missing`);
            validation.valid = false;
          }
        }
      }
    }

    // Check for unknown parameters
    if (strict && parameters && nodeInfo.parameters) {
      for (const key of Object.keys(parameters)) {
        if (!(key in nodeInfo.parameters)) {
          validation.warnings.push(`Unknown parameter '${key}' for node type ${nodeType}`);
        }
      }
    }

    return {
      success: true,
      validation,
      nodeType,
      parametersProvided: parameters ? Object.keys(parameters).length : 0
    };
  }

  private async validateCredentials(workflowIdentifier: string, nodeIdentifier?: string) {
    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    const validation = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      credentialIssues: [] as any[]
    };

    const nodesToCheck = nodeIdentifier
      ? workflow.nodes?.filter(n => n.id === nodeIdentifier || n.name === nodeIdentifier) || []
      : workflow.nodes || [];

    for (const node of nodesToCheck) {
      if (node.credentials) {
        for (const [credType, credId] of Object.entries(node.credentials)) {
          try {
            // Try to fetch credential info (this may fail due to permissions)
            const credentials = await this.n8nClient.getCredentials();
            const credExists = credentials.some(cred => cred.id === credId);

            if (!credExists) {
              validation.errors.push(`Credential ${credId} for ${credType} not found`);
              validation.valid = false;
              validation.credentialIssues.push({
                nodeId: node.id,
                nodeName: node.name,
                credentialType: credType,
                credentialId: credId,
                issue: 'not_found'
              });
            }
          } catch {
            validation.warnings.push('Unable to validate credentials (insufficient permissions)');
          }
        }
      }
    }

    return {
      success: true,
      validation,
      workflow: {
        id: workflow.id,
        name: workflow.name
      },
      nodesChecked: nodesToCheck.length
    };
  }

  private async validateExecutionReadiness(workflowIdentifier: string, strict: boolean) {
    const workflow = await this.getWorkflowByIdOrName(workflowIdentifier);
    if (!workflow) {
      throw new Error(`Workflow ${workflowIdentifier} not found`);
    }

    return {
      success: true,
      validation: await this.validateWorkflowExecutionReadiness(workflow, strict),
      workflow: {
        id: workflow.id,
        name: workflow.name,
        active: workflow.active
      }
    };
  }

  // Helper validation methods
  private async validateAllNodes(workflow: N8nWorkflow, strict: boolean) {
    const validation = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      suggestions: [] as string[],
      nodeResults: [] as any[]
    };

    for (const node of workflow.nodes || []) {
      const nodeValidation = await this.validateSingleNode(node, strict);
      validation.nodeResults.push({
        nodeId: node.id,
        nodeName: node.name,
        ...nodeValidation
      });

      if (!nodeValidation.valid) {
        validation.valid = false;
        validation.errors.push(...nodeValidation.errors.map(e => `Node ${node.name}: ${e}`));
      }
      validation.warnings.push(...nodeValidation.warnings.map(w => `Node ${node.name}: ${w}`));
    }

    return validation;
  }

  private async validateSingleNode(node: N8nNode, strict: boolean) {
    const validation = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };

    // Basic node structure
    if (!node.name || node.name.trim().length === 0) {
      validation.errors.push('Node name is empty');
      validation.valid = false;
    }

    if (!node.type) {
      validation.errors.push('Node type is missing');
      validation.valid = false;
    }

    if (!Array.isArray(node.position) || node.position.length !== 2) {
      validation.errors.push('Node position is invalid');
      validation.valid = false;
    }

    // Check if node type exists
    const nodeInfo = this.nodeDiscovery.getNodeDetails(node.type);
    if (!nodeInfo && strict) {
      validation.warnings.push(`Unknown node type: ${node.type}`);
    }

    return validation;
  }

  private async validateAllConnections(workflow: N8nWorkflow, strict: boolean) {
    const validation = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      suggestions: [] as string[]
    };

    if (!workflow.connections) {
      validation.warnings.push('No connections defined');
      return validation;
    }

    const nodeIds = new Set((workflow.nodes || []).map(n => n.id));

    for (const [fromNodeId, outputs] of Object.entries(workflow.connections)) {
      if (!nodeIds.has(fromNodeId)) {
        validation.errors.push(`Connection source node ${fromNodeId} does not exist`);
        validation.valid = false;
        continue;
      }

      for (const [outputType, outputArrays] of Object.entries(outputs as any)) {
        for (const outputArray of outputArrays as any[]) {
          for (const connection of outputArray) {
            if (!nodeIds.has(connection.node)) {
              validation.errors.push(`Connection target node ${connection.node} does not exist`);
              validation.valid = false;
            }
          }
        }
      }
    }

    return validation;
  }

  private async validateWorkflowExecutionReadiness(workflow: N8nWorkflow, strict: boolean) {
    const validation = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };

    // Check for trigger nodes
    const triggerNodes = (workflow.nodes || []).filter(node =>
      node.type.includes('trigger') ||
      node.type.includes('webhook') ||
      node.type.includes('cron') ||
      node.type === 'n8n-nodes-base.manualTrigger'
    );

    if (triggerNodes.length === 0) {
      if (strict) {
        validation.errors.push('No trigger nodes found');
        validation.valid = false;
      } else {
        validation.warnings.push('No trigger nodes found - workflow may not execute automatically');
      }
    }

    // Check for disconnected nodes
    const connectedNodes = new Set<string>();
    for (const [fromNode, outputs] of Object.entries(workflow.connections || {})) {
      connectedNodes.add(fromNode);
      for (const outputArrays of Object.values(outputs as any)) {
        for (const outputArray of outputArrays as any[]) {
          for (const connection of outputArray) {
            connectedNodes.add(connection.node);
          }
        }
      }
    }

    const disconnectedNodes = (workflow.nodes || []).filter(node =>
      !connectedNodes.has(node.id) && !triggerNodes.some(t => t.id === node.id)
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