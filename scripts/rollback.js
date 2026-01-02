#!/usr/bin/env node
/**
 * Rollback Script
 * 
 * Rolls back a deployment to the previous version
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function exec(command, options = {}) {
  try {
    const output = execSync(command, {
      stdio: 'inherit',
      cwd: ROOT_DIR,
      ...options,
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, error };
  }
}

function getDeploymentInfo(env) {
  const deploymentFile = join(ROOT_DIR, '.deployment-info.json');
  if (!existsSync(deploymentFile)) {
    return null;
  }
  
  const deployments = JSON.parse(readFileSync(deploymentFile, 'utf-8'));
  return deployments[env] || null;
}

async function main() {
  const args = process.argv.slice(2);
  const env = args[0] || 'staging';
  const deploymentId = args[1]; // Optional: specific deployment ID to rollback to
  
  if (!['staging', 'production'].includes(env)) {
    logError(`Invalid environment: ${env}. Must be 'staging' or 'production'`);
    process.exit(1);
  }
  
  if (env === 'production') {
    logWarning('⚠️  PRODUCTION ROLLBACK ⚠️');
    log('This will rollback production. Are you sure?', 'yellow');
  }
  
  log(`\n🔄 Rolling back ${env} deployment...\n`, 'cyan');
  
  const deploymentInfo = getDeploymentInfo(env);
  
  if (!deploymentInfo && !deploymentId) {
    logError('No deployment information found. Cannot determine previous deployment.');
    log('To rollback manually, run: npx wrangler rollback --env ' + env, 'yellow');
    process.exit(1);
  }
  
  const targetDeploymentId = deploymentId || deploymentInfo?.previousDeploymentId;
  
  if (!targetDeploymentId) {
    logError('No previous deployment ID found. Manual rollback required.');
    log('To rollback manually, run: npx wrangler rollback --env ' + env, 'yellow');
    process.exit(1);
  }
  
  log(`Rolling back to deployment: ${targetDeploymentId}`, 'blue');
  log(`Current deployment: ${deploymentInfo?.deploymentId || 'unknown'}`, 'blue');
  log(`Previous deployment: ${targetDeploymentId}\n`, 'blue');
  
  const result = exec(`npx wrangler rollback --env ${env} --message "Manual rollback to ${targetDeploymentId}"`);
  
  if (!result.success) {
    logError('Rollback failed. Manual intervention required.');
    log('Try running: npx wrangler rollback --env ' + env, 'yellow');
    process.exit(1);
  }
  
  logSuccess(`Successfully rolled back ${env} to ${targetDeploymentId}`);
  
  // Update deployment info
  if (deploymentInfo) {
    const deploymentFile = join(ROOT_DIR, '.deployment-info.json');
    const deployments = JSON.parse(readFileSync(deploymentFile, 'utf-8'));
    deployments[env] = {
      deploymentId: targetDeploymentId,
      timestamp: new Date().toISOString(),
      previousDeploymentId: deploymentInfo.deploymentId,
      rolledBack: true,
    };
    writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
  }
}

main().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

