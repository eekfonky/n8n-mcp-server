import { N8nApiClient } from './n8nClient.js';
import { N8nNodeType, N8nNodeProperty } from './types.js';

export interface DiscoveredNode {
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: number;
  inputs: string[];
  outputs: string[];
  parameters: NodeParameter[];
  credentials: string[];
  isCustom: boolean;
  packageName?: string;
}

export interface NodeParameter {
  name: string;
  displayName: string;
  type: string;
  required: boolean;
  description?: string;
  default?: any;
  options?: Array<{ name: string; value: any; description?: string }>;
}

export class NodeDiscoveryService {
  private discoveredNodes: DiscoveredNode[] = [];
  private lastDiscovery: number = 0;
  private readonly discoveryInterval = 5 * 60 * 1000; // 5 minutes

  constructor(private n8nClient: N8nApiClient) {}

  async discoverNodes(forceRefresh = false): Promise<DiscoveredNode[]> {
    const now = Date.now();
    
    // Return cached results if within discovery interval
    if (!forceRefresh && this.discoveredNodes.length > 0 && 
        (now - this.lastDiscovery) < this.discoveryInterval) {
      return this.discoveredNodes;
    }

    try {
      const nodeTypes = await this.n8nClient.getNodeTypes();
      this.discoveredNodes = this.processNodeTypes(nodeTypes);
      this.lastDiscovery = now;

      if (process.env.DEBUG === 'true') {
        console.error(`Discovered ${this.discoveredNodes.length} n8n nodes`);
      }
      return this.discoveredNodes;
    } catch (error) {
      console.error('Failed to discover n8n nodes:', error);
      return this.discoveredNodes; // Return cached results on error
    }
  }

  private processNodeTypes(nodeTypes: N8nNodeType[]): DiscoveredNode[] {
    return nodeTypes.map(nodeType => this.convertNodeType(nodeType));
  }

  private convertNodeType(nodeType: N8nNodeType): DiscoveredNode {
    return {
      name: nodeType.name,
      displayName: nodeType.displayName,
      description: nodeType.description || `${nodeType.displayName} node`,
      category: this.determineCategory(nodeType),
      version: nodeType.version || 1,
      inputs: nodeType.inputs || [],
      outputs: nodeType.outputs || [],
      parameters: this.extractParameters(nodeType.properties || []),
      credentials: this.extractCredentials(nodeType),
      isCustom: this.isCustomNode(nodeType.name),
      packageName: this.extractPackageName(nodeType.name),
    };
  }

  private determineCategory(nodeType: N8nNodeType): string {
    // Use codex categories if available
    if (nodeType.codex?.categories?.length) {
      return nodeType.codex.categories[0];
    }

    // Use group information
    if (nodeType.group?.length) {
      return nodeType.group[0];
    }

    // Fallback to analyzing node name
    const name = nodeType.name.toLowerCase();
    
    if (name.includes('trigger') || name.includes('webhook')) return 'Triggers';
    if (name.includes('http') || name.includes('api')) return 'Communication';
    if (name.includes('database') || name.includes('sql') || name.includes('mongo')) return 'Data';
    if (name.includes('file') || name.includes('csv') || name.includes('json')) return 'Files';
    if (name.includes('email') || name.includes('slack') || name.includes('discord')) return 'Communication';
    if (name.includes('schedule') || name.includes('cron') || name.includes('interval')) return 'Scheduling';
    if (name.includes('transform') || name.includes('filter') || name.includes('merge')) return 'Data';
    
    return 'Miscellaneous';
  }

  private extractParameters(properties: N8nNodeProperty[]): NodeParameter[] {
    return properties.map(prop => ({
      name: prop.name,
      displayName: prop.displayName,
      type: prop.type,
      required: prop.required || false,
      description: prop.description,
      default: prop.default,
      options: prop.options,
    }));
  }

  private extractCredentials(nodeType: N8nNodeType): string[] {
    if (!nodeType.credentials) return [];
    return nodeType.credentials.map(cred => cred.name);
  }

