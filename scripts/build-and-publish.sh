#!/bin/bash

# n8n MCP Server - Build and Publish Script
# Builds Docker image and publishes to both GHCR and Docker Hub

set -e

# Configuration
IMAGE_NAME="n8n-mcp-server"
VERSION="1.0.0"
DOCKER_USERNAME="${DOCKER_USERNAME:-eekfonky}"
GITHUB_USERNAME="${GITHUB_USERNAME:-eekfonky}"

# Image tags
DOCKERHUB_IMAGE="${DOCKER_USERNAME}/${IMAGE_NAME}"
GHCR_IMAGE="ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}"

echo "🚀 Building and publishing n8n MCP Server..."
echo ""

# Function to build the image
build_image() {
    echo "🔨 Building Docker image..."

    # Build the multi-stage image
    docker build \
        --platform linux/amd64,linux/arm64 \
        --build-arg VERSION="$VERSION" \
        --tag "${DOCKERHUB_IMAGE}:${VERSION}" \
        --tag "${DOCKERHUB_IMAGE}:latest" \
        --tag "${GHCR_IMAGE}:${VERSION}" \
        --tag "${GHCR_IMAGE}:latest" \
        .

    echo "✅ Image built successfully"
}

# Function to test the image
test_image() {
    echo ""
    echo "🧪 Testing Docker image..."

    # Test that the image starts properly
    timeout 10s docker run --rm "${DOCKERHUB_IMAGE}:latest" || {
        if [ $? -eq 124 ]; then
            echo "✅ Image starts successfully (timeout expected for MCP server)"
        else
            echo "❌ Image failed to start"
            return 1
        fi
    }
}

# Function to publish to Docker Hub
publish_dockerhub() {
    echo ""
    echo "📤 Publishing to Docker Hub..."

    # Check if logged in to Docker Hub
    if ! docker info | grep -q "Username"; then
        echo "Please log in to Docker Hub first:"
        echo "docker login"
        return 1
    fi

    # Push to Docker Hub
    docker push "${DOCKERHUB_IMAGE}:${VERSION}"
    docker push "${DOCKERHUB_IMAGE}:latest"

    echo "✅ Published to Docker Hub: ${DOCKERHUB_IMAGE}"
}

# Function to publish to GitHub Container Registry
publish_ghcr() {
    echo ""
    echo "📤 Publishing to GitHub Container Registry..."

    # Check if logged in to GHCR
    if ! docker info | grep -q "ghcr.io"; then
        echo "Please log in to GHCR first:"
        echo "echo \$GITHUB_TOKEN | docker login ghcr.io -u \$GITHUB_USERNAME --password-stdin"
        return 1
    fi

    # Push to GHCR
    docker push "${GHCR_IMAGE}:${VERSION}"
    docker push "${GHCR_IMAGE}:latest"

    echo "✅ Published to GHCR: ${GHCR_IMAGE}"
}

# Function to update catalog with new image URLs
update_catalog() {
    echo ""
    echo "📝 Updating catalog files..."

    # Update main catalog
    if [ -f "catalog/n8n-server.yaml" ]; then
        sed -i "s|image: \".*\"|image: \"${DOCKERHUB_IMAGE}:latest\"|" catalog/n8n-server.yaml
        echo "✅ Updated main catalog with Docker Hub image"
    fi

    # Update server definition
    if [ -f "catalog/server-definition.yaml" ]; then
        sed -i "s|image: \".*\"|image: \"${DOCKERHUB_IMAGE}:latest\"|" catalog/server-definition.yaml
        echo "✅ Updated server definition with Docker Hub image"
    fi
}

# Function to show usage information
show_usage() {
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --build-only     Build image without publishing"
    echo "  --dockerhub-only Publish only to Docker Hub"
    echo "  --ghcr-only      Publish only to GHCR"
    echo "  --skip-test      Skip image testing"
    echo "  --help           Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DOCKER_USERNAME  Docker Hub username (default: eekfonky)"
    echo "  GITHUB_USERNAME  GitHub username (default: eekfonky)"
    echo "  GITHUB_TOKEN     GitHub token for GHCR authentication"
}

# Function to show final summary
show_summary() {
    echo ""
    echo "🎉 Build and publish complete!"
    echo ""
    echo "Published images:"
    echo "  Docker Hub: ${DOCKERHUB_IMAGE}:latest"
    echo "  GHCR:       ${GHCR_IMAGE}:latest"
    echo ""
    echo "Usage:"
    echo "  docker run --rm -i ${DOCKERHUB_IMAGE}:latest"
    echo ""
    echo "Catalog files updated with new image references."
}

# Parse command line arguments
BUILD_ONLY=false
DOCKERHUB_ONLY=false
GHCR_ONLY=false
SKIP_TEST=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --dockerhub-only)
            DOCKERHUB_ONLY=true
            shift
            ;;
        --ghcr-only)
            GHCR_ONLY=true
            shift
            ;;
        --skip-test)
            SKIP_TEST=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    # Build the image
    build_image

    # Test the image (unless skipped)
    if [ "$SKIP_TEST" = false ]; then
        test_image
    fi

    # Exit early if build-only
    if [ "$BUILD_ONLY" = true ]; then
        echo "✅ Build complete (publish skipped)"
        exit 0
    fi

    # Publish based on options
    if [ "$GHCR_ONLY" = true ]; then
        publish_ghcr
    elif [ "$DOCKERHUB_ONLY" = true ]; then
        publish_dockerhub
    else
        # Publish to both by default
        publish_dockerhub
        publish_ghcr
    fi

    # Update catalog files
    update_catalog

    # Show summary
    show_summary
}

# Run main function
main "$@"