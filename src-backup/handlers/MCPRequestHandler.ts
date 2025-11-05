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

/**
 * Represents an MCP tool definition
 */
interface Tool {
  name: string;
  description: string;
  inputSchema: unknown;
}

/**
 * Represents a primitive tool handler
 */
interface PrimitiveTool {
  getTool(): Tool;
  handleToolCall(request: CallToolRequest): Promise<ToolCallResult>;
}

/**
 * Result of a tool call
 */
interface ToolCallResult {
  [key: string]: unknown;
}

/**
 * MCP resource definition
 */
interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Text content for MCP responses
 */
interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Resource content for MCP responses
 */
interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export class MCPRequestHandler implements IMCPRequestHandler {
  private primitiveTools: PrimitiveTool[];
  private workflowResources: WorkflowResources;

  constructor(
    primitiveTools: PrimitiveTool[],
    workflowResources: WorkflowResources
  ) {
    this.primitiveTools = primitiveTools;
    this.workflowResources = workflowResources;
  }

  async handleToolsRequest(request: Record<string, unknown>): Promise<{ tools: Tool[] }> {
    const tools = this.primitiveTools.map(tool => tool.getTool());

    return {
      tools,
    };
  }

  async handleResourcesRequest(request: ListResourcesRequest): Promise<{ resources: Resource[] }> {
    const resources = await this.workflowResources.listResources(request);
    return { resources };
  }

  async handleToolCall(request: CallToolRequest): Promise<{ content: TextContent[] }> {
    const toolName = request.params.name;

    // Find the appropriate primitive tool
    const tool = this.primitiveTools.find(t => t.getTool().name === toolName);

    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    try {
      const result = await tool.handleToolCall(request);

      // Safely stringify the result with proper Unicode handling
      // Use replacer to handle any problematic characters
      const safeResult = this.sanitizeForJson(result);
      const jsonString = JSON.stringify(safeResult, this.jsonReplacer, 2);

      return { content: [{ type: 'text', text: jsonString }] };
    } catch (error: unknown) {
      // If JSON serialization fails, return a safe error response
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const safeErrorResponse = {
        error: true,
        message: 'Failed to serialize response: ' + errorMessage,
        tool: toolName
      };
      return { content: [{ type: 'text', text: JSON.stringify(safeErrorResponse, null, 2) }] };
    }
  }

  /**
   * JSON replacer function to handle problematic values during serialization
   * Note: Arrow function to preserve `this` binding when passed as callback
   */
  private jsonReplacer = (key: string, value: unknown): unknown => {
    // Handle undefined
    if (value === undefined) {
      return null;
    }

    // Handle functions
    if (typeof value === 'function') {
      return '[Function]';
    }

    // Handle circular references (basic check)
    if (typeof value === 'object' && value !== null) {
      // Let JSON.stringify handle the built-in circular reference detection
      return value;
    }

    return value;
  };

  /**
   * Helper to check if an object is a plain object
   */
  private isPlainObject(obj: unknown): obj is Record<string, unknown> {
    if (typeof obj !== 'object' || obj === null) return false;
    const proto = Object.getPrototypeOf(obj);
    return proto === null || proto === Object.prototype;
  }

  /**
   * Sanitize data for safe JSON serialization
   * Handles Unicode characters and potential encoding issues
   */
  private sanitizeForJson<T>(obj: T): T | string | null | undefined {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      // Remove any non-printable or problematic characters
      // Keep only valid UTF-8 characters
      let cleaned = obj
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
        .replace(/[\uD800-\uDFFF]/g, ''); // Remove unpaired surrogates

      try {
        // Normalize to ensure valid Unicode
        cleaned = cleaned.normalize('NFC');
      } catch (error: unknown) {
        // If normalization fails, use the cleaned string
        // This can happen with invalid Unicode sequences
        console.debug('Unicode normalization failed, using cleaned string', error);
      }

      return cleaned;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForJson(item)) as T;
    }

    if (this.isPlainObject(obj)) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Also sanitize keys
        const cleanKey = typeof key === 'string' ? this.sanitizeForJson(key) : String(key);
        sanitized[cleanKey as string] = this.sanitizeForJson(value);
      }
      return sanitized as T;
    }

    // Handle other primitives (numbers, booleans, etc.)
    return obj;
  }

  async handleResourceRead(request: ReadResourceRequest): Promise<ResourceContent> {
    return await this.workflowResources.readResource(request);
  }

  validateRequest(request: unknown): ValidationResult {
    const errors: string[] = [];

    // Type guard to validate shape
    if (typeof request !== 'object' || request === null) {
      return {
        isValid: false,
        errors: ['Request must be an object']
      };
    }

    const req = request as Record<string, unknown>;

    // Basic MCP request validation
    if (!req.jsonrpc || req.jsonrpc !== '2.0') {
      errors.push('Invalid JSON-RPC version');
    }

    if (!req.method || typeof req.method !== 'string') {
      errors.push('Method is required and must be a string');
    }

    // Validate method-specific requirements
    if (req.method === 'tools/call') {
      const params = req.params as Record<string, unknown> | undefined;
      if (!params?.name) {
        errors.push('Tool name is required for tools/call');
      }
    }

    if (req.method === 'resources/read') {
      const params = req.params as Record<string, unknown> | undefined;
      if (!params?.uri) {
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