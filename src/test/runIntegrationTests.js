#!/usr/bin/env node

/**
 * Script to run integration tests against a running LocalNet instance
 * 
 * Usage:
 *   npm run test:integration
 * 
 * Prerequisites:
 *   - LocalNet must be running (docker-compose up in localnet directory)
 *   - All Canton services must be healthy
 */

import { spawn } from 'child_process';
import fetch from 'node-fetch';
import { createConnection } from 'net';

// Configuration based on LocalNet ports
const HEALTH_CHECK_ENDPOINTS = [
  { name: 'App User Ledger API', port: 2901, type: 'grpc' },
  { name: 'App User Admin API', port: 2902, type: 'grpc' },
  { name: 'App User Validator API', port: 2903, type: 'grpc' },
  { name: 'App User UI', url: 'http://localhost:2000', type: 'http' },
];

async function checkEndpoint(endpoint) {
  if (endpoint.type === 'http') {
    // HTTP endpoint check (for UI)
    try {
      const response = await fetch(endpoint.url, { 
        timeout: 5000,
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      return { 
        name: endpoint.name, 
        success: response.ok,
        status: response.status 
      };
    } catch (error) {
      return { 
        name: endpoint.name, 
        success: false, 
        error: error.message 
      };
    }
  } else {
    // gRPC endpoint check (for Canton services)
    return new Promise((resolve) => {
      const connection = createConnection(endpoint.port, 'localhost');
      
      const timeout = setTimeout(() => {
        connection.destroy();
        resolve({
          name: endpoint.name,
          success: false,
          error: 'Connection timeout'
        });
      }, 5000);
      
      connection.on('connect', () => {
        clearTimeout(timeout);
        connection.end();
        resolve({
          name: endpoint.name,
          success: true,
          status: 'Connected'
        });
      });
      
      connection.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          name: endpoint.name,
          success: false,
          error: error.message
        });
      });
    });
  }
}

async function checkLocalNetHealth() {
  console.log('🔍 Checking LocalNet health...\n');
  
  const results = await Promise.all(
    HEALTH_CHECK_ENDPOINTS.map(checkEndpoint)
  );
  
  let allHealthy = true;
  
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.name}: OK (Status: ${result.status})`);
    } else {
      console.log(`❌ ${result.name}: FAILED (${result.error || `Status: ${result.status}`})`);
      allHealthy = false;
    }
  });
  
  return allHealthy;
}

async function runIntegrationTests() {
  console.log('Canton Wallet Demo - Integration Test Runner');
  console.log('==========================================\n');
  
  // Check if LocalNet is running
  const isHealthy = await checkLocalNetHealth();
  
  if (!isHealthy) {
    console.error('\n❌ LocalNet is not fully operational!');
    console.error('\nPlease ensure LocalNet is running:');
    console.error('  cd /Users/e/code/sbc/canton/localnet/splice-node/docker-compose/localnet');
    console.error('  docker-compose up');
    console.error('\nWait for all services to be healthy before running integration tests.');
    console.error('You can check the logs with: docker-compose logs -f\n');
    process.exit(1);
  }
  
  console.log('\n✅ LocalNet is healthy!\n');
  console.log('Running integration tests...\n');
  
  // Run integration tests with environment variable
  const testProcess = spawn('npm', ['run', 'test', '--', 'integration.test.js'], {
    env: { 
      ...process.env, 
      RUN_INTEGRATION_TESTS: 'true',
      NODE_ENV: 'test',
      UNSAFE_SECRET: 'test-secret-for-localnet-development-only'
    },
    stdio: 'inherit'
  });
  
  testProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Integration tests completed successfully!');
    } else {
      console.error(`\n❌ Integration tests failed with code ${code}`);
    }
    process.exit(code);
  });
}

// Run the tests
runIntegrationTests().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});