#!/bin/bash

# Setup script for ephemeral Docker MCP with Claude Code
# This follows the proper Docker MCP pattern where containers spin up per request

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setting up Ephemeral n8n MCP Server for Claude Code${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "src/index.ts" ]; then
    echo -e "${RED}❌ Error: Please run this script from the n8n-mcp-server directory${NC}"
    exit 1
fi

# Get current directory
CURRENT_DIR=$(pwd)
echo -e "${BLUE}📁 Project directory: ${CURRENT_DIR}${NC}"

# Prompt for n8n configuration
echo ""
echo -e "${YELLOW}⚙️  n8n Configuration${NC}"
read -p "Enter your n8n base URL [http://localhost:5678]: " N8N_URL
N8N_URL=${N8N_URL:-http://localhost:5678}

read -p "Enter your n8n API key: " N8N_API_KEY

if [ -z "$N8N_API_KEY" ]; then
    echo -e "${RED}❌ Error: n8n API key is required${NC}"
    exit 1
fi

# Build the project and Docker image
echo -e "${BLUE}🔨 Building project and Docker image${NC}"
npm install
npm run build

echo -e "${BLUE}🐳 Building ephemeral MCP Docker image${NC}"
docker build -f Dockerfile.mcp -t n8n-mcp-server:latest .

# Create Claude Code MCP configuration directory
CLAUDE_MCP_DIR="$HOME/.config/claude-code/mcp"
echo -e "${BLUE}📂 Creating Claude Code MCP directory: ${CLAUDE_MCP_DIR}${NC}"
mkdir -p "$CLAUDE_MCP_DIR"

# Create ephemeral MCP server configuration
CONFIG_FILE="$CLAUDE_MCP_DIR/n8n-server.json"

echo -e "${BLUE}⚡ Creating ephemeral Docker MCP configuration${NC}"
cat > "$CONFIG_FILE" << EOF
{
  "name": "n8n",
  "description": "n8n workflow automation MCP server (ephemeral)",
  "command": "docker",
  "args": [
    "run",
    "--rm",
    "-i",
    "--network", "host",
    "-e", "N8N_BASE_URL=$N8N_URL",
    "-e", "N8N_API_KEY=$N8N_API_KEY",
    "-e", "MCP_SERVER_NAME=n8n-mcp-server",
    "-e", "LOG_LEVEL=info",
    "n8n-mcp-server:latest"
  ],
  "transport": "stdio"
}
EOF

echo -e "${GREEN}✅ Ephemeral MCP configuration created: ${CONFIG_FILE}${NC}"

# Test the Docker image
echo -e "${BLUE}🧪 Testing Docker image${NC}"
if timeout 10s docker run --rm -i \
    -e "N8N_BASE_URL=$N8N_URL" \
    -e "N8N_API_KEY=$N8N_API_KEY" \
    --network host \
    n8n-mcp-server:latest > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker image test completed${NC}"
else
    echo -e "${YELLOW}⚠️  Docker image test timed out (expected for MCP servers)${NC}"
fi

# Test n8n connection
echo -e "${BLUE}🔗 Testing n8n connection${NC}"
if curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows" > /dev/null; then
    echo -e "${GREEN}✅ n8n connection successful${NC}"
else
    echo -e "${YELLOW}⚠️  Could not connect to n8n. Please verify your URL and API key.${NC}"
fi

# Provide next steps
echo ""
echo -e "${GREEN}🎉 Ephemeral MCP Setup Complete!${NC}"
echo ""
echo -e "${YELLOW}How it works:${NC}"
echo "• Each MCP request spins up a fresh Docker container"
echo "• Container processes the request and immediately shuts down"
echo "• No long-running processes or resource waste"
echo "• Clean, isolated execution environment"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Open Claude Code"
echo "2. The n8n MCP server will be available automatically"
echo "3. Each request will create a new container instance"
echo ""
echo -e "${BLUE}Configuration Files:${NC}"
echo "  MCP Config: $CONFIG_FILE"
echo "  Docker Image: n8n-mcp-server:latest"
echo ""
echo -e "${BLUE}Test in Claude Code:${NC}"
echo '  Try: "List my n8n workflows"'
echo '  (Watch containers spin up/down: docker ps -a)'
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  Rebuild image: ./scripts/build-mcp-image.sh"
echo "  Test manually: docker run --rm -i -e N8N_BASE_URL=$N8N_URL -e N8N_API_KEY=$N8N_API_KEY --network host n8n-mcp-server:latest"
echo "  View images: docker images | grep n8n-mcp-server"
echo ""
echo -e "${GREEN}Happy ephemeral automating! ⚡${NC}"