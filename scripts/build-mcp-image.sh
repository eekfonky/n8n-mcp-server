#!/bin/bash

# Build MCP-compliant ephemeral Docker image
# Optimized for fast startup and stdio protocol compliance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔨 Building MCP-compliant n8n Server Docker image...${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "src/index.ts" ]; then
    echo -e "${RED}❌ Error: Please run this script from the n8n-mcp-server directory${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
fi

# Clean previous build
echo -e "${BLUE}🧹 Cleaning previous build...${NC}"
npm run clean 2>/dev/null || rm -rf dist

# Build the TypeScript project
echo -e "${BLUE}📦 Building TypeScript project...${NC}"
npm run build

# Verify dist directory exists and has content
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
    echo -e "${RED}❌ Error: TypeScript build failed or dist/index.js not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ TypeScript build successful${NC}"

# Build the optimized Docker image for MCP
echo -e "${BLUE}🐳 Building MCP-optimized Docker image...${NC}"
docker build -f Dockerfile.mcp -t n8n-mcp-server:latest .

# Verify image was built
if ! docker images | grep -q "n8n-mcp-server.*latest"; then
    echo -e "${RED}❌ Error: Docker image build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ MCP Docker image built successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Image optimizations:${NC}"
echo "• Minimal Alpine Linux base"
echo "• No build dependencies"
echo "• Optimized for fast startup"
echo "• Silent stdout for MCP protocol compliance"
echo "• 128MB memory limit"
echo ""
echo -e "${YELLOW}🔧 Next steps:${NC}"
echo "1. Choose configuration:"
echo "   • Local n8n: examples/claude-code-ephemeral.json"
echo "   • Remote n8n: examples/claude-code-isolated.json"
echo "2. Copy to: ~/.config/claude-code/mcp/"
echo "3. Update N8N_BASE_URL and N8N_API_KEY"
echo ""
echo -e "${BLUE}🧪 Test the image:${NC}"
echo "docker run --rm -i \\"
echo "  -e N8N_BASE_URL=http://localhost:5678 \\"
echo "  -e N8N_API_KEY=your-key \\"
echo "  -e DEBUG=true \\"
echo "  n8n-mcp-server:latest"
echo ""
echo -e "${GREEN}🎯 Image ready for ephemeral MCP usage!${NC}"