  private isCustomNode(nodeName: string): boolean {
    // Core n8n nodes typically start with 'n8n-nodes-base'
    // Community nodes usually have different prefixes
    const coreNodePrefixes = [
      'n8n-nodes-base',
      '@n8n/n8n-nodes-langchain',
    ];
    
    return !coreNodePrefixes.some(prefix => nodeName.startsWith(prefix));
  }

  private extractPackageName(nodeName: string): string | undefined {
    // Extract package name from node name for community nodes
    // Example: "@n8n/n8n-nodes-langchain.vectorStorePinecone" -> "@n8n/n8n-nodes-langchain"
    if (nodeName.includes('.')) {
      return nodeName.split('.')[0];
    }
    return undefined;
  }

  // Get nodes by category
  getNodesByCategory(): Record<string, DiscoveredNode[]> {
    const categories: Record<string, DiscoveredNode[]> = {};
    
    for (const node of this.discoveredNodes) {
      if (!categories[node.category]) {
        categories[node.category] = [];
      }
      categories[node.category].push(node);
    }
    
    return categories;
  }

  // Get only community nodes
  getCommunityNodes(): DiscoveredNode[] {
    return this.discoveredNodes.filter(node => node.isCustom);
  }

  // Get core nodes
  getCoreNodes(): DiscoveredNode[] {
    return this.discoveredNodes.filter(node => !node.isCustom);
  }

  // Search nodes by name or description
  searchNodes(query: string): DiscoveredNode[] {
    const lowerQuery = query.toLowerCase();
    return this.discoveredNodes.filter(node => 
      node.name.toLowerCase().includes(lowerQuery) ||
      node.displayName.toLowerCase().includes(lowerQuery) ||
      node.description.toLowerCase().includes(lowerQuery)
    );
  }

  // Get node by exact name
  getNode(name: string): DiscoveredNode | undefined {
    return this.discoveredNodes.find(node => node.name === name);
  }

  // Get statistics about discovered nodes
  getDiscoveryStats(): {
    total: number;
    coreNodes: number;
    communityNodes: number;
    categories: string[];
    lastDiscovery: Date | null;
  } {
    const coreNodes = this.getCoreNodes();
    const communityNodes = this.getCommunityNodes();
    const categories = Object.keys(this.getNodesByCategory());

    return {
      total: this.discoveredNodes.length,
      coreNodes: coreNodes.length,
      communityNodes: communityNodes.length,
      categories: categories.sort(),
      lastDiscovery: this.lastDiscovery ? new Date(this.lastDiscovery) : null,
    };
  }

  // Generate node documentation
  generateNodeDocumentation(node: DiscoveredNode): string {
    let doc = `# ${node.displayName}\n\n`;
    doc += `**Type:** ${node.name}\n`;
    doc += `**Category:** ${node.category}\n`;
    doc += `**Version:** ${node.version}\n`;
    
    if (node.isCustom && node.packageName) {
      doc += `**Package:** ${node.packageName}\n`;
    }
    
    doc += `\n## Description\n${node.description}\n\n`;
    
    if (node.parameters.length > 0) {
      doc += `## Parameters\n\n`;
      for (const param of node.parameters) {
        doc += `### ${param.displayName}\n`;
        doc += `- **Name:** ${param.name}\n`;
        doc += `- **Type:** ${param.type}\n`;
        doc += `- **Required:** ${param.required ? 'Yes' : 'No'}\n`;
        if (param.description) {
          doc += `- **Description:** ${param.description}\n`;
        }
        if (param.default !== undefined) {
          doc += `- **Default:** ${JSON.stringify(param.default)}\n`;
        }
        if (param.options?.length) {
          doc += `- **Options:** ${param.options.map(opt => opt.name).join(', ')}\n`;
        }
        doc += '\n';
      }
    }
    
    if (node.credentials.length > 0) {
      doc += `## Required Credentials\n`;
      doc += node.credentials.map(cred => `- ${cred}`).join('\n') + '\n\n';
    }
    
    if (node.inputs.length > 0) {
      doc += `## Inputs\n`;
      doc += node.inputs.map(input => `- ${input}`).join('\n') + '\n\n';
    }
    
    if (node.outputs.length > 0) {
      doc += `## Outputs\n`;
      doc += node.outputs.map(output => `- ${output}`).join('\n') + '\n\n';
    }
    
    return doc;
  }
}