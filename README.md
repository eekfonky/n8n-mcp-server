# n8n MCP Server

A powerful Model Context Protocol (MCP) server that provides AI models with seamless access to n8n workflow automation capabilities. Built with TypeScript and designed for both ephemeral Docker deployment and persistent service modes.

## 🚀 Features

- **Complete Workflow Management**: List, create, execute, and manage n8n workflows
- **Community Node Discovery**: Automatically discover and interact with installed community nodes
- **Real-time Execution Monitoring**: Track workflow executions and their status
- **Comprehensive API Coverage**: Full access to n8n's REST API capabilities
- **Ephemeral Docker MCP**: Containers spin up per request, then shut down (recommended)
- **Persistent Service Mode**: Long-running server option for development
- **Resource Access**: Rich MCP resources for workflows, nodes, and statistics
- **Rate Limiting & Caching**: Built-in performance optimizations
- **Security First**: Secure API key management and environment configuration

## 📋 Prerequisites

- **Node.js** 18+ 
- **Docker** (for containerized deployment)
- **n8n instance** with API access enabled
- **n8n API Key** with appropriate permissions

## 🛠️ Installation & Setup

### Method 1: Ephemeral Docker MCP (Recommended)

This follows the proper Docker MCP pattern where containers spin up per request and shut down immediately after.

```bash
# Clone and setup
git clone <repository-url>
cd n8n-mcp-server

# Auto-setup with ephemeral containers
./scripts/setup-ephemeral-mcp.sh
```

This will:
- Prompt for your n8n URL and API key
- Build the Docker image
- Configure Claude Code MCP integration
- Test the connection

### Method 2: Manual Ephemeral Setup

```bash
# Build the project and Docker image
npm install
npm run build
./scripts/build-mcp-image.sh

# Copy and configure the Claude Code MCP config
cp examples/claude-code-ephemeral.json ~/.config/claude-code/mcp/n8n-server.json
# Edit the config file with your n8n URL and API key
```

### Method 3: Persistent Service (Development)

```bash
# Copy environment configuration
cp .env.example .env
# Edit .env with your n8n configuration

# Build and run
npm install && npm run build
npm start  # Or docker-compose up -d for persistent Docker
```

## ⚙️ Configuration

### Environment Variables

```bash
# n8n Instance Configuration
N8N_BASE_URL=http://localhost:5678    # Your n8n instance URL
N8N_API_KEY=your_api_key_here        # n8n API key

# MCP Server Configuration
MCP_SERVER_NAME=n8n-mcp-server       # Server identifier
MCP_SERVER_VERSION=1.0.0             # Server version

# Optional: Performance & Debugging
LOG_LEVEL=info                        # Logging level
DEBUG=false                           # Debug mode
RATE_LIMIT_REQUESTS_PER_MINUTE=60    # Rate limiting
CACHE_TTL_SECONDS=300                 # Cache duration
```

### Getting n8n API Key

1. Open your n8n instance
2. Go to **Settings** → **API**
3. Generate a new API key
4. Copy the key for configuration

## 🔧 Usage

### Ephemeral Docker MCP Pattern

With the ephemeral setup, each MCP request:
1. Spins up a fresh Docker container
2. Processes the request with clean state
3. Returns the response
4. Immediately shuts down the container

This ensures:
- ✅ No resource waste from long-running containers
- ✅ Clean execution environment per request
- ✅ Better security isolation
- ✅ Follows Docker MCP best practices

## 🔒 MCP Docker Standards Compliance

