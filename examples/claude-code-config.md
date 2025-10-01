# Claude Code Integration

This guide shows how to integrate the n8n MCP Server with Claude Code on Linux.

## Setup Instructions

### 1. Create MCP Configuration Directory

```bash
mkdir -p ~/.config/claude-code/mcp
```

### 2. Create MCP Server Configuration

Create `~/.config/claude-code/mcp/n8n-server.json`:

```json
{
  "name": "n8n",
  "description": "n8n workflow automation MCP server",
  "command": "node",
  "args": ["/path/to/n8n-mcp-server/dist/index.js"],
  "env": {
    "N8N_BASE_URL": "http://localhost:5678",
    "N8N_API_KEY": "your-api-key-here",
    "MCP_SERVER_NAME": "n8n-mcp-server",
    "LOG_LEVEL": "info"
  },
  "transport": "stdio"
}
```

### 3. Docker-based Configuration (Recommended)

For Docker deployment, create `~/.config/claude-code/mcp/n8n-docker.json`:

```json
{
  "name": "n8n-docker",
  "description": "n8n MCP server via Docker",
  "command": "docker",
  "args": [
    "exec",
    "-i",
    "n8n-mcp-server",
    "node",
    "dist/index.js"
  ],
  "env": {
    "N8N_BASE_URL": "http://n8n:5678",
    "N8N_API_KEY": "your-api-key-here"
  },
  "transport": "stdio"
}
```

### 4. Enable MCP in Claude Code

Add to your Claude Code settings (usually `~/.config/claude-code/settings.json`):

```json
{
  "mcp": {
    "enabled": true,
    "servers": [
      "~/.config/claude-code/mcp/n8n-server.json"
    ]
  }
}
```

## Usage with Claude Code

### Starting the Server

```bash
# If using local installation
cd /path/to/n8n-mcp-server
npm run build
npm start

# If using Docker
docker-compose up -d n8n-mcp-server
```

### Verify Integration

1. Open Claude Code
2. Check the MCP status in the status bar
3. You should see "n8n" as an available MCP server

### Example Commands in Claude Code

```
You: "List my n8n workflows"
Claude Code will execute the list_workflows tool

You: "Create a webhook workflow"
Claude Code will use node discovery and workflow creation tools

You: "Show me workflow execution statistics"
Claude Code will access the n8n://stats resource
```

## Alternative: VS Code Extension

If you prefer VS Code, create a VS Code task in `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start n8n MCP Server",
      "type": "shell",
      "command": "docker-compose",
      "args": ["up", "-d", "n8n-mcp-server"],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": []
    }
  ]
}
```

## Troubleshooting

### Connection Issues

```bash
# Check if server is running
docker ps | grep n8n-mcp-server

# Check server logs
docker logs n8n-mcp-server

# Test n8n API directly
curl -H "X-N8N-API-KEY: your-key" http://localhost:5678/api/v1/workflows
```

### MCP Debug Mode

Enable debug mode in your configuration:

```json
{
  "env": {
    "DEBUG": "true",
    "LOG_LEVEL": "debug"
  }
}
```

## Development Mode

For development with hot reload:

```json
{
  "name": "n8n-dev",
  "command": "npm",
  "args": ["run", "dev"],
  "cwd": "/path/to/n8n-mcp-server",
  "env": {
    "N8N_BASE_URL": "http://localhost:5678",
    "N8N_API_KEY": "your-api-key-here"
  }
}
```