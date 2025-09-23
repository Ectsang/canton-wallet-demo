#!/usr/bin/env node

/**
 * Robust Server Starter
 * Automatically handles port conflicts and provides clear feedback
 */

import { execSync, spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

class ServerStarter {
  constructor() {
    this.port = 8899;
    this.serverPath = join(projectRoot, 'server', 'index.js');
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };
    
    console.log(`[${timestamp}] ${colors[type]('●')} ${message}`);
  }

  async checkPort() {
    this.log(`Checking if port ${this.port} is available...`, 'info');
    
    try {
      const result = execSync(`lsof -ti :${this.port} -sTCP:LISTEN -n -P`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      if (result.trim()) {
        const pids = result.trim().split('\n');
        this.log(`Found ${pids.length} process(es) using port ${this.port}`, 'warning');
        return pids;
      }
      
      this.log(`Port ${this.port} is available`, 'success');
      return [];
    } catch (error) {
      // lsof returns non-zero exit code when no processes found
      this.log(`Port ${this.port} is available`, 'success');
      return [];
    }
  }

  async killExistingProcesses(pids) {
    if (pids.length === 0) return;
    
    this.log(`Terminating ${pids.length} existing process(es)...`, 'warning');
    
    try {
      // Try graceful termination first
      for (const pid of pids) {
        try {
          execSync(`kill ${pid}`, { stdio: 'pipe' });
          this.log(`Sent TERM signal to process ${pid}`, 'info');
        } catch (error) {
          // Process might already be dead
        }
      }
      
      // Wait a moment for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if any processes are still running
      const remainingPids = await this.checkPort();
      
      if (remainingPids.length > 0) {
        this.log('Some processes still running, using force kill...', 'warning');
        
        // Force kill remaining processes
        for (const pid of remainingPids) {
          try {
            execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
            this.log(`Force killed process ${pid}`, 'warning');
          } catch (error) {
            // Process might already be dead
          }
        }
      }
      
      // Also kill by process name as backup
      try {
        execSync('pkill -f "server/index.js"', { stdio: 'pipe' });
      } catch (error) {
        // No processes found, which is fine
      }
      
      try {
        execSync('pkill -f "nodemon --watch server"', { stdio: 'pipe' });
      } catch (error) {
        // No processes found, which is fine
      }
      
      this.log('✅ Port cleanup completed', 'success');
    } catch (error) {
      this.log(`Warning: Some processes might still be running: ${error.message}`, 'warning');
    }
  }

  async startServer() {
    this.log('Starting Canton Wallet Demo server...', 'info');
    
    const serverProcess = spawn('node', [this.serverPath], {
      stdio: 'inherit',
      cwd: projectRoot
    });

    serverProcess.on('error', (error) => {
      this.log(`Failed to start server: ${error.message}`, 'error');
      process.exit(1);
    });

    serverProcess.on('exit', (code, signal) => {
      if (signal) {
        this.log(`Server terminated by signal: ${signal}`, 'warning');
      } else if (code !== 0) {
        this.log(`Server exited with code: ${code}`, 'error');
        process.exit(code);
      } else {
        this.log('Server shut down gracefully', 'info');
      }
    });

    // Give the server a moment to start
    setTimeout(() => {
      this.log(`🚀 Server should be running at http://localhost:${this.port}`, 'success');
      this.log(`📚 API docs available at http://localhost:${this.port}/docs`, 'info');
      this.log('Press Ctrl+C to stop the server', 'info');
    }, 1000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.log('Received SIGINT, shutting down gracefully...', 'info');
      serverProcess.kill('SIGTERM');
    });

    process.on('SIGTERM', () => {
      this.log('Received SIGTERM, shutting down gracefully...', 'info');
      serverProcess.kill('SIGTERM');
    });

    return serverProcess;
  }

  async run() {
    try {
      console.log(chalk.bold('🔧 Canton Wallet Demo Server Starter\n'));
      
      // Check and clean up port
      const existingPids = await this.checkPort();
      await this.killExistingProcesses(existingPids);
      
      // Final port check
      const finalCheck = await this.checkPort();
      if (finalCheck.length > 0) {
        throw new Error(`Port ${this.port} is still in use after cleanup`);
      }
      
      // Start the server
      await this.startServer();
      
    } catch (error) {
      this.log(`Startup failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const starter = new ServerStarter();
  starter.run();
}

export default ServerStarter;
