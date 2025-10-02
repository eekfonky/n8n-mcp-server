/**
 * Custom Error Classes for n8n MCP Server
 * Provides comprehensive error handling with proper context and debugging information
 */

export class N8nMcpError extends Error {
  public readonly code: string;
  public readonly context: Record<string, any>;
  public readonly timestamp: string;
  public readonly originalError: Error | undefined;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    context: Record<string, any> = {},
    originalError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      originalError: this.originalError?.message
    };
  }
}

export class N8nApiError extends N8nMcpError {
  public readonly statusCode: number | undefined;
  public readonly endpoint: string | undefined;

  constructor(
    message: string,
    statusCode?: number,
    endpoint?: string,
    context: Record<string, any> = {},
    originalError?: Error
  ) {
    super(message, 'N8N_API_ERROR', context, originalError);
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}

export class ValidationError extends N8nMcpError {
  public readonly field: string | undefined;
  public readonly value: any;

  constructor(
    message: string,
    field?: string,
    value?: any,
    context: Record<string, any> = {}
  ) {
    super(message, 'VALIDATION_ERROR', context);
    this.field = field;
    this.value = value;
  }
}

export class TimeoutError extends N8nMcpError {
  public readonly timeoutMs: number;
  public readonly operation: string;

  constructor(
    message: string,
    timeoutMs: number,
    operation: string,
    context: Record<string, any> = {}
  ) {
    super(message, 'TIMEOUT_ERROR', context);
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }
}

export class ConcurrencyError extends N8nMcpError {
  public readonly maxConcurrency: number;
  public readonly attempted: number;

  constructor(
    message: string,
    maxConcurrency: number,
    attempted: number,
    context: Record<string, any> = {}
  ) {
    super(message, 'CONCURRENCY_ERROR', context);
    this.maxConcurrency = maxConcurrency;
    this.attempted = attempted;
  }
}

export class MemoryError extends N8nMcpError {
  public readonly memoryUsed: number;
  public readonly memoryLimit: number;

  constructor(
    message: string,
    memoryUsed: number,
    memoryLimit: number,
    context: Record<string, any> = {}
  ) {
    super(message, 'MEMORY_ERROR', context);
    this.memoryUsed = memoryUsed;
    this.memoryLimit = memoryLimit;
  }
}

export class SecurityError extends N8nMcpError {
  public readonly securityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  constructor(
    message: string,
    securityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM',
    context: Record<string, any> = {}
  ) {
    super(message, 'SECURITY_ERROR', context);
    this.securityLevel = securityLevel;
  }
}

/**
 * Error Handler Utility Functions
 */
export class ErrorHandler {
  static isRetryable(error: Error): boolean {
    if (error instanceof N8nApiError) {
      return error.statusCode ? [429, 502, 503, 504].includes(error.statusCode) : false;
    }
    if (error instanceof TimeoutError) {
      return true;
    }
    return false;
  }

  static getRetryDelay(attempt: number, baseDelay: number = 1000): number {
    return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries || !this.isRetryable(lastError)) {
          throw lastError;
        }

        const delay = this.getRetryDelay(attempt, baseDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName: string = 'operation'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError(
          `Operation '${operationName}' timed out after ${timeoutMs}ms`,
          timeoutMs,
          operationName
        ));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  static createErrorResponse(error: Error): { success: false; error: string; code?: string; context?: any } {
    if (error instanceof N8nMcpError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
        context: error.context
      };
    }

    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }

  static sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'credential', 'apiKey'];
    const sanitized = { ...context };

    for (const [key, value] of Object.entries(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value);
      }
    }

    return sanitized;
  }
}

/**
 * Input Validation Utilities
 */
export class Validator {
  static validateRequired(value: any, fieldName: string): void {
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`Field '${fieldName}' is required`, fieldName, value);
    }
  }

  static validateString(value: any, fieldName: string, minLength?: number, maxLength?: number): void {
    this.validateRequired(value, fieldName);
    
    if (typeof value !== 'string') {
      throw new ValidationError(`Field '${fieldName}' must be a string`, fieldName, value);
    }

    if (minLength !== undefined && value.length < minLength) {
      throw new ValidationError(
        `Field '${fieldName}' must be at least ${minLength} characters`,
        fieldName,
        value
      );
    }

    if (maxLength !== undefined && value.length > maxLength) {
      throw new ValidationError(
        `Field '${fieldName}' must be at most ${maxLength} characters`,
        fieldName,
        value
      );
    }
  }

  static validateEnum<T>(value: any, fieldName: string, allowedValues: T[]): void {
    this.validateRequired(value, fieldName);
    
    if (!allowedValues.includes(value)) {
      throw new ValidationError(
        `Field '${fieldName}' must be one of: ${allowedValues.join(', ')}`,
        fieldName,
        value
      );
    }
  }

  static validateNumber(value: any, fieldName: string, min?: number, max?: number): void {
    this.validateRequired(value, fieldName);
    
    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError(`Field '${fieldName}' must be a valid number`, fieldName, value);
    }

    if (min !== undefined && value < min) {
      throw new ValidationError(
        `Field '${fieldName}' must be at least ${min}`,
        fieldName,
        value
      );
    }

    if (max !== undefined && value > max) {
      throw new ValidationError(
        `Field '${fieldName}' must be at most ${max}`,
        fieldName,
        value
      );
    }
  }

  static validateArray(value: any, fieldName: string, minLength?: number, maxLength?: number): void {
    this.validateRequired(value, fieldName);
    
    if (!Array.isArray(value)) {
      throw new ValidationError(`Field '${fieldName}' must be an array`, fieldName, value);
    }

    if (minLength !== undefined && value.length < minLength) {
      throw new ValidationError(
        `Field '${fieldName}' must have at least ${minLength} items`,
        fieldName,
        value
      );
    }

    if (maxLength !== undefined && value.length > maxLength) {
      throw new ValidationError(
        `Field '${fieldName}' must have at most ${maxLength} items`,
        fieldName,
        value
      );
    }
  }

  static sanitizeInput(input: string): string {
    // Remove potentially dangerous characters
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }
}