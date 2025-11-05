import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { BatchParams, BatchResult, ToolResponse } from '../../types/primitiveTypes.js';
import { deepClone, ConcurrencyController, ArrayOptimizer } from '../../utils/performance.js';
import { EnhancedNodeDiscovery } from '../../discovery/EnhancedNodeDiscovery.js';
import { extractParameters } from '../../utils/parameterExtraction.js';

export class N8nBatchTool {
  private concurrencyController: ConcurrencyController;

  constructor(
    private n8nClient: N8nApiClient,
    private nodeDiscovery: EnhancedNodeDiscovery
  ) {
    this.concurrencyController = new ConcurrencyController(5); // Max 5 concurrent operations
  }

  getTool(): Tool {
    return {
      name: 'n8n_batch',
      description: 'Perform bulk operations on workflows, executions, and nodes',
      inputSchema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['create', 'update', 'delete', 'execute', 'activate', 'deactivate', 'clone', 'migrate'],
            description: 'Type of batch operation to perform'
          },
          targets: {
            type: 'object',
            properties: {
              workflowIds: { type: 'array', items: { type: 'string' } },
              executionIds: { type: 'array', items: { type: 'string' } },
              filter: {
                type: 'object',
                properties: {
                  tags: { type: 'array', items: { type: 'string' } },
                  status: { type: 'string', enum: ['active', 'inactive'] },
                  namePattern: { type: 'string' },
                  nodeType: { type: 'string' },
                  lastExecuted: { type: 'string' }
                }
              }
            },
            description: 'Target workflows or filtering criteria'
          },
          data: {
            type: 'object',
            description: 'Data for batch operations (updates, new workflows, etc.)'
          },
          options: {
            type: 'object',
            properties: {
              concurrent: { type: 'number', default: 3, minimum: 1, maximum: 10 },
              dryRun: { type: 'boolean', default: false },
              continueOnError: { type: 'boolean', default: true },
              timeout: { type: 'number', default: 30000 },
              backup: { type: 'boolean', default: true }
            },
            description: 'Batch operation options'
          }
        },
        required: ['operation', 'targets']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<ToolResponse> {
    const args = extractParameters(request);
    const params = args as unknown as BatchParams;
    const { action, target, operation, items, options = {} } = params;
    const targets = items || [];
    const data = operation?.data || {};

    // Set default options
    const opts = {
      concurrent: 3,
      dryRun: false,
      continueOnError: true,
      timeout: 30000,
      backup: true,
      ...options
    };

    try {
      switch (action) {
        case 'create':
          const createData = await this.batchCreate(targets, data, opts);
          return { success: true, data: createData };

        case 'update':
          const updateData = await this.batchUpdate(targets, data, opts);
          return { success: true, data: updateData };

        case 'delete':
          const deleteData = await this.batchDelete(targets, opts);
          return { success: true, data: deleteData };

        case 'execute':
          const executeData = await this.batchExecute(targets, opts);
          return { success: true, data: executeData };

        case 'migrate':
          const migrateData = await this.batchMigrate(targets, data, opts);
          return { success: true, data: migrateData };

        case 'validate':
          const validateData = await this.batchUpdate(targets, data, opts);
          return { success: true, data: validateData };

        case 'status':
          const statusData = await this.batchExecute(targets, opts);
          return { success: true, data: statusData };

        default:
          throw new Error(`Unknown batch action: ${action}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async resolveTargets(targets: any): Promise<string[]> {
    let workflowIds: string[] = [];

    // Direct workflow IDs
    if (targets.workflowIds) {
      workflowIds = [...targets.workflowIds];
    }

    // Resolve by filter
    if (targets.filter) {
      const workflows = await this.n8nClient.getWorkflows();
      const filtered = workflows.filter((workflow: any) => {
        let matches = true;

        // Filter by tags
        if (targets.filter.tags) {
          const workflowTags = workflow.tags?.map((tag: any) => tag.name) || [];
          matches = matches && targets.filter.tags.some((tag: string) => workflowTags.includes(tag));
        }

        // Filter by status
        if (targets.filter.status) {
          const isActive = workflow.active;
          matches = matches && (
            (targets.filter.status === 'active' && isActive) ||
            (targets.filter.status === 'inactive' && !isActive)
          );
        }

        // Filter by name pattern
        if (targets.filter.namePattern) {
          const pattern = new RegExp(targets.filter.namePattern, 'i');
          matches = matches && pattern.test(workflow.name);
        }

        // Filter by node type
        if (targets.filter.nodeType) {
          const hasNodeType = workflow.nodes?.some((node: any) =>
            node.type === targets.filter.nodeType);
          matches = matches && hasNodeType;
        }

        // Filter by last executed
        if (targets.filter.lastExecuted) {
          // This would require checking execution history
          // For now, we'll skip this filter
        }

        return matches;
      });

      workflowIds = [...workflowIds, ...filtered.map((wf: any) => wf.id)];
    }

    // Remove duplicates
    return [...new Set(workflowIds)];
  }

  private async batchCreate(targets: any, data: any, options: any) {
    if (!data?.workflows || !Array.isArray(data.workflows)) {
      throw new Error('Workflows array is required for batch create');
    }

    const results = {
      operation: 'create',
      total: data.workflows.length,
      successful: [] as any[],
      failed: [] as any[],
      dryRun: options.dryRun
    };

    if (options.dryRun) {
      results.successful = data.workflows.map((workflow: any, index: number) => ({
        index,
        name: workflow.name,
        status: 'would_create',
        nodes: workflow.nodes?.length || 0
      }));
      return { batch: results, timestamp: new Date().toISOString() };
    }

    // Process workflows in batches
    const batches = this.chunkArray(data.workflows, options.concurrent);

    for (const batch of batches) {
      const promises = batch.map(async (workflow: any, index: number) => {
        try {
          const created = await this.n8nClient.createWorkflow(workflow);
          results.successful.push({
            index,
            id: created.id,
            name: created.name,
            status: 'created'
          });
        } catch (error) {
          const errorInfo = {
            index,
            name: workflow.name,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'failed'
          };
          results.failed.push(errorInfo);

          if (!options.continueOnError) {
            throw error;
          }
        }
      });

      await Promise.all(promises);
    }

    return {
      batch: results,
      summary: {
        total: results.total,
        created: results.successful.length,
        failed: results.failed.length,
        successRate: (results.successful.length / results.total) * 100
      },
      timestamp: new Date().toISOString()
    };
  }

  private async batchUpdate(targets: any, data: any, options: any) {
    const workflowIds = await this.resolveTargets(targets);

    const results = {
      operation: 'update',
      total: workflowIds.length,
      successful: [] as any[],
      failed: [] as any[],
      dryRun: options.dryRun
    };

    if (options.dryRun) {
      const workflows = await Promise.all(
        workflowIds.map(id => this.n8nClient.getWorkflow(id).catch(() => null))
      );

      results.successful = workflows
        .filter(wf => wf)
        .map((workflow: any) => ({
          id: workflow.id,
          name: workflow.name,
          status: 'would_update',
          changes: Object.keys(data.updates || {})
        }));
      return { batch: results, timestamp: new Date().toISOString() };
    }

    // Create backup if requested
    let backup: any[] = [];
    if (options.backup) {
      backup = await this.createBackup(workflowIds);
    }

    // Process updates in batches
    const batches = this.chunkArray(workflowIds, options.concurrent);

    for (const batch of batches) {
      const promises = batch.map(async (workflowId: string) => {
        try {
          const current = await this.n8nClient.getWorkflow(workflowId);
          const updated = { ...current, ...data.updates };

          const result = await this.n8nClient.updateWorkflow(workflowId, updated);
          results.successful.push({
            id: workflowId,
            name: result.name,
            status: 'updated'
          });
        } catch (error) {
          const errorInfo = {
            id: workflowId,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'failed'
          };
          results.failed.push(errorInfo);

          if (!options.continueOnError) {
            throw error;
          }
        }
      });

      await Promise.all(promises);
    }

    return {
      batch: results,
      backup: options.backup ? { created: true, count: backup.length } : null,
      summary: {
        total: results.total,
        updated: results.successful.length,
        failed: results.failed.length,
        successRate: (results.successful.length / results.total) * 100
      },
      timestamp: new Date().toISOString()
    };
  }

  private async batchDelete(targets: any, options: any) {
    const workflowIds = await this.resolveTargets(targets);

    const results = {
      operation: 'delete',
      total: workflowIds.length,
      successful: [] as any[],
      failed: [] as any[],
      dryRun: options.dryRun
    };

    if (options.dryRun) {
      const workflows = await Promise.all(
        workflowIds.map(id => this.n8nClient.getWorkflow(id).catch(() => null))
      );

      results.successful = workflows
        .filter(wf => wf)
        .map((workflow: any) => ({
          id: workflow.id,
          name: workflow.name,
          status: 'would_delete'
        }));
      return { batch: results, timestamp: new Date().toISOString() };
    }

    // Create backup before deletion
    let backup: any[] = [];
    if (options.backup) {
      backup = await this.createBackup(workflowIds);
    }

    // Process deletions in batches
    const batches = this.chunkArray(workflowIds, options.concurrent);

    for (const batch of batches) {
      const promises = batch.map(async (workflowId: string) => {
        try {
          const workflow = await this.n8nClient.getWorkflow(workflowId);
          await this.n8nClient.deleteWorkflow(workflowId);

          results.successful.push({
            id: workflowId,
            name: workflow.name,
            status: 'deleted'
          });
        } catch (error) {
          const errorInfo = {
            id: workflowId,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'failed'
          };
          results.failed.push(errorInfo);

          if (!options.continueOnError) {
            throw error;
          }
        }
      });

      await Promise.all(promises);
    }

    return {
      batch: results,
      backup: options.backup ? { created: true, count: backup.length } : null,
      warning: 'Deleted workflows cannot be recovered without backup',
      summary: {
        total: results.total,
        deleted: results.successful.length,
        failed: results.failed.length,
        successRate: (results.successful.length / results.total) * 100
      },
      timestamp: new Date().toISOString()
    };
  }

  private async batchExecute(targets: any, options: any) {
    const workflowIds = await this.resolveTargets(targets);

    const results = {
      operation: 'execute',
      total: workflowIds.length,
      successful: [] as any[],
      failed: [] as any[],
      executions: [] as any[]
    };

    if (options.dryRun) {
      const workflows = await Promise.all(
        workflowIds.map(id => this.n8nClient.getWorkflow(id).catch(() => null))
      );

      results.successful = workflows
        .filter(wf => wf)
        .map((workflow: any) => ({
          id: workflow.id,
          name: workflow.name,
          status: 'would_execute'
        }));
      return { batch: results, timestamp: new Date().toISOString() };
    }

    // Execute workflows in batches with monitoring
    const batches = this.chunkArray(workflowIds, options.concurrent);

    for (const batch of batches) {
      const promises = batch.map(async (workflowId: string) => {
        try {
          const workflow = await this.n8nClient.getWorkflow(workflowId);
          const execution = await this.n8nClient.executeWorkflow(workflowId);

          // Monitor execution with timeout
          const executionResult = await this.monitorExecution(execution.id, options.timeout);

          results.successful.push({
            id: workflowId,
            name: workflow.name,
            executionId: execution.id,
            status: 'executed'
          });

          results.executions.push({
            workflowId,
            executionId: execution.id,
            status: executionResult.status,
            duration: executionResult.duration
          });
        } catch (error) {
          const errorInfo = {
            id: workflowId,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'failed'
          };
          results.failed.push(errorInfo);

          if (!options.continueOnError) {
            throw error;
          }
        }
      });

      await Promise.all(promises);
    }

    return {
      batch: results,
      summary: {
        total: results.total,
        executed: results.successful.length,
        failed: results.failed.length,
        successRate: (results.successful.length / results.total) * 100,
        averageDuration: results.executions.length > 0 ?
          results.executions.reduce((sum, exec) => sum + (exec.duration || 0), 0) / results.executions.length : 0
      },
      timestamp: new Date().toISOString()
    };
  }

  private async batchActivation(targets: any, activate: boolean, options: any) {
    const workflowIds = await this.resolveTargets(targets);
    const operation = activate ? 'activate' : 'deactivate';

    const results = {
      operation,
      total: workflowIds.length,
      successful: [] as any[],
      failed: [] as any[],
      dryRun: options.dryRun
    };

    if (options.dryRun) {
      const workflows = await Promise.all(
        workflowIds.map(id => this.n8nClient.getWorkflow(id).catch(() => null))
      );

      results.successful = workflows
        .filter(wf => wf)
        .map((workflow: any) => ({
          id: workflow.id,
          name: workflow.name,
          currentStatus: workflow.active ? 'active' : 'inactive',
          status: `would_${operation}`
        }));
      return { batch: results, timestamp: new Date().toISOString() };
    }

    // Process activation/deactivation in batches
    const batches = this.chunkArray(workflowIds, options.concurrent);

    for (const batch of batches) {
      const promises = batch.map(async (workflowId: string) => {
        try {
          const workflow = await this.n8nClient.getWorkflow(workflowId);

          if (workflow.active === activate) {
            results.successful.push({
              id: workflowId,
              name: workflow.name,
              status: `already_${activate ? 'active' : 'inactive'}`
            });
            return;
          }

          const updated = await this.n8nClient.updateWorkflow(workflowId, {
            ...workflow,
            active: activate
          });

          results.successful.push({
            id: workflowId,
            name: updated.name,
            status: activate ? 'activated' : 'deactivated'
          });
        } catch (error) {
          const errorInfo = {
            id: workflowId,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'failed'
          };
          results.failed.push(errorInfo);

          if (!options.continueOnError) {
            throw error;
          }
        }
      });

      await Promise.all(promises);
    }

    return {
      batch: results,
      summary: {
        total: results.total,
        processed: results.successful.length,
        failed: results.failed.length,
        successRate: (results.successful.length / results.total) * 100
      },
      timestamp: new Date().toISOString()
    };
  }

  private async batchClone(targets: any, data: any, options: any) {
    const workflowIds = await this.resolveTargets(targets);

    const results = {
      operation: 'clone',
      total: workflowIds.length,
      successful: [] as any[],
      failed: [] as any[],
      dryRun: options.dryRun
    };

    if (options.dryRun) {
      const workflows = await Promise.all(
        workflowIds.map(id => this.n8nClient.getWorkflow(id).catch(() => null))
      );

      results.successful = workflows
        .filter(wf => wf)
        .map((workflow: any) => ({
          sourceId: workflow.id,
          sourceName: workflow.name,
          cloneName: `${workflow.name} (Copy)`,
          status: 'would_clone'
        }));
      return { batch: results, timestamp: new Date().toISOString() };
    }

    // Process cloning in batches
    const batches = this.chunkArray(workflowIds, options.concurrent);

    for (const batch of batches) {
      const promises = batch.map(async (workflowId: string) => {
        try {
          const original = await this.n8nClient.getWorkflow(workflowId);

          // Create clone data
          const cloneData = {
            ...original,
            name: data?.namePrefix ?
              `${data.namePrefix}${original.name}` :
              `${original.name} (Copy)`,
            active: false // Start clones as inactive
          };

          delete (cloneData as any).id;
          delete (cloneData as any).createdAt;
          delete (cloneData as any).updatedAt;

          // Apply any modifications from data
          if (data?.modifications) {
            Object.assign(cloneData, data.modifications);
          }

          const cloned = await this.n8nClient.createWorkflow(cloneData);

          results.successful.push({
            sourceId: workflowId,
            sourceName: original.name,
            cloneId: cloned.id,
            cloneName: cloned.name,
            status: 'cloned'
          });
        } catch (error) {
          const errorInfo = {
            sourceId: workflowId,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'failed'
          };
          results.failed.push(errorInfo);

          if (!options.continueOnError) {
            throw error;
          }
        }
      });

      await Promise.all(promises);
    }

    return {
      batch: results,
      summary: {
        total: results.total,
        cloned: results.successful.length,
        failed: results.failed.length,
        successRate: (results.successful.length / results.total) * 100
      },
      timestamp: new Date().toISOString()
    };
  }

  private async batchMigrate(targets: any, data: any, options: any) {
    const workflowIds = await this.resolveTargets(targets);

    const results = {
      operation: 'migrate',
      total: workflowIds.length,
      successful: [] as any[],
      failed: [] as any[],
      migrations: [] as any[],
      dryRun: options.dryRun
    };

    if (!data?.migrations || !Array.isArray(data.migrations)) {
      throw new Error('Migrations array is required for batch migrate');
    }

    if (options.dryRun) {
      const workflows = await Promise.all(
        workflowIds.map(id => this.n8nClient.getWorkflow(id).catch(() => null))
      );

      results.successful = workflows
        .filter(wf => wf)
        .map((workflow: any) => ({
          id: workflow.id,
          name: workflow.name,
          migrationCount: data.migrations.length,
          status: 'would_migrate'
        }));
      return { batch: results, timestamp: new Date().toISOString() };
    }

    // Process migrations in batches
    const batches = this.chunkArray(workflowIds, options.concurrent);

    for (const batch of batches) {
      const promises = batch.map(async (workflowId: string) => {
        try {
          let workflow = await this.n8nClient.getWorkflow(workflowId);
          const appliedMigrations: string[] = [];

          // Apply each migration
          for (const migration of data.migrations) {
            workflow = await this.applyMigration(workflow, migration);
            appliedMigrations.push(migration.name || migration.type);
          }

          // Update the workflow
          const updated = await this.n8nClient.updateWorkflow(workflowId, workflow);

          results.successful.push({
            id: workflowId,
            name: updated.name,
            migrationsApplied: appliedMigrations,
            status: 'migrated'
          });

          results.migrations.push({
            workflowId,
            migrations: appliedMigrations
          });
        } catch (error) {
          const errorInfo = {
            id: workflowId,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'failed'
          };
          results.failed.push(errorInfo);

          if (!options.continueOnError) {
            throw error;
          }
        }
      });

      await Promise.all(promises);
    }

    return {
      batch: results,
      summary: {
        total: results.total,
        migrated: results.successful.length,
        failed: results.failed.length,
        successRate: (results.successful.length / results.total) * 100,
        totalMigrations: results.migrations.reduce((sum, m) => sum + m.migrations.length, 0)
      },
      timestamp: new Date().toISOString()
    };
  }

  private async applyMigration(workflow: any, migration: any) {
    const migrated = deepClone(workflow);

    switch (migration.type) {
      case 'node_replacement':
        if (migrated.nodes) {
          migrated.nodes.forEach((node: any) => {
            if (node.type === migration.from) {
              node.type = migration.to;
              if (migration.parameterMapping) {
                this.mapParameters(node, migration.parameterMapping);
              }
            }
          });
        }
        break;

      case 'parameter_update':
        if (migrated.nodes) {
          migrated.nodes
            .filter((node: any) =>
              !migration.nodeType || node.type === migration.nodeType)
            .forEach((node: any) => {
              if (node.parameters) {
                Object.assign(node.parameters, migration.parameters);
              }
            });
        }
        break;

      case 'credential_migration':
        if (migrated.nodes) {
          migrated.nodes.forEach((node: any) => {
            if (node.credentials && migration.credentialMapping) {
              Object.entries(migration.credentialMapping).forEach(([oldType, newType]) => {
                if (node.credentials[oldType]) {
                  node.credentials[newType as string] = node.credentials[oldType];
                  delete node.credentials[oldType];
                }
              });
            }
          });
        }
        break;

      case 'workflow_property':
        Object.assign(migrated, migration.properties);
        break;

      default:
        throw new Error(`Unknown migration type: ${migration.type}`);
    }

    return migrated;
  }

  private mapParameters(node: any, mapping: Record<string, string>) {
    if (!node.parameters) return;

    const newParameters: any = {};
    Object.entries(node.parameters).forEach(([key, value]) => {
      const newKey = mapping[key] || key;
      newParameters[newKey] = value;
    });

    node.parameters = newParameters;
  }

  private async createBackup(workflowIds: string[]): Promise<any[]> {
    const backup: any[] = [];

    for (const workflowId of workflowIds) {
      try {
        const workflow = await this.n8nClient.getWorkflow(workflowId);
        backup.push({
          id: workflowId,
          backup: workflow,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        // Continue with backup even if some workflows fail
        backup.push({
          id: workflowId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    }

    return backup;
  }

  private async monitorExecution(executionId: string, timeout: number): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second

    while (Date.now() - startTime < timeout) {
      try {
        const execution = await this.n8nClient.getExecution(executionId);

        if (execution.finished) {
          return {
            status: execution.data?.resultData && 'error' in execution.data.resultData ? 'failed' : 'success',
            duration: execution.stoppedAt ?
              new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime() : null
          };
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        return {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return {
      status: 'timeout',
      duration: timeout
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}