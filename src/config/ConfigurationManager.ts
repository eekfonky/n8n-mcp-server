/**
 * Centralized configuration management for the n8n MCP server
 * Handles environment variables, Docker secrets, and validation
 */

import fs from 'fs';
import path from 'path';
import { IConfigurationManager, ServerConfig, ValidationResult } from '../interfaces/index.js';
import { Config, validateConfig, ConfigSchema } from './schema.js';
import { ConfigurationError } from '../errors/MCPError.js';

export class ConfigurationManager implements IConfigurationManager {
  private config: Config | null = null;
  private rawEnv: Record<string, string | undefined>;

  constructor(env: Record<string, string | undefined> = process.env) {
    this.rawEnv = { ...env };
    this.loadAndValidate();
  }

  /**
   * Get a specific configuration value
   */
  get<K extends keyof ServerConfig>(key: K): ServerConfig[K] {
    if (!this.config) {
      throw new ConfigurationError('Configuration not loaded', key as string);
    }

    // Map interface keys to internal config keys
    const keyMap: Record<keyof ServerConfig, keyof Config> = {
      n8nBaseUrl: 'N8N_BASE_URL',
      n8nApiKey: 'N8N_API_KEY',
      allowedOrigins: 'ALLOWED_ORIGINS',
      logLevel: 'LOG_LEVEL',
      debug: 'DEBUG',
      rateLimitRequestsPerMinute: 'RATE_LIMIT_REQUESTS_PER_MINUTE',
      cacheTtlSeconds: 'CACHE_TTL_SECONDS',
      mcpMode: 'MCP_MODE',
      mcpPort: 'MCP_PORT',
      dockerSecretsPath: 'DOCKER_SECRETS_PATH',
    };

    const configKey = keyMap[key];
    if (!configKey) {
      throw new ConfigurationError(`Unknown configuration key: ${key as string}`, key as string);
    }

    // Transform internal config to external interface format by key mapping
    switch (key) {
      case 'n8nBaseUrl':
        return this.config.N8N_BASE_URL as ServerConfig[K];
      case 'n8nApiKey':
        return this.config.N8N_API_KEY as ServerConfig[K];
      case 'allowedOrigins':
        return this.config.ALLOWED_ORIGINS as ServerConfig[K];
      case 'logLevel':
        return this.config.LOG_LEVEL as ServerConfig[K];
      case 'debug':
        return this.config.DEBUG as ServerConfig[K];
      case 'rateLimitRequestsPerMinute':
        return this.config.RATE_LIMIT_REQUESTS_PER_MINUTE as ServerConfig[K];
      case 'cacheTtlSeconds':
        return this.config.CACHE_TTL_SECONDS as ServerConfig[K];
      case 'mcpMode':
        return this.config.MCP_MODE as ServerConfig[K];
      case 'mcpPort':
        return this.config.MCP_PORT as ServerConfig[K];
      case 'dockerSecretsPath':
        return this.config.DOCKER_SECRETS_PATH as ServerConfig[K];
      default:
        throw new ConfigurationError(`Unknown configuration key: ${key as string}`, key as string);
    }
  }

  /**
   * Get all configuration values
   */
  getAll(): ServerConfig {
    if (!this.config) {
      throw new ConfigurationError('Configuration not loaded');
    }

    return {
      n8nBaseUrl: this.config.N8N_BASE_URL,
      n8nApiKey: this.config.N8N_API_KEY,
      allowedOrigins: this.config.ALLOWED_ORIGINS,
      logLevel: this.config.LOG_LEVEL,
      debug: this.config.DEBUG,
      rateLimitRequestsPerMinute: this.config.RATE_LIMIT_REQUESTS_PER_MINUTE,
      cacheTtlSeconds: this.config.CACHE_TTL_SECONDS,
      mcpMode: this.config.MCP_MODE,
      mcpPort: this.config.MCP_PORT,
      dockerSecretsPath: this.config.DOCKER_SECRETS_PATH,
    };
  }

  /**
   * Validate the current configuration
   */
  validate(): ValidationResult {
    try {
      const enrichedEnv = this.enrichWithDockerSecrets(this.rawEnv);
      const result = validateConfig(enrichedEnv);

      return {
        isValid: result.success,
        errors: result.errors || [],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      };
    }
  }

  /**
   * Reload configuration from environment
   */
  async reload(): Promise<void> {
    this.rawEnv = { ...process.env };
    this.loadAndValidate();
  }

  /**
   * Load and validate configuration on initialization
   */
  private loadAndValidate(): void {
    try {
      // Enrich environment with Docker secrets
      const enrichedEnv = this.enrichWithDockerSecrets(this.rawEnv);

      // Validate configuration
      const result = validateConfig(enrichedEnv);

      if (!result.success) {
        const errorMessage = `Configuration validation failed:\n${result.errors?.join('\n')}`;
        throw new ConfigurationError(errorMessage);
      }

      this.config = result.data!;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError(`Failed to load configuration: ${error}`);
    }
  }

  /**
   * Enrich environment variables with Docker secrets
   */
  private enrichWithDockerSecrets(env: Record<string, string | undefined>): Record<string, string | undefined> {
    const enriched = { ...env };
    const secretsPath = env.DOCKER_SECRETS_PATH;

    if (!secretsPath) {
      return enriched;
    }

    // Mapping of environment variable names to secret file names
    const secretMappings: Record<string, string> = {
      N8N_API_KEY: 'n8n-api-key',
      N8N_BASE_URL: 'n8n-base-url',
    };

    for (const [envKey, secretFileName] of Object.entries(secretMappings)) {
      // Only read secret if environment variable is not already set
      if (!enriched[envKey]) {
        const secretValue = this.readDockerSecret(secretsPath, secretFileName);
        if (secretValue) {
          enriched[envKey] = secretValue;
        }
      }
    }

    return enriched;
  }

  /**
   * Safely read a Docker secret from file
   */
  private readDockerSecret(secretsPath: string, secretName: string): string | null {
    try {
      // Sanitize secret name to prevent path traversal
      const sanitizedName = secretName.replace(/[^a-z0-9_-]/g, '');
      if (sanitizedName !== secretName) {
        console.error(`Invalid secret name format: ${secretName}`);
        return null;
      }

      const secretFile = path.join(secretsPath, sanitizedName);

      // Ensure the resolved path is within the secrets directory
      const resolvedPath = path.resolve(secretFile);
      const resolvedSecretsPath = path.resolve(secretsPath);

      if (!resolvedPath.startsWith(resolvedSecretsPath + path.sep) && resolvedPath !== resolvedSecretsPath) {
        console.error(`Secret path traversal attempt detected: ${secretName}`);
        return null;
      }

      // Use statSync for existence check (more efficient than existsSync + readFileSync)
      try {
        const stats = fs.statSync(secretFile);
        if (stats.isFile()) {
          const content = fs.readFileSync(secretFile, 'utf8');
          return content.trim() || null;
        }
      } catch (statError) {
        // File doesn't exist or isn't readable
        return null;
      }
    } catch (error) {
      console.error(`Failed to read Docker secret ${secretName}:`, error);
    }

    return null;
  }

  /**
   * Get configuration schema for documentation/validation
   */
  static getSchema() {
    return ConfigSchema;
  }

  /**
   * Check if configuration is loaded
   */
  isLoaded(): boolean {
    return this.config !== null;
  }

  /**
   * Get raw environment values (for debugging)
   */
  getRawEnv(): Record<string, string | undefined> {
    return { ...this.rawEnv };
  }
}