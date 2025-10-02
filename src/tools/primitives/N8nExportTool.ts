import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { ExportParams, ExportResult, ToolResponse } from '../../types/primitiveTypes.js';
import { deepClone, DataTransformer, ArrayOptimizer } from '../../utils/performance.js';
import { EnhancedNodeDiscovery } from '../../discovery/EnhancedNodeDiscovery.js';

export class N8nExportTool {
  constructor(
    private n8nClient: N8nApiClient,
    private nodeDiscovery: EnhancedNodeDiscovery
  ) {}

  getTool(): Tool {
    return {
      name: 'n8n_export',
      description: 'Export workflows, data, and configurations in various formats',
      inputSchema: {
        type: 'object',
        properties: {
          exportType: {
            type: 'string',
            enum: ['workflow', 'execution', 'data', 'backup', 'report', 'documentation'],
            description: 'Type of export to perform'
          },
          format: {
            type: 'string',
            enum: ['json', 'yaml', 'csv', 'xml', 'markdown', 'html', 'pdf'],
            description: 'Output format for the export',
            default: 'json'
          },
          targets: {
            type: 'object',
            properties: {
              workflowIds: { type: 'array', items: { type: 'string' } },
              executionIds: { type: 'array', items: { type: 'string' } },
              nodeTypes: { type: 'array', items: { type: 'string' } },
              dateRange: {
                type: 'object',
                properties: {
                  start: { type: 'string' },
                  end: { type: 'string' }
                }
              },
              filter: {
                type: 'object',
                properties: {
                  tags: { type: 'array', items: { type: 'string' } },
                  status: { type: 'string' },
                  includeInactive: { type: 'boolean', default: true }
                }
              }
            },
            description: 'Targets and filters for export'
          },
          options: {
            type: 'object',
            properties: {
              includeCredentials: { type: 'boolean', default: false },
              includeExecutionData: { type: 'boolean', default: false },
              includeMetadata: { type: 'boolean', default: true },
              compress: { type: 'boolean', default: false },
              anonymize: { type: 'boolean', default: false },
              limit: { type: 'number', default: 1000 },
              template: { type: 'string' }
            },
            description: 'Export options and settings'
          }
        },
        required: ['exportType']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<ToolResponse> {
    const params = request.params as unknown as ExportParams;
    const { action, target, format = 'json', filters, options = {} } = params;

    try {
      switch (action) {
        case 'export':
          const exportData = await this.exportWorkflows(target, format, options);
          return { success: true, data: exportData };

        case 'schedule':
          const scheduleData = await this.exportExecutions(target, format, options);
          return { success: true, data: scheduleData };

        case 'status':
          const statusData = await this.exportData(target, format, options);
          return { success: true, data: statusData };

        case 'download':
          const downloadData = await this.exportReport(target, format, options);
          return { success: true, data: downloadData };

        default:
          throw new Error(`Unknown export action: ${action}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async exportWorkflows(targets: any, format: string, options: any) {
    let workflows = await this.n8nClient.getWorkflows();

    // Apply filters
    if (targets.workflowIds) {
      workflows = workflows.filter((wf: any) => targets.workflowIds.includes(wf.id));
    }

    if (targets.filter) {
      workflows = this.applyWorkflowFilters(workflows, targets.filter);
    }

    // Process workflows
    const processedWorkflows = await Promise.all(
      workflows.map(async (workflow: any) => await this.processWorkflowForExport(workflow, options))
    );

    const exportData = {
      metadata: {
        exportType: 'workflows',
        format,
        timestamp: new Date().toISOString(),
        count: processedWorkflows.length,
        n8nVersion: await this.getN8nVersion(),
        exportOptions: options
      },
      workflows: processedWorkflows
    };

    return {
      export: await this.formatOutput(exportData, format, options),
      summary: {
        totalWorkflows: processedWorkflows.length,
        activeWorkflows: processedWorkflows.filter(wf => wf.active).length,
        format,
        size: JSON.stringify(exportData).length
      },
      timestamp: new Date().toISOString()
    };
  }

  private async exportExecutions(targets: any, format: string, options: any) {
    let executions: any[] = [];

    if (targets.executionIds) {
      // Fetch specific executions
      executions = await Promise.all(
        targets.executionIds.map(async (id: string) => {
          try {
            return await this.n8nClient.getExecution(id);
          } catch (error) {
            return null;
          }
        })
      );
      executions = executions.filter(exec => exec !== null);
    } else {
      // Fetch executions by criteria
      const workflowIds = targets.workflowIds || undefined;
      const limit = Math.min(options.limit || 1000, 1000);

      if (workflowIds) {
        for (const workflowId of workflowIds) {
          const workflowExecutions = await this.n8nClient.getExecutions(workflowId, limit);
          executions.push(...workflowExecutions);
        }
      } else {
        executions = await this.n8nClient.getExecutions(undefined, limit);
      }
    }

    // Apply date range filter
    if (targets.dateRange) {
      executions = this.applyDateRangeFilter(executions, targets.dateRange);
    }

    // Process executions
    const processedExecutions = executions.map(execution =>
      this.processExecutionForExport(execution, options)
    );

    const exportData = {
      metadata: {
        exportType: 'executions',
        format,
        timestamp: new Date().toISOString(),
        count: processedExecutions.length,
        dateRange: targets.dateRange,
        exportOptions: options
      },
      executions: processedExecutions
    };

    return {
      export: await this.formatOutput(exportData, format, options),
      summary: {
        totalExecutions: processedExecutions.length,
        successfulExecutions: processedExecutions.filter(e => !e.failed).length,
        failedExecutions: processedExecutions.filter(e => e.failed).length,
        format,
        size: JSON.stringify(exportData).length
      },
      timestamp: new Date().toISOString()
    };
  }

  private async exportData(targets: any, format: string, options: any) {
    const dataExport: any = {
      workflows: [],
      executions: [],
      nodes: [],
      statistics: {}
    };

    // Export workflow data
    if (!targets.exclude?.includes('workflows')) {
      const workflows = await this.n8nClient.getWorkflows();
      dataExport.workflows = workflows.map(wf => this.extractWorkflowData(wf, options));
    }

    // Export execution data
    if (!targets.exclude?.includes('executions')) {
      const limit = Math.min(options.limit || 100, 1000);
      const executions = await this.n8nClient.getExecutions(undefined, limit);
      dataExport.executions = executions.map(exec => this.extractExecutionData(exec, options));
    }

    // Export node data
    if (!targets.exclude?.includes('nodes')) {
      const discoveryResult = await this.nodeDiscovery.discoverNodes();
      dataExport.nodes = this.extractNodeData(discoveryResult, options);
    }

    // Export statistics
    if (!targets.exclude?.includes('statistics')) {
      dataExport.statistics = await this.generateStatistics(dataExport);
    }

    const exportData = {
      metadata: {
        exportType: 'data',
        format,
        timestamp: new Date().toISOString(),
        exportOptions: options
      },
      data: dataExport
    };

    return {
      export: await this.formatOutput(exportData, format, options),
      summary: {
        workflowCount: dataExport.workflows.length,
        executionCount: dataExport.executions.length,
        nodeTypeCount: dataExport.nodes.length,
        format,
        size: JSON.stringify(exportData).length
      },
      timestamp: new Date().toISOString()
    };
  }

  private async exportBackup(targets: any, format: string, options: any) {
    const backup: any = {
      metadata: {
        backupType: 'full',
        timestamp: new Date().toISOString(),
        n8nVersion: await this.getN8nVersion(),
        exportOptions: options
      },
      workflows: [],
      nodeDiscovery: null,
      configuration: {}
    };

    // Backup all workflows
    const workflows = await this.n8nClient.getWorkflows();
    backup.workflows = await Promise.all(
      workflows.map(async (workflow: any) => {
        const full = await this.n8nClient.getWorkflow(workflow.id);
        return this.processWorkflowForExport(full, { ...options, includeCredentials: true });
      })
    );

    // Backup node discovery data
    const discoveryResult = await this.nodeDiscovery.discoverNodes();
    backup.nodeDiscovery = {
      catalog: discoveryResult.catalog,
      statistics: discoveryResult.statistics,
      sources: discoveryResult.sources
    };

    // Backup configuration (metadata only)
    backup.configuration = {
      serverInfo: await this.getServerInfo(),
      exportTimestamp: new Date().toISOString()
    };

    const exportData = {
      metadata: backup.metadata,
      backup
    };

    return {
      export: await this.formatOutput(exportData, format, options),
      summary: {
        backupType: 'full',
        workflowCount: backup.workflows.length,
        nodeTypeCount: backup.nodeDiscovery?.catalog?.totalNodes || 0,
        format,
        size: JSON.stringify(exportData).length
      },
      timestamp: new Date().toISOString()
    };
  }

  private async exportReport(targets: any, format: string, options: any) {
    const workflows = await this.n8nClient.getWorkflows();
    const executions = await this.n8nClient.getExecutions(undefined, 100);
    const discoveryResult = await this.nodeDiscovery.discoverNodes();

    const report = {
      summary: {
        reportGenerated: new Date().toISOString(),
        reportPeriod: targets.dateRange || { start: 'All time', end: 'Current' },
        totalWorkflows: workflows.length,
        activeWorkflows: workflows.filter((wf: any) => wf.active).length,
        totalExecutions: executions.length,
        nodeTypesAvailable: discoveryResult.statistics.totalDiscovered
      },
      workflowAnalysis: this.analyzeWorkflows(workflows),
      executionAnalysis: this.analyzeExecutions(executions, targets.dateRange),
      nodeAnalysis: this.analyzeNodes(discoveryResult),
      performance: await this.analyzePerformance(executions),
      recommendations: this.generateRecommendations(workflows, executions, discoveryResult)
    };

    const exportData = {
      metadata: {
        exportType: 'report',
        format,
        timestamp: new Date().toISOString(),
        reportOptions: options
      },
      report
    };

    return {
      export: await this.formatOutput(exportData, format, options),
      summary: {
        reportType: 'comprehensive',
        sectionsGenerated: Object.keys(report).length,
        format,
        size: JSON.stringify(exportData).length
      },
      timestamp: new Date().toISOString()
    };
  }

  private async exportDocumentation(targets: any, format: string, options: any) {
    const workflows = await this.n8nClient.getWorkflows();
    const discoveryResult = await this.nodeDiscovery.discoverNodes();

    let targetWorkflows = workflows;
    if (targets.workflowIds) {
      targetWorkflows = workflows.filter((wf: any) => targets.workflowIds.includes(wf.id));
    }

    const documentation = {
      overview: {
        title: 'n8n Workflow Documentation',
        generated: new Date().toISOString(),
        workflowCount: targetWorkflows.length,
        scope: targets.workflowIds ? 'Selected Workflows' : 'All Workflows'
      },
      workflows: await Promise.all(
        targetWorkflows.map(async (workflow: any) => {
          const full = await this.n8nClient.getWorkflow(workflow.id);
          return this.generateWorkflowDocumentation(full, discoveryResult);
        })
      ),
      nodeReference: this.generateNodeReference(discoveryResult),
      appendix: {
        nodeTypes: discoveryResult.catalog.coreNodes.concat(discoveryResult.catalog.communityNodes),
        generatedBy: 'n8n MCP Server Export Tool'
      }
    };

    const exportData = {
      metadata: {
        exportType: 'documentation',
        format,
        timestamp: new Date().toISOString(),
        documentationOptions: options
      },
      documentation
    };

    return {
      export: await this.formatOutput(exportData, format, options),
      summary: {
        documentationType: 'workflow_documentation',
        workflowsDocumented: targetWorkflows.length,
        format,
        size: JSON.stringify(exportData).length
      },
      timestamp: new Date().toISOString()
    };
  }

  private async processWorkflowForExport(workflow: any, options: any) {
    const processed = DataTransformer.cleanWorkflow(workflow);

    if (options.anonymize) {
      processed.name = `Workflow_${processed.id}`;
      delete processed.notes;
      if (processed.nodes) {
        processed.nodes.forEach((node: any) => {
          if (node.parameters) {
            this.anonymizeParameters(node.parameters);
          }
        });
      }
    }

    if (!options.includeCredentials && processed.nodes) {
      processed.nodes.forEach((node: any) => {
        if (node.credentials) {
          node.credentials = Object.keys(node.credentials).reduce((acc: any, key: string) => {
            acc[key] = '[CREDENTIAL_REMOVED]';
            return acc;
          }, {});
        }
      });
    }

    if (!options.includeMetadata) {
      delete processed.createdAt;
      delete processed.updatedAt;
      delete processed.versionId;
    }

    return processed;
  }

  private processExecutionForExport(execution: any, options: any) {
    const processed = {
      id: execution.id,
      workflowId: execution.workflowId,
      mode: execution.mode,
      startedAt: execution.startedAt,
      stoppedAt: execution.stoppedAt,
      finished: execution.finished,
      failed: !!(execution.data?.resultData && 'error' in execution.data.resultData),
      duration: execution.stoppedAt ?
        new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime() : null,
      nodeCount: execution.data?.resultData?.runData ?
        Object.keys(execution.data.resultData.runData).length : 0
    };

    if (options.includeExecutionData && execution.data?.resultData?.runData) {
      (processed as any).nodeResults = Object.entries(execution.data.resultData.runData)
        .map(([nodeId, nodeData]: [string, any]) => ({
          nodeId,
          success: !nodeData[0]?.error,
          itemCount: nodeData[0]?.data?.main?.[0]?.length || 0,
          error: nodeData[0]?.error?.message
        }));
    }

    return processed;
  }

  private extractWorkflowData(workflow: any, options: any) {
    return {
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      nodeCount: workflow.nodes?.length || 0,
      tags: workflow.tags?.map((tag: any) => tag.name) || [],
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt
    };
  }

  private extractExecutionData(execution: any, options: any) {
    return {
      id: execution.id,
      workflowId: execution.workflowId,
      startedAt: execution.startedAt,
      finished: execution.finished,
      success: !(execution.data?.resultData && 'error' in execution.data.resultData),
      duration: execution.stoppedAt ?
        new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime() : null
    };
  }

  private extractNodeData(discoveryResult: any, options: any) {
    const allNodes = [...discoveryResult.catalog.coreNodes, ...discoveryResult.catalog.communityNodes];
    return allNodes.map((node: any) => ({
      name: node.name,
      displayName: node.displayName,
      category: node.category,
      isCore: node.isCore,
      usageCount: node.usageCount || 0,
      description: options.includeMetadata ? node.description : undefined
    }));
  }

  private async generateStatistics(data: any) {
    return {
      workflow: {
        total: data.workflows.length,
        active: data.workflows.filter((wf: any) => wf.active).length,
        averageNodes: data.workflows.reduce((sum: number, wf: any) => sum + wf.nodeCount, 0) / data.workflows.length
      },
      execution: {
        total: data.executions.length,
        successful: data.executions.filter((exec: any) => exec.success).length,
        averageDuration: data.executions
          .filter((exec: any) => exec.duration)
          .reduce((sum: number, exec: any) => sum + exec.duration, 0) / data.executions.length
      },
      nodes: {
        total: data.nodes.length,
        core: data.nodes.filter((node: any) => node.isCore).length,
        community: data.nodes.filter((node: any) => !node.isCore).length
      }
    };
  }

  private analyzeWorkflows(workflows: any[]) {
    const nodeTypeUsage: Record<string, number> = {};
    let totalNodes = 0;

    workflows.forEach(workflow => {
      if (workflow.nodes) {
        totalNodes += workflow.nodes.length;
        workflow.nodes.forEach((node: any) => {
          nodeTypeUsage[node.type] = (nodeTypeUsage[node.type] || 0) + 1;
        });
      }
    });

    return {
      totalWorkflows: workflows.length,
      activeWorkflows: workflows.filter(wf => wf.active).length,
      averageNodesPerWorkflow: workflows.length > 0 ? totalNodes / workflows.length : 0,
      mostUsedNodeTypes: Object.entries(nodeTypeUsage)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([type, count]) => ({ type, count }))
    };
  }

  private analyzeExecutions(executions: any[], dateRange?: any) {
    const now = new Date();
    const last24h = executions.filter(exec =>
      new Date(exec.startedAt) > new Date(now.getTime() - 24 * 60 * 60 * 1000)
    );

    return {
      total: executions.length,
      successful: executions.filter(exec => !(exec.data?.resultData && 'error' in exec.data.resultData)).length,
      failed: executions.filter(exec => exec.data?.resultData && 'error' in exec.data.resultData).length,
      last24Hours: last24h.length,
      averageDuration: executions
        .filter(exec => exec.stoppedAt)
        .reduce((sum, exec) => {
          const duration = new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime();
          return sum + duration;
        }, 0) / executions.length || 0
    };
  }

  private analyzeNodes(discoveryResult: any) {
    return {
      totalAvailable: discoveryResult.statistics.totalDiscovered,
      core: discoveryResult.catalog.coreNodes.length,
      community: discoveryResult.catalog.communityNodes.length,
      categories: discoveryResult.statistics.categoriesFound,
      mostUsed: discoveryResult.statistics.mostUsedNode
    };
  }

  private async analyzePerformance(executions: any[]) {
    const durations = executions
      .filter(exec => exec.stoppedAt)
      .map(exec => new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime());

    return {
      averageExecutionTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      fastestExecution: durations.length > 0 ? Math.min(...durations) : 0,
      slowestExecution: durations.length > 0 ? Math.max(...durations) : 0,
      totalExecutions: executions.length,
      successRate: executions.length > 0 ?
        (executions.filter(exec => !(exec.data?.resultData && 'error' in exec.data.resultData)).length / executions.length) * 100 : 0
    };
  }

  private generateRecommendations(workflows: any[], executions: any[], discoveryResult: any) {
    const recommendations = [];

    if (workflows.filter(wf => wf.active).length / workflows.length < 0.5) {
      recommendations.push('Consider reviewing inactive workflows - many workflows are not currently active');
    }

    const failureRate = executions.filter(exec => exec.data?.resultData && 'error' in exec.data.resultData).length / executions.length;
    if (failureRate > 0.1) {
      recommendations.push('High execution failure rate detected - review and fix failing workflows');
    }

    if (discoveryResult.catalog.communityNodes.length === 0) {
      recommendations.push('Consider installing community nodes to expand automation capabilities');
    }

    return recommendations;
  }

  private generateWorkflowDocumentation(workflow: any, discoveryResult: any) {
    const allNodes = [...discoveryResult.catalog.coreNodes, ...discoveryResult.catalog.communityNodes];

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.notes || 'No description provided',
      active: workflow.active,
      nodeCount: workflow.nodes?.length || 0,
      nodes: workflow.nodes?.map((node: any) => {
        const nodeType = allNodes.find((nt: any) => nt.name === node.type);
        return {
          name: node.name,
          type: node.type,
          description: nodeType?.description || 'Unknown node type',
          category: nodeType?.category || 'Unknown',
          position: node.position
        };
      }) || [],
      tags: workflow.tags?.map((tag: any) => tag.name) || [],
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt
    };
  }

  private generateNodeReference(discoveryResult: any) {
    const categories = Object.entries(discoveryResult.catalog.categories || {})
      .map(([category, nodes]: [string, any]) => ({
        name: category,
        nodeCount: nodes.length,
        nodes: nodes.slice(0, 5).map((node: any) => ({
          name: node.name,
          displayName: node.displayName,
          description: node.description
        }))
      }));

    return {
      totalNodes: discoveryResult.statistics.totalDiscovered,
      categories
    };
  }

  private async formatOutput(data: any, format: string, options: any) {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(data, null, options.compress ? 0 : 2);

      case 'yaml':
        // Simple YAML-like format (would need yaml library for full YAML)
        return this.toYamlLike(data);

      case 'csv':
        if (data.workflows) {
          return this.toCsv(data.workflows, 'workflows');
        } else if (data.executions) {
          return this.toCsv(data.executions, 'executions');
        }
        return this.toCsv([data], 'data');

      case 'markdown':
        return this.toMarkdown(data);

      case 'html':
        return this.toHtml(data);

      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private toYamlLike(obj: any, indent = 0): string {
    const spaces = '  '.repeat(indent);
    if (Array.isArray(obj)) {
      return obj.map(item => `${spaces}- ${this.toYamlLike(item, indent + 1)}`).join('\n');
    } else if (obj && typeof obj === 'object') {
      return Object.entries(obj)
        .map(([key, value]) => `${spaces}${key}: ${this.toYamlLike(value, indent + 1)}`)
        .join('\n');
    }
    return String(obj);
  }

  private toCsv(data: any[], type: string): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(item =>
      headers.map(header => {
        const value = item[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return String(value || '');
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  private toMarkdown(data: any): string {
    let md = `# n8n Export Report\n\n`;
    md += `Generated: ${new Date().toISOString()}\n\n`;

    if (data.metadata) {
      md += `## Export Information\n`;
      md += `- Type: ${data.metadata.exportType}\n`;
      md += `- Format: ${data.metadata.format}\n`;
      md += `- Timestamp: ${data.metadata.timestamp}\n\n`;
    }

    if (data.workflows) {
      md += `## Workflows (${data.workflows.length})\n\n`;
      data.workflows.slice(0, 10).forEach((workflow: any) => {
        md += `### ${workflow.name}\n`;
        md += `- ID: ${workflow.id}\n`;
        md += `- Active: ${workflow.active ? 'Yes' : 'No'}\n`;
        md += `- Nodes: ${workflow.nodes?.length || 0}\n\n`;
      });
    }

    return md;
  }

  private toHtml(data: any): string {
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>n8n Export Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .section { margin: 20px 0; }
    </style>
</head>
<body>
    <h1>n8n Export Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
`;

    if (data.workflows) {
      html += `
    <div class="section">
        <h2>Workflows (${data.workflows.length})</h2>
        <table>
            <tr><th>Name</th><th>ID</th><th>Active</th><th>Nodes</th></tr>
`;
      data.workflows.slice(0, 20).forEach((workflow: any) => {
        html += `
            <tr>
                <td>${workflow.name}</td>
                <td>${workflow.id}</td>
                <td>${workflow.active ? 'Yes' : 'No'}</td>
                <td>${workflow.nodes?.length || 0}</td>
            </tr>`;
      });
      html += `
        </table>
    </div>`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  private applyWorkflowFilters(workflows: any[], filter: any) {
    return workflows.filter(workflow => {
      if (filter.tags && filter.tags.length > 0) {
        const workflowTags = workflow.tags?.map((tag: any) => tag.name) || [];
        if (!filter.tags.some((tag: string) => workflowTags.includes(tag))) {
          return false;
        }
      }

      if (filter.status) {
        if (filter.status === 'active' && !workflow.active) return false;
        if (filter.status === 'inactive' && workflow.active) return false;
      }

      if (!filter.includeInactive && !workflow.active) {
        return false;
      }

      return true;
    });
  }

  private applyDateRangeFilter(executions: any[], dateRange: any) {
    if (!dateRange.start && !dateRange.end) return executions;

    return executions.filter(execution => {
      const execDate = new Date(execution.startedAt);
      if (dateRange.start && execDate < new Date(dateRange.start)) return false;
      if (dateRange.end && execDate > new Date(dateRange.end)) return false;
      return true;
    });
  }

  private anonymizeParameters(parameters: any) {
    Object.keys(parameters).forEach(key => {
      if (typeof parameters[key] === 'string') {
        if (key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('password')) {
          parameters[key] = '[REDACTED]';
        } else if (parameters[key].includes('@')) {
          parameters[key] = '[EMAIL_REDACTED]';
        } else if (parameters[key].match(/https?:\/\//)) {
          parameters[key] = '[URL_REDACTED]';
        }
      }
    });
  }

  private async getN8nVersion(): Promise<string> {
    try {
      const health = await this.n8nClient.validateConnection();
      return health.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async getServerInfo(): Promise<any> {
    try {
      const health = await this.n8nClient.validateConnection();
      return {
        version: health.version,
        connected: health.valid,
        responseTime: (health as any).responseTime || 0
      };
    } catch {
      return { version: 'unknown', connected: false };
    }
  }
}