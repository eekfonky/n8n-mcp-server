# Upgrading n8n MCP Server

## How to Upgrade from an Older Version

### Option 1: Docker MCP (Recommended)

If you're using Docker MCP (Claude Code with Docker integration), the upgrade is automatic:

```bash
# Simply restart the server - Docker MCP pulls the latest version automatically
docker mcp restart n8n_mcp_server
```

### Option 2: Direct Docker Installation

If you installed using the quick install script:

```bash
# Pull the latest image
docker pull ghcr.io/eekfonky/n8n-mcp-server:latest

# Restart the container (if running)
docker stop n8n-mcp-server
docker rm n8n-mcp-server

# Run the container again with your existing secrets/config
docker run -d \
  --name n8n-mcp-server \
  -v n8n-mcp-secrets:/run/secrets \
  ghcr.io/eekfonky/n8n-mcp-server:latest
```

### Option 3: npm/npx Installation

If you're running via npm:

```bash
# Update the package globally
npm update -g n8n-mcp-server

# Or if using npx, it automatically uses the latest version
npx n8n-mcp-server
```

### Option 4: Claude Desktop Configuration

If you configured Claude Desktop to use this server:

**Location:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

Your configuration should look like this:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["-y", "n8n-mcp-server"]
    }
  }
}
```

With this setup, Claude Desktop will automatically use the latest version each time it starts.

**To force an update immediately:**
1. Quit Claude Desktop completely
2. Clear npx cache: `npx clear-npx-cache`
3. Restart Claude Desktop

---

## What's New in This Version (v1.0.x)

### Critical Fixes

1. **Fixed MCP Protocol JSON Errors** ✅
   - Resolved "invalid character 'ð' looking for beginning of value" error
   - All diagnostic output now goes to stderr (won't corrupt MCP responses)
   - Removed emoji characters from logging

2. **Added Memory Protection** 🛡️
   - Cache now has size limits (default: 100 entries)
   - Prevents memory leaks on long-running servers
   - Configurable via `MAX_CACHE_SIZE` environment variable

3. **Large Response Protection** 📦
   - Automatically detects execution data > 5MB
   - Returns summary instead of full payload when too large
   - Prevents timeouts and crashes

4. **Fixed Numeric Parsing Bugs** 🔢
   - All `parseInt()` calls now use explicit radix
   - Prevents octal interpretation issues

### New Environment Variables

```bash
# Optional: Set maximum cache size (default: 100)
MAX_CACHE_SIZE=100
```

### Breaking Changes

**None** - This is a backward-compatible update.

---

## Verification After Upgrade

Test that the upgrade worked:

```bash
# If using Docker MCP
docker mcp test n8n_mcp_server

# Check the version
docker logs n8n-mcp-server 2>&1 | head -20
```

You should see clean log output without emojis and the startup should complete without JSON errors.

---

## Troubleshooting

### "Still seeing old version"

**For npx users:**
```bash
# Clear the npx cache
rm -rf ~/.npm/_npx
npx n8n-mcp-server
```

**For Docker users:**
```bash
# Force pull the latest
docker pull ghcr.io/eekfonky/n8n-mcp-server:latest --platform linux/amd64
docker images | grep n8n-mcp-server  # Check the image date
```

### "Server not working after upgrade"

1. Check your environment variables are still set:
   ```bash
   docker exec n8n-mcp-server env | grep N8N_
   ```

2. Check the logs for errors:
   ```bash
   docker logs n8n-mcp-server
   ```

3. Verify n8n API key is still valid:
   ```bash
   curl -H "X-N8N-API-KEY: your-key" http://your-n8n-instance/api/v1/workflows
   ```

### "Want to rollback"

**Docker:**
```bash
docker pull ghcr.io/eekfonky/n8n-mcp-server:v1.0.0  # Use specific version
```

**npm:**
```bash
npm install -g n8n-mcp-server@1.0.0  # Use specific version
```

---

## Migration Notes

### From versions < 1.0.0

No migration needed - configuration is backward compatible. However, you may want to:

1. **Review your cache settings** - The new `MAX_CACHE_SIZE` defaults to 100. If you have a high-traffic server, you may want to increase this:
   ```bash
   export MAX_CACHE_SIZE=500
   ```

2. **Monitor memory usage** - After upgrade, the server should use less memory over time due to bounded caching.

---

## Need Help?

- 📝 Report issues: https://github.com/eekfonky/n8n-mcp-server/issues
- 📖 Documentation: https://github.com/eekfonky/n8n-mcp-server
- 💬 Ask questions in the issues section

---

**Last Updated:** 2025-01-06
