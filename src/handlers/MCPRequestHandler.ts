/**
 * MCP request handler for processing tools and resources
 */

import type {
  CallToolRequest,
  ListResourcesRequest,
  ReadResourceRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { IMCPRequestHandler, ValidationResult } from '../interfaces/index.js';
import { WorkflowTools } from '../tools/workflowTools.js';
import { NodeTools } from '../tools/nodeTools.js';
import { WorkflowResources } from '../resources/workflowResources.js';
import { InternalError } from '../errors/MCPError.js';

export class MCPRequestHandler implements IMCPRequestHandler {
  private workflowTools: WorkflowTools;
  private nodeTools: NodeTools;
  private workflowResources: WorkflowResources;

  constructor(
    workflowTools: WorkflowTools,
    nodeTools: NodeTools,
    workflowResources: WorkflowResources
  ) {
    this.workflowTools = workflowTools;
    this.nodeTools = nodeTools;
    this.workflowResources = workflowResources;
  }

  async handleToolsRequest(request: Record<string, unknown>): Promise<{ tools: any[] }> {
    const workflowTools = this.workflowTools.getTools();
    const nodeTools = this.nodeTools.getTools();

    return {
      tools: [...workflowTools, ...nodeTools],
    };
  }

  async handleResourcesRequest(request: ListResourcesRequest): Promise<{ resources: any[] }> {
    const resources = await this.workflowResources.listResources(request);
    return { resources };
  }

  async handleToolCall(request: CallToolRequest): Promise<{ content: any[] }> {
    const toolName = request.params.name;

    // Route to appropriate tool handler
    const workflowToolNames = this.workflowTools.getTools().map(t => t.name);
    const nodeToolNames = this.nodeTools.getTools().map(t => t.name);

    if (workflowToolNames.includes(toolName)) {
      const result = await this.workflowTools.handleToolCall(request);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (nodeToolNames.includes(toolName)) {
      const result = await this.nodeTools.handleToolCall(request);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    throw new Error(`Unknown tool: ${toolName}`);
  }

  async handleResourceRead(request: ReadResourceRequest): Promise<any> {
    return await this.workflowResources.readResource(request);
  }

  validateRequest(request: any): ValidationResult {
    const errors: string[] = [];

    // Basic MCP request validation
    if (!request.jsonrpc || request.jsonrpc !== '2.0') {
      errors.push('Invalid JSON-RPC version');
    }

    if (!request.method || typeof request.method !== 'string') {
      errors.push('Method is required and must be a string');
    }

    // Validate method-specific requirements
    if (request.method === 'tools/call') {
      if (!request.params?.name) {
        errors.push('Tool name is required for tools/call');
      }
    }

    if (request.method === 'resources/read') {
      if (!request.params?.uri) {
        errors.push('Resource URI is required for resources/read');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create error handler for MCP server
   */
  createErrorHandler() {
    return (error: Error) => {
      const mcpError = new InternalError('MCP Server Error', error);
      console.error('[MCP Error]', JSON.stringify(mcpError.toMCPFormat()));
    };
  }
}