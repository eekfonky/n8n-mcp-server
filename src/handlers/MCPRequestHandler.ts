/**
 * MCP request handler for processing tools and resources
 */

import type {
  CallToolRequest,
  ListResourcesRequest,
  ReadResourceRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { IMCPRequestHandler, ValidationResult } from '../interfaces/index.js';
import { WorkflowResources } from '../resources/workflowResources.js';
import { InternalError } from '../errors/MCPError.js';

export class MCPRequestHandler implements IMCPRequestHandler {
  private primitiveTools: Array<{ getTool(): any; handleToolCall(request: any): Promise<any> }>;
  private workflowResources: WorkflowResources;

  constructor(
    primitiveTools: Array<{ getTool(): any; handleToolCall(request: any): Promise<any> }>,
    workflowResources: WorkflowResources
  ) {
    this.primitiveTools = primitiveTools;
    this.workflowResources = workflowResources;
  }

  async handleToolsRequest(request: Record<string, unknown>): Promise<{ tools: any[] }> {
    const tools = this.primitiveTools.map(tool => tool.getTool());

    return {
      tools,
    };
  }

  async handleResourcesRequest(request: ListResourcesRequest): Promise<{ resources: any[] }> {
    const resources = await this.workflowResources.listResources(request);
    return { resources };
  }

  async handleToolCall(request: CallToolRequest): Promise<{ content: any[] }> {
    const toolName = request.params.name;

    // Find the appropriate primitive tool
    const tool = this.primitiveTools.find(t => t.getTool().name === toolName);

    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const result = await tool.handleToolCall(request);

    // Safely stringify the result with proper Unicode handling
    // Use replacer to handle any problematic characters
    const safeResult = this.sanitizeForJson(result);
    return { content: [{ type: 'text', text: JSON.stringify(safeResult, null, 2) }] };
  }

  /**
   * Sanitize data for safe JSON serialization
   * Handles Unicode characters and potential encoding issues
   */
  private sanitizeForJson(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      // Ensure valid UTF-8 by normalizing the string
      return obj.normalize('NFC');
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForJson(item));
    }

    if (typeof obj === 'object' && obj.constructor === Object) {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeForJson(value);
      }
      return sanitized;
    }

    return obj;
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