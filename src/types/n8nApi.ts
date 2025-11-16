/**
 * n8n API Response Types
 *
 * Comprehensive TypeScript types for n8n API responses
 * Based on n8n API documentation: https://docs.n8n.io/api/
 */

export interface N8nApiResponse<T> {
  data: T;
}

export interface N8nApiListResponse<T> {
  data: T[];
  nextCursor?: string;
}

// Workflow Types
export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, {
    id: string;
    name: string;
  }>;
  disabled?: boolean;
  notes?: string;
  notesInFlow?: boolean;
  alwaysOutputData?: boolean;
  executeOnce?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  continueOnFail?: boolean;
  onError?: 'continueErrorOutput' | 'continueRegularOutput' | 'stopWorkflow';
}

export interface WorkflowConnection {
  node: string;
  type: string;
  index: number;
}

export interface WorkflowConnections {
  [key: string]: {
    main?: WorkflowConnection[][];
  };
}

export interface WorkflowSettings {
  executionOrder?: 'v0' | 'v1';
  saveDataErrorExecution?: 'all' | 'none';
  saveDataSuccessExecution?: 'all' | 'none';
  saveManualExecutions?: boolean;
  saveExecutionProgress?: boolean;
  callerPolicy?: string;
  errorWorkflow?: string;
  timezone?: string;
  executionTimeout?: number;
}

export interface WorkflowData {
  id: string;
  name: string;
  active: boolean;
  nodes: WorkflowNode[];
  connections: WorkflowConnections;
  settings?: WorkflowSettings;
  staticData?: any;
  tags?: Array<{ id: string; name: string }>;
  versionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowCreateRequest {
  name: string;
  nodes?: WorkflowNode[];
  connections?: WorkflowConnections;
  active?: boolean;
  settings?: WorkflowSettings;
  staticData?: any;
}

export interface WorkflowUpdateRequest {
  name?: string;
  nodes?: WorkflowNode[];
  connections?: WorkflowConnections;
  active?: boolean;
  settings?: WorkflowSettings;
  staticData?: any;
  versionId?: string;
}

// Execution Types
export interface ExecutionData {
  startData?: {
    destinationNode?: string;
    runNodeFilter?: string[];
  };
  resultData: {
    runData: Record<string, any[]>;
    error?: {
      name: string;
      message: string;
      description?: string;
      stack?: string;
    };
    lastNodeExecuted?: string;
  };
  executionData?: {
    contextData: Record<string, any>;
    nodeExecutionStack: any[];
    waitingExecution: Record<string, any>;
    waitingExecutionSource: Record<string, any>;
  };
}

export interface ExecutionResponse {
  id: string;
  finished: boolean;
  mode: 'manual' | 'trigger' | 'webhook' | 'error' | 'retry' | 'internal';
  retryOf?: string;
  retrySuccessId?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  workflowData?: WorkflowData;
  data: ExecutionData;
  waitTill?: string;
  status: 'new' | 'running' | 'success' | 'error' | 'waiting' | 'canceled' | 'crashed';
}

export interface ExecutionSummary {
  id: string;
  finished: boolean;
  mode: 'manual' | 'trigger' | 'webhook' | 'error' | 'retry' | 'internal';
  retryOf?: string;
  retrySuccessId?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  workflowName?: string;
  waitTill?: string;
  status: 'new' | 'running' | 'success' | 'error' | 'waiting' | 'canceled' | 'crashed';
}

export interface ExecuteWorkflowRequest {
  workflowData?: WorkflowData;
  executionMode?: 'manual' | 'trigger';
  destinationNode?: string;
  runData?: Record<string, any>;
}

// Node Type Types
export interface NodeParameter {
  displayName: string;
  name: string;
  type: string;
  default: any;
  description?: string;
  required?: boolean;
  displayOptions?: Record<string, any>;
  options?: any[];
  routing?: any;
}

export interface NodeProperty {
  displayName: string;
  name: string;
  type: string;
  default: any;
  description?: string;
  required?: boolean;
  displayOptions?: Record<string, any>;
  options?: any[];
}

export interface NodeType {
  name: string;
  displayName: string;
  description: string;
  version: number | number[];
  defaults: {
    name: string;
    color?: string;
  };
  inputs: string[] | Array<{ type: string; displayName?: string }>;
  outputs: string[] | Array<{ type: string; displayName?: string }>;
  properties: NodeProperty[];
  credentials?: Array<{
    name: string;
    required?: boolean;
    displayOptions?: Record<string, any>;
  }>;
  polling?: boolean;
  webhooks?: any[];
  group?: string[];
  icon?: string;
  iconUrl?: string;
  subtitle?: string;
  maxNodes?: number;
}

// Credential Types
export interface CredentialData {
  id: string;
  name: string;
  type: string;
  data?: any;
  createdAt: string;
  updatedAt: string;
  sharedWith?: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  }>;
}

export interface CredentialType {
  name: string;
  displayName: string;
  documentationUrl?: string;
  properties: Array<{
    displayName: string;
    name: string;
    type: string;
    default: any;
    required?: boolean;
  }>;
  authenticate?: any;
  test?: any;
}

// Error Types
export interface N8nApiError {
  message: string;
  code?: string;
  status?: number;
  stack?: string;
  details?: any;
  retryAfter?: string;
}

// Health Check
export interface HealthCheckResponse {
  status: 'ok' | 'error';
}

// Tag Types
export interface TagData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
