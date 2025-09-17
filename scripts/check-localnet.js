#!/usr/bin/env node

/**
 * LocalNet Health Check Script
 * 
 * This script checks if Canton LocalNet is running and healthy before running integration tests.
 * It verifies all required services are accessible and responding correctly.
 */

import { checkLocalNetHealth, setupIntegrationTests } from '../src/test/integration/helpers/localnetSetup.js';

const HEALTH_CHECK_TIMEOUT = 30000; // 30 seconds
const RETRY_INTERVAL = 2000; // 2 seconds

/**
 * Main health check function
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    wait: args.includes('--wait'),
    timeout: parseInt(args.find(arg => arg.startsWith('--timeout='))?.split('=')[1]) || HEALTH_CHECK_TIMEOUT,
    verbose: args.includes('--verbose') || args.includes('-v'),
    quiet: args.includes('--quiet') || args.includes('-q'),
  };

  if (!options.quiet) {
    console.log('🏥 Canton LocalNet Health Check');
    console.log('================================');
  }

  try {
    if (options.wait) {
      await waitForHealthyLocalNet(options);
    } else {
      await checkOnce(options);
    }
  } catch (error) {
    if (!options.quiet) {
      console.error('❌ Health check failed:', error.message);
    }
    process.exit(1);
  }
}

/**
 * Perform a single health check
 */
async function checkOnce(options) {
  const isHealthy = await checkLocalNetHealth();
  
  if (isHealthy) {
    if (!options.quiet) {
      console.log('✅ LocalNet is healthy and ready for integration tests!');
    }
    process.exit(0);
  } else {
    if (!options.quiet) {
      console.log('❌ LocalNet is not healthy. Please start LocalNet and try again.');
      console.log('\nTo start LocalNet, run:');
      console.log('  canton -c examples/01-simple-topology/simple-topology.conf');
    }
    process.exit(1);
  }
}

/**
 * Wait for LocalNet to become healthy (with timeout)
 */
async function waitForHealthyLocalNet(options) {
  const startTime = Date.now();
  let attempt = 1;

  if (!options.quiet) {
    console.log(`⏳ Waiting for LocalNet to become healthy (timeout: ${options.timeout}ms)...`);
  }

  while (Date.now() - startTime < options.timeout) {
    if (options.verbose) {
      console.log(`\n🔄 Attempt ${attempt}:`);
    }

    const isHealthy = await checkLocalNetHealth();
    
    if (isHealthy) {
      if (!options.quiet) {
        console.log(`\n✅ LocalNet is healthy after ${attempt} attempt(s)!`);
      }
      return;
    }

    if (options.verbose) {
      console.log(`❌ Not healthy yet, retrying in ${RETRY_INTERVAL}ms...`);
    } else if (!options.quiet) {
      process.stdout.write('.');
    }

    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
    attempt++;
  }

  throw new Error(`LocalNet did not become healthy within ${options.timeout}ms`);
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Usage: node scripts/check-localnet.js [options]

Options:
  --wait              Wait for LocalNet to become healthy (with timeout)
  --timeout=<ms>      Timeout in milliseconds (default: 30000)
  --verbose, -v       Verbose output
  --quiet, -q         Quiet mode (minimal output)
  --help, -h          Show this help message

Examples:
  node scripts/check-localnet.js                    # Single health check
  node scripts/check-localnet.js --wait             # Wait for healthy LocalNet
  node scripts/check-localnet.js --wait --timeout=60000  # Wait up to 60 seconds
  node scripts/check-localnet.js --quiet            # Quiet mode for scripts
`);
}

// Handle help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printUsage();
  process.exit(0);
}

// Run the main function
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
