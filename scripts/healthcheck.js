#!/usr/bin/env node
/**
 * Docker healthcheck script
 * Verifies the MCP server is running and can connect to n8n
 */

import axios from 'axios';

const N8N_BASE_URL = process.env.N8N_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

async function healthcheck() {
  try {
    // Check if we can reach n8n
    if (!N8N_BASE_URL || !N8N_API_KEY) {
      console.error('Missing required environment variables');
      process.exit(1);
    }

    const response = await axios.get(`${N8N_BASE_URL}/api/v1/../healthz`, {
      timeout: 5000,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
      },
    });

    if (response.status === 200) {
      console.log('Health check passed');
      process.exit(0);
    } else {
      console.error('Health check failed:', response.status);
      process.exit(1);
    }
  } catch (error) {
    console.error('Health check error:', error.message);
    process.exit(1);
  }
}

healthcheck();
