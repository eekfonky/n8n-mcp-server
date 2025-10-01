#!/bin/bash

# Setup script for Claude Code integration with n8n MCP Server
# Run this script to automatically configure Claude Code MCP integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setting up n8n MCP Server for Claude Code${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "src/index.ts" ]; then
    echo -e "${RED}❌ Error: Please run this script from the n8n-mcp-server directory${NC}"
    exit 1
fi

# Get current directory
CURRENT_DIR=$(pwd)
echo -e "${BLUE}📁 Project directory: ${CURRENT_DIR}${NC}"

# Create Claude Code MCP configuration directory
CLAUDE_MCP_DIR="$HOME/.config/claude-code/mcp"
echo -e "${BLUE}📂 Creating Claude Code MCP directory: ${CLAUDE_MCP_DIR}${NC}"
mkdir -p "$CLAUDE_MCP_DIR"

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

# Ask for deployment method
echo ""
echo -e "${YELLOW}🐳 Deployment Method${NC}"
echo "1) Docker (recommended)"
echo "2) Local Node.js"
read -p "Choose deployment method [1]: " DEPLOYMENT_METHOD
DEPLOYMENT_METHOD=${DEPLOYMENT_METHOD:-1}

# Create MCP server configuration
CONFIG_FILE="$CLAUDE_MCP_DIR/n8n-server.json"

if [ "$DEPLOYMENT_METHOD" = "1" ]; then
    echo -e "${BLUE}🐳 Creating Docker-based MCP configuration${NC}"
    cat > "$CONFIG_FILE" << EOF
{
  "name": "n8n",
  "description": "n8n workflow automation MCP server",
  "command": "docker",
  "args": [
    "exec",
    "-i",
    "n8n-mcp-server",
    "node",
    "dist/index.js"
  ],
  "env": {
    "N8N_BASE_URL": "$N8N_URL",
    "N8N_API_KEY": "$N8N_API_KEY",
    "MCP_SERVER_NAME": "n8n-mcp-server",
    "LOG_LEVEL": "info"
  },
  "transport": "stdio"
}
EOF
else
    echo -e "${BLUE}📦 Creating local Node.js MCP configuration${NC}"
    cat > "$CONFIG_FILE" << EOF
{
  "name": "n8n",
  "description": "n8n workflow automation MCP server",
  "command": "node",
  "args": ["$CURRENT_DIR/dist/index.js"],
  "env": {
    "N8N_BASE_URL": "$N8N_URL",
    "N8N_API_KEY": "$N8N_API_KEY",
    "MCP_SERVER_NAME": "n8n-mcp-server",
    "LOG_LEVEL": "info"
  },
  "transport": "stdio"
}
EOF
fi

echo -e "${GREEN}✅ MCP configuration created: ${CONFIG_FILE}${NC}"

# Create or update .env file
ENV_FILE="$CURRENT_DIR/.env"
echo -e "${BLUE}🔧 Creating/updating .env file${NC}"

cat > "$ENV_FILE" << EOF
# n8n Instance Configuration
N8N_BASE_URL=$N8N_URL
N8N_API_KEY=$N8N_API_KEY

# MCP Server Configuration
MCP_SERVER_NAME=n8n-mcp-server
MCP_SERVER_VERSION=1.0.0

# Optional: Logging and Debug
LOG_LEVEL=info
DEBUG=false

# Optional: Rate limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=60
CACHE_TTL_SECONDS=300
EOF

echo -e "${GREEN}✅ Environment file updated: ${ENV_FILE}${NC}"

# Build the project
echo -e "${BLUE}🔨 Building the project${NC}"
npm install
npm run build

# Start appropriate service
if [ "$DEPLOYMENT_METHOD" = "1" ]; then
    echo -e "${BLUE}🐳 Starting Docker services${NC}"
    docker-compose up -d n8n-mcp-server
    
    # Wait for container to be ready
    echo -e "${BLUE}⏳ Waiting for container to be ready...${NC}"
    sleep 5
    
    # Check if container is running
    if docker ps | grep -q "n8n-mcp-server"; then
        echo -e "${GREEN}✅ Docker container is running${NC}"
    else
        echo -e "${RED}❌ Docker container failed to start${NC}"
        echo "Check logs with: docker logs n8n-mcp-server"
        exit 1
    fi
else
    echo -e "${BLUE}🚀 Testing local server${NC}"
    # Test that the server can start (quick test)
    timeout 5s npm start > /dev/null 2>&1 || echo -e "${YELLOW}⚠️  Server test completed (expected timeout)${NC}"
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
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"

if [ "$DEPLOYMENT_METHOD" = "1" ]; then
    echo "1. The Docker container is running"
    echo "2. Open Claude Code"
    echo "3. The n8n MCP server should be automatically available"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  View logs: docker logs -f n8n-mcp-server"
    echo "  Stop server: docker-compose down"
    echo "  Restart server: docker-compose restart n8n-mcp-server"
else
    echo "1. Start the server: npm start"
    echo "2. Open Claude Code"
    echo "3. The n8n MCP server should be automatically available"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  Start server: npm start"
    echo "  Development mode: npm run dev"
    echo "  View logs: Check console output"
fi

echo ""
echo -e "${BLUE}Configuration Files:${NC}"
echo "  MCP Config: $CONFIG_FILE"
echo "  Environment: $ENV_FILE"
echo ""
echo -e "${BLUE}Test in Claude Code:${NC}"
echo '  Try: "List my n8n workflows"'
echo '  Or: "Show me available n8n nodes"'
echo ""
echo -e "${GREEN}Happy automating! 🎯${NC}"