/**
 * Configuration schema validation using Zod
 */

import { z } from 'zod';

// Environment variable schema
export const ConfigSchema = z.object({
  // Required configuration
  N8N_BASE_URL: z
    .string()
    .url('N8N_BASE_URL must be a valid URL')
    .describe('Base URL of the n8n instance'),

  N8N_API_KEY: z
    .string()
    .min(1, 'N8N_API_KEY cannot be empty')
    .describe('n8n API key for authentication'),

  // Optional configuration with defaults
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((val) => val?.split(',').map((origin) => origin.trim()) || ['http://localhost:3000'])
    .describe('Comma-separated list of allowed CORS origins'),

  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info')
    .describe('Logging verbosity level'),

  DEBUG: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .pipe(z.boolean().default(false))
    .describe('Enable debug mode'),

  RATE_LIMIT_REQUESTS_PER_MINUTE: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 60))
    .pipe(z.number().min(1).max(1000))
    .describe('API rate limiting (requests per minute)'),

  CACHE_TTL_SECONDS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 300))
    .pipe(z.number().min(0).max(3600))
    .describe('Cache time-to-live in seconds'),

  MCP_MODE: z
    .enum(['stdio', 'gateway'])
    .default('stdio')
    .describe('MCP server transport mode'),

  MCP_PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 3000))
    .pipe(z.number().min(1024).max(65535))
    .describe('Port for gateway mode'),

  DOCKER_SECRETS_PATH: z
    .string()
    .optional()
    .describe('Path to Docker secrets directory'),

  // Additional optional settings
  MCP_SERVER_NAME: z
    .string()
    .default('n8n-mcp-server')
    .describe('MCP server name'),

  MCP_SERVER_VERSION: z
    .string()
    .default('1.0.0')
    .describe('MCP server version'),
});

// Infer the TypeScript type from the schema
export type ConfigInput = z.input<typeof ConfigSchema>;
export type Config = z.output<typeof ConfigSchema>;

// Validation function
export function validateConfig(input: Record<string, string | undefined>): {
  success: boolean;
  data?: Config;
  errors?: string[];
} {
  try {
    const result = ConfigSchema.parse(input);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return {
      success: false,
      errors: ['Unknown validation error'],
    };
  }
}

// Safe validation that doesn't throw
export function safeValidateConfig(input: Record<string, string | undefined>) {
  return ConfigSchema.safeParse(input);
}

// Helper to get default configuration for development
export function getDefaultConfig(): Partial<Config> {
  return {
    N8N_BASE_URL: 'http://localhost:5678',
    N8N_API_KEY: 'development-key',
    ALLOWED_ORIGINS: ['http://localhost:3000'],
    LOG_LEVEL: 'debug',
    DEBUG: true,
    RATE_LIMIT_REQUESTS_PER_MINUTE: 60,
    CACHE_TTL_SECONDS: 300,
    MCP_MODE: 'stdio',
    MCP_PORT: 3000,
    MCP_SERVER_NAME: 'n8n-mcp-server',
    MCP_SERVER_VERSION: '1.0.0',
  };
}

// Helper to check if all required fields are present
export function checkRequiredConfig(input: Record<string, string | undefined>): {
  isValid: boolean;
  missing: string[];
} {
  const required = ['N8N_BASE_URL', 'N8N_API_KEY'];
  const missing = required.filter((key) => !input[key]);

  return {
    isValid: missing.length === 0,
    missing,
  };
}