import fetch from 'node-fetch';
import { createConnection } from 'net';

/**
 * LocalNet setup and health check utilities for integration tests
 */

// Configuration based on LocalNet ports
export const LOCALNET_CONFIG = {
  LEDGER_API_PORT: 2901,
  ADMIN_API_PORT: 2902,
  VALIDATOR_API_PORT: 2903,
  UI_PORT: 2000,
  SCAN_API_URL: 'http://scan.localhost:4000/api/scan',
};

const HEALTH_CHECK_ENDPOINTS = [
  { name: 'App User Ledger API', port: LOCALNET_CONFIG.LEDGER_API_PORT, type: 'grpc' },
  { name: 'App User Admin API', port: LOCALNET_CONFIG.ADMIN_API_PORT, type: 'grpc' },
  { name: 'App User Validator API', port: LOCALNET_CONFIG.VALIDATOR_API_PORT, type: 'grpc' },
  { name: 'App User UI', url: `http://localhost:${LOCALNET_CONFIG.UI_PORT}`, type: 'http' },
];

/**
 * Check if a specific endpoint is healthy
 */
async function checkEndpoint(endpoint) {
  if (endpoint.type === 'http') {
    try {
      const response = await fetch(endpoint.url, { 
        timeout: 5000,
        headers: { 'User-Agent': 'Canton-Integration-Test' }
      });
      return { 
        name: endpoint.name, 
        status: response.ok ? 'OK' : 'FAIL',
        details: `Status: ${response.status}`
      };
    } catch (error) {
      return { 
        name: endpoint.name, 
        status: 'ERROR', 
        details: error.message 
      };
    }
  } else if (endpoint.type === 'grpc') {
    // For gRPC endpoints, just check if the port is open
    return new Promise((resolve) => {
      const socket = createConnection(endpoint.port, 'localhost');
      
      socket.on('connect', () => {
        socket.destroy();
        resolve({ 
          name: endpoint.name, 
          status: 'OK', 
          details: 'Status: Connected' 
        });
      });
      
      socket.on('error', (error) => {
        resolve({ 
          name: endpoint.name, 
          status: 'ERROR', 
          details: error.message 
        });
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        socket.destroy();
        resolve({ 
          name: endpoint.name, 
          status: 'TIMEOUT', 
          details: 'Connection timeout' 
        });
      }, 5000);
    });
  }
}

/**
 * Check if LocalNet is healthy and ready for integration tests
 */
export async function checkLocalNetHealth() {
  console.info('🔍 Checking LocalNet health...');
  
  const results = await Promise.all(
    HEALTH_CHECK_ENDPOINTS.map(endpoint => checkEndpoint(endpoint))
  );
  
  const allHealthy = results.every(result => result.status === 'OK');
  
  // Log results
  results.forEach(result => {
    const icon = result.status === 'OK' ? '✅' : '❌';
    console.info(`${icon} ${result.name}: ${result.status} (${result.details})`);
  });
  
  if (allHealthy) {
    console.info('✅ LocalNet is healthy!');
  } else {
    console.error('❌ LocalNet health check failed!');
    console.error('Please ensure LocalNet is running: docker-compose up');
  }
  
  return allHealthy;
}

/**
 * Wait for LocalNet to be ready (with retries)
 */
export async function waitForLocalNet(maxRetries = 10, retryDelay = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    const isHealthy = await checkLocalNetHealth();
    if (isHealthy) {
      return true;
    }
    
    if (i < maxRetries - 1) {
      console.info(`⏳ Waiting ${retryDelay}ms before retry ${i + 2}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  throw new Error(`LocalNet failed to become healthy after ${maxRetries} attempts`);
}

/**
 * Setup function to be called before integration tests
 */
export async function setupIntegrationTests() {
  console.info('🚀 Setting up integration tests...');
  
  const isHealthy = await checkLocalNetHealth();
  
  if (!isHealthy) {
    console.error('❌ LocalNet is not available for integration tests');
    console.error('');
    console.error('To start LocalNet, run:');
    console.error('  canton -c examples/01-simple-topology/simple-topology.conf');
    console.error('');
    console.error('Or use the health check script:');
    console.error('  node scripts/check-localnet.js --wait');
    console.error('');
    throw new Error('LocalNet is not healthy. Please start LocalNet before running integration tests.');
  }
  
  console.info('✅ LocalNet is ready for integration tests');
  return true;
}

/**
 * Validate LocalNet configuration for integration tests
 */
export async function validateLocalNetConfig() {
  console.info('🔧 Validating LocalNet configuration...');
  
  const results = await Promise.all(
    HEALTH_CHECK_ENDPOINTS.map(endpoint => checkEndpoint(endpoint))
  );
  
  const issues = results.filter(result => result.status !== 'OK');
  
  if (issues.length > 0) {
    console.warn('⚠️  LocalNet configuration issues detected:');
    issues.forEach(issue => {
      console.warn(`   - ${issue.name}: ${issue.status} (${issue.details})`);
    });
    
    return {
      isValid: false,
      issues: issues.map(issue => ({
        service: issue.name,
        status: issue.status,
        details: issue.details
      }))
    };
  }
  
  console.info('✅ LocalNet configuration is valid');
  return { isValid: true, issues: [] };
}

/**
 * Cleanup function to be called after integration tests
 */
export async function cleanupIntegrationTests() {
  // Add any cleanup logic here if needed
  console.info('🧹 Integration test cleanup completed');
}
