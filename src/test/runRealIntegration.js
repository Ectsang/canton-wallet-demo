#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

// Canton LocalNet configuration
const CANTON_LEDGER_API = 'http://localhost:2901/v1/health';
const CANTON_ADMIN_API = 'http://localhost:2902/health';
const CANTON_DOCKER_COMPOSE_PATH = '/Users/e/code/sbc/canton/localnet/splice-node/docker-compose';

async function checkCantonRunning() {
  console.log(chalk.blue('🔍 Checking if Canton LocalNet is running...'));
  
  try {
    // Check if Canton containers are running
    const containers = await getCantonContainers();
    if (containers && containers.includes('canton')) {
      console.log(chalk.green('✅ Canton LocalNet containers are running!'));
      return true;
    }
  } catch (error) {
    // Canton is not running
  }
  
  console.log(chalk.yellow('⚠️  Canton LocalNet is not running'));
  return false;
}

async function checkDockerRunning() {
  try {
    await execAsync('docker info');
    return true;
  } catch (error) {
    return false;
  }
}

async function getCantonContainers() {
  try {
    const { stdout } = await execAsync('docker ps --format "table {{.Names}}\t{{.Status}}" | grep canton || true');
    return stdout.trim();
  } catch (error) {
    return '';
  }
}

async function startCanton() {
  console.log(chalk.blue('\n📦 Starting Canton LocalNet...'));
  console.log(chalk.gray(`Working directory: ${CANTON_DOCKER_COMPOSE_PATH}`));
  
  const dockerCompose = spawn('docker-compose', ['up', '-d'], {
    cwd: CANTON_DOCKER_COMPOSE_PATH,
    stdio: 'inherit'
  });
  
  return new Promise((resolve, reject) => {
    dockerCompose.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('✅ Docker Compose started successfully'));
        resolve();
      } else {
        reject(new Error(`Docker Compose exited with code ${code}`));
      }
    });
    
    dockerCompose.on('error', (error) => {
      reject(error);
    });
  });
}

async function waitForCanton(maxAttempts = 30) {
  console.log(chalk.blue('\n⏳ Waiting for Canton to be ready...'));
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Check if containers are healthy
      const { stdout } = await execAsync('docker ps --format "table {{.Names}}\t{{.Status}}" | grep canton | grep healthy || true');
      if (stdout.includes('healthy')) {
        console.log(chalk.green('\n✅ Canton is ready!'));
        return true;
      }
    } catch (error) {
      // Still waiting
    }
    
    process.stdout.write('.');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(chalk.red('\n❌ Canton failed to start within timeout'));
  return false;
}

async function runTests() {
  console.log(chalk.blue('\n🧪 Running real integration tests...'));
  
  const testProcess = spawn('npm', ['test', '--', 'realIntegration.test.js'], {
    env: {
      ...process.env,
      RUN_REAL_INTEGRATION_TESTS: 'true',
      NODE_ENV: 'test'
    },
    stdio: 'inherit'
  });
  
  return new Promise((resolve) => {
    testProcess.on('close', (code) => {
      resolve(code);
    });
  });
}

async function showCantonConsoleInstructions() {
  console.log(chalk.blue('\n📋 Canton Console Verification Instructions:'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log('1. Connect to Canton console:');
  console.log(chalk.cyan('   docker exec -it splice-node-app-user-1 /canton/bin/canton console'));
  console.log('\n2. Useful console commands:');
  console.log(chalk.cyan('   // List all parties'));
  console.log(chalk.cyan('   participant.parties.list()'));
  console.log(chalk.cyan('\n   // Find specific party'));
  console.log(chalk.cyan('   participant.parties.find("party::...")'));
  console.log(chalk.cyan('\n   // List all active contracts'));
  console.log(chalk.cyan('   participant.ledger_api.acs.of_all()'));
  console.log(chalk.cyan('\n   // Filter token contracts'));
  console.log(chalk.cyan('   participant.ledger_api.acs.filter(c => c.templateId.includes("Token"))'));
  console.log(chalk.gray('─'.repeat(50)));
}

async function main() {
  console.log(chalk.bold.blue('\n🚀 Canton Real Integration Test Runner\n'));
  
  // Check if Docker is running
  const dockerRunning = await checkDockerRunning();
  if (!dockerRunning) {
    console.log(chalk.red('❌ Docker is not running. Please start Docker Desktop first.'));
    process.exit(1);
  }
  
  // Check if Canton is already running
  let cantonRunning = await checkCantonRunning();
  
  if (!cantonRunning) {
    // Show current Canton containers
    const containers = await getCantonContainers();
    if (containers) {
      console.log(chalk.yellow('\nCurrent Canton containers:'));
      console.log(containers);
    }
    
    // Ask user if they want to start Canton
    console.log(chalk.yellow('\n⚠️  Canton LocalNet needs to be running for real integration tests.'));
    console.log(chalk.gray(`Expected location: ${CANTON_DOCKER_COMPOSE_PATH}`));
    console.log(chalk.yellow('\nWould you like to start Canton LocalNet? (Y/n)'));
    
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.toLowerCase());
      });
    });
    
    if (answer === '' || answer === 'y' || answer === 'yes') {
      try {
        await startCanton();
        const ready = await waitForCanton();
        if (!ready) {
          console.log(chalk.red('❌ Canton failed to start. Please check Docker logs.'));
          process.exit(1);
        }
      } catch (error) {
        console.log(chalk.red(`❌ Failed to start Canton: ${error.message}`));
        console.log(chalk.yellow('\nTo start Canton manually:'));
        console.log(chalk.cyan(`cd ${CANTON_DOCKER_COMPOSE_PATH}`));
        console.log(chalk.cyan('docker-compose up -d'));
        process.exit(1);
      }
    } else {
      console.log(chalk.yellow('\nTo start Canton manually:'));
      console.log(chalk.cyan(`cd ${CANTON_DOCKER_COMPOSE_PATH}`));
      console.log(chalk.cyan('docker-compose up -d'));
      console.log(chalk.yellow('\nThen run this script again.'));
      process.exit(0);
    }
  }
  
  // Run the tests
  const exitCode = await runTests();
  
  // Show Canton console instructions
  await showCantonConsoleInstructions();
  
  // Show summary
  if (exitCode === 0) {
    console.log(chalk.green('\n✅ All tests passed!'));
  } else {
    console.log(chalk.red(`\n❌ Tests failed with exit code ${exitCode}`));
  }
  
  process.exit(exitCode);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('\n❌ Unhandled error:'), error);
  process.exit(1);
});

// Run the script
main().catch((error) => {
  console.error(chalk.red('\n❌ Script error:'), error);
  process.exit(1);
});