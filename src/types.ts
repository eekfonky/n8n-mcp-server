/**
 * Essential type definitions for n8n MCP server
 */

// Workflow types
export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: Record<string, any>;
  settings?: Record<string, any>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion?: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, any>;
  disabled?: boolean;
}

// Execution types
export interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId?: string;
  workflowData?: N8nWorkflow;
  data?: {
    resultData: {
      runData: Record<string, any[]>;
    };
  };
}

// Node type definitions
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
  group: string[];
  icon?: string;
}

export interface N8nNodeProperty {
  displayName: string;
  name: string;
  type: string;
  default: any;
  required?: boolean;
  description?: string;
  options?: Array<{ name: string; value: any }>;
}

export interface N8nCredentialReference {
  name: string;
  required?: boolean;
}

// Credential types
export interface N8nCredential {
  id: string;
  name: string;
  type: string;
  data?: Record<string, any>;
}

// MCP Tool result helper
export interface ToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}
