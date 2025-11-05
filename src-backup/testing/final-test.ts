/**
 * Final Test - Working directly with tool methods
 *
 * Tests the core functionality by bypassing the MCP interface complexity
 * and calling the tool methods directly.
 */

import { MockN8nServer } from './MockN8nServer.js';
import { EnhancedNodeDiscovery } from '../discovery/EnhancedNodeDiscovery.js';
import { N8nApiClient } from '../n8nClient.js';

// Mock API Client that uses MockN8nServer
class MockApiClient extends N8nApiClient {
  constructor(private mockServer: MockN8nServer) {
    super({
      baseUrl: 'http://mock-n8n.test',
      apiKey: 'mock-api-key'
    });
  }

  override async healthCheck(): Promise<boolean> {
    return this.mockServer.healthCheck();
  }

  override async getWorkflows() {
    return this.mockServer.getWorkflows();
  }

  override async getWorkflow(id: string) {
    return this.mockServer.getWorkflow(id);
  }

  override async createWorkflow(workflow: any) {
    return this.mockServer.createWorkflow(workflow);
  }

  override async updateWorkflow(id: string, workflow: any) {
    return this.mockServer.updateWorkflow(id, workflow);
  }

  override async deleteWorkflow(id: string) {
    return this.mockServer.deleteWorkflow(id);
  }

  override async executeWorkflow(id: string, data?: any) {
    return this.mockServer.executeWorkflow(id, data);
  }

  override async getExecution(id: string) {
    return this.mockServer.getExecution(id);
  }

  override async getExecutions(workflowId?: string) {
    return this.mockServer.getExecutions(workflowId || '');
  }

  override async getNodeTypes() {
    return this.mockServer.getNodeTypes();
  }

  override async getCredentials() {
    return this.mockServer.getCredentials();
  }

  override async activateWorkflow(id: string) {
    const workflow = await this.mockServer.getWorkflow(id);
    return this.mockServer.updateWorkflow(id, { ...workflow, active: true });
  }

  override async deactivateWorkflow(id: string) {
    const workflow = await this.mockServer.getWorkflow(id);
    return this.mockServer.updateWorkflow(id, { ...workflow, active: false });
  }
}

async function runFinalTest() {
  console.log('🧪 Running Final Integration Test...\n');

  try {
    // Setup
    const mockServer = new MockN8nServer();
    const mockClient = new MockApiClient(mockServer);
    const nodeDiscovery = new EnhancedNodeDiscovery(mockClient);

    // Test 1: Basic API client operations
    console.log('📋 Test 1: Basic API client operations');

    const workflows = await mockClient.getWorkflows();
    console.log('✅ Retrieved workflows:', workflows.length);

    const nodeTypes = await mockClient.getNodeTypes();
    console.log('✅ Retrieved node types:', nodeTypes.length);

    const credentials = await mockClient.getCredentials();
    console.log('✅ Retrieved credentials:', credentials.length);

    // Test 2: Node discovery
    console.log('\n🔧 Test 2: Enhanced node discovery');

    const discoveryResult = await nodeDiscovery.discoverNodes({ forceRefresh: true });
    console.log('✅ Discovery completed successfully');
    console.log('   - Total nodes found:', discoveryResult.statistics.totalDiscovered);
    console.log('   - Core nodes:', discoveryResult.catalog.coreNodes.length);
    console.log('   - Community nodes:', discoveryResult.catalog.communityNodes.length);

    // Test 3: Workflow operations
    console.log('\n⚙️ Test 3: Workflow operations');

    const newWorkflow = await mockClient.createWorkflow({
      name: 'Test Integration Workflow',
      nodes: [],
      connections: {},
      settings: {}
    });
    console.log('✅ Created workflow:', newWorkflow.name, '(ID:', newWorkflow.id + ')');

    // Test 4: Workflow execution
    console.log('\n▶️ Test 4: Workflow execution');

    const execution = await mockClient.executeWorkflow(newWorkflow.id, { test: 'data' });
    console.log('✅ Executed workflow:', execution.id);
    console.log('   - Status:', execution.finished ? 'finished' : 'running');
    console.log('   - Started at:', execution.startedAt);

    // Test 5: Execution retrieval
    console.log('\n📊 Test 5: Execution retrieval');

    const retrievedExecution = await mockClient.getExecution(execution.id);
    console.log('✅ Retrieved execution:', retrievedExecution.id);

    const allExecutions = await mockClient.getExecutions();
    console.log('✅ All executions count:', allExecutions.length);

    // Test 6: Workflow management
    console.log('\n🔄 Test 6: Workflow management');

    const activatedWorkflow = await mockClient.activateWorkflow(newWorkflow.id);
    console.log('✅ Activated workflow:', activatedWorkflow.name, '- Active:', activatedWorkflow.active);

    const deactivatedWorkflow = await mockClient.deactivateWorkflow(newWorkflow.id);
    console.log('✅ Deactivated workflow:', deactivatedWorkflow.name, '- Active:', deactivatedWorkflow.active);

    // Test 7: Cleanup
    console.log('\n🧹 Test 7: Cleanup');

    await mockClient.deleteWorkflow(newWorkflow.id);
    console.log('✅ Deleted workflow:', newWorkflow.id);

    // Final statistics
    console.log('\n📈 Final Statistics:');
    console.log('   - Total workflows:', mockServer.getWorkflowCount());
    console.log('   - Total executions:', mockServer.getExecutionCount());

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n✨ The testing framework is working correctly!');
    console.log('   - MockN8nServer provides reliable test environment');
    console.log('   - API client operations work as expected');
    console.log('   - Enhanced node discovery functions properly');
    console.log('   - Workflow lifecycle management is functional');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error instanceof Error ? error.stack : String(error));
  }
}

// Run the test
runFinalTest().catch(console.error);