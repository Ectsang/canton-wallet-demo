#!/usr/bin/env node

/**
 * DAML Build Script - Phase 1.1
 * Automated DAR compilation and validation for MinimalToken
 */

import { execSync, spawn } from 'child_process';
import { existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const damlProjectPath = join(projectRoot, 'daml', 'minimal-token');
const darOutputPath = join(damlProjectPath, 'minimal-token.dar');

class DAMLBuilder {
  constructor() {
    this.verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
    this.force = process.argv.includes('--force') || process.argv.includes('-f');
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };
    
    console.log(`[${timestamp}] ${colors[type]('●')} ${message}`);
  }

  async checkPrerequisites() {
    this.log('Checking DAML prerequisites...', 'info');
    
    try {
      // Check if daml command exists
      execSync('daml version', { stdio: 'pipe' });
      this.log('✓ DAML SDK found', 'success');
    } catch (error) {
      throw new Error('DAML SDK not found. Please install DAML SDK first.');
    }

    // Check if daml.yaml exists
    const damlYamlPath = join(damlProjectPath, 'daml.yaml');
    if (!existsSync(damlYamlPath)) {
      throw new Error(`daml.yaml not found at ${damlYamlPath}`);
    }
    this.log('✓ daml.yaml found', 'success');

    // Check if MinimalToken.daml exists
    const minimalTokenPath = join(damlProjectPath, 'daml', 'MinimalToken.daml');
    if (!existsSync(minimalTokenPath)) {
      throw new Error(`MinimalToken.daml not found at ${minimalTokenPath}`);
    }
    this.log('✓ MinimalToken.daml found', 'success');

    return true;
  }

  async checkIfRebuildNeeded() {
    if (this.force) {
      this.log('Force rebuild requested', 'warning');
      return true;
    }

    if (!existsSync(darOutputPath)) {
      this.log('DAR file does not exist, build needed', 'info');
      return true;
    }

    // Check if source files are newer than DAR
    const darStats = statSync(darOutputPath);
    const damlFiles = [
      join(damlProjectPath, 'daml.yaml'),
      join(damlProjectPath, 'daml', 'MinimalToken.daml')
    ];

    for (const file of damlFiles) {
      if (existsSync(file)) {
        const fileStats = statSync(file);
        if (fileStats.mtime > darStats.mtime) {
          this.log(`${file} is newer than DAR, rebuild needed`, 'info');
          return true;
        }
      }
    }

    this.log('DAR is up to date', 'success');
    return false;
  }

  async buildDAR() {
    this.log('Building DAML project...', 'info');
    
    return new Promise((resolve, reject) => {
      const buildProcess = spawn('daml', ['build'], {
        cwd: damlProjectPath,
        stdio: this.verbose ? 'inherit' : 'pipe'
      });

      let stdout = '';
      let stderr = '';

      if (!this.verbose) {
        buildProcess.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        buildProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      buildProcess.on('close', (code) => {
        if (code === 0) {
          this.log('✓ DAML build completed successfully', 'success');
          resolve({ success: true, stdout, stderr });
        } else {
          this.log('✗ DAML build failed', 'error');
          if (!this.verbose) {
            console.log('STDOUT:', stdout);
            console.log('STDERR:', stderr);
          }
          reject(new Error(`DAML build failed with exit code ${code}`));
        }
      });

      buildProcess.on('error', (error) => {
        this.log(`✗ Build process error: ${error.message}`, 'error');
        reject(error);
      });
    });
  }

  async validateDAR() {
    this.log('Validating generated DAR...', 'info');

    if (!existsSync(darOutputPath)) {
      throw new Error('DAR file not found after build');
    }

    const stats = statSync(darOutputPath);
    if (stats.size === 0) {
      throw new Error('Generated DAR file is empty');
    }

    this.log(`✓ DAR file generated: ${darOutputPath} (${stats.size} bytes)`, 'success');

    // Validate DAR contents using daml damlc inspect-dar
    try {
      const inspectOutput = execSync(`daml damlc inspect-dar ${darOutputPath}`, { 
        cwd: damlProjectPath,
        encoding: 'utf8'
      });

      if (this.verbose) {
        console.log('DAR Contents:');
        console.log(inspectOutput);
      }

      // Check if MinimalToken module is present
      if (!inspectOutput.includes('MinimalToken')) {
        throw new Error('MinimalToken module not found in DAR');
      }

      this.log('✓ DAR validation passed', 'success');
      return { valid: true, contents: inspectOutput };
    } catch (error) {
      throw new Error(`DAR validation failed: ${error.message}`);
    }
  }

  async run() {
    try {
      this.log('Starting DAML build process...', 'info');
      
      await this.checkPrerequisites();
      
      const rebuildNeeded = await this.checkIfRebuildNeeded();
      if (!rebuildNeeded) {
        this.log('Build skipped - DAR is up to date', 'success');
        // Still validate the existing DAR
        const validation = await this.validateDAR();
        return { success: true, skipped: true, validation };
      }

      await this.buildDAR();
      const validation = await this.validateDAR();
      
      this.log('DAML build process completed successfully!', 'success');
      return { 
        success: true, 
        darPath: darOutputPath,
        validation 
      };
    } catch (error) {
      this.log(`Build failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const builder = new DAMLBuilder();
  builder.run();
}

export default DAMLBuilder;
