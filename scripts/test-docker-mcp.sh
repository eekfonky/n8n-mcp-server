#!/bin/bash

# n8n MCP Server - Docker MCP Toolkit Test Script
# Tests the Docker MCP integration

set -e

echo "🧪 Testing n8n MCP Server with Docker MCP Toolkit..."
echo ""

# Test catalog visibility
test_catalog() {
    echo "📦 Testing catalog visibility..."

    if docker mcp catalog show n8n-mcp-catalog &> /dev/null; then
        echo "✅ n8n-mcp-catalog is visible"
        docker mcp catalog show n8n-mcp-catalog --format json | jq -r '.registry["n8n-server"].description' 2>/dev/null || echo "Catalog structure verified"
    else
        echo "❌ n8n-mcp-catalog not found"
        echo "Available catalogs:"
        docker mcp catalog ls
        return 1
    fi
}

# Test tools availability
test_tools() {
    echo ""
    echo "🔧 Testing tools availability..."

    local n8n_tools=$(docker mcp tools list 2>/dev/null | grep "n8n_" | wc -l)

    if [ "$n8n_tools" -gt 0 ]; then
        echo "✅ Found $n8n_tools n8n tools"
        echo "Available n8n tools:"
        docker mcp tools list | grep "n8n_" | head -5
        if [ "$n8n_tools" -gt 5 ]; then
            echo "... and $((n8n_tools - 5)) more"
        fi
    else
        echo "❌ No n8n tools found"
        return 1
    fi
}

# Test specific tool inspection
test_tool_inspection() {
    echo ""
    echo "🔍 Testing tool inspection..."

    if docker mcp tools inspect n8n_discover &> /dev/null; then
        echo "✅ n8n_discover tool is inspectable"
        docker mcp tools inspect n8n_discover | jq -r '.description'
    else
        echo "❌ Cannot inspect n8n_discover tool"
        return 1
    fi
}

# Test tool execution (if secrets are configured)
test_tool_execution() {
    echo ""
    echo "🚀 Testing tool execution..."

    # Check if secrets are configured
    if docker mcp secret list 2>/dev/null | grep -q "n8n-server"; then
        echo "✅ Secrets are configured, testing tool call..."

        # Test health check
        if docker mcp tools call n8n_discover type=health 2>/dev/null; then
            echo "✅ n8n_discover health check successful"
        else
            echo "⚠️  Tool call failed (check n8n connection)"
        fi
    else
        echo "⚠️  No secrets configured - skipping execution test"
        echo "Run: docker mcp secret set n8n-server.base_url <your-n8n-url>"
        echo "Run: docker mcp secret set n8n-server.api_key <your-api-key>"
    fi
}

# Test gateway status
test_gateway() {
    echo ""
    echo "🌉 Testing gateway status..."

    # Check if gateway is running (non-destructive check)
    if pgrep -f "docker mcp gateway" &> /dev/null; then
        echo "✅ Docker MCP Gateway is running"
    else
        echo "ℹ️  Gateway not running - start with:"
        echo "   docker mcp gateway run --use-configured-catalogs"
    fi
}

# Display summary
show_summary() {
    echo ""
    echo "📊 Test Summary:"
    echo "=================="

    # Count successful tests
    local passed=0
    local total=4

    docker mcp catalog show n8n-mcp-catalog &> /dev/null && ((passed++))
    [ "$(docker mcp tools list 2>/dev/null | grep "n8n_" | wc -l)" -gt 0 ] && ((passed++))
    docker mcp tools inspect n8n_discover &> /dev/null && ((passed++))
    docker mcp secret list 2>/dev/null | grep -q "n8n-server" && ((passed++))

    echo "Tests passed: $passed/$total"

    if [ $passed -eq $total ]; then
        echo "🎉 All tests passed! n8n MCP Server is ready to use."
    else
        echo "⚠️  Some tests failed. Check the output above for details."
    fi

    echo ""
    echo "Next steps:"
    echo "• Start gateway: docker mcp gateway run --use-configured-catalogs"
    echo "• List tools: docker mcp tools list | grep n8n_"
    echo "• Call tools: docker mcp tools call n8n_discover type=health"
}

# Main execution
main() {
    test_catalog
    test_tools
    test_tool_inspection
    test_tool_execution
    test_gateway
    show_summary
}

# Run tests
main "$@"