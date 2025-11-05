# n8n MCP Server (Minimal Edition)

A lightweight, focused Model Context Protocol (MCP) server for n8n workflow automation. Designed for AI assistants like Claude Code and Gemini CLI.

## 🎯 Design Philosophy

**Version 2.0** is a complete rewrite focused on:
- **Minimal footprint** - Only 1,062 lines of code (91.9% reduction from v1)
- **Zero bloat** - Just 3 production dependencies
- **5 core tools** - Essential workflow operations only
- **Lazy loading** - Tools load on-demand for faster startup
- **Modern Node.js** - Built for Node.js 24+

## ✨ Features

### 5 Core Tools

1. **n8n_discover** - Find workflows, nodes, executions, and credentials
2. **n8n_create** - Create workflows and add nodes
3. **n8n_execute** - Run workflows with input data
4. **n8n_inspect** - Get detailed workflow/execution information
5. **n8n_remove** - Delete workflows or remove nodes

### Architecture

```
src/
  ├── index.ts        (~160 LOC) - MCP server entry point with lazy loading
  ├── client.ts       (~125 LOC) - Minimal n8n API client
  ├── types.ts        (~90 LOC)  - Essential TypeScript types
  ├── utils.ts        (~75 LOC)  - Helper functions
  └── tools/          (~600 LOC) - 5 core tools
      ├── discover.ts
      ├── create.ts
      ├── execute.ts
      ├── inspect.ts
      └── remove.ts
```

**Total: 1,062 LOC** (down from 13,165 LOC in v1)

### Dependencies

**Production (3):**
- `@modelcontextprotocol/sdk` - MCP protocol
- `axios` - HTTP client
- `dotenv` - Environment variables

**Development (3):**
- `@types/node` - TypeScript types
- `tsx` - Development runner
- `typescript` - TypeScript compiler

## 🚀 Quick Start

### Prerequisites

- Node.js 24 or higher
- n8n instance with API access enabled
- n8n API key

### Installation

```bash
# Clone repository
git clone https://github.com/eekfonky/n8n-mcp-server.git
cd n8n-mcp-server

# Install dependencies
npm install

# Build
npm run build
```

### Configuration

Create a `.env` file:

```env
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your_api_key_here
```

### Usage with Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["/path/to/n8n-mcp-server/dist/index.js"],
      "env": {
        "N8N_BASE_URL": "http://localhost:5678",
        "N8N_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Docker Usage

```bash
# Build image
docker build -t n8n-mcp-server .

# Run with environment variables
docker run -i --rm \
  -e N8N_BASE_URL=http://host.docker.internal:5678 \
  -e N8N_API_KEY=your_api_key_here \
  n8n-mcp-server
```

## 📖 Tool Examples

### Discover Workflows

```typescript
{
  "name": "n8n_discover",
  "arguments": {
    "type": "workflows"
  }
}
```

### Create Workflow

```typescript
{
  "name": "n8n_create",
  "arguments": {
    "type": "workflow",
    "name": "My New Workflow"
  }
}
```

### Execute Workflow

```typescript
{
  "name": "n8n_execute",
  "arguments": {
    "workflowId": "workflow-id-or-name",
    "data": {
      "input": "test data"
    },
    "wait": true
  }
}
```

### Inspect Workflow

```typescript
{
  "name": "n8n_inspect",
  "arguments": {
    "type": "workflow",
    "id": "workflow-id-or-name"
  }
}
```

### Remove Workflow

```typescript
{
  "name": "n8n_remove",
  "arguments": {
    "type": "workflow",
    "id": "workflow-id-or-name"
  }
}
```

## 🔧 Development

```bash
# Development mode (with auto-reload)
npm run dev

# Type check
npm run typecheck

# Build
npm run build

# Clean build artifacts
npm run clean
```

## 📊 Comparison: v1 vs v2

| Metric | v1.x | v2.0 | Change |
|--------|------|------|--------|
| Lines of Code | 13,165 | 1,062 | **-91.9%** |
| Production Dependencies | 6 | 3 | **-50%** |
| Tools | 15 | 5 | **-66%** |
| Startup Time | ~200ms | ~50ms | **-75%** |
| Disk Size (dist) | ~3MB | ~952KB | **-68%** |
| Complexity | High | Minimal | ✅ |

## 🎯 What Was Removed

To achieve this reduction, we removed:
- ❌ 10 advanced tools (monitoring, debugging, templates, batch operations, etc.)
- ❌ Node discovery service
- ❌ Caching layer
- ❌ Health check service
- ❌ Gateway/HTTP transport mode (stdio only)
- ❌ Complex service factory pattern
- ❌ Extensive error catalog
- ❌ Rate limiting
- ❌ Test infrastructure from source

## 📝 Migration from v1

If you're using v1 and need advanced features, you have two options:

1. **Stay on v1** - If you use advanced tools (monitoring, templates, batch), stick with v1.x
2. **Upgrade to v2** - If you only use basic workflow operations, v2 is faster and lighter

## 🤝 Contributing

This is a minimal, focused implementation. Feature requests should align with the "minimal footprint" philosophy.

## 📄 License

MIT

## 🔗 Links

- [n8n Documentation](https://docs.n8n.io/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Claude Desktop](https://claude.ai/desktop)

---

**v2.0.0** - Built with ❤️ for AI-powered workflow automation
