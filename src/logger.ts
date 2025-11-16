/**
 * Structured logging with Pino
 *
 * Provides consistent logging across the application with:
 * - Configurable log levels
 * - Pretty printing in debug mode
 * - JSON output in production
 * - Performance-optimized logging
 */

import pino from 'pino';

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

// Create logger instance
export const logger = isDevelopment
  ? pino({
      level: logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    })
  : pino({
      level: logLevel,
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });

// Export child logger creators for different modules
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

// Typed logging helpers
export const loggers = {
  server: createModuleLogger('server'),
  client: createModuleLogger('client'),
  tool: createModuleLogger('tool'),
  cache: createModuleLogger('cache'),
};

// Performance logging helper
export function logPerformance(
  operation: string,
  durationMs: number,
  metadata?: Record<string, any>
) {
  loggers.server.debug(
    {
      operation,
      durationMs,
      ...metadata,
    },
    `${operation} completed in ${durationMs}ms`
  );
}

// Error logging helper
export function logError(
  error: Error | unknown,
  context?: Record<string, any>
) {
  const errorInfo = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    : { message: String(error) };

  logger.error(
    {
      error: errorInfo,
      ...context,
    },
    `Error: ${errorInfo.message}`
  );
}

// API call logging helper
export function logApiCall(
  method: string,
  endpoint: string,
  statusCode?: number,
  durationMs?: number
) {
  loggers.client.info(
    {
      method,
      endpoint,
      statusCode,
      durationMs,
    },
    `${method} ${endpoint} ${statusCode ? `- ${statusCode}` : ''}`
  );
}

// Tool execution logging helper
export function logToolExecution(
  toolName: string,
  params: Record<string, any>,
  durationMs?: number,
  success = true
) {
  const log = success ? loggers.tool.info : loggers.tool.error;

  log(
    {
      tool: toolName,
      params,
      durationMs,
      success,
    },
    `Tool ${toolName} ${success ? 'completed' : 'failed'}${durationMs ? ` in ${durationMs}ms` : ''}`
  );
}

export default logger;
