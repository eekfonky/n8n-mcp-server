import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { EnhancedNodeDiscovery } from '../../discovery/EnhancedNodeDiscovery.js';
import { extractParameters } from '../../utils/parameterExtraction.js';

export class N8nInspectTool {
  constructor(
    private n8nClient: N8nApiClient,
    private nodeDiscovery: EnhancedNodeDiscovery
  ) {}

  getTool(): Tool {
    return {
      name: 'n8n_inspect',
      description: 'Deep inspection of workflows, nodes, executions, and configurations',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['workflow', 'node', 'execution', 'credential'],
            description: 'Type of entity to inspect'
          },
          id: {
            type: 'string',
            description: 'ID of the entity to inspect'
          },
          name: {
            type: 'string',
            description: 'Name of the entity (alternative to ID)'
          },
          nodeType: {
            type: 'string',
            description: 'Node type to inspect (for node inspection)'
          },
          detail: {
            type: 'string',
            enum: ['basic', 'full', 'schema', 'examples'],
            description: 'Level of detail to return',
            default: 'basic'
          },
          includeData: {
            type: 'boolean',
            description: 'Include execution data (for executions)',
            default: false
          }
        },
        required: ['type']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<any> {
    const args = extractParameters(request);
    const { type, id, name, nodeType, detail = 'basic', includeData = false } = args;

    try {
      switch (type) {
        case 'workflow':
          return await this.inspectWorkflow(id || name, detail);

        case 'node':
          return await this.inspectNode(nodeType || id || name, detail);

        case 'execution':
          return await this.inspectExecution(id, includeData);

        case 'credential':
          return await this.inspectCredential(id || name);

        default:
          throw new Error(`Unknown inspection type: ${type}`);
      }
    } catch (error: any) {
      return {
        error: true,
        message: error?.message || 'Inspection failed',
        type
      };
    }
  }

  private async inspectWorkflow(identifier: string, detail: string) {
    if (!identifier) {
      throw new Error('Workflow ID or name is required');
    }

    const workflow = await this.getWorkflowByIdOrName(identifier);
    if (!workflow) {
      throw new Error(`Workflow ${identifier} not found`);
    }

    const result: any = {
      type: 'workflow',
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt
    };

    if (detail === 'basic') {
      result.summary = {
        nodeCount: workflow.nodes?.length || 0,
        connectionCount: workflow.connections ? Object.keys(workflow.connections).length : 0,
        hasTags: workflow.tags && workflow.tags.length > 0
      };

      result.nodeTypes = workflow.nodes?.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        hasParameters: !!node.parameters && Object.keys(node.parameters).length > 0,
        hasCredentials: !!node.credentials
      })) || [];
    }

    if (detail === 'full' || detail === 'schema') {
      result.nodes = workflow.nodes?.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        typeVersion: node.typeVersion,
        position: node.position,
        parameters: node.parameters || {},
        credentials: node.credentials || null,
        hasParameters: !!node.parameters && Object.keys(node.parameters).length > 0
      })) || [];

      result.connections = workflow.connections || {};
      result.tags = workflow.tags || [];
    }

    if (detail === 'full') {
      result.tags = workflow.tags;

      // Get recent executions
      try {
        const executions = await this.n8nClient.getExecutions(workflow.id);
        result.recentExecutions = executions.slice(0, 5).map(exec => ({
          id: exec.id,
          finished: exec.finished,
          startedAt: exec.startedAt,
          stoppedAt: exec.stoppedAt,
          mode: exec.mode
        }));
      } catch {
        result.recentExecutions = [];
      }
    }

    return result;
  }

  private async inspectNode(nodeType: string, detail: string) {
    if (!nodeType) {
      throw new Error('Node type is required');
    }

    // Get node information from discovery
    const nodeInfo = this.nodeDiscovery.getNodeDetails(nodeType);
    if (!nodeInfo) {
      throw new Error(`Node type ${nodeType} not found`);
    }

    const result: any = {
      type: 'node',
      nodeType: nodeInfo.type,
      displayName: nodeInfo.displayName,
      category: nodeInfo.category,
      description: nodeInfo.description,
      isCore: nodeInfo.isCore,
      packageName: nodeInfo.packageName,
      typeVersion: nodeInfo.typeVersion
    };

    if (detail === 'basic') {
      result.summary = {
        usageCount: nodeInfo.usageCount,
        hasCredentials: !!nodeInfo.credentials && Object.keys(nodeInfo.credentials).length > 0,
        exampleConfigCount: nodeInfo.exampleConfigs.length,
        parameterCount: nodeInfo.parameters ? Object.keys(nodeInfo.parameters).length : 0
      };
    }

    if (detail === 'schema' || detail === 'full') {
      result.parameters = nodeInfo.parameters || {};
      result.credentials = nodeInfo.credentials || {};
    }

    if (detail === 'examples' || detail === 'full') {
      result.exampleConfigs = nodeInfo.exampleConfigs.slice(0, 3).map(config => ({
        name: config.name,
        parameters: config.parameters,
        credentials: config.credentials
      }));

      // Generate full documentation
      result.documentation = this.nodeDiscovery.generateNodeDocumentation(nodeType);
    }

    return result;
  }

  private async inspectExecution(executionId: string, includeData: boolean) {
    if (!executionId) {
      throw new Error('Execution ID is required');
    }

    const execution = await this.n8nClient.getExecution(executionId);

    const result: any = {
      type: 'execution',
      id: execution.id,
      workflowData: execution.workflowData?.name || 'Unknown',
      finished: execution.finished,
      mode: execution.mode,
      startedAt: execution.startedAt,
      stoppedAt: execution.stoppedAt
    };

    if (execution.startedAt && execution.stoppedAt) {
      result.duration = new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime();
    }

    if (includeData && execution.data) {
      // Warn about potentially large execution data
      const dataStr = JSON.stringify(execution.data);
      const dataSizeMB = Buffer.byteLength(dataStr, 'utf8') / (1024 * 1024);

      if (dataSizeMB > 5) {
        result.warning = `Execution data is large (${dataSizeMB.toFixed(2)}MB). Consider using includeData=false for better performance.`;
        result.dataSummary = {
          sizeMB: parseFloat(dataSizeMB.toFixed(2)),
          hasError: execution.data?.resultData && 'error' in execution.data.resultData,
          nodeCount: execution.data?.resultData?.runData ? Object.keys(execution.data.resultData.runData).length : 0
        };
        // Don't include full data for very large responses
        console.error(`[Inspect] Warning: Large execution data (${dataSizeMB.toFixed(2)}MB) requested for execution ${executionId}`);
      } else {
        result.data = execution.data;
      }
    }

    // Workflow info is already in workflowData
    result.workflow = {
      name: execution.workflowData?.name || 'Unknown',
      id: execution.workflowData?.id || 'Unknown'
    };

    return result;
  }

  private async inspectCredential(identifier: string) {
    if (!identifier) {
      throw new Error('Credential ID or name is required');
    }

    try {
      const credentials = await this.n8nClient.getCredentials();
      const credential = credentials.find(cred =>
        cred.id === identifier || cred.name === identifier
      );

      if (!credential) {
        throw new Error(`Credential ${identifier} not found`);
      }

      return {
        type: 'credential',
        id: credential.id,
        name: credential.name,
        credentialType: credential.type,
        // Note: We don't return actual credential data for security
        summary: {
          hasData: !!credential.data
        }
      };
    } catch (error: any) {
      if (error.message.includes('not found')) {
        throw error;
      }
      throw new Error('Unable to inspect credentials (may require special permissions)');
    }
  }

  private async getWorkflowByIdOrName(identifier: string) {
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