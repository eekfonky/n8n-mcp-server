#!/bin/bash

# n8n MCP Server - Docker MCP Toolkit Setup Script
# Installs n8n MCP server via Docker Desktop's MCP Toolkit
# Updated: 2025-10-06 - Fixed Docker MCP HTTPS URL fetching issue

set -e

echo "🚀 Setting up n8n MCP Server with Docker MCP Toolkit..."
echo ""

# Check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        echo "❌ Error: Docker is not installed"
        echo "Please install Docker Desktop from https://docker.com/products/docker-desktop"
        exit 1
    fi

    # Check if Docker MCP plugin is available
    if ! docker mcp --help &> /dev/null; then
        echo "❌ Error: Docker MCP plugin is not available"
        echo "Please ensure you have Docker Desktop with MCP Toolkit installed"
        exit 1
    fi

    echo "✅ Prerequisites met"
}

# Enable required Docker MCP features
enable_features() {
    echo ""
    echo "🔧 Enabling Docker MCP features..."

    # Enable configured catalogs feature (if available)
    docker mcp feature enable configured-catalogs 2>/dev/null || echo "ℹ️  Configured catalogs feature not available - using standard catalog workflow"

    # Enable dynamic tools feature (if available)
    docker mcp feature enable dynamic-tools 2>/dev/null || true
    echo "✅ Dynamic tools enabled (if available)"
}

# Create and setup n8n MCP catalog
setup_catalog() {
    echo ""
    echo "📦 Setting up n8n MCP Server catalog..."

    # Check if catalog already exists
    if docker mcp catalog show n8n-mcp-catalog &> /dev/null; then
        echo "ℹ️  n8n MCP catalog already exists"
    else
        # Create the catalog
        docker mcp catalog create n8n-mcp-catalog
        echo "✅ Created n8n MCP catalog"
    fi

    # Add n8n server to catalog
    echo "Adding n8n server to catalog..."

    # Use local server definition or remote URL
    SERVER_DEF_URL="${1:-https://raw.githubusercontent.com/eekfonky/n8n-mcp-server/main/catalog/server-definition.yaml}"

    # If running from project directory, use local file
    if [ -f "catalog/server-definition.yaml" ]; then
        SERVER_DEF_URL="./catalog/server-definition.yaml"
        echo "Using local server definition file"
    else
        # Docker MCP has issues with HTTPS URLs, so download locally first
        TEMP_FILE=$(mktemp)
        if curl -s "$SERVER_DEF_URL" -o "$TEMP_FILE"; then
            SERVER_DEF_URL="$TEMP_FILE"
            echo "Downloaded server definition file"
        else
            echo "❌ Error: Failed to download server definition from $SERVER_DEF_URL"
            exit 1
        fi
    fi

    docker mcp catalog add n8n-mcp-catalog n8n-server "$SERVER_DEF_URL" || echo "ℹ️  Server already exists in catalog"

    # Clean up temp file if created
    if [[ "$SERVER_DEF_URL" == /tmp/* ]]; then
        rm -f "$SERVER_DEF_URL"
    fi
    echo "✅ n8n MCP Server catalog setup complete"
}

# Set up secrets
setup_secrets() {
    echo ""
    echo "🔐 Setting up n8n connection..."

    # Prompt for n8n URL
    if [ -z "$N8N_BASE_URL" ]; then
        read -p "Enter your n8n instance URL (e.g., https://your-n8n.com): " N8N_BASE_URL
    fi

    # Prompt for API key
    if [ -z "$N8N_API_KEY" ]; then
        read -s -p "Enter your n8n API key: " N8N_API_KEY
        echo ""
    fi

    # Set secrets
    docker mcp secret set n8n-server.base_url "$N8N_BASE_URL"
    docker mcp secret set n8n-server.api_key "$N8N_API_KEY"

    echo "✅ Secrets configured"
}

# Test connection
test_connection() {
    echo ""
    echo "🧪 Testing connection..."

    # Test if catalog is visible
    if docker mcp catalog show n8n-mcp-catalog &> /dev/null; then
        echo "✅ n8n MCP catalog is accessible"
    else
        echo "⚠️  Catalog not yet visible (may take a moment)"
    fi

    # Test if n8n tools are available
    if docker mcp tools list 2>/dev/null | grep -q "n8n_"; then
        echo "✅ n8n tools are available"
    else
        echo "⚠️  n8n tools not yet visible (may take a moment)"
    fi
}

# Display usage instructions
show_usage() {
    echo ""
    echo "🎉 Setup complete!"
    echo ""
    echo "To use n8n MCP Server:"
    echo "  1. Start the gateway:"
    echo "     docker mcp gateway run --use-configured-catalogs"
    echo ""
    echo "  2. In another terminal, test the tools:"
    echo "     docker mcp tools list | grep n8n_"
    echo "     docker mcp tools call n8n_discover type=health"
    echo ""
    echo "  3. Available n8n tools:"
    echo "     • n8n_discover  - Universal discovery"
    echo "     • n8n_create    - Create workflows/nodes"
    echo "     • n8n_execute   - Execute workflows"
    echo "     • n8n_inspect   - Deep inspection"
    echo "     • n8n_monitor   - Real-time monitoring"
    echo "     • ...and 10 more powerful tools"
    echo ""
    echo "📚 Documentation: https://github.com/eekfonky/n8n-mcp-server"
}

# Main execution
main() {
    check_prerequisites
    enable_features
    setup_catalog "$1"

    # Only set up secrets if not provided via environment
    if [ -z "$N8N_BASE_URL" ] || [ -z "$N8N_API_KEY" ]; then
        setup_secrets
    else
        echo "✅ Using environment variables for n8n connection"
        docker mcp secret set n8n-server.base_url "$N8N_BASE_URL"
        docker mcp secret set n8n-server.api_key "$N8N_API_KEY"
    fi

    test_connection
    show_usage
}

# Run main function
main "$@"