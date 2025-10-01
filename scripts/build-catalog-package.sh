#!/bin/bash

# Script to build and package n8n MCP server for Docker MCP Catalog submission
# This script creates a complete package ready for catalog submission

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
PACKAGE_DIR="$BUILD_DIR/catalog-package"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🚀 Building n8n MCP Server Catalog Package..."
echo "Project root: $PROJECT_ROOT"

# Clean and create build directories
rm -rf "$BUILD_DIR"
mkdir -p "$PACKAGE_DIR"

cd "$PROJECT_ROOT"

# Step 1: Build TypeScript
echo "📦 Building TypeScript..."
npm run build

# Step 2: Build Docker image
echo "🐳 Building Docker image..."
docker build -f Dockerfile.mcp -t n8n-mcp-server:latest .
docker tag n8n-mcp-server:latest n8n-mcp-server:$TIMESTAMP

# Step 3: Save Docker image
echo "💾 Exporting Docker image..."
docker save n8n-mcp-server:latest | gzip > "$PACKAGE_DIR/n8n-mcp-server.tar.gz"

# Step 4: Copy catalog files
echo "📋 Copying catalog metadata..."
cp catalog-metadata.json "$PACKAGE_DIR/"
cp docker-mcp.yaml "$PACKAGE_DIR/"

# Step 5: Copy deployment configurations
echo "⚙️  Copying deployment configurations..."
cp docker-compose.gateway.yml "$PACKAGE_DIR/"
cp docker-stack.yml "$PACKAGE_DIR/"
cp Dockerfile.mcp "$PACKAGE_DIR/"

# Step 6: Copy scripts
echo "📜 Copying helper scripts..."
mkdir -p "$PACKAGE_DIR/scripts"
cp scripts/create-secrets.sh "$PACKAGE_DIR/scripts/"
chmod +x "$PACKAGE_DIR/scripts/create-secrets.sh"

# Step 7: Generate package manifest
echo "📄 Generating package manifest..."
cat > "$PACKAGE_DIR/MANIFEST.md" << EOF
# n8n MCP Server Catalog Package

Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Version: 1.0.0

## Package Contents

