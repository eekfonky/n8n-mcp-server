# 15 Powerful Tool Primitives Architecture

## Design Philosophy
- **LEGO Block Approach**: Each tool is a fundamental primitive that can be combined
- **Iterative Building**: Support building workflows step-by-step, not monolithically
- **Context Efficiency**: Minimize tool count to reduce context window pollution
- **All Node Access**: Ensure access to ALL built-in and community nodes
- **Removal Capabilities**: Full CRUD operations on workflows and nodes

## The 15 Primitives

### 🔍 Discovery & Information (4 tools)
1. **`n8n_discover`** - Universal discovery (nodes, workflows, executions, stats)
2. **`n8n_inspect`** - Deep inspection of any n8n object by ID/name
3. **`n8n_search`** - Unified search across all n8n entities
4. **`n8n_validate`** - Validate configurations, connections, and schemas

### 🏗️ Workflow Building (4 tools)
5. **`n8n_create`** - Create workflows, nodes, connections
6. **`n8n_modify`** - Update/edit existing workflows and nodes
7. **`n8n_connect`** - Manage connections between nodes
8. **`n8n_remove`** - Delete workflows, nodes, connections

### 🚀 Execution & Management (4 tools)
9. **`n8n_execute`** - Run workflows manually or with test data
10. **`n8n_control`** - Activate/deactivate workflows, manage state
11. **`n8n_monitor`** - Get execution results, logs, status
12. **`n8n_debug`** - Troubleshoot workflows, test connections

### 🎯 Advanced Operations (3 tools)
13. **`n8n_template`** - Generate workflow templates and node examples
14. **`n8n_batch`** - Batch operations on multiple workflows/nodes
15. **`n8n_export`** - Import/export workflows, backup/restore

## Key Benefits

### Versus 18 Specific Tools
- **Reduced Context**: 15 vs 18 tools (17% reduction)
- **More Powerful**: Each primitive handles multiple use cases
- **Better Composition**: Tools designed to work together
- **Iterative Support**: Built for step-by-step workflow construction

### Versus 200+ Tools
- **Massive Context Savings**: 15 vs 200+ tools (92% reduction)
- **Maintenance Efficiency**: Far fewer tools to maintain and test
- **Cognitive Load**: Easier for AI to choose the right tool
- **Performance**: Faster tool loading and processing

## Implementation Strategy

### Phase 1: Core Primitives (5 tools)
- `n8n_discover` - Universal discovery
- `n8n_create` - Basic creation
- `n8n_execute` - Basic execution
- `n8n_inspect` - Deep inspection
- `n8n_remove` - Deletion capabilities

### Phase 2: Building Primitives (5 tools)
- `n8n_modify` - Updates and edits
- `n8n_connect` - Connection management
- `n8n_control` - Workflow state management
- `n8n_search` - Unified search
- `n8n_validate` - Validation

### Phase 3: Advanced Primitives (5 tools)
- `n8n_monitor` - Execution monitoring
- `n8n_debug` - Troubleshooting
- `n8n_template` - Template generation
- `n8n_batch` - Batch operations
- `n8n_export` - Import/export

## Iterative Building Support

Each primitive supports iterative workflow construction:

```javascript
// Step 1: Discover available nodes
await n8n_discover({ type: "nodes", category: "triggers" });

// Step 2: Create basic workflow
await n8n_create({
  type: "workflow",
  name: "My Workflow",
  nodes: [{ type: "manual-trigger" }]
});

// Step 3: Add more nodes iteratively
await n8n_create({
  type: "node",
  workflow: "My Workflow",
  nodeType: "http-request",
  after: "manual-trigger"
});

// Step 4: Connect nodes
await n8n_connect({
  workflow: "My Workflow",
  from: "manual-trigger",
  to: "http-request"
});

// Step 5: Test execution
await n8n_execute({
  workflow: "My Workflow",
  mode: "test",
  data: { test: true }
});
```

This architecture provides maximum flexibility while maintaining efficiency and supporting the core requirement of iterative workflow building.