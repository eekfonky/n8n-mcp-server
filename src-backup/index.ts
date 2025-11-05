#!/usr/bin/env node

// This file maintains backwards compatibility and routes to the appropriate server mode
import { N8nMcpServer } from './N8nMcpServer.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Handle graceful shutdown
async function main() {
  const mode = process.env.MCP_MODE || 'stdio';
  const port = parseInt(process.env.MCP_PORT || '3000', 10);

  const server = new N8nMcpServer();

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    if (process.env.DEBUG === 'true') {
      console.error(`\nReceived ${signal}, shutting down gracefully...`);
    }
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  try {
    if (mode === 'gateway') {
      await server.startGateway(port);
    } else {
      await server.startStdio();
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Server startup failed:', error);
    process.exit(1);
  });
}