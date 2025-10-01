import { ListResourcesRequest, ReadResourceRequest, Resource } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../n8nClient.js';
import { NodeDiscoveryService } from '../nodeDiscovery.js';

export class WorkflowResources {
  constructor(
    private n8nClient: N8nApiClient,
    private nodeDiscovery: NodeDiscoveryService
  ) {}

  async listResources(request: ListResourcesRequest): Promise<Resource[]> {
    const resources: Resource[] = [
      {
        uri: 'n8n://workflows',
        name: 'Workflows List',
        description: 'List of all workflows in the n8n instance',
        mimeType: 'application/json',
      },
      {
        uri: 'n8n://nodes',
        name: 'Available Nodes',
        description: 'List of all available n8n nodes including community nodes',
        mimeType: 'application/json',
      },
      {
        uri: 'n8n://executions',
        name: 'Recent Executions',
        description: 'Recent workflow executions and their status',
        mimeType: 'application/json',
      },
      {
        uri: 'n8n://stats',
        name: 'Instance Statistics',
        description: 'Statistics about the n8n instance',
        mimeType: 'application/json',
      },
    ];

    // Add individual workflow resources
    try {
      const workflows = await this.n8nClient.getWorkflows();
      for (const workflow of workflows) {
        resources.push({
          uri: `n8n://workflow/${workflow.id}`,
          name: `Workflow: ${workflow.name}`,
          description: `Detailed information about workflow "${workflow.name}"`,
          mimeType: 'application/json',
        });
      }
    } catch (error) {
      console.error('Failed to load workflows for resource list:', error);
    }

    // Add node category resources
    try {
      await this.nodeDiscovery.discoverNodes();
      const categories = this.nodeDiscovery.getNodesByCategory();
      for (const category of Object.keys(categories)) {
        resources.push({
          uri: `n8n://nodes/category/${encodeURIComponent(category)}`,
          name: `Nodes: ${category}`,
          description: `All nodes in the ${category} category`,
          mimeType: 'application/json',
        });
      }
    } catch (error) {
      console.error('Failed to load node categories for resource list:', error);
    }

    return resources;
  }

  async readResource(request: ReadResourceRequest): Promise<any> {
    const { uri } = request.params;

    if (uri.startsWith('n8n://workflow/')) {
      return await this.readWorkflowResource(uri);
    }

    if (uri.startsWith('n8n://nodes/category/')) {
      return await this.readNodeCategoryResource(uri);
    }

    switch (uri) {
      case 'n8n://workflows':
        return await this.readWorkflowsResource();

      case 'n8n://nodes':
        return await this.readNodesResource();

      case 'n8n://executions':
        return await this.readExecutionsResource();

      case 'n8n://stats':
        return await this.readStatsResource();

      default:
        throw new Error(`Unknown resource URI: ${uri}`);
    }
  }

  private async readWorkflowsResource() {
    const workflows = await this.n8nClient.getWorkflows();
    
    return {
      contents: [{
        uri: 'n8n://workflows',
        mimeType: 'application/json',
        text: JSON.stringify({
          workflows: workflows.map(wf => ({
            id: wf.id,
            name: wf.name,
            active: wf.active,
            tags: wf.tags,
            nodeCount: wf.nodes?.length || 0,
            createdAt: wf.createdAt,
            updatedAt: wf.updatedAt,
            uri: `n8n://workflow/${wf.id}`,
          })),
          total: workflows.length,
          active: workflows.filter(wf => wf.active).length,
          inactive: workflows.filter(wf => !wf.active).length,
          lastUpdated: new Date().toISOString(),
        }, null, 2),
      }],
    };
  }

