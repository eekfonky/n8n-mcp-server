import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { MonitorParams, ToolResponse, ExecutionLog, SystemHealth } from '../../types/primitiveTypes.js';
import { ErrorHandler, Validator, N8nApiError, ValidationError, TimeoutError } from '../../types/errors.js';
import { extractParameters } from '../../utils/parameterExtraction.js';

export class N8nMonitorTool {
  constructor(private n8nClient: N8nApiClient) {}

  getTool(): Tool {
    return {
      name: 'n8n_monitor',
      description: 'Monitor workflow executions and performance metrics in real-time',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['status', 'watch', 'metrics', 'logs', 'health'],
            description: 'Type of monitoring action to perform'
          },
          workflowId: {
            type: 'string',
            description: 'Specific workflow ID to monitor'
          },
          executionId: {
            type: 'string',
            description: 'Specific execution ID to monitor'
          },
          timeframe: {
            type: 'string',
            enum: ['1h', '6h', '24h', '7d', '30d'],
            description: 'Time frame for metrics',
            default: '24h'
          },
          realTime: {
            type: 'boolean',
            description: 'Enable real-time monitoring (for watch action)',
            default: false
          },
          filters: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['running', 'success', 'error', 'waiting', 'canceled']
              },
              startDate: { type: 'string' },
              endDate: { type: 'string' }
            },
            description: 'Filters for execution monitoring'
          }
        },
        required: ['action']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<ToolResponse> {
    try {
      const args = extractParameters(request);
      const params = args as unknown as MonitorParams;

      // Input validation
      Validator.validateRequired(params.action, 'action');
      Validator.validateEnum(params.action, 'action', ['status', 'watch', 'metrics', 'logs', 'health']);

      if (params.timeframe) {
        Validator.validateEnum(params.timeframe, 'timeframe', ['1h', '6h', '24h', '7d', '30d']);
      }

      if (params.workflowId) {
        Validator.validateString(params.workflowId, 'workflowId', 1, 100);
      }

      if (params.executionId) {
        Validator.validateString(params.executionId, 'executionId', 1, 100);
      }

      const { action, workflowId, executionId, timeframe = '24h', realTime = false, filters } = params;
      switch (action) {
        case 'status':
          const statusData = await ErrorHandler.withTimeout(
            () => this.getExecutionStatus(workflowId, executionId),
            10000,
            'getExecutionStatus'
          );
          return { success: true, data: statusData };

        case 'watch':
          const watchData = await ErrorHandler.withTimeout(
            () => this.watchExecutions(workflowId, filters, realTime),
            15000,
            'watchExecutions'
          );
          return { success: true, data: watchData };

        case 'metrics':
          const metricsData = await ErrorHandler.withTimeout(
            () => this.getPerformanceMetrics(timeframe, workflowId),
            20000,
            'getPerformanceMetrics'
          );
          return { success: true, data: metricsData };

        case 'logs':
          const logsData = await ErrorHandler.withTimeout(
            () => this.getExecutionLogs(executionId, workflowId),
            15000,
            'getExecutionLogs'
          );
          return { success: true, data: logsData };

        case 'health':
          const healthData = await ErrorHandler.withTimeout(
            () => this.getSystemHealth(),
            10000,
            'getSystemHealth'
          );
          return { success: true, data: healthData };

        default:
          throw new Error(`Unknown monitoring action: ${action}`);
      }
    } catch (error) {
      return ErrorHandler.createErrorResponse(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async getExecutionStatus(workflowId?: string, executionId?: string) {
    if (executionId) {
      const execution = await this.n8nClient.getExecution(executionId);
      return {
        execution: {
          id: execution.id,
          workflowId: execution.workflowData?.id,
          status: execution.finished ? 'completed' : 'running',
          mode: execution.mode,
          startedAt: execution.startedAt,
          stoppedAt: execution.stoppedAt,
          executionTime: execution.stoppedAt ?
            new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime() : null,
          success: !(execution.data?.resultData && 'error' in execution.data.resultData)
        },
        timestamp: new Date().toISOString()
      };
    }

    if (workflowId) {
      const executions = await this.n8nClient.getExecutions(workflowId, 10);
      return {
        workflow: { id: workflowId },
        recentExecutions: executions.map(exec => ({
          id: exec.id,
          status: exec.finished ? 'completed' : 'running',
          startedAt: exec.startedAt,
          success: !(exec.data?.resultData && 'error' in exec.data.resultData)
        })),
        timestamp: new Date().toISOString()
      };
    }

    // Get overall status
    const executions = await this.n8nClient.getExecutions(undefined, 50);
    const running = executions.filter(e => !e.finished);
    const recent = executions.slice(0, 10);

    return {
      overview: {
        totalRunning: running.length,
        runningExecutions: running.map(e => ({
          id: e.id,
          workflowId: e.workflowData?.id,
          startedAt: e.startedAt
        })),
        recentExecutions: recent.map(e => ({
          id: e.id,
          workflowId: e.workflowData?.id,
          status: e.finished ? 'completed' : 'running',
          success: !(e.data?.resultData && 'error' in e.data.resultData)
        }))
      },
      timestamp: new Date().toISOString()
    };
  }

  private async watchExecutions(workflowId?: string, filters?: MonitorParams['filters'], realTime: boolean = false) {
    const executions = await this.n8nClient.getExecutions(workflowId, 20);

    let filteredExecutions = executions;
    if (filters?.status) {
      filteredExecutions = executions.filter(e => {
        const status = e.finished ? (e.data?.resultData && 'error' in e.data.resultData ? 'error' : 'success') : 'running';
        return status === filters.status;
      });
    }

    if (filters?.startDate || filters?.endDate) {
      filteredExecutions = filteredExecutions.filter(e => {
        const execDate = new Date(e.startedAt);
        if (filters.startDate && execDate < new Date(filters.startDate)) return false;
        if (filters.endDate && execDate > new Date(filters.endDate)) return false;
        return true;
      });
    }

    return {
      monitoring: {
        workflowId: workflowId || 'all',
        filters,
        realTime,
        executions: filteredExecutions.map(e => ({
          id: e.id,
          workflowId: e.workflowData?.id,
          status: e.finished ? (e.data?.resultData && 'error' in e.data.resultData ? 'error' : 'success') : 'running',
          startedAt: e.startedAt,
          duration: e.stoppedAt ?
            new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime() : null
        })),
        summary: {
          total: filteredExecutions.length,
          running: filteredExecutions.filter(e => !e.finished).length,
          succeeded: filteredExecutions.filter(e => e.finished && !(e.data?.resultData && 'error' in e.data.resultData)).length,
          failed: filteredExecutions.filter(e => e.finished && e.data?.resultData && 'error' in e.data.resultData).length
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  private async getPerformanceMetrics(timeframe: string, workflowId?: string) {
    const executions = await this.n8nClient.getExecutions(workflowId, 100);

    // Calculate time range based on timeframe
    const now = new Date();
    const timeRanges = {
      '1h': 1 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const timeRange = timeRanges[timeframe as keyof typeof timeRanges];
    const cutoff = new Date(now.getTime() - timeRange);

    const recentExecutions = executions.filter(e =>
      new Date(e.startedAt) >= cutoff
    );

    // Calculate metrics
    const completed = recentExecutions.filter(e => e.finished);
    const successful = completed.filter(e => !(e.data?.resultData && 'error' in e.data.resultData));
    const failed = completed.filter(e => e.data?.resultData && 'error' in e.data.resultData);

    const executionTimes = completed
      .filter(e => e.stoppedAt)
      .map(e => new Date(e.stoppedAt!).getTime() - new Date(e.startedAt).getTime());

    const avgExecutionTime = executionTimes.length > 0 ?
      executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length : 0;

    return {
      metrics: {
        timeframe,
        workflowId: workflowId || 'all',
        period: {
          start: cutoff.toISOString(),
          end: now.toISOString()
        },
        executions: {
          total: recentExecutions.length,
          completed: completed.length,
          running: recentExecutions.filter(e => !e.finished).length,
          successful: successful.length,
          failed: failed.length,
          successRate: completed.length > 0 ? (successful.length / completed.length) * 100 : 0
        },
        performance: {
          averageExecutionTime: Math.round(avgExecutionTime),
          minExecutionTime: executionTimes.length > 0 ? Math.min(...executionTimes) : 0,
          maxExecutionTime: executionTimes.length > 0 ? Math.max(...executionTimes) : 0,
          executionsPerHour: timeframe === '1h' ? recentExecutions.length :
            Math.round(recentExecutions.length / (timeRange / (60 * 60 * 1000)))
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  private async getExecutionLogs(executionId?: string, workflowId?: string) {
    if (executionId) {
      const execution = await this.n8nClient.getExecution(executionId);
      return {
        execution: {
          id: executionId,
          logs: this.extractExecutionLogs(execution),
          nodes: execution.data?.resultData?.runData ?
            Object.keys(execution.data.resultData.runData).map(nodeId => {
              const nodeRun = execution.data?.resultData?.runData?.[nodeId]?.[0];
              return {
                nodeId,
                status: nodeRun?.error ? 'error' : 'success',
                data: nodeRun?.data?.main?.[0] || [],
                error: nodeRun?.error
              };
            }) : []
        },
        timestamp: new Date().toISOString()
      };
    }

    // Get recent execution logs for workflow
    const executions = await this.n8nClient.getExecutions(workflowId, 5);
    return {
      recentLogs: executions.map(exec => ({
        id: exec.id,
        workflowId: exec.workflowData?.id,
        status: exec.finished ? (exec.data?.resultData && 'error' in exec.data.resultData ? 'error' : 'success') : 'running',
        startedAt: exec.startedAt,
        logs: this.extractExecutionLogs(exec)
      })),
      timestamp: new Date().toISOString()
    };
  }

  private extractExecutionLogs(execution: any): ExecutionLog[] {
    const logs: ExecutionLog[] = [];

    // Extract basic execution info
    logs.push({
      level: 'info' as const,
      message: `Execution started`,
      timestamp: execution.startedAt || new Date().toISOString(),
      source: 'system' as const
    });

    if (execution.finished) {
      const hasError = execution.data?.resultData && 'error' in execution.data.resultData;
      logs.push({
        level: hasError ? 'error' as const : 'info' as const,
        message: hasError ?
          `Execution failed: ${execution.data.resultData.error.message}` :
          'Execution completed successfully',
        timestamp: execution.stoppedAt || new Date().toISOString(),
        source: 'system' as const
      });
    }

    // Extract node-level logs
    if (execution.data?.resultData?.runData) {
      Object.entries(execution.data.resultData.runData).forEach(([nodeId, nodeData]: [string, any]) => {
        const nodeRun = Array.isArray(nodeData) ? nodeData[0] : nodeData;
        if (nodeRun?.error) {
          logs.push({
            level: 'error' as const,
            message: `Node ${nodeId} failed: ${nodeRun.error.message}`,
            timestamp: nodeRun.startTime || execution.startedAt || new Date().toISOString(),
            source: 'node' as const,
            nodeId
          });
        } else {
          logs.push({
            level: 'info' as const,
            message: `Node ${nodeId} executed successfully`,
            timestamp: nodeRun.startTime || execution.startedAt || new Date().toISOString(),
            source: 'node' as const,
            nodeId
          });
        }
      });
    }

    return logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private async getSystemHealth() {
    try {
      const healthCheck = await this.n8nClient.validateConnection();
      const executions = await this.n8nClient.getExecutions(undefined, 10);
      const workflows = await this.n8nClient.getWorkflows();

      const now = new Date();
      const recentExecutions = executions.filter(e =>
        new Date(e.startedAt) > new Date(now.getTime() - 5 * 60 * 1000) // Last 5 minutes
      );

      return {
        health: {
          status: healthCheck.valid ? 'healthy' : 'unhealthy',
          n8nConnection: {
            connected: healthCheck.valid,
            version: healthCheck.version,
            responseTime: (healthCheck as any).responseTime || 0
          },
          system: {
            activeWorkflows: workflows.filter((w: any) => w.active).length,
            totalWorkflows: workflows.length,
            runningExecutions: executions.filter(e => !e.finished).length,
            recentActivity: recentExecutions.length
          },
          performance: {
            lastExecutionTime: executions.length > 0 ? executions[0]?.startedAt : null,
            averageResponseTime: (healthCheck as any).responseTime || 0
          }
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        health: {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          n8nConnection: { connected: false }
        },
        timestamp: new Date().toISOString()
      };
    }
  }
}