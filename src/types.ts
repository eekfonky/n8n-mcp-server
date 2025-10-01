export interface N8nConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  tags: string[];
  nodes: N8nNode[];
  connections: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, string>;
}

export interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  retryOf?: string;
  retrySuccessId?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowData: N8nWorkflow;
  data?: {
    resultData: {
      runData: Record<string, any[]>;
    };
  };
}

export interface N8nNodeType {
  name: string;
  displayName: string;
  description: string;
  version: number;
  defaults: Record<string, any>;
  inputs: string[];
  outputs: string[];
  properties: N8nNodeProperty[];
  credentials?: N8nCredentialReference[];
  icon?: string;
  iconUrl?: string;
  group: string[];
  subtitle?: string;
  codex?: {
    categories?: string[];
    subcategories?: Record<string, string[]>;
    resources?: {
      primaryDocumentation?: Array<{
        url: string;
      }>;
    };
  };
}

export interface N8nNodeProperty {
  displayName: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'options' | 'multiOptions' | 'collection' | 'fixedCollection';
  default: any;
  description?: string;
  required?: boolean;
  options?: Array<{
    name: string;
    value: any;
    description?: string;
  }>;
  displayOptions?: {
    show?: Record<string, any[]>;
    hide?: Record<string, any[]>;
  };
}

export interface N8nCredentialReference {
  name: string;
  required?: boolean;
  displayOptions?: {
    show?: Record<string, any[]>;
    hide?: Record<string, any[]>;
  };
}

export interface N8nCredential {
  id: string;
  name: string;
  type: string;
  data?: Record<string, any>;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface RateLimiter {
  requests: number;
  windowStart: number;
  windowSize: number;
  maxRequests: number;
}