  private async readWorkflowResource(uri: string) {
    const workflowId = uri.replace('n8n://workflow/', '');
    const workflow = await this.n8nClient.getWorkflow(workflowId);
    
    // Get recent executions for this workflow
    let recentExecutions: any[] = [];
    try {
      recentExecutions = await this.n8nClient.getExecutions(workflowId, 5);
    } catch (error) {
      console.warn('Failed to load recent executions:', error);
    }

    // Enhance nodes with type information
    const nodeTypes = await this.nodeDiscovery.discoverNodes();
    const enhancedNodes = workflow.nodes?.map(node => {
      const nodeType = nodeTypes.find(nt => nt.name === node.type);
      return {
        ...node,
        typeInfo: nodeType ? {
          displayName: nodeType.displayName,
          description: nodeType.description,
          category: nodeType.category,
          isCustom: nodeType.isCustom,
          version: nodeType.version,
        } : { displayName: node.type, description: 'Unknown node type' },
      };
    });

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          workflow: {
            ...workflow,
            nodes: enhancedNodes,
          },
          statistics: {
            nodeCount: workflow.nodes?.length || 0,
            connectionCount: Object.keys(workflow.connections || {}).length,
            customNodeCount: enhancedNodes?.filter(n => n.typeInfo?.isCustom).length || 0,
            coreNodeCount: enhancedNodes?.filter(n => !n.typeInfo?.isCustom).length || 0,
          },
          recentExecutions: recentExecutions.map(exec => ({
            id: exec.id,
            status: exec.finished ? 'completed' : 'running',
            startedAt: exec.startedAt,
            stoppedAt: exec.stoppedAt,
            mode: exec.mode,
          })),
          lastUpdated: new Date().toISOString(),
        }, null, 2),
      }],
    };
  }

  private async readNodesResource() {
    const nodes = await this.nodeDiscovery.discoverNodes();
    const stats = this.nodeDiscovery.getDiscoveryStats();
    const categories = this.nodeDiscovery.getNodesByCategory();
    
    return {
      contents: [{
        uri: 'n8n://nodes',
        mimeType: 'application/json',
        text: JSON.stringify({
          nodes: nodes.map(node => ({
            name: node.name,
            displayName: node.displayName,
            description: node.description,
            category: node.category,
            version: node.version,
            isCustom: node.isCustom,
            packageName: node.packageName,
            parameterCount: node.parameters.length,
            credentialCount: node.credentials.length,
          })),
          statistics: stats,
          categories: Object.keys(categories).map(cat => ({
            name: cat,
            nodeCount: categories[cat]!.length,
            uri: `n8n://nodes/category/${encodeURIComponent(cat)}`,
          })),
          communityNodes: this.nodeDiscovery.getCommunityNodes().map(node => ({
            name: node.name,
            displayName: node.displayName,
            packageName: node.packageName,
            category: node.category,
          })),
          lastUpdated: new Date().toISOString(),
        }, null, 2),
      }],
    };
  }

  private async readNodeCategoryResource(uri: string) {
    const category = decodeURIComponent(uri.replace('n8n://nodes/category/', ''));
    await this.nodeDiscovery.discoverNodes();
    const categories = this.nodeDiscovery.getNodesByCategory();
    const categoryNodes = categories[category] || [];
    
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          category,
          nodes: categoryNodes.map(node => ({
            name: node.name,
            displayName: node.displayName,
            description: node.description,
            version: node.version,
            isCustom: node.isCustom,
            packageName: node.packageName,
            parameters: node.parameters.map(p => ({
              name: p.name,
              displayName: p.displayName,
              type: p.type,
              required: p.required,
              description: p.description,
            })),
            credentials: node.credentials,
            inputs: node.inputs,
            outputs: node.outputs,
          })),
          total: categoryNodes.length,
          lastUpdated: new Date().toISOString(),
        }, null, 2),
      }],
    };
  }

  private async readExecutionsResource() {
    const executions = await this.n8nClient.getExecutions(undefined, 50);
    
    // Group by status
    const byStatus = executions.reduce((acc, exec) => {
      const status = exec.finished ? 'completed' : 'running';
      if (!acc[status]) acc[status] = [];
      acc[status].push(exec);
      return acc;
    }, {} as Record<string, any[]>);

    // Group by workflow
    const byWorkflow = executions.reduce((acc, exec) => {
      const workflowId = exec.workflowData?.id || 'unknown';
      if (!acc[workflowId]) {
        acc[workflowId] = {
          workflowName: exec.workflowData?.name || 'Unknown',
          executions: [],
        };
      }
      acc[workflowId].executions.push(exec);
      return acc;
    }, {} as Record<string, any>);

    return {
      contents: [{
        uri: 'n8n://executions',
        mimeType: 'application/json',
        text: JSON.stringify({
          executions: executions.map(exec => ({
            id: exec.id,
            workflowId: exec.workflowData?.id,
            workflowName: exec.workflowData?.name,
            status: exec.finished ? 'completed' : 'running',
            startedAt: exec.startedAt,
            stoppedAt: exec.stoppedAt,
            duration: exec.stoppedAt && exec.startedAt 
              ? new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime()
              : null,
            mode: exec.mode,
          })),
          summary: {
            total: executions.length,
            completed: byStatus.completed?.length || 0,
            running: byStatus.running?.length || 0,
            byWorkflow: Object.entries(byWorkflow).map(([id, data]: [string, any]) => ({
              workflowId: id,
              workflowName: data.workflowName,
              executionCount: data.executions.length,
            })),
          },
          lastUpdated: new Date().toISOString(),
        }, null, 2),
      }],
    };
  }

  private async readStatsResource() {
    try {
      const [workflows, executions, nodeStats] = await Promise.all([
        this.n8nClient.getWorkflows(),
        this.n8nClient.getExecutions(undefined, 100),
        this.nodeDiscovery.getDiscoveryStats(),
      ]);

      const connectionStatus = await this.n8nClient.validateConnection();
      
      // Calculate execution statistics
      const now = Date.now();
      const last24h = executions.filter(exec => 
        new Date(exec.startedAt).getTime() > now - (24 * 60 * 60 * 1000)
      );
      const last7d = executions.filter(exec => 
        new Date(exec.startedAt).getTime() > now - (7 * 24 * 60 * 60 * 1000)
      );

      return {
        contents: [{
          uri: 'n8n://stats',
          mimeType: 'application/json',
          text: JSON.stringify({
            instance: {
              connected: connectionStatus.valid,
              version: connectionStatus.version,
            },
            workflows: {
              total: workflows.length,
              active: workflows.filter(wf => wf.active).length,
              inactive: workflows.filter(wf => !wf.active).length,
              withTags: workflows.filter(wf => wf.tags && wf.tags.length > 0).length,
            },
            executions: {
              total: executions.length,
              completed: executions.filter(exec => exec.finished).length,
              running: executions.filter(exec => !exec.finished).length,
              last24h: last24h.length,
              last7d: last7d.length,
            },
            nodes: {
              total: nodeStats.total,
              core: nodeStats.coreNodes,
              community: nodeStats.communityNodes,
              categories: nodeStats.categories.length,
            },
            performance: {
              cacheStats: this.n8nClient.getCacheStats(),
              discoveryLastRun: nodeStats.lastDiscovery,
            },
            lastUpdated: new Date().toISOString(),
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        contents: [{
          uri: 'n8n://stats',
          mimeType: 'application/json',
          text: JSON.stringify({
            error: 'Failed to gather statistics',
            message: error instanceof Error ? error.message : 'Unknown error',
            lastUpdated: new Date().toISOString(),
          }, null, 2),
        }],
      };
    }
  }
}