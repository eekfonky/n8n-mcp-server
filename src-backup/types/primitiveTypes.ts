/**
 * Comprehensive TypeScript interfaces for n8n MCP Server Primitive Tools
 * Replaces all 'any' types with proper type definitions
 */

// =============================================================================
// COMMON TYPES
// =============================================================================

export type WorkflowStatus = 'active' | 'inactive' | 'error' | 'unknown';
export type ExecutionStatus = 'running' | 'success' | 'error' | 'waiting' | 'canceled' | 'completed';
export type ExecutionMode = 'manual' | 'trigger' | 'webhook' | 'retry' | 'internal';
export type NodeStatus = 'success' | 'error' | 'waiting' | 'disabled';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type ExportFormat = 'json' | 'csv' | 'xml' | 'yaml';
export type TemplateCategory = 'automation' | 'integration' | 'data-processing' | 'notification' | 'webhook' | 'database' | 'api' | 'other';
export type SortOrder = 'asc' | 'desc';
export type TimeFrame = '1h' | '6h' | '24h' | '7d' | '30d';

// =============================================================================
// FILTER INTERFACES
// =============================================================================

export interface BaseFilters {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ExecutionFilters extends BaseFilters {
  status?: ExecutionStatus;
  mode?: ExecutionMode;
  workflowId?: string;
  includeData?: boolean;
}

export interface WorkflowFilters extends BaseFilters {
  status?: WorkflowStatus;
  tags?: string[];
  name?: string;
  includeInactive?: boolean;
}

export interface NodeFilters {
  type?: string;
  name?: string;
  status?: NodeStatus;
  hasCredentials?: boolean;
}

// =============================================================================
// N8N MONITOR TOOL TYPES
// =============================================================================

export interface MonitorParams {
  action: 'status' | 'watch' | 'metrics' | 'logs' | 'health';
  workflowId?: string;
  executionId?: string;
  timeframe?: TimeFrame;
  realTime?: boolean;
  filters?: ExecutionFilters;
}

export interface PerformanceMetrics {
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  executionsPerHour: number;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy';
  n8nConnection: {
    connected: boolean;
    version?: string;
    responseTime?: number;
  };
  system: {
    activeWorkflows: number;
    totalWorkflows: number;
    runningExecutions: number;
    recentActivity: number;
  };
  performance: {
    lastExecutionTime: string | null;
    averageResponseTime?: number;
  };
}

export interface ExecutionLog {
  level: LogLevel;
  message: string;
  timestamp: string;
  source: 'system' | 'node' | 'workflow';
  nodeId?: string;
  error?: any;
}

// =============================================================================
// N8N DEBUG TOOL TYPES
// =============================================================================

export interface DebugParams {
  action: 'analyze' | 'trace' | 'validate' | 'performance' | 'dependencies';
  target: DebugTarget;
  options?: DebugOptions;
}

export interface DebugTarget {
  workflowId?: string;
  executionId?: string;
  nodeId?: string;
  nodeType?: string;
}

export interface DebugOptions {
  includeCredentials?: boolean;
  includeData?: boolean;
  depth?: 'shallow' | 'deep' | 'complete';
  format?: 'summary' | 'detailed' | 'raw';
  timeout?: number;
}

export interface WorkflowAnalysis {
  workflow: {
    id: string;
    name: string;
    nodeCount: number;
    connectionCount: number;
    complexity: number;
  };
  nodes: NodeAnalysis[];
  connections: ConnectionAnalysis[];
  issues: AnalysisIssue[];
  recommendations: string[];
}

export interface NodeAnalysis {
  id: string;
  name: string;
  type: string;
  status: NodeStatus;
  issues: string[];
  performance?: {
    averageExecutionTime: number;
    errorRate: number;
  };
}

export interface ConnectionAnalysis {
  from: string;
  to: string;
  type: 'main' | 'error';
  isValid: boolean;
  issues: string[];
}

export interface AnalysisIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'configuration' | 'connection' | 'performance' | 'security';
  message: string;
  nodeId?: string;
  suggestion?: string;
}

// =============================================================================
// N8N TEMPLATE TOOL TYPES
// =============================================================================

export interface TemplateParams {
  action: 'browse' | 'search' | 'create' | 'apply' | 'analyze' | 'export';
  query?: string;
  category?: TemplateCategory;
  tags?: string[];
  filters?: TemplateFilters;
  sortBy?: 'name' | 'created' | 'updated' | 'usage';
  sortOrder?: SortOrder;
  limit?: number;
  offset?: number;
  groupBy?: 'category' | 'tags' | 'complexity';
  template?: TemplateDefinition;
  workflowId?: string;
  variables?: Record<string, any>;
}

export interface TemplateFilters extends BaseFilters {
  category?: TemplateCategory;
  complexity?: 'simple' | 'medium' | 'complex';
  nodeTypes?: string[];
  hasCredentials?: boolean;
  isPublic?: boolean;
}

