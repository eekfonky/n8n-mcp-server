import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { DebugParams, DebugTarget, DebugOptions, ToolResponse, WorkflowAnalysis, AnalysisIssue } from '../../types/primitiveTypes.js';
import { EnhancedNodeDiscovery } from '../../discovery/EnhancedNodeDiscovery.js';
import { extractParameters } from '../../utils/parameterExtraction.js';

export class N8nDebugTool {
  constructor(
    private n8nClient: N8nApiClient,
    private nodeDiscovery: EnhancedNodeDiscovery
  ) {}

  getTool(): Tool {
    return {
      name: 'n8n_debug',
      description: 'Debug workflows, analyze failures, and troubleshoot execution issues',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['analyze', 'trace', 'validate', 'test', 'compare'],
            description: 'Type of debugging action to perform'
          },
          target: {
            type: 'object',
            properties: {
              workflowId: { type: 'string' },
              executionId: { type: 'string' },
              nodeId: { type: 'string' }
            },
            description: 'Target workflow, execution, or node to debug'
          },
          scope: {
            type: 'string',
            enum: ['workflow', 'execution', 'node', 'connection', 'data'],
            description: 'Scope of debugging analysis',
            default: 'workflow'
          },
          includeData: {
            type: 'boolean',
            description: 'Include data payloads in debug output',
            default: false
          },
          verbose: {
            type: 'boolean',
            description: 'Enable verbose debugging output',
            default: false
          }
        },
        required: ['action', 'target']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<ToolResponse> {
    const args = extractParameters(request);
    const params = args as unknown as DebugParams;
    const { action, target, options = {} } = params;
    const { includeCredentials = false, includeData = false, depth = 'shallow', format = 'summary' } = options;

    try {
      switch (action) {
        case 'analyze':
          const analyzeData = await this.analyzeIssues(target, depth, format === 'detailed');
          return { success: true, data: analyzeData };

        case 'trace':
          const traceData = await this.traceExecution(target, includeData, format === 'detailed');
          return { success: true, data: traceData };

        case 'validate':
          const validateData = await this.validateWorkflow(target, format === 'detailed');
          return { success: true, data: validateData };

        case 'performance':
          const perfData = await this.analyzeIssues(target, depth, format === 'detailed');
          return { success: true, data: perfData };

        case 'dependencies':
          const depData = await this.analyzeIssues(target, depth, format === 'detailed');
          return { success: true, data: depData };

        default:
          throw new Error(`Unknown debug action: ${action}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async analyzeIssues(target: DebugTarget, depth: string, verbose: boolean) {
    const issues: AnalysisIssue[] = [];
    let workflow, execution;

    // Map depth to scope for compatibility
    const scope = depth === 'shallow' ? 'workflow' : depth === 'deep' ? 'execution' : depth === 'complete' ? 'node' : 'workflow';

    // Get workflow and execution data
    if (target.workflowId) {
      workflow = await this.n8nClient.getWorkflow(target.workflowId);
    }
    if (target.executionId) {
      execution = await this.n8nClient.getExecution(target.executionId);
      if (!workflow && execution.workflowData?.id) {
        workflow = await this.n8nClient.getWorkflow(execution.workflowData?.id);
      }
    }

    if (!workflow && !execution) {
      throw new Error('Must provide workflowId or executionId');
    }

    // Analyze workflow structure
    if (workflow) {
      issues.push(...await this.analyzeWorkflowStructure(workflow, verbose));
    }

    // Analyze execution issues
    if (execution) {
      issues.push(...await this.analyzeExecutionIssues(execution, verbose));
    }

    // Analyze specific node
    if (target.nodeId && workflow) {
      issues.push(...await this.analyzeNodeIssues(workflow, target.nodeId, execution, verbose));
    }

    return {
      analysis: {
        target,
        scope,
        totalIssues: issues.length,
        criticalIssues: issues.filter(i => i.severity === 'critical').length,
        highIssues: issues.filter(i => i.severity === 'high').length,
        mediumIssues: issues.filter(i => i.severity === 'medium').length,
        lowIssues: issues.filter(i => i.severity === 'low').length,
        issues: issues.sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return (severityOrder[b.severity as keyof typeof severityOrder] || 0) -
                 (severityOrder[a.severity as keyof typeof severityOrder] || 0);
        }),
        recommendations: this.generateRecommendations(issues)
      },
      timestamp: new Date().toISOString()
    };
  }

  private async analyzeWorkflowStructure(workflow: any, verbose: boolean) {
    const issues: any[] = [];
    const nodes = workflow.nodes || [];
    const connections = workflow.connections || {};

    // Check for orphaned nodes
    const connectedNodes = new Set();
    Object.values(connections).forEach((nodeConnections: any) => {
      Object.values(nodeConnections).forEach((connections: any) => {
        connections.forEach((conn: any) => {
          connectedNodes.add(conn.node);
        });
      });
    });

    nodes.forEach((node: any, index: number) => {
      if (index > 0 && !connectedNodes.has(node.name) && !Object.keys(connections).includes(node.name)) {
        issues.push({
          type: 'orphaned_node',
          severity: 'warning',
          message: `Node "${node.name}" (${node.type}) is not connected to the workflow`,
          nodeId: node.name,
          location: 'workflow_structure'
        });
      }
    });

    // Check for missing trigger
    const hasTrigger = nodes.some((node: any) =>
      node.type.toLowerCase().includes('trigger') ||
      node.type === 'n8n-nodes-base.manualTrigger'
    );

    if (!hasTrigger) {
      issues.push({
        type: 'missing_trigger',
        severity: 'critical',
        message: 'Workflow has no trigger node - it cannot be executed',
        location: 'workflow_structure'
      });
    }

    // Check for invalid node configurations
    const discoveryResult = await this.nodeDiscovery.discoverNodes();
    const availableNodes = [...discoveryResult.catalog.coreNodes, ...discoveryResult.catalog.communityNodes];

    for (const node of nodes) {
      const nodeType = availableNodes.find((nt: any) => nt.name === node.type);
      if (!nodeType) {
        issues.push({
          type: 'unknown_node_type',
          severity: 'critical',
          message: `Node type "${node.type}" is not available in this n8n instance`,
          nodeId: node.name,
          location: 'node_configuration'
        });
        continue;
      }

      // Check required parameters
      if (verbose && nodeType.parameters) {
        Object.entries(nodeType.parameters).forEach(([paramName, paramConfig]: [string, any]) => {
          if (paramConfig.required && (!node.parameters || node.parameters[paramName] === undefined)) {
            issues.push({
              type: 'missing_required_parameter',
              severity: 'error',
              message: `Node "${node.name}" is missing required parameter "${paramName}"`,
              nodeId: node.name,
              parameter: paramName,
              location: 'node_configuration'
            });
          }
        });
      }
    }

    return issues;
  }

  private async analyzeExecutionIssues(execution: any, verbose: boolean) {
    const issues: any[] = [];

    // Check execution status
    if (execution.data?.resultData && 'error' in execution.data.resultData) {
      issues.push({
        type: 'execution_failed',
        severity: 'critical',
        message: `Execution failed: ${execution.data.resultData.error.message}`,
        error: execution.data.resultData.error,
        location: 'execution'
      });
    }

    // Analyze node execution data
    if (execution.data?.resultData?.runData && verbose) {
      Object.entries(execution.data.resultData.runData).forEach(([nodeId, nodeData]: [string, any]) => {
        if (nodeData[0]?.error) {
          issues.push({
            type: 'node_execution_error',
            severity: 'error',
            message: `Node "${nodeId}" failed: ${nodeData[0].error.message}`,
            nodeId,
            error: nodeData[0].error,
            location: 'node_execution'
          });
        }

        // Check for empty data outputs
        if (nodeData[0]?.data?.main?.[0]?.length === 0) {
          issues.push({
            type: 'empty_data_output',
            severity: 'warning',
            message: `Node "${nodeId}" produced no output data`,
            nodeId,
            location: 'data_flow'
          });
        }
      });
    }

    // Check execution duration
    if (execution.startedAt && execution.stoppedAt) {
      const duration = new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime();
      if (duration > 300000) { // 5 minutes
        issues.push({
          type: 'long_execution_time',
          severity: 'warning',
          message: `Execution took ${Math.round(duration / 1000)} seconds, which is unusually long`,
          duration,
          location: 'performance'
        });
      }
    }

    return issues;
  }

  private async analyzeNodeIssues(workflow: any, nodeId: string, execution: any, verbose: boolean) {
    const issues: any[] = [];
    const node = workflow.nodes?.find((n: any) => n.name === nodeId);

    if (!node) {
      issues.push({
        type: 'node_not_found',
        severity: 'critical',
        message: `Node "${nodeId}" not found in workflow`,
        nodeId,
        location: 'node_configuration'
      });
      return issues;
    }

    // Check node connections
    const connections = workflow.connections || {};
    const hasInputConnections = Object.values(connections).some((nodeConns: any) =>
      Object.values(nodeConns).some((conns: any) =>
        conns.some((conn: any) => conn.node === nodeId)
      )
    );

    const hasOutputConnections = connections[nodeId] && Object.keys(connections[nodeId]).length > 0;

    if (!hasInputConnections && !node.type.toLowerCase().includes('trigger')) {
      issues.push({
        type: 'no_input_connections',
        severity: 'warning',
        message: `Node "${nodeId}" has no input connections`,
        nodeId,
        location: 'connections'
      });
    }

    if (!hasOutputConnections) {
      issues.push({
        type: 'no_output_connections',
        severity: 'info',
        message: `Node "${nodeId}" has no output connections`,
        nodeId,
        location: 'connections'
      });
    }

    // Check execution data for this node
    if (execution?.data?.resultData?.runData?.[nodeId] && verbose) {
      const nodeRunData = execution.data.resultData.runData[nodeId][0];

      if (nodeRunData.error) {
        issues.push({
          type: 'node_runtime_error',
          severity: 'error',
          message: `Node "${nodeId}" failed during execution: ${nodeRunData.error.message}`,
          nodeId,
          error: nodeRunData.error,
          location: 'runtime'
        });
      }

      // Check data quality
      if (nodeRunData.data?.main?.[0]) {
        const outputData = nodeRunData.data.main[0];
        if (outputData.length === 0) {
          issues.push({
            type: 'empty_output',
            severity: 'warning',
            message: `Node "${nodeId}" produced no output items`,
            nodeId,
            location: 'data_output'
          });
        } else if (outputData.some((item: any) => !item.json || Object.keys(item.json).length === 0)) {
          issues.push({
            type: 'empty_json_data',
            severity: 'warning',
            message: `Node "${nodeId}" produced items with empty JSON data`,
            nodeId,
            location: 'data_quality'
          });
        }
      }
    }

    return issues;
  }

  private async traceExecution(target: any, includeData: boolean, verbose: boolean) {
    if (!target.executionId) {
      throw new Error('executionId is required for trace action');
    }

    const execution = await this.n8nClient.getExecution(target.executionId);
    const workflow = await this.n8nClient.getWorkflow(execution.workflowData?.id);

    const trace = {
      executionId: target.executionId,
      workflowId: execution.workflowData?.id,
      status: execution.finished ? 'completed' : 'running',
      duration: execution.stoppedAt ?
        new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime() : null,
      nodeTrace: [] as any[]
    };

    // Build execution trace
    if (execution.data?.resultData?.runData) {
      const nodes = workflow.nodes || [];
      const runData = execution.data.resultData.runData;

      // Create execution order based on node dependencies
      const executionOrder = this.buildExecutionOrder(workflow, runData);

      trace.nodeTrace = executionOrder.map(nodeId => {
        const node = nodes.find((n: any) => n.name === nodeId);
        const nodeRunData = runData[nodeId]?.[0] as any;

        const nodeTrace: any = {
          nodeId,
          nodeType: node?.type || 'unknown',
          status: nodeRunData?.error ? 'error' : 'success',
          startTime: nodeRunData?.startTime,
          executionTime: nodeRunData?.executionTime,
          itemsProcessed: nodeRunData?.data?.main?.[0]?.length || 0
        };

        if (nodeRunData?.error) {
          nodeTrace.error = {
            message: nodeRunData.error.message,
            type: nodeRunData.error.name,
            stack: verbose ? nodeRunData.error.stack : undefined
          };
        }

        if (includeData && nodeRunData?.data?.main?.[0]) {
          nodeTrace.outputData = nodeRunData.data.main[0].slice(0, verbose ? 10 : 3);
        }

        return nodeTrace;
      });
    }

    return {
      trace,
      summary: {
        totalNodes: trace.nodeTrace.length,
        successfulNodes: trace.nodeTrace.filter(n => n.status === 'success').length,
        failedNodes: trace.nodeTrace.filter(n => n.status === 'error').length,
        totalItems: trace.nodeTrace.reduce((sum, n) => sum + n.itemsProcessed, 0)
      },
      timestamp: new Date().toISOString()
    };
  }

  private buildExecutionOrder(workflow: any, runData: any): string[] {
    const nodes = workflow.nodes || [];
    const connections = workflow.connections || {};
    const executed = Object.keys(runData);

    // Simple topological sort based on connections
    const order: string[] = [];
    const visited = new Set<string>();

    const visit = (nodeId: string) => {
      if (visited.has(nodeId) || !executed.includes(nodeId)) return;
      visited.add(nodeId);

      // Visit dependencies first (nodes that connect to this one)
      Object.entries(connections).forEach(([sourceNodeId, sourceConnections]: [string, any]) => {
        Object.values(sourceConnections).forEach((conns: any) => {
          conns.forEach((conn: any) => {
            if (conn.node === nodeId && !visited.has(sourceNodeId)) {
              visit(sourceNodeId);
            }
          });
        });
      });

      order.push(nodeId);
    };

    executed.forEach(nodeId => visit(nodeId));
    return order;
  }

  private async validateWorkflow(target: any, verbose: boolean) {
    if (!target.workflowId) {
      throw new Error('workflowId is required for validate action');
    }

    const workflow = await this.n8nClient.getWorkflow(target.workflowId);
    const validationResult = {
      valid: true,
      errors: [] as any[],
      warnings: [] as any[],
      recommendations: [] as any[]
    };

    // Run comprehensive validation
    const issues = await this.analyzeWorkflowStructure(workflow, true);

    issues.forEach(issue => {
      if (issue.severity === 'critical' || issue.severity === 'error') {
        validationResult.valid = false;
        validationResult.errors.push(issue);
      } else if (issue.severity === 'warning') {
        validationResult.warnings.push(issue);
      } else {
        validationResult.recommendations.push(issue);
      }
    });

    return {
      validation: validationResult,
      summary: {
        isValid: validationResult.valid,
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
        recommendationCount: validationResult.recommendations.length
      },
      timestamp: new Date().toISOString()
    };
  }

  private async testWorkflow(target: any, verbose: boolean) {
    if (!target.workflowId) {
      throw new Error('workflowId is required for test action');
    }

    // This would trigger a test execution
    // For now, we'll validate and return test recommendations
    const workflow = await this.n8nClient.getWorkflow(target.workflowId);
    const validation = await this.validateWorkflow(target, verbose);

    return {
      test: {
        workflowId: target.workflowId,
        canExecute: validation.validation.valid,
        testRecommendations: [
          'Ensure all required credentials are configured',
          'Test with sample data first',
          'Monitor execution in real-time',
          'Check node outputs for expected data structure'
        ],
        preTestChecks: validation.validation
      },
      timestamp: new Date().toISOString()
    };
  }

  private async compareExecutions(target: any, verbose: boolean) {
    if (!target.executionId || !target.compareWith) {
      throw new Error('executionId and compareWith are required for compare action');
    }

    const execution1 = await this.n8nClient.getExecution(target.executionId);
    const execution2 = await this.n8nClient.getExecution(target.compareWith);

    const comparison = {
      executions: {
        first: {
          id: target.executionId,
          status: execution1.finished ? 'completed' : 'running',
          duration: execution1.stoppedAt ?
            new Date(execution1.stoppedAt).getTime() - new Date(execution1.startedAt).getTime() : null
        },
        second: {
          id: target.compareWith,
          status: execution2.finished ? 'completed' : 'running',
          duration: execution2.stoppedAt ?
            new Date(execution2.stoppedAt).getTime() - new Date(execution2.startedAt).getTime() : null
        }
      },
      differences: [] as any[]
    };

    // Compare execution results
    const runData1 = execution1.data?.resultData?.runData || {};
    const runData2 = execution2.data?.resultData?.runData || {};

    const allNodes = new Set([...Object.keys(runData1), ...Object.keys(runData2)]);

    allNodes.forEach(nodeId => {
      const node1 = runData1[nodeId];
      const node2 = runData2[nodeId];

      if (!node1 && node2) {
        comparison.differences.push({
          type: 'node_missing_in_first',
          nodeId,
          message: `Node ${nodeId} executed in second execution but not in first`
        });
      } else if (node1 && !node2) {
        comparison.differences.push({
          type: 'node_missing_in_second',
          nodeId,
          message: `Node ${nodeId} executed in first execution but not in second`
        });
      } else if (node1 && node2) {
        const n1 = node1[0] as any;
        const n2 = node2[0] as any;
        const items1 = n1?.data?.main?.[0]?.length || 0;
        const items2 = n2?.data?.main?.[0]?.length || 0;

        if (items1 !== items2) {
          comparison.differences.push({
            type: 'different_item_count',
            nodeId,
            message: `Node ${nodeId} processed ${items1} items vs ${items2} items`,
            values: { first: items1, second: items2 }
          });
        }

        if (!!n1?.error !== !!n2?.error) {
          comparison.differences.push({
            type: 'different_error_status',
            nodeId,
            message: `Node ${nodeId} error status differs between executions`,
            values: {
              first: n1?.error ? 'error' : 'success',
              second: n2?.error ? 'error' : 'success'
            }
          });
        }
      }
    });

    return {
      comparison,
      summary: {
        totalDifferences: comparison.differences.length,
        executionOutcome: execution1.data?.resultData && 'error' in execution1.data.resultData ? 'failed' : 'success',
        comparisonOutcome: execution2.data?.resultData && 'error' in execution2.data.resultData ? 'failed' : 'success'
      },
      timestamp: new Date().toISOString()
    };
  }

  private generateRecommendations(issues: any[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(i => i.type === 'missing_trigger')) {
      recommendations.push('Add a trigger node (Manual Trigger, Webhook, Schedule, etc.) to make the workflow executable');
    }

    if (issues.some(i => i.type === 'orphaned_node')) {
      recommendations.push('Connect all nodes or remove unused nodes to improve workflow clarity');
    }

    if (issues.some(i => i.type === 'unknown_node_type')) {
      recommendations.push('Install missing community nodes or replace with available alternatives');
    }

    if (issues.some(i => i.type === 'missing_required_parameter')) {
      recommendations.push('Configure all required node parameters before execution');
    }

    if (issues.some(i => i.type === 'long_execution_time')) {
      recommendations.push('Consider optimizing workflow performance with batch processing or pagination');
    }

    if (issues.some(i => i.type === 'empty_data_output')) {
      recommendations.push('Review node configurations and input data to ensure proper data flow');
    }

    return recommendations;
  }
}