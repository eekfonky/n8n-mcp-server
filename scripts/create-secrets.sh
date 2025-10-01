#!/bin/bash

# Script to create Docker secrets for n8n MCP server
# Usage: ./scripts/create-secrets.sh

set -e

echo "Creating Docker secrets for n8n MCP server..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Swarm is initialized (required for secrets)
if ! docker node ls >/dev/null 2>&1; then
    echo "Docker Swarm is not initialized. Initializing now..."
    docker swarm init
fi

# Function to create or update a secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3

    echo "Creating/updating secret: $secret_name"

    # Remove existing secret if it exists
    if docker secret ls | grep -q "$secret_name"; then
        echo "  Removing existing secret: $secret_name"
        docker secret rm "$secret_name" >/dev/null 2>&1 || true
    fi

    # Create new secret
    echo "$secret_value" | docker secret create "$secret_name" - --label "description=$description"
    echo "  ✓ Secret '$secret_name' created successfully"
}

# Prompt for N8N_BASE_URL if not provided
if [ -z "$N8N_BASE_URL" ]; then
    read -p "Enter your n8n base URL (e.g., http://localhost:5678): " N8N_BASE_URL
fi

if [ -z "$N8N_BASE_URL" ]; then
    echo "Error: N8N_BASE_URL is required"
    exit 1
fi

# Prompt for N8N_API_KEY if not provided
if [ -z "$N8N_API_KEY" ]; then
    echo "Enter your n8n API key:"
    read -s N8N_API_KEY
    echo
fi

if [ -z "$N8N_API_KEY" ]; then
    echo "Error: N8N_API_KEY is required"
    exit 1
fi

# Create secrets
create_or_update_secret "n8n_base_url" "$N8N_BASE_URL" "n8n instance base URL"
create_or_update_secret "n8n_api_key" "$N8N_API_KEY" "n8n API authentication key"

echo ""
echo "✓ All Docker secrets created successfully!"
echo ""
echo "You can now deploy the n8n MCP server using:"
echo "  docker compose -f docker-compose.gateway.yml up -d"
echo ""
echo "To verify secrets were created:"
echo "  docker secret ls"
echo ""
echo "To view secret details (without revealing content):"
echo "  docker secret inspect n8n_base_url"
echo "  docker secret inspect n8n_api_key"