# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive TypeScript type definitions for n8n API responses
- Zod validation schemas for all tool inputs
- In-memory caching layer for n8n API responses
- Retry logic with exponential backoff for API calls
- Structured logging with Pino
- HTTP connection pooling for better performance
- Extensive unit test coverage (client, cache, validation)
- Integration tests for MCP server
- ESLint configuration and linting scripts
- Pre-commit hooks with Husky and lint-staged
- CHANGELOG.md for version tracking
- CONTRIBUTING.md for contributors
- GitHub issue templates

### Changed
- Updated catalog definition to accurately reflect 5 core tools
- Enhanced client with performance monitoring and logging
- Updated dependencies to latest versions
  - axios: ^1.6.0 → ^1.7.7
  - dotenv: ^16.3.0 → ^16.4.5
  - @types/node: ^20.0.0 → ^22.9.0
  - typescript: ^5.0.0 → ^5.6.3
- Added production dependencies: pino, pino-pretty, zod
- Added dev dependencies: eslint, jest, husky, lint-staged, and more

### Fixed
- Missing ESLint and TypeScript ESLint dependencies
- Catalog listing 15 tools instead of actual 5 tools
- Missing return type annotations in client methods

## [2.0.0] - 2025-10-02

### Changed
- Complete rewrite with minimal MCP server approach
- Reduced from 15 to 5 core tools (discover, create, execute, inspect, remove)
- Lazy-loading architecture for faster startup
- Updated to MCP SDK v1.0
- Reduced codebase from ~13,000 to ~2,400 lines of code

### Removed
- 10 advanced tools (modify, connect, control, search, validate, monitor, debug, template, batch, export)
  - Moved to src-backup for reference
- Complex caching and performance layers (simplified in v2)

### Added
- Universal MCP server compatibility (Claude Code, Claude Desktop, Gemini CLI)
- Standardized installation following Claude Code best practices
- Comprehensive documentation and examples

## [1.0.0] - Previous Version

### Features
- 15 comprehensive n8n workflow automation tools
- Advanced caching and performance optimization
- Extensive type system and error handling
- Complex workflow management capabilities

---

## Migration Guide

### From v1.x to v2.x

**Breaking Changes:**
- 10 tools removed (available in src-backup if needed)
- Simplified API - focus on 5 core operations

**Non-Breaking:**
- All v1 workflows continue to work with v2 tools
- Environment variables unchanged
- Docker image names remain the same

**To Upgrade:**
See [UPGRADING.md](./UPGRADING.md) for detailed instructions.

---

## Links

- [Repository](https://github.com/eekfonky/n8n-mcp-server)
- [Issues](https://github.com/eekfonky/n8n-mcp-server/issues)
- [Documentation](https://github.com/eekfonky/n8n-mcp-server#readme)
