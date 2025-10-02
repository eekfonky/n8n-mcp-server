import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8nApiClient } from '../../n8nClient.js';
import { TemplateParams, TemplateDefinition, TemplateVariable, TemplateMetadata, ToolResponse } from '../../types/primitiveTypes.js';
import { deepClone, DataTransformer } from '../../utils/performance.js';
import { EnhancedNodeDiscovery } from '../../discovery/EnhancedNodeDiscovery.js';
import { N8nWorkflow } from '../../types.js';

export class N8nTemplateTool {
  constructor(
    private n8nClient: N8nApiClient,
    private nodeDiscovery: EnhancedNodeDiscovery
  ) {}

  getTool(): Tool {
    return {
      name: 'n8n_template',
      description: 'Create, manage, and use workflow templates and patterns',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'apply', 'list', 'generate', 'analyze', 'export'],
            description: 'Template action to perform'
          },
          template: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              category: { type: 'string' },
              description: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              workflow: { type: 'object' },
              parameters: { type: 'object' }
            },
            description: 'Template definition'
          },
          source: {
            type: 'object',
            properties: {
              workflowId: { type: 'string' },
              pattern: { type: 'string' },
              category: { type: 'string' }
            },
            description: 'Source for template creation or pattern matching'
          },
          target: {
            type: 'object',
            properties: {
              workflowId: { type: 'string' },
              name: { type: 'string' },
              variables: { type: 'object' }
            },
            description: 'Target for template application'
          },
          options: {
            type: 'object',
            properties: {
              includeCredentials: { type: 'boolean', default: false },
              generateVariables: { type: 'boolean', default: true },
              validateNodes: { type: 'boolean', default: true }
            },
            description: 'Template processing options'
          }
        },
        required: ['action']
      }
    };
  }

  async handleToolCall(request: CallToolRequest): Promise<ToolResponse> {
    const params = request.params as unknown as TemplateParams;
    const { action, template, workflowId, variables, filters, sortBy = 'name', limit = 20 } = params;

    try {
      switch (action) {
        case 'create':
          const createData = await this.createTemplate(workflowId, template, {});
          return { success: true, data: createData };

        case 'apply':
          const applyData = await this.applyTemplate(template, workflowId, {});
          return { success: true, data: applyData };

        case 'browse':
          const browseData = await this.listTemplates();
          return { success: true, data: browseData };

        case 'search':
          const searchData = await this.listTemplates(filters?.category);
          return { success: true, data: searchData };

        case 'analyze':
          const analyzeData = await this.analyzeWorkflowPatterns(workflowId, {});
          return { success: true, data: analyzeData };

        case 'export':
          const exportData = await this.generateTemplate(template, {});
          return { success: true, data: exportData };

        default:
          throw new Error(`Unknown template action: ${action}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async createTemplate(source: any, templateDef: any, options: any) {
    if (!source?.workflowId && !templateDef?.workflow) {
      throw new Error('Must provide source workflowId or template workflow definition');
    }

    let workflow: N8nWorkflow;

    if (source?.workflowId) {
      workflow = await this.n8nClient.getWorkflow(source.workflowId);
    } else {
      workflow = templateDef.workflow;
    }

    // Clean up workflow for template use
    const template = await this.createTemplateFromWorkflow(workflow, templateDef, options);

    return {
      template: {
        id: `template_${Date.now()}`,
        name: templateDef?.name || workflow.name || 'Unnamed Template',
        category: templateDef?.category || this.inferCategory(workflow),
        description: templateDef?.description || workflow.name + " - Template" || 'Generated template',
        tags: templateDef?.tags || this.generateTags(workflow),
        created: new Date().toISOString(),
        workflow: template.workflow,
        variables: template.variables,
        metadata: template.metadata
      },
      summary: {
        nodeCount: template.workflow.nodes?.length || 0,
        variableCount: Object.keys(template.variables).length,
        complexity: this.calculateComplexity(template.workflow)
      },
      timestamp: new Date().toISOString()
    };
  }

  private async createTemplateFromWorkflow(workflow: N8nWorkflow, templateDef: any, options: any) {
    const cleanedWorkflow = DataTransformer.cleanWorkflow(workflow);
    const variables: Record<string, any> = {};
    const metadata: any = {
      originalId: workflow.id,
      nodeTypes: [],
      connections: 0,
      requiredCredentials: []
    };

    // Remove instance-specific data
    delete cleanedWorkflow.id;
    delete cleanedWorkflow.createdAt;
    delete cleanedWorkflow.updatedAt;
    cleanedWorkflow.active = false;

    if (cleanedWorkflow.nodes) {
      cleanedWorkflow.nodes.forEach((node: any, index: number) => {
        // Track node types
        if (!metadata.nodeTypes.includes(node.type)) {
          metadata.nodeTypes.push(node.type);
        }

        // Generate variables for common parameters
        if (options.generateVariables && node.parameters) {
          this.extractVariablesFromNode(node, variables, index);
        }

        // Handle credentials
        if (node.credentials) {
          Object.keys(node.credentials).forEach(credType => {
            if (!metadata.requiredCredentials.includes(credType)) {
              metadata.requiredCredentials.push(credType);
            }
          });

          if (!options.includeCredentials) {
            // Replace with template placeholders
            Object.keys(node.credentials).forEach(credType => {
              node.credentials[credType] = {
                id: `{{credential_${credType}}}`,
                name: `Template ${credType} credential`
              };
            });
          }
        }
      });
    }

    // Count connections
    if (cleanedWorkflow.connections) {
      metadata.connections = Object.values(cleanedWorkflow.connections).reduce((total: number, nodeConns: any) => {
        return total + Object.values(nodeConns).reduce((nodeTotal: number, connections: any) => {
          return nodeTotal + connections.length;
        }, 0);
      }, 0);
    }

    return {
      workflow: cleanedWorkflow,
      variables,
      metadata
    };
  }

  private extractVariablesFromNode(node: any, variables: Record<string, any>, nodeIndex: number) {
    const variablePrefix = `node_${nodeIndex}_`;

    // Common parameters to parameterize
    const parameterPatterns = [
      { key: 'url', pattern: /https?:\/\/[^\s]+/ },
      { key: 'apiKey', pattern: /^[a-zA-Z0-9_-]+$/ },
      { key: 'endpoint', pattern: /^\/.*/ },
      { key: 'collection', pattern: /^[a-zA-Z0-9_-]+$/ },
      { key: 'table', pattern: /^[a-zA-Z0-9_-]+$/ },
      { key: 'database', pattern: /^[a-zA-Z0-9_-]+$/ }
    ];

    Object.entries(node.parameters || {}).forEach(([paramKey, paramValue]) => {
      if (typeof paramValue === 'string') {
        parameterPatterns.forEach(({ key, pattern }) => {
          if (paramKey.toLowerCase().includes(key) && pattern.test(paramValue)) {
            const variableName = `${variablePrefix}${paramKey}`;
            variables[variableName] = {
              description: `${key} for ${node.name || node.type}`,
              defaultValue: paramValue,
              type: 'string',
              required: true
            };
            // Replace with variable reference
            node.parameters[paramKey] = `{{${variableName}}}`;
          }
        });
      }
    });
  }

  private async applyTemplate(template: any, target: any, options: any) {
    if (!template?.workflow) {
      throw new Error('Template must include workflow definition');
    }

    const workflowData = deepClone(template.workflow);

    // Apply variables
    if (target?.variables && template.variables) {
      this.applyVariables(workflowData, target.variables, template.variables);
    }

    // Set workflow properties
    workflowData.name = target?.name || template.name || 'Workflow from Template';

    // Validate nodes if requested
    if (options.validateNodes) {
      const validation = await this.validateTemplateNodes(workflowData);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Template validation failed',
          validation,
          timestamp: new Date().toISOString()
        };
      }
    }

    // Create or update workflow
    let result;
    if (target?.workflowId) {
      // Update existing workflow
      result = await this.n8nClient.updateWorkflow(target.workflowId, workflowData);
    } else {
      // Create new workflow
      result = await this.n8nClient.createWorkflow(workflowData);
    }

    return {
      success: true,
      workflow: result,
      applied: {
        templateName: template.name,
        targetWorkflowId: result.id,
        variablesApplied: target?.variables ? Object.keys(target.variables).length : 0
      },
      timestamp: new Date().toISOString()
    };
  }

  private applyVariables(workflow: any, variables: Record<string, any>, templateVariables: Record<string, any>) {
    const replaceVariables = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
          if (variables[varName] !== undefined) {
            return variables[varName];
          }
          if (templateVariables[varName]?.defaultValue !== undefined) {
            return templateVariables[varName].defaultValue;
          }
          return match; // Keep original if no replacement found
        });
      }

      if (Array.isArray(obj)) {
        return obj.map(replaceVariables);
      }

      if (obj && typeof obj === 'object') {
        const result: any = {};
        Object.entries(obj).forEach(([key, value]) => {
          result[key] = replaceVariables(value);
        });
        return result;
      }

      return obj;
    };

    return replaceVariables(workflow);
  }

  private async listTemplates(category?: string) {
    // This would typically query a template database
    // For now, we'll return common template patterns
    const builtInTemplates = [
      {
        id: 'webhook_to_database',
        name: 'Webhook to Database',
        category: 'integration',
        description: 'Receive webhook data and store in database',
        tags: ['webhook', 'database', 'api'],
        complexity: 'simple',
        nodeTypes: ['n8n-nodes-base.webhook', 'n8n-nodes-base.postgres']
      },
      {
        id: 'email_automation',
        name: 'Email Automation',
        category: 'communication',
        description: 'Automated email sending with templates',
        tags: ['email', 'automation', 'template'],
        complexity: 'simple',
        nodeTypes: ['n8n-nodes-base.emailSend', 'n8n-nodes-base.schedule']
      },
      {
        id: 'data_sync',
        name: 'Data Synchronization',
        category: 'data',
        description: 'Sync data between two systems',
        tags: ['sync', 'data', 'integration'],
        complexity: 'medium',
        nodeTypes: ['n8n-nodes-base.httpRequest', 'n8n-nodes-base.set']
      },
      {
        id: 'slack_notification',
        name: 'Slack Notification',
        category: 'notification',
        description: 'Send notifications to Slack channels',
        tags: ['slack', 'notification', 'alert'],
        complexity: 'simple',
        nodeTypes: ['n8n-nodes-base.slack']
      },
      {
        id: 'file_processing',
        name: 'File Processing',
        category: 'data',
        description: 'Process and transform files',
        tags: ['file', 'processing', 'transform'],
        complexity: 'medium',
        nodeTypes: ['n8n-nodes-base.readBinaryFile', 'n8n-nodes-base.set']
      }
    ];

    let templates = builtInTemplates;
    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    return {
      templates,
      categories: [...new Set(builtInTemplates.map(t => t.category))],
      total: templates.length,
      timestamp: new Date().toISOString()
    };
  }

  private async generateTemplate(source: any, options: any) {
    if (!source?.pattern) {
      throw new Error('Pattern is required for template generation');
    }

    const pattern = source.pattern.toLowerCase();
    let generatedTemplate;

    switch (pattern) {
      case 'webhook_api':
        generatedTemplate = this.generateWebhookApiTemplate();
        break;
      case 'scheduled_task':
        generatedTemplate = this.generateScheduledTaskTemplate();
        break;
      case 'data_transformation':
        generatedTemplate = this.generateDataTransformationTemplate();
        break;
      case 'notification_system':
        generatedTemplate = this.generateNotificationTemplate();
        break;
      default:
        throw new Error(`Unknown pattern: ${source.pattern}`);
    }

    return {
      generated: generatedTemplate,
      pattern: source.pattern,
      timestamp: new Date().toISOString()
    };
  }

  private generateWebhookApiTemplate() {
    return {
      name: 'Webhook to API Template',
      category: 'integration',
      description: 'Receive webhook data and forward to external API',
      workflow: {
        name: 'Webhook to API Workflow',
        nodes: [
          {
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            position: [250, 300],
            parameters: {
              httpMethod: 'POST',
              path: '{{webhook_path}}',
              responseMode: 'responseNode'
            }
          },
          {
            name: 'Process Data',
            type: 'n8n-nodes-base.set',
            position: [450, 300],
            parameters: {
              values: {
                string: [
                  {
                    name: 'processedData',
                    value: '={{JSON.stringify($json)}}'
                  }
                ]
              }
            }
          },
          {
            name: 'Send to API',
            type: 'n8n-nodes-base.httpRequest',
            position: [650, 300],
            parameters: {
              url: '{{api_endpoint}}',
              method: 'POST',
              headers: {
                'Authorization': 'Bearer {{api_token}}',
                'Content-Type': 'application/json'
              },
              body: {
                contentType: 'json',
                specifyBody: 'json',
                jsonBody: '={{$json.processedData}}'
              }
            }
          },
          {
            name: 'Respond',
            type: 'n8n-nodes-base.respondToWebhook',
            position: [850, 300],
            parameters: {
              responseBody: '{"status": "success", "message": "Data processed"}',
              options: {}
            }
          }
        ],
        connections: {
          'Webhook': {
            main: [[{ node: 'Process Data', type: 'main', index: 0 }]]
          },
          'Process Data': {
            main: [[{ node: 'Send to API', type: 'main', index: 0 }]]
          },
          'Send to API': {
            main: [[{ node: 'Respond', type: 'main', index: 0 }]]
          }
        }
      },
      variables: {
        webhook_path: {
          description: 'Webhook endpoint path',
          defaultValue: '/webhook',
          type: 'string',
          required: true
        },
        api_endpoint: {
          description: 'Target API endpoint URL',
          defaultValue: 'https://api.example.com/data',
          type: 'string',
          required: true
        },
        api_token: {
          description: 'API authentication token',
          defaultValue: '',
          type: 'string',
          required: true
        }
      }
    };
  }

  private generateScheduledTaskTemplate() {
    return {
      name: 'Scheduled Task Template',
      category: 'automation',
      description: 'Execute tasks on a schedule',
      workflow: {
        name: 'Scheduled Task Workflow',
        nodes: [
          {
            name: 'Schedule',
            type: 'n8n-nodes-base.cron',
            position: [250, 300],
            parameters: {
              cronExpression: '{{cron_schedule}}'
            }
          },
          {
            name: 'Fetch Data',
            type: 'n8n-nodes-base.httpRequest',
            position: [450, 300],
            parameters: {
              url: '{{data_source_url}}',
              method: 'GET',
              headers: {
                'Authorization': 'Bearer {{api_token}}'
              }
            }
          },
          {
            name: 'Process Results',
            type: 'n8n-nodes-base.set',
            position: [650, 300],
            parameters: {
              values: {
                string: [
                  {
                    name: 'timestamp',
                    value: '={{new Date().toISOString()}}'
                  },
                  {
                    name: 'recordCount',
                    value: '={{$json.length}}'
                  }
                ]
              }
            }
          }
        ],
        connections: {
          'Schedule': {
            main: [[{ node: 'Fetch Data', type: 'main', index: 0 }]]
          },
          'Fetch Data': {
            main: [[{ node: 'Process Results', type: 'main', index: 0 }]]
          }
        }
      },
      variables: {
        cron_schedule: {
          description: 'Cron expression for schedule',
          defaultValue: '0 */6 * * *',
          type: 'string',
          required: true
        },
        data_source_url: {
          description: 'URL to fetch data from',
          defaultValue: 'https://api.example.com/data',
          type: 'string',
          required: true
        },
        api_token: {
          description: 'API authentication token',
          defaultValue: '',
          type: 'string',
          required: true
        }
      }
    };
  }

  private generateDataTransformationTemplate() {
    return {
      name: 'Data Transformation Template',
      category: 'data',
      description: 'Transform and map data between formats',
      workflow: {
        name: 'Data Transformation Workflow',
        nodes: [
          {
            name: 'Manual Trigger',
            type: 'n8n-nodes-base.manualTrigger',
            position: [250, 300],
            parameters: {}
          },
          {
            name: 'Input Data',
            type: 'n8n-nodes-base.set',
            position: [450, 300],
            parameters: {
              values: {
                string: [
                  {
                    name: 'inputData',
                    value: '{{input_data}}'
                  }
                ]
              }
            }
          },
          {
            name: 'Transform',
            type: 'n8n-nodes-base.function',
            position: [650, 300],
            parameters: {
              functionCode: `
                // Transform the input data
                const input = items[0].json.inputData;
                const transformed = {{transformation_logic}};
                return [{ json: { transformed } }];
              `
            }
          },
          {
            name: 'Output',
            type: 'n8n-nodes-base.set',
            position: [850, 300],
            parameters: {
              values: {
                string: [
                  {
                    name: 'result',
                    value: '={{$json.transformed}}'
                  }
                ]
              }
            }
          }
        ],
        connections: {
          'Manual Trigger': {
            main: [[{ node: 'Input Data', type: 'main', index: 0 }]]
          },
          'Input Data': {
            main: [[{ node: 'Transform', type: 'main', index: 0 }]]
          },
          'Transform': {
            main: [[{ node: 'Output', type: 'main', index: 0 }]]
          }
        }
      },
      variables: {
        input_data: {
          description: 'Input data to transform',
          defaultValue: '{}',
          type: 'object',
          required: true
        },
        transformation_logic: {
          description: 'JavaScript transformation logic',
          defaultValue: 'input',
          type: 'string',
          required: true
        }
      }
    };
  }

  private generateNotificationTemplate() {
    return {
      name: 'Notification System Template',
      category: 'notification',
      description: 'Send notifications via multiple channels',
      workflow: {
        name: 'Multi-Channel Notification',
        nodes: [
          {
            name: 'Webhook Trigger',
            type: 'n8n-nodes-base.webhook',
            position: [250, 300],
            parameters: {
              httpMethod: 'POST',
              path: '/notify'
            }
          },
          {
            name: 'Format Message',
            type: 'n8n-nodes-base.set',
            position: [450, 300],
            parameters: {
              values: {
                string: [
                  {
                    name: 'title',
                    value: '={{$json.title || "Notification"}}'
                  },
                  {
                    name: 'message',
                    value: '={{$json.message}}'
                  },
                  {
                    name: 'urgency',
                    value: '={{$json.urgency || "normal"}}'
                  }
                ]
              }
            }
          },
          {
            name: 'Send Email',
            type: 'n8n-nodes-base.emailSend',
            position: [650, 200],
            parameters: {
              to: '{{notification_email}}',
              subject: '={{$json.title}}',
              text: '={{$json.message}}'
            }
          },
          {
            name: 'Send Slack',
            type: 'n8n-nodes-base.slack',
            position: [650, 400],
            parameters: {
              channel: '{{slack_channel}}',
              text: '={{$json.title}}: {{$json.message}}'
            }
          }
        ],
        connections: {
          'Webhook Trigger': {
            main: [[{ node: 'Format Message', type: 'main', index: 0 }]]
          },
          'Format Message': {
            main: [
              [
                { node: 'Send Email', type: 'main', index: 0 },
                { node: 'Send Slack', type: 'main', index: 0 }
              ]
            ]
          }
        }
      },
      variables: {
        notification_email: {
          description: 'Email address for notifications',
          defaultValue: 'admin@example.com',
          type: 'string',
          required: true
        },
        slack_channel: {
          description: 'Slack channel for notifications',
          defaultValue: '#general',
          type: 'string',
          required: true
        }
      }
    };
  }

  private async analyzeWorkflowPatterns(source: any, options: any) {
    const workflows = await this.n8nClient.getWorkflows();
    const patterns = {
      common_patterns: [] as any[],
      node_usage: {} as any,
      integration_patterns: [] as any[],
      complexity_analysis: {} as any
    };

    // Analyze node usage patterns
    workflows.forEach((workflow: any) => {
      if (workflow.nodes) {
        workflow.nodes.forEach((node: any) => {
          patterns.node_usage[node.type] = (patterns.node_usage[node.type] || 0) + 1;
        });
      }
    });

    // Identify common integration patterns
    const integrationPatterns = this.identifyIntegrationPatterns(workflows);
    patterns.integration_patterns = integrationPatterns;

    // Calculate complexity metrics
    patterns.complexity_analysis = {
      averageNodesPerWorkflow: workflows.reduce((sum: number, wf: any) =>
        sum + (wf.nodes?.length || 0), 0) / workflows.length,
      mostComplexWorkflow: workflows.reduce((max: any, wf: any) =>
        (wf.nodes?.length || 0) > (max?.nodes?.length || 0) ? wf : max, {}),
      commonComplexityRange: this.calculateComplexityDistribution(workflows)
    };

    return {
      analysis: patterns,
      recommendations: this.generatePatternRecommendations(patterns),
      timestamp: new Date().toISOString()
    };
  }

  private identifyIntegrationPatterns(workflows: any[]) {
    const patterns: any[] = [];

    workflows.forEach(workflow => {
      if (workflow.nodes) {
        const nodeTypes = workflow.nodes.map((n: any) => n.type);

        // Webhook + API pattern
        if (nodeTypes.includes('n8n-nodes-base.webhook') &&
            nodeTypes.some((type: string) => type.includes('httpRequest'))) {
          patterns.push({
            pattern: 'webhook_to_api',
            workflowId: workflow.id,
            workflowName: workflow.name
          });
        }

        // Database integration pattern
        if (nodeTypes.some((type: string) => type.includes('postgres') || type.includes('mysql'))) {
          patterns.push({
            pattern: 'database_integration',
            workflowId: workflow.id,
            workflowName: workflow.name
          });
        }

        // Email automation pattern
        if (nodeTypes.includes('n8n-nodes-base.emailSend')) {
          patterns.push({
            pattern: 'email_automation',
            workflowId: workflow.id,
            workflowName: workflow.name
          });
        }
      }
    });

    return patterns;
  }

  private calculateComplexityDistribution(workflows: any[]) {
    const complexities = workflows.map(wf => this.calculateComplexity(wf));
    complexities.sort((a, b) => a - b);

    return {
      simple: complexities.filter(c => c <= 3).length,
      medium: complexities.filter(c => c > 3 && c <= 8).length,
      complex: complexities.filter(c => c > 8).length
    };
  }

  private generatePatternRecommendations(patterns: any) {
    const recommendations = [];

    if (patterns.node_usage['n8n-nodes-base.webhook']) {
      recommendations.push('Consider creating webhook templates for common API integrations');
    }

    if (patterns.node_usage['n8n-nodes-base.emailSend']) {
      recommendations.push('Create email notification templates for different use cases');
    }

    if (patterns.integration_patterns.length > 0) {
      recommendations.push('Document common integration patterns as reusable templates');
    }

    return recommendations;
  }

  private async exportTemplate(source: any, options: any) {
    if (!source?.workflowId) {
      throw new Error('workflowId is required for template export');
    }

    const workflow = await this.n8nClient.getWorkflow(source.workflowId);
    const template = await this.createTemplateFromWorkflow(workflow, {}, options);

    return {
      export: {
        format: 'n8n_template',
        version: '1.0.0',
        template: {
          name: workflow.name,
          description: workflow.name + " - Template" || 'Exported workflow template',
          workflow: template.workflow,
          variables: template.variables,
          metadata: template.metadata
        },
        exportedAt: new Date().toISOString()
      },
      usage: {
        instructions: 'Use the "apply" action to create workflows from this template',
        variableCount: Object.keys(template.variables).length,
        requiredCredentials: template.metadata.requiredCredentials
      },
      timestamp: new Date().toISOString()
    };
  }

  private async validateTemplateNodes(workflow: any) {
    const discoveryResult = await this.nodeDiscovery.discoverNodes();
    const availableNodes = [...discoveryResult.catalog.coreNodes, ...discoveryResult.catalog.communityNodes];
    const availableNodeTypes = availableNodes.map((n: any) => n.name);

    const validation = {
      valid: true,
      issues: [] as any[]
    };

    if (workflow.nodes) {
      workflow.nodes.forEach((node: any) => {
        if (!availableNodeTypes.includes(node.type)) {
          validation.valid = false;
          validation.issues.push({
            type: 'missing_node_type',
            nodeId: node.name,
            nodeType: node.type,
            message: `Node type "${node.type}" is not available`
          });
        }
      });
    }

    return validation;
  }

  private inferCategory(workflow: any): string {
    const nodes = workflow.nodes || [];

    if (nodes.some((n: any) => n.type.includes('webhook'))) return 'integration';
    if (nodes.some((n: any) => n.type.includes('email'))) return 'communication';
    if (nodes.some((n: any) => n.type.includes('database'))) return 'data';
    if (nodes.some((n: any) => n.type.includes('schedule'))) return 'automation';

    return 'general';
  }

  private generateTags(workflow: any): string[] {
    const tags = [];
    const nodes = workflow.nodes || [];

    if (nodes.some((n: any) => n.type.includes('webhook'))) tags.push('webhook');
    if (nodes.some((n: any) => n.type.includes('api'))) tags.push('api');
    if (nodes.some((n: any) => n.type.includes('email'))) tags.push('email');
    if (nodes.some((n: any) => n.type.includes('database'))) tags.push('database');
    if (nodes.some((n: any) => n.type.includes('schedule'))) tags.push('scheduled');

    return tags;
  }

  private calculateComplexity(workflow: any): number {
    let complexity = 0;

    if (workflow.nodes) {
      complexity += workflow.nodes.length;
    }

    if (workflow.connections) {
      complexity += Object.values(workflow.connections).reduce((total: number, nodeConns: any) => {
        return total + Object.values(nodeConns).reduce((nodeTotal: number, connections: any) => {
          return nodeTotal + connections.length;
        }, 0);
      }, 0);
    }

    return Math.min(complexity, 10); // Cap at 10 for simplicity
  }
}