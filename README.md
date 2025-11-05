# n8n MCP Server (Minimal Edition)

A lightweight Model Context Protocol (MCP) server for n8n workflow automation. Built for AI assistants like Claude Code, Claude Desktop, and Gemini CLI.

[![npm version](https://img.shields.io/npm/v/n8n-mcp-server.svg)](https://www.npmjs.com/package/n8n-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

### For Claude Code

Install with a single command:

```bash
claude mcp add --transport stdio n8n \
  --env N8N_BASE_URL=http://localhost:5678 \
  --env N8N_API_KEY=your_api_key_here \
  -- npx -y n8n-mcp-server
```

**That's it!** You can now ask Claude to:
- "Show me all my n8n workflows"
- "Create a new workflow called 'Daily Report'"
- "Execute the 'Send Email' workflow"
- "What's in my Customer Service workflow?"

### For Gemini CLI

Install with a single command:

```bash
gemini mcp add n8n \
  -e N8N_BASE_URL=http://localhost:5678 \
  -e N8N_API_KEY=your_api_key_here \
  npx -y n8n-mcp-server
```

**Now you can use it with Gemini:**
- "> @n8n List all my workflows"
- "> @n8n Create a workflow called 'Sales Pipeline'"
- "> @n8n Execute the Customer Onboarding workflow"
- "> @n8n Show me execution details for abc123"

**Manage your server:**
```bash
gemini mcp list          # List all servers
gemini mcp remove n8n    # Remove the server
```

### For Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["-y", "n8n-mcp-server"],
      "env": {
        "N8N_BASE_URL": "http://localhost:5678",
        "N8N_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**Config file locations:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

### For Manual Configuration (Any MCP Client)

Add to your MCP client's `settings.json` or config file:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["-y", "n8n-mcp-server"],
      "env": {
        "N8N_BASE_URL": "http://localhost:5678",
        "N8N_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## 📋 Prerequisites

- **Node.js 18+** or **Node.js 24+** (recommended)
- **n8n instance** with API access enabled
- **n8n API Key** ([How to create an API key](https://docs.n8n.io/api/authentication/))

## 🎯 Design Philosophy

**Version 2.0** is a complete rewrite focused on:
- **Minimal footprint** - Only 1,062 lines of code (91.9% reduction from v1)
- **Zero bloat** - Just 3 production dependencies
- **5 core tools** - Essential workflow operations only
- **Lazy loading** - Tools load on-demand for faster startup
- **Modern Node.js** - Built for Node.js 18+ and 24+

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

## 📖 Usage Examples

Once installed, you can interact with n8n naturally through Claude:

### Discover Workflows
```
> "What workflows do I have?"
> "Show me all executions from today"
> "List available n8n node types"
```

### Create Workflows
```
> "Create a new workflow called 'Customer Onboarding'"
> "Add an HTTP Request node to the Sales workflow"
```

### Execute Workflows
```
> "Run the 'Daily Backup' workflow"
> "Execute workflow 'Send Newsletter' with test data"
```

### Inspect & Debug
```
> "Show me details of the 'Data Sync' workflow"
> "What happened in execution abc123?"
> "Get the schema of my Customer workflow"
```

### Manage Workflows
```
> "Delete the 'Old Test' workflow"
> "Remove the broken node from my workflow"
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `N8N_BASE_URL` | Yes | Your n8n instance URL | `http://localhost:5678` |
| `N8N_API_KEY` | Yes | n8n API key | `n8n_api_...` |
| `DEBUG` | No | Enable debug logging | `true` |

### Advanced Installation

**Claude Code - Project scope** (shared with team via git):
```bash
claude mcp add --transport stdio n8n --scope project \
  --env N8N_BASE_URL=http://localhost:5678 \
  --env N8N_API_KEY=your_api_key_here \
  -- npx -y n8n-mcp-server
```

**Claude Code - User scope** (available across all your projects):
```bash
claude mcp add --transport stdio n8n --scope user \
  --env N8N_BASE_URL=http://localhost:5678 \
  --env N8N_API_KEY=your_api_key_here \
  -- npx -y n8n-mcp-server
```

**Gemini CLI - With custom options:**
```bash
# With timeout and trust settings
gemini mcp add n8n \
  -e N8N_BASE_URL=http://localhost:5678 \
  -e N8N_API_KEY=your_api_key_here \
  --timeout 60000 \
  --trust \
  npx -y n8n-mcp-server

# With description
gemini mcp add n8n \
  -e N8N_BASE_URL=http://localhost:5678 \
  -e N8N_API_KEY=your_api_key_here \
  --description "n8n workflow automation" \
  npx -y n8n-mcp-server
```

### Managing the Server

**Claude Code:**
```bash
# List all MCP servers
claude mcp list

# Get server details
claude mcp get n8n

# Remove the server
claude mcp remove n8n

# Check server status (within Claude Code)
/mcp
```

**Gemini CLI:**
```bash
# List all MCP servers
gemini mcp list

# Remove the server
gemini mcp remove n8n

# Check server status (within Gemini CLI)
/mcp
```

## 🔒 Security Best Practices

1. **Never commit API keys** - Use environment variables or local scope
2. **Use read-only API keys** - Create keys with minimal permissions for testing
3. **Secure your n8n instance** - Use HTTPS for production n8n instances
4. **Review workflows** - Always review AI-generated workflows before activating

## 📊 Comparison: v1 vs v2

| Metric | v1.x | v2.0 | Change |
|--------|------|------|--------|
| Lines of Code | 13,165 | 1,062 | **-91.9%** |
| Production Dependencies | 6 | 3 | **-50%** |
| Tools | 15 | 5 | **-66%** |
| Startup Time | ~200ms | ~50ms | **-75%** |
| Disk Size (dist) | ~3MB | ~952KB | **-68%** |
| Node.js Version | 18+ | 18-24+ | ✅ |

## 🎯 What Was Removed from v1

To achieve this reduction, we removed:
- ❌ 10 advanced tools (monitoring, debugging, templates, batch operations)
- ❌ Node discovery service
- ❌ Caching layer
- ❌ Health check service
- ❌ Gateway/HTTP transport mode (stdio only)
- ❌ Complex service factory pattern
- ❌ Extensive error catalog
- ❌ Rate limiting
- ❌ Test infrastructure from source

## 🛠️ Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/eekfonky/n8n-mcp-server.git
cd n8n-mcp-server

# Install dependencies
npm install

# Build
npm run build

# Development mode (with auto-reload)
npm run dev

# Type check
npm run typecheck

# Clean build artifacts
npm run clean
```

### Testing Locally

Create a `.env` file:

```env
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your_api_key_here
DEBUG=true
```

Run the server:

```bash
npm start
```

## 📝 MCP Best Practices Implemented

This server follows official MCP SDK and n8n API best practices:

**MCP SDK Best Practices:**
- ✅ Server class with setRequestHandler (current MCP SDK pattern)
- ✅ Structured error responses with text and structured content
- ✅ Connection cleanup handlers for graceful shutdown
- ✅ Lazy-loaded tools to minimize startup time
- ✅ StdioServerTransport for subprocess communication
- ✅ JSON Schema compliant tool definitions

**n8n API Best Practices:**
- ✅ X-N8N-API-KEY header authentication
- ✅ Proper HTTP status code handling (401, 403, 404, 429)
- ✅ Rate limit detection with Retry-After header support
- ✅ 30-second request timeout (recommended)
- ✅ Content-Type and Accept headers

## 🚢 Docker Deployment

```bash
# Build image
docker build -t n8n-mcp-server .

# Run with environment variables
docker run -i --rm \
  -e N8N_BASE_URL=http://host.docker.internal:5678 \
  -e N8N_API_KEY=your_api_key_here \
  n8n-mcp-server
```

**Note:** Use `host.docker.internal` to connect to n8n running on the host machine.

## 📝 Migration from v1

If you're using v1 and need advanced features:

1. **Stay on v1** - If you use monitoring, templates, or batch operations
2. **Upgrade to v2** - If you only need basic workflow operations

v2 is faster, lighter, and covers 90% of use cases with 5 core tools.

## 🤝 Contributing

This is a minimal, focused implementation. Feature requests should align with the "minimal footprint" philosophy.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🔗 Links

- [GitHub Repository](https://github.com/eekfonky/n8n-mcp-server)
- [npm Package](https://www.npmjs.com/package/n8n-mcp-server)
- [n8n Documentation](https://docs.n8n.io/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Code Documentation](https://docs.claude.com/claude-code)

## 🐛 Troubleshooting

### Server won't start

**Error: "Invalid n8n API key"**
- Verify your API key is correct
- Check that API access is enabled in n8n settings

**Error: "n8n resource not found"**
- Ensure N8N_BASE_URL is correct
- Verify n8n is running and accessible

### Connection issues

**"Connection closed" errors**
- Check your n8n instance is reachable
- Verify firewall/network settings
- Try using `http://localhost:5678` instead of `http://127.0.0.1:5678`

### Rate limiting

If you see rate limit errors:
- n8n may be limiting API requests
- Wait a few seconds and try again
- Check n8n logs for rate limit configuration

### Debug mode

Enable debug logging to see detailed information:

```bash
claude mcp add --transport stdio n8n \
  --env N8N_BASE_URL=http://localhost:5678 \
  --env N8N_API_KEY=your_api_key_here \
  --env DEBUG=true \
  -- npx -y n8n-mcp-server
```

---

**v2.0.0** - Built with ❤️ for AI-powered workflow automation