### Core Files
- \`catalog-metadata.json\` - Docker MCP Catalog metadata
- \`docker-mcp.yaml\` - Docker MCP Gateway configuration
- \`n8n-mcp-server.tar.gz\` - Docker image (ready to load)

### Deployment Configurations
- \`docker-compose.gateway.yml\` - Docker Compose for gateway mode
- \`docker-stack.yml\` - Docker Stack for production deployment
- \`Dockerfile.mcp\` - Multi-stage Dockerfile for building

### Helper Scripts
- \`scripts/create-secrets.sh\` - Docker secrets creation script

## Quick Start

1. Load the Docker image:
   \`\`\`bash
   docker load < n8n-mcp-server.tar.gz
   \`\`\`

2. Create Docker secrets:
   \`\`\`bash
   ./scripts/create-secrets.sh
   \`\`\`

3. Deploy with Docker Compose:
   \`\`\`bash
   docker compose -f docker-compose.gateway.yml up -d
   \`\`\`

## Verification

Check the health endpoint:
\`\`\`bash
curl http://localhost:3000/health
\`\`\`

## Support

- Repository: https://github.com/eekfonky/n8n-mcp-server
- Issues: https://github.com/eekfonky/n8n-mcp-server/issues
EOF

# Step 8: Generate installation instructions
echo "📖 Generating installation instructions..."
cat > "$PACKAGE_DIR/INSTALL.md" << EOF
# Installation Instructions

## Prerequisites

- Docker Engine 20.10+ with Docker Compose
- n8n instance with API access enabled
- Network connectivity between Docker and n8n

## Environment Setup

### Option 1: Docker Secrets (Recommended for Production)

1. Initialize Docker Swarm (if not already done):
   \`\`\`bash
   docker swarm init
   \`\`\`

2. Create secrets using the provided script:
   \`\`\`bash
   ./scripts/create-secrets.sh
   \`\`\`

3. Deploy using Docker Stack:
   \`\`\`bash
   docker stack deploy -c docker-stack.yml n8n-mcp
   \`\`\`

### Option 2: Environment Variables (Development)

1. Create a \`.env\` file:
   \`\`\`bash
   N8N_BASE_URL=http://localhost:5678
   N8N_API_KEY=your_api_key_here
   LOG_LEVEL=info
   DEBUG=false
   \`\`\`

2. Deploy using Docker Compose:
   \`\`\`bash
   docker compose -f docker-compose.gateway.yml up -d
   \`\`\`

## Verification

1. Check container status:
   \`\`\`bash
   docker ps | grep n8n-mcp-server
   \`\`\`

2. Test health endpoint:
   \`\`\`bash
   curl -s http://localhost:3000/health | jq
   \`\`\`

3. Test MCP capabilities:
   \`\`\`bash
   # SSE endpoint (should return event stream headers)
   curl -I http://localhost:3000/n8n
   \`\`\`

## Integration

### Claude Desktop Configuration

Add to your Claude Desktop configuration:

\`\`\`json
{
  "mcpServers": {
    "n8n-mcp-server": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--network=host",
        "-e", "N8N_BASE_URL=http://localhost:5678",
        "-e", "N8N_API_KEY=your_api_key",
        "n8n-mcp-server:latest"
      ]
    }
  }
}
\`\`\`

### MCP Gateway Integration

For Docker MCP Gateway integration, the server is automatically discoverable at:
- SSE endpoint: \`http://localhost:3000/n8n\`
- Health check: \`http://localhost:3000/health\`

## Troubleshooting

### Common Issues

1. **Connection refused**: Ensure Docker is running and ports are not blocked
2. **Authentication failed**: Verify n8n API key and base URL
3. **Container exits**: Check logs with \`docker logs <container_id>\`

### Debug Mode

Enable debug logging:
\`\`\`bash
docker compose -f docker-compose.gateway.yml \
  -e DEBUG=true \
  up -d
\`\`\`

View logs:
\`\`\`bash
docker compose -f docker-compose.gateway.yml logs -f
\`\`\`

## Security Considerations

- Store API keys in Docker secrets, not environment variables
- Use read-only root filesystem where possible
- Run containers as non-root user (UID 1001)
- Implement network policies to restrict access
- Regularly update the Docker image for security patches
EOF

# Step 9: Generate checksum file
echo "🔐 Generating checksums..."
cd "$PACKAGE_DIR"
find . -type f \( -name "*.json" -o -name "*.yaml" -o -name "*.yml" -o -name "*.sh" -o -name "*.md" -o -name "*.tar.gz" \) -exec sha256sum {} \; > SHA256SUMS

# Step 10: Create final package archive
echo "📦 Creating final package archive..."
cd "$BUILD_DIR"
tar -czf "n8n-mcp-server-catalog-${TIMESTAMP}.tar.gz" catalog-package/

# Step 11: Display summary
echo ""
echo "✅ Catalog package built successfully!"
echo ""
echo "📂 Package location: $BUILD_DIR/n8n-mcp-server-catalog-${TIMESTAMP}.tar.gz"
echo "📁 Package directory: $PACKAGE_DIR"
echo ""
echo "📋 Package contents:"
ls -la "$PACKAGE_DIR"
echo ""
echo "🔍 Package size:"
du -sh "$BUILD_DIR/n8n-mcp-server-catalog-${TIMESTAMP}.tar.gz"
echo ""
echo "📝 Next steps:"
echo "1. Test the package in a clean environment"
echo "2. Submit to Docker MCP Catalog"
echo "3. Update documentation with catalog submission details"
echo ""
echo "🔐 Checksums:"
cat "$PACKAGE_DIR/SHA256SUMS"