import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../n8nClient.js';
import { NodeDiscoveryService } from '../nodeDiscovery.js';

export class NodeTools {
  constructor(
    private n8nClient: N8nApiClient,
    private nodeDiscovery: NodeDiscoveryService
  ) {}

  getTools(): Tool[] {
    return [
      {
        name: 'discover_nodes',
        description: 'Discover all available n8n nodes including community nodes',
        inputSchema: {
          type: 'object',
          properties: {
            forceRefresh: {
              type: 'boolean',
              description: 'Force refresh of node discovery cache',
              default: false,
            },
          },
        },
      },
      {
        name: 'get_node_info',
        description: 'Get detailed information about a specific node type',
        inputSchema: {
          type: 'object',
          properties: {
            nodeName: {
              type: 'string',
              description: 'The exact node type name',
            },
          },
          required: ['nodeName'],
        },
      },
      {
        name: 'search_nodes',
        description: 'Search for nodes by name, description, or functionality',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for node name or description',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_nodes_by_category',
        description: 'Get all nodes organized by category',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by specific category (optional)',
            },
          },
        },
      },
      {
        name: 'get_community_nodes',
        description: 'Get only community/custom nodes installed in the n8n instance',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_node_documentation',
        description: 'Generate comprehensive documentation for a specific node',
        inputSchema: {
          type: 'object',
          properties: {
            nodeName: {
              type: 'string',
              description: 'The node type name to document',
            },
          },
          required: ['nodeName'],
        },
      },
      {
        name: 'get_discovery_stats',
        description: 'Get statistics about discovered nodes',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'validate_node_config',
        description: 'Validate a node configuration against its schema',
        inputSchema: {
          type: 'object',
          properties: {
            nodeName: {
              type: 'string',
              description: 'The node type name',
            },
            config: {
              type: 'object',
              description: 'The node configuration to validate',
              additionalProperties: true,
            },
          },
          required: ['nodeName', 'config'],
        },
      },
    ];
  }

  async handleToolCall(request: CallToolRequest): Promise<any> {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case 'discover_nodes':
          return await this.discoverNodes(Boolean(args.forceRefresh));

        case 'get_node_info':
          return await this.getNodeInfo(String(args.nodeName || ''));

        case 'search_nodes':
          return await this.searchNodes(String(args.query || ''));

        case 'get_nodes_by_category':
          return await this.getNodesByCategory(args.category ? String(args.category) : undefined);

        case 'get_community_nodes':
          return await this.getCommunityNodes();

        case 'get_node_documentation':
          return await this.getNodeDocumentation(String(args.nodeName || ''));

        case 'get_discovery_stats':
          return await this.getDiscoveryStats();

        case 'validate_node_config':
          return await this.validateNodeConfig(String(args.nodeName || ''), args.config || {});

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return {
        error: true,
        message: error?.message || 'Unknown error occurred',
        tool: name,
      };
    }
  }

  private async discoverNodes(forceRefresh = false) {
    const nodes = await this.nodeDiscovery.discoverNodes(forceRefresh);
    return {
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
      total: nodes.length,
      refreshed: forceRefresh,
    };
  }

  private async getNodeInfo(nodeName: string) {
    await this.nodeDiscovery.discoverNodes();
    const node = this.nodeDiscovery.getNode(nodeName);
    
    if (!node) {
      throw new Error(`Node '${nodeName}' not found`);
    }

    return {
      ...node,
      usageExample: this.generateUsageExample(node),
    };
  }

  private async searchNodes(query: string) {
    await this.nodeDiscovery.discoverNodes();
    const results = this.nodeDiscovery.searchNodes(query);
    
    return {
      query,
      results: results.map(node => ({
        name: node.name,
        displayName: node.displayName,
        description: node.description,
        category: node.category,
        isCustom: node.isCustom,
        relevanceScore: this.calculateRelevance(node, query),
      })),
      total: results.length,
    };
  }

  private async getNodesByCategory(category?: string) {
    await this.nodeDiscovery.discoverNodes();
    const nodesByCategory = this.nodeDiscovery.getNodesByCategory();
    
    if (category) {
      const categoryNodes = nodesByCategory[category] || [];
      return {
        category,
        nodes: categoryNodes,
        total: categoryNodes.length,
      };
    }

    return {
      categories: Object.keys(nodesByCategory).map(cat => ({
        name: cat,
        nodeCount: nodesByCategory[cat]!.length,
        nodes: nodesByCategory[cat]!.slice(0, 5), // Preview first 5 nodes
      })),
      totalCategories: Object.keys(nodesByCategory).length,
    };
  }

  private async getCommunityNodes() {
    await this.nodeDiscovery.discoverNodes();
    const communityNodes = this.nodeDiscovery.getCommunityNodes();
    
    // Group by package
    const byPackage: Record<string, any[]> = {};
    for (const node of communityNodes) {
      const packageName = node.packageName || 'Unknown';
      if (!byPackage[packageName]) {
        byPackage[packageName] = [];
      }
      byPackage[packageName]!.push({
        name: node.name,
        displayName: node.displayName,
        description: node.description,
        category: node.category,
      });
    }

    return {
      nodes: communityNodes.map(node => ({
        name: node.name,
        displayName: node.displayName,
        description: node.description,
        category: node.category,
        packageName: node.packageName,
      })),
      packages: Object.keys(byPackage).map(pkg => ({
        name: pkg,
        nodeCount: byPackage[pkg]!.length,
        nodes: byPackage[pkg]!,
      })),
      total: communityNodes.length,
    };
  }

  private async getNodeDocumentation(nodeName: string) {
    await this.nodeDiscovery.discoverNodes();
    const node = this.nodeDiscovery.getNode(nodeName);
    
    if (!node) {
      throw new Error(`Node '${nodeName}' not found`);
    }

    const documentation = this.nodeDiscovery.generateNodeDocumentation(node);
    
    return {
      nodeName: node.name,
      displayName: node.displayName,
      documentation,
      usageExample: this.generateUsageExample(node),
    };
  }

  private async getDiscoveryStats() {
    await this.nodeDiscovery.discoverNodes();
    const stats = this.nodeDiscovery.getDiscoveryStats();
    
    return {
      ...stats,
      cacheInfo: {
        size: 'N/A', // Could add cache size info from nodeDiscovery
        lastRefresh: stats.lastDiscovery,
      },
    };
  }

  private async validateNodeConfig(nodeName: string, config: any) {
    await this.nodeDiscovery.discoverNodes();
    const node = this.nodeDiscovery.getNode(nodeName);
    
    if (!node) {
      throw new Error(`Node '${nodeName}' not found`);
    }

    const validation = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    // Check required parameters
    for (const param of node.parameters) {
      if (param.required && !(param.name in config)) {
        validation.valid = false;
        validation.errors.push(`Required parameter '${param.name}' is missing`);
      }
    }

    // Check parameter types
    for (const [key, value] of Object.entries(config)) {
      const param = node.parameters.find(p => p.name === key);
      if (!param) {
        validation.warnings.push(`Unknown parameter '${key}'`);
        continue;
      }

      if (!this.validateParameterType(value, param.type)) {
        validation.valid = false;
        validation.errors.push(
          `Parameter '${key}' should be of type '${param.type}', got '${typeof value}'`
        );
      }
    }

    return {
      nodeName,
      config,
      validation,
    };
  }

  private validateParameterType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'options':
      case 'multiOptions':
        return true; // Would need option validation
      case 'collection':
      case 'fixedCollection':
        return typeof value === 'object';
      default:
        return true; // Unknown type, assume valid
    }
  }

  private calculateRelevance(node: any, query: string): number {
    const lowerQuery = query.toLowerCase();
    let score = 0;

    // Exact name match
    if (node.name.toLowerCase() === lowerQuery) score += 100;
    
    // Display name match
    if (node.displayName.toLowerCase().includes(lowerQuery)) score += 50;
    
    // Name contains query
    if (node.name.toLowerCase().includes(lowerQuery)) score += 30;
    
    // Description contains query
    if (node.description.toLowerCase().includes(lowerQuery)) score += 10;
    
    // Category match
    if (node.category.toLowerCase().includes(lowerQuery)) score += 5;

    return score;
  }

  private generateUsageExample(node: any): string {
    const requiredParams = node.parameters.filter((p: any) => p.required);
    const exampleParams: Record<string, any> = {};
    
    for (const param of requiredParams) {
      switch (param.type) {
        case 'string':
          exampleParams[param.name] = `"example_${param.name}"`;
          break;
        case 'number':
          exampleParams[param.name] = 42;
          break;
        case 'boolean':
          exampleParams[param.name] = true;
          break;
        case 'options':
          if (param.options?.length) {
            exampleParams[param.name] = param.options[0].value;
          }
          break;
        default:
          exampleParams[param.name] = param.default;
      }
    }

    return JSON.stringify({
      id: 'example-node-id',
      name: `Example ${node.displayName}`,
      type: node.name,
      typeVersion: node.version,
      position: [250, 300],
      parameters: exampleParams,
    }, null, 2);
  }
}