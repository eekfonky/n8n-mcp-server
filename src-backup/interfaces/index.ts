/**
 * Core interfaces for the n8n MCP server
 * These provide abstraction and better testability
 */

// Configuration interfaces
export interface ServerConfig {
  n8nBaseUrl: string;
  n8nApiKey: string;
  allowedOrigins: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  debug: boolean;
  rateLimitRequestsPerMinute: number;
  cacheTtlSeconds: number;
  mcpMode: 'stdio' | 'gateway';
  mcpPort: number;
  dockerSecretsPath: string | undefined;
}

// API Client interface
export interface IApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, data?: unknown): Promise<T>;
  put<T>(path: string, data?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
  patch<T>(path: string, data?: unknown): Promise<T>;
}

// Node Discovery interface
export interface INodeDiscoveryService {
  discoverNodes(forceRefresh?: boolean): Promise<DiscoveredNode[]>;
  getNodeInfo(nodeName: string): Promise<DiscoveredNode | null>;
  searchNodes(query: string): Promise<DiscoveredNode[]>;
  getCommunityNodes(): Promise<DiscoveredNode[]>;
  getNodesByCategory(category?: string): Promise<DiscoveredNode[]>;
  validateNodeConfig(nodeName: string, config: Record<string, unknown>): Promise<ValidationResult>;
}

// Configuration Manager interface
export interface IConfigurationManager {
  get<K extends keyof ServerConfig>(key: K): ServerConfig[K];
  getAll(): ServerConfig;
  validate(): ValidationResult;
  reload(): Promise<void>;
}

// Cache Service interface
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// Health Check Service interface
export interface IHealthCheckService {
  checkOverallHealth(): Promise<HealthStatus>;
  checkN8nConnectivity(): Promise<boolean>;
  checkCacheHealth(): Promise<boolean>;
  getHealthReport(): Promise<HealthReport>;
}

// HTTP Server interface to type the server return
export interface IHttpServer {
  listen(port: number, callback?: () => void): this;
  close(callback?: (err?: Error) => void): this;
  address(): { port: number; family: string; address: string } | string | null;
}

// Transport Manager interface
export interface ITransportManager {
  startStdio(): Promise<void>;
  startGateway(port: number): Promise<IHttpServer>; // Returns HTTP server
  stop(): Promise<void>;
  isRunning(): boolean;
  getMode(): 'stdio' | 'gateway' | 'stopped';
}

// MCP Protocol types
export interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPToolsRequest extends MCPRequest {
  method: 'tools/list';
}

export interface MCPResourcesRequest extends MCPRequest {
  method: 'resources/list';
}

export interface MCPToolCallRequest extends MCPRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

export interface MCPResourceReadRequest extends MCPRequest {
  method: 'resources/read';
  params: {
    uri: string;
  };
}

// MCP Request Handler interface
export interface IMCPRequestHandler {
  handleToolsRequest(request: Record<string, unknown>): Promise<{ tools: any[] }>;
  handleResourcesRequest(request: any): Promise<{ resources: any[] }>;
  handleToolCall(request: any): Promise<{ content: any[] }>;
  handleResourceRead(request: any): Promise<any>;
  validateRequest(request: any): ValidationResult;
  createErrorHandler(): (error: Error) => void;
}

// Supporting types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, unknown> | undefined;
}

export interface HealthReport {
  overall: HealthStatus;
  components: {
    n8n: HealthStatus;
    cache: HealthStatus;
    server: HealthStatus;
  };
  timestamp: string;
}

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
  packageName: string | undefined;
}

export interface NodeParameter {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'options' | 'multiOptions' | 'collection' | 'fixedCollection';
  required: boolean;
  description: string | undefined;
  default?: unknown;
  options?: Array<{ name: string; value: string | number }> | undefined;
}

// Service Dependencies interface for dependency injection
export interface ServiceDependencies {
  configManager: IConfigurationManager;
  apiClient: any;
  nodeDiscovery: any;
  cacheService: ICacheService;
  healthCheck: IHealthCheckService;
  transportManager?: any;
  requestHandler: any;
}

// MCP Server interface (from SDK)
export interface IMCPServer {
  connect(): Promise<void>;
  close(): Promise<void>;
  setRequestHandler<T>(schema: unknown, handler: (request: T) => Promise<unknown>): void;
  notification(method: string, params?: unknown): void;
}

// Factory interfaces for creating services
export interface IServiceFactory {
  createApiClient(config: ServerConfig): IApiClient;
  createNodeDiscovery(apiClient: IApiClient): INodeDiscoveryService;
  createCacheService(config: ServerConfig): ICacheService;
  createHealthCheck(dependencies: Partial<ServiceDependencies>): IHealthCheckService;
  createTransportManager(server: IMCPServer, dependencies: ServiceDependencies): ITransportManager;
  createRequestHandler(dependencies: Partial<ServiceDependencies>): IMCPRequestHandler;
}

// Logging interface
export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
}

// Event types for loose coupling
export type ServerEvent =
  | 'server:starting'
  | 'server:started'
  | 'server:stopping'
  | 'server:stopped'
  | 'server:error'
  | 'config:changed'
  | 'cache:cleared'
  | 'n8n:connected'
  | 'n8n:disconnected';

export interface IEventEmitter {
  emit(event: ServerEvent, data?: unknown): void;
  on(event: ServerEvent, listener: (data?: unknown) => void): void;
  off(event: ServerEvent, listener: (data?: unknown) => void): void;
}