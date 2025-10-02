import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { EnhancedNodeDiscovery } from '../../discovery/EnhancedNodeDiscovery.js';

export class N8nSearchTool {
  constructor(
    private n8nClient: N8nApiClient,
    private nodeDiscovery: EnhancedNodeDiscovery
  ) {}

  getTool(): Tool {
    return {
      name: 'n8n_search',
      description: 'Unified search across workflows, nodes, executions, and configurations',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query string'
          },
          type: {
            type: 'string',
            enum: ['all', 'workflows', 'nodes', 'executions', 'node-types'],
            description: 'Type of entities to search',
            default: 'all'
          },
          scope: {
            type: 'string',
            enum: ['names', 'descriptions', 'parameters', 'content', 'all'],
            description: 'Search scope within entities',
            default: 'all'
          },
          limit: {
            type: 'number',
            description: 'Maximum results per category',
            default: 20
          },
          includeInactive: {
            type: 'boolean',
            description: 'Include inactive workflows in search',
            default: true
          },
          fuzzy: {
            type: 'boolean',
            description: 'Enable fuzzy matching',
            default: true
          }
        },
        required: ['query']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<any> {
    const { query, type = 'all', scope = 'all', limit = 20, includeInactive = true, fuzzy = true } = request.params as any;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Search query is required and must be a non-empty string');
    }

