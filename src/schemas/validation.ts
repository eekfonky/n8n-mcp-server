/**
 * Zod validation schemas for MCP tool inputs
 *
 * Provides runtime validation for all tool parameters
 */

import { z } from 'zod';

// Common schemas
export const workflowIdSchema = z.string().min(1, 'Workflow ID is required');
export const executionIdSchema = z.string().min(1, 'Execution ID is required');
export const nodeIdSchema = z.string().min(1, 'Node ID is required');

// n8n_discover tool schemas
export const discoverSchema = z.object({
  type: z.enum(['workflows', 'nodes', 'executions', 'credentials']),
  filter: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  active: z.boolean().optional(),
});

export type DiscoverParams = z.infer<typeof discoverSchema>;

// n8n_create tool schemas
export const createWorkflowSchema = z.object({
  action: z.literal('workflow'),
  name: z.string().min(1, 'Workflow name is required'),
  active: z.boolean().default(false),
  nodes: z.array(z.any()).optional(),
  connections: z.record(z.any()).optional(),
});

export const createNodeSchema = z.object({
  action: z.literal('node'),
  workflowId: workflowIdSchema,
  nodeType: z.string().min(1, 'Node type is required'),
  nodeName: z.string().min(1, 'Node name is required'),
  parameters: z.record(z.any()).default({}),
  position: z.tuple([z.number(), z.number()]).optional(),
});

export const createSchema = z.discriminatedUnion('action', [
  createWorkflowSchema,
  createNodeSchema,
]);

export type CreateParams = z.infer<typeof createSchema>;

// n8n_execute tool schemas
export const executeSchema = z.object({
  workflowId: workflowIdSchema,
  data: z.record(z.any()).optional(),
  waitForCompletion: z.boolean().default(true),
  timeout: z.number().int().min(1000).max(300000).default(30000),
});

export type ExecuteParams = z.infer<typeof executeSchema>;

// n8n_inspect tool schemas
export const inspectWorkflowSchema = z.object({
  type: z.literal('workflow'),
  id: workflowIdSchema,
  includeNodes: z.boolean().default(true),
  includeConnections: z.boolean().default(true),
});

export const inspectExecutionSchema = z.object({
  type: z.literal('execution'),
  id: executionIdSchema,
  includeData: z.boolean().default(false),
});

export const inspectNodeSchema = z.object({
  type: z.literal('node'),
  nodeType: z.string().min(1, 'Node type is required'),
});

export const inspectSchema = z.discriminatedUnion('type', [
  inspectWorkflowSchema,
  inspectExecutionSchema,
  inspectNodeSchema,
]);

export type InspectParams = z.infer<typeof inspectSchema>;

// n8n_remove tool schemas
export const removeWorkflowSchema = z.object({
  action: z.literal('workflow'),
  workflowId: workflowIdSchema,
  force: z.boolean().default(false),
});

export const removeNodeSchema = z.object({
  action: z.literal('node'),
  workflowId: workflowIdSchema,
  nodeId: nodeIdSchema,
});

export const removeSchema = z.discriminatedUnion('action', [
  removeWorkflowSchema,
  removeNodeSchema,
]);

export type RemoveParams = z.infer<typeof removeSchema>;

// Validation helper function
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: errorMessages };
    }
    return { success: false, error: String(error) };
  }
}
