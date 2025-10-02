import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { EnhancedNodeDiscovery } from '../../discovery/EnhancedNodeDiscovery.js';

export class N8nDiscoverTool {
  constructor(
    private n8nClient: N8nApiClient,
    private nodeDiscovery: EnhancedNodeDiscovery
  ) {}

  getTool(): Tool {
    return {
      name: 'n8n_discover',
      description: 'Universal discovery tool for nodes, workflows, executions, and statistics',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['nodes', 'workflows', 'executions', 'credentials', 'stats', 'health'],
            description: 'Type of discovery to perform'
          },
          category: {
            type: 'string',
            description: 'Filter by category (for nodes)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 50
          },
          forceRefresh: {
            type: 'boolean',
            description: 'Force refresh of cached data',
            default: false
          },
          workflowId: {
            type: 'string',
            description: 'Specific workflow ID (for executions)'
          }
        },
        required: ['type']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<any> {
    const { type, category, limit = 50, forceRefresh = false, workflowId } = request.params as any;

    try {
      switch (type) {
        case 'nodes':
          return await this.discoverNodes(category, limit, forceRefresh);

        case 'workflows':
          return await this.discoverWorkflows(limit);

        case 'executions':
          return await this.discoverExecutions(workflowId, limit);

        case 'credentials':
          return await this.discoverCredentials(limit);

        case 'stats':
          return await this.discoverStats();

        case 'health':
          return await this.discoverHealth();

        default:
          throw new Error(`Unknown discovery type: ${type}`);
      }
    } catch (error: any) {
      return {
        error: true,
        message: error?.message || 'Discovery failed',
        type
      };
    }
  }

  private async discoverNodes(category?: string, limit = 50, forceRefresh = false) {
    const result = await this.nodeDiscovery.discoverNodes({ forceRefresh });

    let nodes = [...result.catalog.coreNodes, ...result.catalog.communityNodes];

    if (category) {
      nodes = this.nodeDiscovery.getNodesByCategory(category) as any[];
    }

    return {
      type: 'nodes',
      total: nodes.length,
      nodes: nodes.slice(0, limit).map(node => ({
        name: node.type,
        displayName: node.displayName,
        category: node.category,
        description: node.description,
        isCore: node.isCore,
        packageName: node.packageName,
        usageCount: node.usageCount,
        hasCredentials: node.credentials ? Object.keys(node.credentials).length > 0 : false,
        exampleConfigCount: node.exampleConfigs.length
      })),
      categories: Object.keys(result.catalog.categories),
      statistics: result.statistics,
      sources: result.sources
    };
  }

  private async discoverWorkflows(limit = 50) {
    const workflows = await this.n8nClient.getWorkflows();

    return {
      type: 'workflows',
      total: workflows.length,
      workflows: workflows.slice(0, limit).map(wf => ({
        id: wf.id,
        name: wf.name,
        active: wf.active,
        nodeCount: wf.nodes?.length || 0,
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
        hasConnections: wf.connections && Object.keys(wf.connections).length > 0,
        hasNodes: wf.nodes && wf.nodes.length > 0
      })),
      activeCount: workflows.filter(wf => wf.active).length,
      inactiveCount: workflows.filter(wf => !wf.active).length
    };
  }

  private async discoverExecutions(workflowId?: string, limit = 50) {
    if (workflowId) {
      const executions = await this.n8nClient.getExecutions(workflowId);
      return {
        type: 'executions',
        workflowId,
        total: executions.length,
        executions: executions.slice(0, limit).map(exec => ({
          id: exec.id,
          finished: exec.finished,
          startedAt: exec.startedAt,
          stoppedAt: exec.stoppedAt,
          workflowData: exec.workflowData?.name || 'Unknown',
          mode: exec.mode
        }))
      };
    } else {
      // Get recent executions across all workflows
      const workflows = await this.n8nClient.getWorkflows();
      const allExecutions = [];

      for (const workflow of workflows.slice(0, 10)) { // Limit to first 10 workflows
        try {
          const executions = await this.n8nClient.getExecutions(workflow.id);
          allExecutions.push(...executions.slice(0, 5)); // 5 per workflow
        } catch (error) {
          // Continue if execution fetch fails for a workflow
        }
      }

      return {
        type: 'executions',
        total: allExecutions.length,
        executions: allExecutions.slice(0, limit).map(exec => ({
          id: exec.id,
          finished: exec.finished,
          startedAt: exec.startedAt,
          stoppedAt: exec.stoppedAt,
          workflowData: exec.workflowData?.name || 'Unknown',
          mode: exec.mode
        })),
        workflowsCovered: Math.min(10, workflows.length)
      };
    }
  }

  private async discoverCredentials(limit = 50) {
    try {
      const credentials = await this.n8nClient.getCredentials();

      return {
        type: 'credentials',
        total: credentials.length,
        credentials: credentials.slice(0, limit).map(cred => ({
          id: cred.id,
          name: cred.name,
          type: cred.type,
          hasData: !!cred.data
        }))
      };
    } catch (error) {
      return {
        type: 'credentials',
        total: 0,
        credentials: [],
        error: 'Unable to fetch credentials (may require special permissions)'
      };
    }
  }

  private async discoverStats() {
    const [workflows, nodeDiscovery] = await Promise.all([
      this.n8nClient.getWorkflows(),
      this.nodeDiscovery.discoverNodes()
    ]);

    const activeWorkflows = workflows.filter(wf => wf.active).length;
    const totalNodes = workflows.reduce((sum, wf) => sum + (wf.nodes?.length || 0), 0);

    return {
      type: 'stats',
      workflows: {
        total: workflows.length,
        active: activeWorkflows,
        inactive: workflows.length - activeWorkflows
      },
      nodes: {
        totalInWorkflows: totalNodes,
        uniqueTypesAvailable: nodeDiscovery.statistics.totalDiscovered,
        coreNodes: nodeDiscovery.catalog.coreNodes.length,
        communityNodes: nodeDiscovery.catalog.communityNodes.length,
        categories: nodeDiscovery.statistics.categoriesFound
      },
      discovery: {
        sources: nodeDiscovery.sources,
        lastUpdated: nodeDiscovery.catalog.lastUpdated,
        mostUsedNode: nodeDiscovery.statistics.mostUsedNode
      }
    };
  }

  private async discoverHealth() {
    const isHealthy = await this.n8nClient.healthCheck();

    return {
      type: 'health',
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      details: {
        apiAccessible: isHealthy,
        baseUrl: process.env.N8N_BASE_URL,
        hasApiKey: !!process.env.N8N_API_KEY
      }
    };
  }
}