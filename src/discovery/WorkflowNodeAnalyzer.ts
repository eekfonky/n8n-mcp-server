/**
 * WorkflowNodeAnalyzer - Discovers all available nodes by analyzing existing workflows
 * This provides complete node discovery even when API endpoints are limited
 */

import { N8nApiClient } from '../n8nClient.js';
import { N8nWorkflow, N8nNode } from '../types.js';

export interface DiscoveredNodeType {
  name: string;
  displayName: string;
  type: string;
  typeVersion: number;
  category: string;
  description: string;
  parameters: Record<string, any>;
  credentials?: Record<string, string> | undefined;
  usageCount: number;
  exampleConfigs: any[];
  isCore: boolean;
  packageName?: string | undefined;
}

export interface NodeCatalog {
  totalNodes: number;
  coreNodes: DiscoveredNodeType[];
  communityNodes: DiscoveredNodeType[];
  categories: Record<string, DiscoveredNodeType[]>;
  mostUsed: DiscoveredNodeType[];
  lastUpdated: Date;
}

export class WorkflowNodeAnalyzer {
  private nodeMap = new Map<string, DiscoveredNodeType>();
  private catalog: NodeCatalog | null = null;

  constructor(private n8nClient: N8nApiClient) {}

  /**
   * Analyze all workflows to discover available nodes
   */
  async discoverNodesFromWorkflows(): Promise<NodeCatalog> {
    console.error('[Analyzer] Discovering nodes from existing workflows...');

    try {
      // Get all workflows
      const workflows = await this.n8nClient.getWorkflows();
      console.error(`[Analyzer] Found ${workflows.length} workflows to analyze`);

      // Clear previous discovery
      this.nodeMap.clear();

      // Analyze each workflow
      for (const workflow of workflows) {
        try {
          const fullWorkflow = await this.n8nClient.getWorkflow(workflow.id);
          this.analyzeWorkflowNodes(fullWorkflow);
        } catch (error) {
          console.error(`[Analyzer] Failed to analyze workflow ${workflow.id}:`, error);
        }
      }

      // Build the catalog
      this.catalog = this.buildCatalog();

      console.error(`[Analyzer] Discovered ${this.catalog.totalNodes} unique node types`);
      return this.catalog;

    } catch (error) {
      console.error('Failed to discover nodes from workflows:', error);
      throw error;
    }
  }

  /**
   * Analyze a single workflow for node types
   */
  private analyzeWorkflowNodes(workflow: N8nWorkflow): void {
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      return;
    }

