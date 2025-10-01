import { Request, Response, NextFunction } from 'express';

export interface MCPRequest {
  jsonrpc: string;
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * Validates that incoming requests conform to basic MCP protocol structure
 */
export function validateMCPRequest(req: Request, res: Response, next: NextFunction): void {
  const { jsonrpc, method } = req.body as MCPRequest;

  // Check required fields
  if (!jsonrpc || jsonrpc !== '2.0') {
    res.status(400).json({
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: -32600,
        message: 'Invalid Request: jsonrpc must be "2.0"',
      },
    });
    return;
  }

  if (!method || typeof method !== 'string') {
    res.status(400).json({
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: -32600,
        message: 'Invalid Request: method is required and must be a string',
      },
    });
    return;
  }

  // Validate method names against MCP specification
  const validMethods = [
    'initialize',
    'initialized',
    'ping',
    'tools/list',
    'tools/call',
    'resources/list',
    'resources/read',
    'prompts/list',
    'prompts/get',
  ];

  if (!validMethods.includes(method)) {
    res.status(400).json({
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    });
    return;
  }

  // Sanitize params to prevent injection attacks
  if (req.body.params && typeof req.body.params === 'object') {
    req.body.params = sanitizeObject(req.body.params);
  }

  next();
}

/**
 * Recursively sanitize object to prevent injection attacks
 */
function sanitizeObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const sanitizedKey = sanitizeString(key);
    sanitized[sanitizedKey] = sanitizeObject(value);
  }
  return sanitized;
}

/**
 * Basic string sanitization to prevent common injection attacks
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;

  return str
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags completely
    .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}