    try {
      const results: any = {
        query: query.trim(),
        type,
        scope,
        totalResults: 0,
        categories: {}
      };

      const searchQuery = query.trim().toLowerCase();

      if (type === 'all' || type === 'workflows') {
        results.categories.workflows = await this.searchWorkflows(searchQuery, scope, limit, includeInactive, fuzzy);
        results.totalResults += results.categories.workflows.length;
      }

      if (type === 'all' || type === 'nodes') {
        results.categories.nodes = await this.searchWorkflowNodes(searchQuery, scope, limit, fuzzy);
        results.totalResults += results.categories.nodes.length;
      }

      if (type === 'all' || type === 'node-types') {
        results.categories.nodeTypes = await this.searchNodeTypes(searchQuery, scope, limit, fuzzy);
        results.totalResults += results.categories.nodeTypes.length;
      }

      if (type === 'all' || type === 'executions') {
        results.categories.executions = await this.searchExecutions(searchQuery, limit);
        results.totalResults += results.categories.executions.length;
      }

      return {
        success: true,
        ...results,
        message: `Found ${results.totalResults} results for "${query}"`
      };

    } catch (error: any) {
      return {
        error: true,
        message: error?.message || 'Search failed',
        query
      };
    }
  }

  private async searchWorkflows(query: string, scope: string, limit: number, includeInactive: boolean, fuzzy: boolean) {
    const workflows = await this.n8nClient.getWorkflows();
    const results = [];

    for (const workflow of workflows) {
      if (!includeInactive && !workflow.active) {
        continue;
      }

      let relevanceScore = 0;
      const matches = [];

      // Search in name
      if (scope === 'all' || scope === 'names') {
        const nameScore = this.calculateRelevance(workflow.name, query, fuzzy);
        if (nameScore > 0) {
          relevanceScore += nameScore * 2; // Name matches are more important
          matches.push({ field: 'name', value: workflow.name, score: nameScore });
        }
      }

      // Search in tags
      if (scope === 'all' || scope === 'content') {
        if (workflow.tags) {
          for (const tag of workflow.tags) {
            const tagScore = this.calculateRelevance(tag, query, fuzzy);
            if (tagScore > 0) {
              relevanceScore += tagScore;
              matches.push({ field: 'tag', value: tag, score: tagScore });
            }
          }
        }
      }

      // Search in node names and parameters
      if (scope === 'all' || scope === 'content' || scope === 'parameters') {
        if (workflow.nodes) {
          for (const node of workflow.nodes) {
            const nodeNameScore = this.calculateRelevance(node.name, query, fuzzy);
            if (nodeNameScore > 0) {
              relevanceScore += nodeNameScore * 0.5;
              matches.push({ field: 'node.name', value: node.name, score: nodeNameScore });
            }

            // Search in node parameters
            if (scope === 'all' || scope === 'parameters') {
              const parameterText = JSON.stringify(node.parameters || {}).toLowerCase();
              if (parameterText.includes(query)) {
                relevanceScore += 10;
                matches.push({ field: 'node.parameters', value: 'Parameter match', score: 10 });
              }
            }
          }
        }
      }

      if (relevanceScore > 0) {
        results.push({
          id: workflow.id,
          name: workflow.name,
          active: workflow.active,
          nodeCount: workflow.nodes?.length || 0,
          tags: workflow.tags || [],
          relevanceScore,
          matches,
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt
        });
      }
    }

    // Sort by relevance and limit results
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  private async searchWorkflowNodes(query: string, scope: string, limit: number, fuzzy: boolean) {
    const workflows = await this.n8nClient.getWorkflows();
    const results = [];

    for (const workflow of workflows) {
      if (!workflow.nodes) continue;

      for (const node of workflow.nodes) {
        let relevanceScore = 0;
        const matches = [];

        // Search in node name
        if (scope === 'all' || scope === 'names') {
          const nameScore = this.calculateRelevance(node.name, query, fuzzy);
          if (nameScore > 0) {
            relevanceScore += nameScore * 2;
            matches.push({ field: 'name', value: node.name, score: nameScore });
          }
        }

        // Search in node type
        if (scope === 'all' || scope === 'content') {
          const typeScore = this.calculateRelevance(node.type, query, fuzzy);
          if (typeScore > 0) {
            relevanceScore += typeScore;
            matches.push({ field: 'type', value: node.type, score: typeScore });
          }
        }

        // Search in parameters
        if (scope === 'all' || scope === 'parameters') {
          const parameterText = JSON.stringify(node.parameters || {}).toLowerCase();
          if (parameterText.includes(query)) {
            relevanceScore += 15;
            matches.push({ field: 'parameters', value: 'Parameter match', score: 15 });
          }
        }

        if (relevanceScore > 0) {
          results.push({
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            workflowId: workflow.id,
            workflowName: workflow.name,
            workflowActive: workflow.active,
            position: node.position,
            relevanceScore,
            matches
          });
        }
      }
    }

    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  private async searchNodeTypes(query: string, scope: string, limit: number, fuzzy: boolean) {
    // Discover nodes if not already done
    await this.nodeDiscovery.discoverNodes();

    const nodeTypes = this.nodeDiscovery.searchNodes(query);

    return nodeTypes.slice(0, limit).map(node => ({
      type: node.type,
      displayName: node.displayName,
      category: node.category,
      description: node.description,
      isCore: node.isCore,
      packageName: node.packageName,
      usageCount: node.usageCount,
      relevanceScore: this.calculateNodeTypeRelevance(node, query, fuzzy)
    }));
  }

  private async searchExecutions(query: string, limit: number) {
    const workflows = await this.n8nClient.getWorkflows();
    const results = [];

    // Search in execution data is limited - mainly by workflow name/ID
    for (const workflow of workflows.slice(0, 10)) { // Limit to prevent too many API calls
      if (this.calculateRelevance(workflow.name, query, false) === 0 &&
          workflow.id !== query) {
        continue;
      }

      try {
        const executions = await this.n8nClient.getExecutions(workflow.id);
        for (const execution of executions.slice(0, 5)) {
          results.push({
            executionId: execution.id,
            workflowId: workflow.id,
            workflowName: workflow.name,
            finished: execution.finished,
            mode: execution.mode,
            startedAt: execution.startedAt,
            stoppedAt: execution.stoppedAt
          });
        }
      } catch {
        // Continue if execution fetch fails
      }
    }

    return results.slice(0, limit);
  }

  private calculateRelevance(text: string, query: string, fuzzy: boolean): number {
    if (!text || !query) return 0;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact match
    if (lowerText === lowerQuery) return 100;

    // Starts with
    if (lowerText.startsWith(lowerQuery)) return 80;

    // Contains whole word
    if (lowerText.includes(lowerQuery)) return 60;

    // Fuzzy matching
    if (fuzzy) {
      // Simple fuzzy: check if most characters are present
      const queryChars = lowerQuery.split('');
      const matchedChars = queryChars.filter(char => lowerText.includes(char));
      const fuzzyScore = (matchedChars.length / queryChars.length) * 30;

      if (fuzzyScore > 15) return Math.floor(fuzzyScore);
    }

    return 0;
  }

  private calculateNodeTypeRelevance(node: any, query: string, fuzzy: boolean): number {
    let score = 0;

    score += this.calculateRelevance(node.displayName, query, fuzzy) * 2;
    score += this.calculateRelevance(node.type, query, fuzzy);
    score += this.calculateRelevance(node.category, query, fuzzy) * 0.5;
    score += this.calculateRelevance(node.description, query, fuzzy) * 0.3;

    // Boost score based on usage
    score += Math.min(node.usageCount * 2, 20);

    return Math.floor(score);
  }
}