# Testing Framework for n8n MCP Server

This directory contains the comprehensive testing framework for the n8n MCP Server primitives.

## Files

### MockN8nServer.ts
Complete mock implementation of the n8n API for reliable testing without requiring a live n8n instance. Provides:
- Workflow CRUD operations
- Execution management
- Node type discovery
- Credential management
- Test data initialization

### final-test.ts
Comprehensive integration test that validates:
- Basic API client operations
- Enhanced node discovery functionality
- Workflow lifecycle management
- Execution operations
- Error handling

### setup.ts
Jest configuration and custom matchers for testing (if using Jest).

## Running Tests

### Primary Test Command
```bash
npm run test:primitives
```

This runs the final integration test that validates all core functionality.

### Manual Test Run
```bash
npm run build
node dist/testing/final-test.js
```

## Test Coverage

The testing framework validates:

1. **MockN8nServer Operations**
   - Workflow creation, retrieval, update, deletion
   - Execution management
   - Node type and credential discovery
   - State management and cleanup

2. **API Client Integration**
   - All HTTP operations through mock server
   - Error handling and response parsing
   - Authentication simulation

3. **Enhanced Node Discovery**
   - Workflow-based node discovery
   - API-based node discovery
   - Catalog merging and statistics

4. **Workflow Lifecycle**
   - Creation with various templates
   - Activation/deactivation
   - Execution with custom data
   - Cleanup operations

## Test Results

A successful test run shows:
- ✅ All API operations complete successfully
- ✅ Node discovery finds and catalogs nodes
- ✅ Workflow operations work end-to-end
- ✅ Execution system functions properly
- ✅ Statistics and state management work correctly

## Benefits

1. **Reliability**: No dependency on external n8n instance
2. **Speed**: Fast execution with predictable results
3. **Isolation**: Each test run starts with clean state
4. **Coverage**: Tests all primitive operations comprehensively
5. **Debugging**: Clear output shows exactly what's working

## Architecture

The testing framework follows a clean architecture:
- **MockN8nServer**: Simulates n8n API behavior
- **MockApiClient**: Extends real API client to use mock server
- **Final Test**: Exercises all functionality through realistic scenarios

This approach ensures that our primitive tools work correctly in isolation while validating the integration points between components.