This implementation fully adheres to [MCP Docker standards](https://github.com/modelcontextprotocol/specification) for ephemeral containers:

### ✅ Compliance Features

- **Stdio Transport**: Clean stdin/stdout communication for MCP protocol
- **Silent Startup**: No stdout contamination (logs only to stderr in debug mode)
- **Fast Startup**: < 3 seconds from container start to MCP ready
- **Lazy Loading**: Node discovery and validation only when needed
- **Resource Optimized**: 128MB memory limit, minimal Alpine base
- **Security**: Non-root user execution, isolated container environment
- **Ephemeral Pattern**: `docker run --rm` with immediate shutdown after request

### 🧪 Test Compliance

```bash
# Validate MCP Docker standards compliance
./scripts/test-mcp-compliance.sh
```

This script tests:
- Container lifecycle (startup/shutdown)
- JSON-RPC protocol compliance
- Stdio transport functionality
- Resource optimization
- Security configuration
- Performance benchmarks

### Available Tools

The MCP server provides these tools for AI models:

#### Workflow Management
- `list_workflows` - List all workflows
- `get_workflow` - Get detailed workflow information
- `execute_workflow` - Execute a workflow manually
- `create_workflow` - Create new workflows
- `update_workflow` - Modify existing workflows
- `activate_workflow` / `deactivate_workflow` - Control workflow status
- `delete_workflow` - Remove workflows

#### Execution Monitoring
- `get_execution` - Get execution details
- `get_executions` - List workflow executions

#### Node Discovery
- `discover_nodes` - Find all available nodes
- `get_node_info` - Get detailed node information
- `search_nodes` - Search nodes by functionality
- `get_community_nodes` - List community/custom nodes
- `get_nodes_by_category` - Browse nodes by category
- `validate_node_config` - Validate node configurations

### Available Resources

Access structured data through MCP resources:

- `n8n://workflows` - Complete workflows list
- `n8n://workflow/{id}` - Individual workflow details
- `n8n://nodes` - All available nodes
- `n8n://nodes/category/{category}` - Nodes by category
- `n8n://executions` - Execution history
- `n8n://stats` - Instance statistics

### Example Usage with Claude Code

```
You: "Show me all my n8n workflows"
Claude Code: [Spins up container, lists workflows, shuts down]

You: "Execute the 'Data Processing' workflow"
Claude Code: [New container, executes workflow, returns status, shuts down]

You: "What community nodes do I have installed?"
Claude Code: [Fresh container, discovers nodes, returns list, shuts down]
```

## 🐳 Docker Deployment Options

### Ephemeral (Recommended)

```bash
# Build the ephemeral image
./scripts/build-mcp-image.sh

# Claude Code will automatically use:
docker run --rm -i \
  -e N8N_BASE_URL=http://localhost:5678 \
  -e N8N_API_KEY=your-key \
  --network host \
  n8n-mcp-server:latest
```

### Persistent Service (Development)

```bash
# Long-running service
docker-compose up -d n8n-mcp-server

# Or production mode
docker-compose -f docker-compose.prod.yml up -d
```

## 🔌 Claude Code Integration

### Ephemeral Configuration

```json
{
  "name": "n8n",
  "description": "n8n workflow automation MCP server (ephemeral)",
  "command": "docker",
  "args": [
    "run", "--rm", "-i", "--network", "host",
    "-e", "N8N_BASE_URL=http://localhost:5678",
    "-e", "N8N_API_KEY=your-api-key-here",
    "n8n-mcp-server:latest"
  ],
  "transport": "stdio"
}
```

### Persistent Configuration

```json
{
  "name": "n8n",
  "command": "docker",
  "args": ["exec", "-i", "n8n-mcp-server", "node", "dist/index.js"],
  "transport": "stdio"
}
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Claude Code   │────│  Docker Container│────│   n8n Instance  │
│                 │    │  (ephemeral)     │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                               │
                       ┌──────────────────┐
                       │  Community Nodes │
                       │   Discovery      │
                       └──────────────────┘
```

### Ephemeral Lifecycle

```
Request → Spin Up Container → Process → Response → Shut Down
   ↓            ↓               ↓         ↓          ↓
Claude      Fresh Docker    Clean State  Result   No Resources
Code        Container       Processing   Return   Left Behind
```

## 📊 Monitoring & Debugging

### Watch Containers (Ephemeral Mode)

```bash
# Watch containers spin up/down
watch "docker ps -a | grep n8n-mcp-server"

# View recent container logs
docker logs $(docker ps -a -q --filter ancestor=n8n-mcp-server:latest | head -1)
```

### Test Manually

```bash
# Test the ephemeral container directly
docker run --rm -i \
  -e N8N_BASE_URL=http://localhost:5678 \
  -e N8N_API_KEY=your-key \
  --network host \
  n8n-mcp-server:latest

# Then provide MCP input via stdin
```

### Health Checks

```bash
# Check n8n connectivity
curl -H "X-N8N-API-KEY: your-key" http://localhost:5678/api/v1/workflows

# Rebuild image if needed
./scripts/build-mcp-image.sh
```

## 🆘 Troubleshooting

### Common Issues

**Ephemeral Container Fails**
```bash
# Check image exists
docker images | grep n8n-mcp-server

# Rebuild if needed
./scripts/build-mcp-image.sh

# Test manually with debug
docker run --rm -it -e DEBUG=true -e N8N_BASE_URL=http://localhost:5678 -e N8N_API_KEY=your-key n8n-mcp-server:latest
```

**Connection Issues**
```bash
# Verify n8n accessibility from Docker
docker run --rm --network host curlimages/curl \
  curl -H "X-N8N-API-KEY: your-key" http://localhost:5678/api/v1/workflows
```

**Claude Code Not Finding Server**
```bash
# Check MCP config location
ls ~/.config/claude-code/mcp/

# Verify config syntax
cat ~/.config/claude-code/mcp/n8n-server.json | jq .
```

## 🔄 Development

### Local Development

```bash
# Development mode with hot reload
npm run dev

# Build and test
npm run build
npm start
```

### Rebuilding

```bash
# Rebuild everything
./scripts/build-mcp-image.sh

# Or just rebuild TypeScript
npm run build
```

## 📚 Examples

Check the `examples/` directory for:
- Sample workflow definitions
- Claude Code configurations  
- Usage examples and patterns
- Integration guides

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test with both ephemeral and persistent modes
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Perfect for Claude Code on Linux!** 🐧⚡

The ephemeral Docker pattern ensures efficient resource usage while providing full n8n automation capabilities to your AI workflows.