    for (const node of workflow.nodes) {
      this.processNode(node);
    }
  }

  /**
   * Process a single node and add to discovery map
   */
  private processNode(node: N8nNode): void {
    const nodeKey = `${node.type}:${node.typeVersion}`;

    if (this.nodeMap.has(nodeKey)) {
      // Update existing node
      const existing = this.nodeMap.get(nodeKey)!;
      existing.usageCount++;

      // Add unique parameter configurations
      const configKey = JSON.stringify(node.parameters);
      const hasConfig = existing.exampleConfigs.some(
        config => JSON.stringify(config) === configKey
      );

      if (!hasConfig) {
        existing.exampleConfigs.push({
          name: node.name,
          parameters: node.parameters,
          credentials: node.credentials || undefined
        });
      }
    } else {
      // Create new node discovery entry
      const discoveredNode: DiscoveredNodeType = {
        name: node.name,
        displayName: this.extractDisplayName(node.type),
        type: node.type,
        typeVersion: node.typeVersion,
        category: this.categorizeNode(node.type),
        description: this.generateDescription(node.type),
        parameters: node.parameters || {},
        credentials: node.credentials || undefined,
        usageCount: 1,
        exampleConfigs: [{
          name: node.name,
          parameters: node.parameters,
          credentials: node.credentials || undefined
        }],
        isCore: this.isCorNode(node.type),
        packageName: this.extractPackageName(node.type)
      };

      this.nodeMap.set(nodeKey, discoveredNode);
    }
  }

  /**
   * Extract display name from node type
   */
  private extractDisplayName(nodeType: string): string {
    // Remove package prefix and convert to display name
    const parts = nodeType.split('.');
    const name = parts[parts.length - 1] || nodeType;

    // Convert camelCase to Title Case
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Categorize node based on type
   */
  private categorizeNode(nodeType: string): string {
    const type = nodeType.toLowerCase();

    if (type.includes('trigger') || type.includes('webhook') || type.includes('cron')) {
      return 'Triggers';
    }
    if (type.includes('http') || type.includes('api') || type.includes('rest')) {
      return 'Communication';
    }
    if (type.includes('database') || type.includes('sql') || type.includes('mongo') || type.includes('redis')) {
      return 'Data Storage';
    }
    if (type.includes('file') || type.includes('csv') || type.includes('json') || type.includes('xml')) {
      return 'Files';
    }
    if (type.includes('email') || type.includes('slack') || type.includes('discord') || type.includes('teams')) {
      return 'Communication';
    }
    if (type.includes('function') || type.includes('code') || type.includes('script')) {
      return 'Logic';
    }
    if (type.includes('if') || type.includes('switch') || type.includes('merge') || type.includes('split')) {
      return 'Flow Control';
    }
    if (type.includes('set') || type.includes('transform') || type.includes('filter')) {
      return 'Data Processing';
    }
    if (type.includes('ai') || type.includes('openai') || type.includes('gpt') || type.includes('claude')) {
      return 'AI & ML';
    }
    if (type.includes('google') || type.includes('microsoft') || type.includes('aws') || type.includes('azure')) {
      return 'Cloud Services';
    }

    return 'Other';
  }

  /**
   * Generate description for node type
   */
  private generateDescription(nodeType: string): string {
    const displayName = this.extractDisplayName(nodeType);
    const category = this.categorizeNode(nodeType);

    return `${displayName} node in the ${category} category. Used for workflow automation and integration.`;
  }

  /**
   * Check if node is a core n8n node
   */
  private isCorNode(nodeType: string): boolean {
    const corePackages = [
      'n8n-nodes-base',
      '@n8n/n8n-nodes-langchain'
    ];

    return corePackages.some(pkg => nodeType.startsWith(pkg));
  }

  /**
   * Extract package name from node type
   */
  private extractPackageName(nodeType: string): string | undefined {
    if (nodeType.includes('.')) {
      const parts = nodeType.split('.');
      if (parts.length > 1) {
        return parts[0];
      }
    }
    return undefined;
  }

  /**
   * Build the final node catalog
   */
  private buildCatalog(): NodeCatalog {
    const allNodes = Array.from(this.nodeMap.values());

    // Separate core and community nodes
    const coreNodes = allNodes.filter(node => node.isCore);
    const communityNodes = allNodes.filter(node => !node.isCore);

    // Group by category
    const categories: Record<string, DiscoveredNodeType[]> = {};
    for (const node of allNodes) {
      if (!categories[node.category]) {
        categories[node.category] = [];
      }
      categories[node.category]!.push(node);
    }

    // Sort by usage
    const mostUsed = [...allNodes]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 20);

    return {
      totalNodes: allNodes.length,
      coreNodes,
      communityNodes,
      categories,
      mostUsed,
      lastUpdated: new Date()
    };
  }

  /**
   * Get the current catalog
   */
  getCatalog(): NodeCatalog | null {
    return this.catalog;
  }

  /**
   * Search nodes by query
   */
  searchNodes(query: string): DiscoveredNodeType[] {
    if (!this.catalog) return [];

    const lowerQuery = query.toLowerCase();
    const allNodes = [
      ...this.catalog.coreNodes,
      ...this.catalog.communityNodes
    ];

    return allNodes.filter(node =>
      node.name.toLowerCase().includes(lowerQuery) ||
      node.displayName.toLowerCase().includes(lowerQuery) ||
      node.type.toLowerCase().includes(lowerQuery) ||
      node.category.toLowerCase().includes(lowerQuery) ||
      node.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get nodes by category
   */
  getNodesByCategory(category: string): DiscoveredNodeType[] {
    if (!this.catalog) return [];

    return this.catalog.categories[category] || [];
  }

  /**
   * Get detailed node information
   */
  getNodeDetails(nodeType: string): DiscoveredNodeType | null {
    for (const [key, node] of this.nodeMap) {
      if (node.type === nodeType) {
        return node;
      }
    }
    return null;
  }
}