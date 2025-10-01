# n8n MCP Server Usage Examples

This file contains practical examples of how to use the n8n MCP Server with AI models like Claude.

## Basic Workflow Operations

### List All Workflows
```
You: "Show me all my n8n workflows"

Claude will use: list_workflows tool
Response: JSON list of all workflows with basic info (name, status, tags, etc.)
```

### Get Workflow Details
```
You: "Tell me about the 'Data Processing' workflow"

Claude will use: get_workflow tool with workflow name/ID
Response: Complete workflow definition including nodes, connections, and metadata
```

### Execute a Workflow
```
You: "Run the customer onboarding workflow"

Claude will use: execute_workflow tool
Response: Execution ID and status
```

## Advanced Workflow Management

### Create a New Workflow
```
You: "Create a workflow that processes incoming webhooks and sends emails"

Claude will:
1. Use discover_nodes to find relevant nodes
2. Use create_workflow to build the workflow
3. Return the new workflow ID and configuration
```

### Workflow with Input Data
```
You: "Execute the data processing workflow with this customer data: {name: 'John', email: 'john@example.com'}"

Claude will use: execute_workflow with the provided data
```

## Node Discovery and Management

### Find Specific Nodes
```
You: "What nodes do I have for sending emails?"

Claude will use: search_nodes with query "email"
Response: List of email-related nodes with descriptions
```

### Community Nodes
```
You: "What community nodes are installed in my n8n instance?"

Claude will use: get_community_nodes
Response: List of all community/custom nodes with package information
```

### Node Categories
```
You: "Show me all communication nodes"

Claude will use: get_nodes_by_category with category "Communication"
Response: All nodes in the communication category
```

## Execution Monitoring

### Check Execution Status
```
You: "What's the status of execution 12345?"

Claude will use: get_execution with execution ID
Response: Detailed execution information including duration and status
```

### Recent Executions
```
You: "Show me the last 10 workflow executions"

Claude will use: get_executions with limit 10
Response: List of recent executions across all workflows
```

### Workflow-Specific Executions
```
You: "Show me executions for the customer onboarding workflow"

Claude will use: get_executions filtered by workflow
Response: Executions for that specific workflow
```

## Resource Access Examples

### Instance Statistics
```
You: "Give me stats about my n8n instance"

Claude will access: n8n://stats resource
Response: Comprehensive statistics including workflow counts, node counts, etc.
```

### Node Information
```
You: "Tell me about all available nodes"

Claude will access: n8n://nodes resource  
Response: Complete node catalog with categories and descriptions
```

## Complex Scenarios

### Workflow Analysis
```
You: "Analyze my 'Lead Processing' workflow and suggest improvements"

Claude will:
1. Use get_workflow to get workflow details
2. Analyze node usage and connections
3. Use discover_nodes to find alternative/better nodes
4. Provide recommendations
```

### Workflow Debugging
```
You: "My email workflow isn't working. Help me debug it."

Claude will:
1. Get workflow details
2. Check recent executions for errors
3. Validate node configurations
4. Suggest fixes
```

### Workflow Creation from Description
```
You: "Create a workflow that monitors RSS feeds and posts to Slack when new items appear"

Claude will:
1. Search for RSS and Slack nodes
2. Get node parameters and requirements
3. Create workflow with proper connections
4. Set up trigger and action nodes
```

## Workflow Optimization

### Performance Analysis
```
You: "Which of my workflows take the longest to execute?"

Claude will:
1. Get all executions
2. Calculate average execution times
3. Identify slowest workflows
4. Provide optimization suggestions
```

### Node Usage Statistics
```
You: "What are my most used node types?"

Claude will:
1. Analyze all workflows
2. Count node type usage
3. Identify patterns and usage statistics
```

## Integration Examples

### API Workflow Creation
```
You: "Create a workflow that accepts webhook data and stores it in a database"

Claude creates workflow with:
- Webhook trigger node
- Data transformation node  
- Database storage node
- Response node
```

### Scheduled Workflows
```
You: "Set up a daily report workflow that runs at 9 AM"

Claude creates workflow with:
- Cron trigger node (scheduled for 9 AM)
- Data collection nodes
- Report generation nodes
- Email notification node
```

### Conditional Workflows
```
You: "Create a workflow that processes orders differently based on order value"

Claude creates workflow with:
- Trigger node
- Conditional logic nodes (IF/Switch)
- Different processing branches
- Merge/output nodes
```

## Error Handling

### Failed Executions
```
You: "Why did my last workflow execution fail?"

Claude will:
1. Get recent executions
2. Find failed execution
3. Analyze error details
4. Suggest fixes
```

### Node Configuration Issues
```
You: "Validate the configuration of my Slack node"

Claude will use: validate_node_config
Response: Validation results with specific errors/warnings
```

## Best Practices Examples

### Workflow Naming
```
You: "Help me organize my workflows better"

Claude suggests:
- Consistent naming conventions
- Proper tagging strategies
- Workflow descriptions
```

### Security Review
```
You: "Review my workflows for security issues"

Claude will:
1. Analyze all workflows
2. Check for exposed credentials
3. Review webhook configurations
4. Suggest security improvements
```

These examples demonstrate the comprehensive capabilities of the n8n MCP Server and how AI models can effectively manage, create, and optimize n8n workflows through natural language interactions.