export interface TemplateDefinition {
  id?: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  workflow: any; // n8n workflow object
  variables?: TemplateVariable[];
  metadata?: TemplateMetadata;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: string[];
  };
}

export interface TemplateMetadata {
  author?: string;
  version?: string;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
  complexity: number;
  nodeTypes: string[];
  requiredCredentials: string[];
}

// =============================================================================
// N8N BATCH TOOL TYPES
// =============================================================================

export interface BatchParams {
  action: 'create' | 'update' | 'delete' | 'execute' | 'migrate' | 'validate' | 'status';
  target: 'workflows' | 'executions' | 'nodes' | 'credentials';
  operation?: BatchOperation;
  items?: any[];
  filters?: BatchFilters;
  options?: BatchOptions;
  validation?: ValidationOptions;
  migration?: MigrationOptions;
}

export interface BatchOperation {
  type: 'create' | 'update' | 'delete' | 'activate' | 'deactivate' | 'clone' | 'migrate';
  data?: any;
  mapping?: Record<string, string>;
  conditions?: BatchCondition[];
}

export interface BatchCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'exists';
  value: any;
}

export interface BatchFilters extends BaseFilters {
  ids?: string[];
  names?: string[];
  tags?: string[];
  status?: string[];
  nodeTypes?: string[];
  includeInactive?: boolean;
}

export interface BatchOptions {
  concurrency?: number;
  timeout?: number;
  continueOnError?: boolean;
  dryRun?: boolean;
  rollbackOnFailure?: boolean;
  validateBefore?: boolean;
  retryFailures?: boolean;
  maxRetries?: number;
}

export interface ValidationOptions {
  strict?: boolean;
  checkConnections?: boolean;
  validateCredentials?: boolean;
  checkNodeTypes?: boolean;
  rules?: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: string;
  pattern?: string;
  customValidator?: string;
}

export interface MigrationOptions {
  fromVersion?: string;
  toVersion?: string;
  nodeTypeMappings?: Record<string, string>;
  credentialMappings?: Record<string, string>;
  preserveData?: boolean;
  backupOriginal?: boolean;
}

export interface BatchResult {
  operation: string;
  target: string;
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  results: BatchItemResult[];
  errors: BatchError[];
  performance: {
    startTime: string;
    endTime: string;
    duration: number;
    averageItemTime: number;
  };
}

export interface BatchItemResult {
  id: string;
  status: 'success' | 'failed' | 'skipped';
  operation: string;
  message?: string;
  data?: any;
  error?: string;
  timing: {
    start: string;
    end: string;
    duration: number;
  };
}

export interface BatchError {
  itemId?: string;
  operation: string;
  error: string;
  details?: any;
  timestamp: string;
}

// =============================================================================
// N8N EXPORT TOOL TYPES
// =============================================================================

export interface ExportParams {
  action: 'export' | 'schedule' | 'status' | 'download';
  target: 'workflows' | 'executions' | 'logs' | 'metrics';
  format: ExportFormat;
  filters?: ExportFilters;
  options?: ExportOptions;
  jobId?: string;
}

export interface ExportFilters extends BaseFilters {
  workflowIds?: string[];
  executionIds?: string[];
  status?: ExecutionStatus[];
  includeData?: boolean;
  includeCredentials?: boolean;
  anonymize?: boolean;
}

export interface ExportOptions {
  filename?: string;
  compression?: 'none' | 'gzip' | 'zip';
  splitLargeFiles?: boolean;
  maxFileSize?: number;
  includeMetadata?: boolean;
  includeSchema?: boolean;
  customFields?: string[];
  excludeFields?: string[];
  dateFormat?: string;
  timezone?: string;
  encoding?: 'utf8' | 'utf16' | 'ascii';
  streaming?: boolean;
  batchSize?: number;
}

export interface ExportResult {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  target: string;
  format: ExportFormat;
  progress: {
    total: number;
    processed: number;
    percentage: number;
  };
  result?: {
    filename: string;
    size: number;
    downloadUrl?: string;
    records: number;
    metadata: ExportMetadata;
  };
  error?: string;
  timing: {
    startTime: string;
    endTime?: string;
    duration?: number;
  };
}

export interface ExportMetadata {
  version: string;
  exportedAt: string;
  source: {
    n8nVersion?: string;
    serverVersion: string;
  };
  filters: any;
  options: any;
  statistics: {
    totalRecords: number;
    fileSize: number;
    compression?: string;
  };
}

// =============================================================================
// COMMON RESPONSE TYPES
// =============================================================================

export interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: string;
    requestId?: string;
    executionTime?: number;
    version?: string;
  };
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type StringKeys<T> = Extract<keyof T, string>;

export type NonNullable<T> = T extends null | undefined ? never : T;