/**
 * Custom error classes for the n8n MCP server
 */

export class MCPError extends Error {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(message: string, code: number = -32000, data?: unknown) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.data = data;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPError);
    }
  }

  /**
   * Convert to MCP JSON-RPC error format
   */
  toMCPFormat(id?: string | number) {
    return {
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code: this.code,
        message: this.message,
        data: this.data,
      },
    };
  }
}

/**
 * Error for invalid MCP requests
 */
export class InvalidRequestError extends MCPError {
  constructor(message: string, data?: unknown) {
    super(message, -32600, data);
    this.name = 'InvalidRequestError';
  }
}

/**
 * Error for method not found
 */
export class MethodNotFoundError extends MCPError {
  constructor(method: string) {
    super(`Method not found: ${method}`, -32601, { method });
    this.name = 'MethodNotFoundError';
  }
}

/**
 * Error for invalid method parameters
 */
export class InvalidParamsError extends MCPError {
  constructor(message: string, params?: unknown) {
    super(message, -32602, { params });
    this.name = 'InvalidParamsError';
  }
}

/**
 * Error for internal server errors
 */
export class InternalError extends MCPError {
  constructor(message: string, originalError?: Error) {
    super(
      message,
      -32603,
      originalError
        ? {
            originalMessage: originalError.message,
            stack: originalError.stack,
          }
        : undefined
    );
    this.name = 'InternalError';
  }
}

/**
 * Error for n8n API related issues
 */
export class N8nApiError extends MCPError {
  constructor(message: string, statusCode?: number, response?: unknown) {
    super(`n8n API Error: ${message}`, -32100, { statusCode, response });
    this.name = 'N8nApiError';
  }
}

/**
 * Error for configuration issues
 */
export class ConfigurationError extends MCPError {
  constructor(message: string, configKey?: string) {
    super(`Configuration Error: ${message}`, -32200, { configKey });
    this.name = 'ConfigurationError';
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends MCPError {
  constructor(message: string, field?: string, value?: unknown) {
    super(`Validation Error: ${message}`, -32300, { field, value });
    this.name = 'ValidationError';
  }
}

/**
 * Type guard to check if an error is an MCPError
 */
export function isMCPError(error: unknown): error is MCPError {
  return error instanceof MCPError;
}

/**
 * Helper to convert any error to MCP format
 */
export function errorToMCPFormat(error: unknown, id?: string | number) {
  if (isMCPError(error)) {
    return error.toMCPFormat(id);
  }

  // Convert generic errors to internal errors
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  const internalError = new InternalError(errorMessage, error instanceof Error ? error : undefined);

  return internalError.toMCPFormat(id);
}
