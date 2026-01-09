#!/usr/bin/env node
/**
 * Deployment Script
 * 
 * Handles deployment to Cloudflare Workers with:
 * - Pre-deployment testing
 * - Building
 * - Deployment
 * - Smoke tests
 * - Rollback on failure
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

function logStep(step, message) {
  log(`\n[${step}] ${message}`, 'cyan');
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
  const wranglerToml = readFileSync(join(ROOT_DIR, 'wrangler.toml'), 'utf-8');
  const envMatch = wranglerToml.match(new RegExp(`\\[env\\.${env}\\]([\\s\\S]*?)(?=\\[env\\.|$)`));
  
  if (!envMatch) {
    throw new Error(`Environment ${env} not found in wrangler.toml`);
  }

  const nameMatch = envMatch[1].match(/name\s*=\s*"([^"]+)"/);
  const workerName = nameMatch ? nameMatch[1] : `smartcdn-${env}`;

  return {
    workerName,
    env,
  };
}

function saveDeploymentInfo(env, deploymentId) {
  const deploymentFile = join(ROOT_DIR, '.deployment-info.json');
  let deployments = {};
  
  if (existsSync(deploymentFile)) {
    deployments = JSON.parse(readFileSync(deploymentFile, 'utf-8'));
  }
  
  deployments[env] = {
    deploymentId,
    timestamp: new Date().toISOString(),
    previousDeploymentId: deployments[env]?.deploymentId || null,
  };
  
  writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
  return deployments[env];
}

function getPreviousDeploymentId(env) {
  const deploymentFile = join(ROOT_DIR, '.deployment-info.json');
  if (!existsSync(deploymentFile)) {
    return null;
  }
  
  const deployments = JSON.parse(readFileSync(deploymentFile, 'utf-8'));
  return deployments[env]?.previousDeploymentId || null;
}

async function runTests() {
  logStep('1/5', 'Running tests...');
  const result = exec('npm run test:unit -- --run');
  if (!result.success) {
    logError('Tests failed. Aborting deployment.');
    process.exit(1);
  }
  logSuccess('All tests passed');
}

function buildWorker() {
  logStep('2/5', 'Building worker...');
  const result = exec('npm run build');
  if (!result.success) {
    logError('Build failed. Aborting deployment.');
    process.exit(1);
  }
  logSuccess('Worker built successfully');
}

async function deployToCloudflare(env) {
  logStep('3/5', `Deploying to ${env}...`);

  const deploymentInfo = getDeploymentInfo(env);
  log(`Deploying worker: ${deploymentInfo.workerName}`, 'blue');

  // Try to get current deployment ID before deploying (may not exist for first deployment)
  let currentDeploymentId = null;
  try {
    currentDeploymentId = await getCurrentDeploymentId(env, deploymentInfo.workerName);
  } catch (error) {
    log(`First deployment detected for ${deploymentInfo.workerName}`, 'yellow');
  }

  // Attempt automated deployment
  const result = exec(`npx wrangler deploy --env ${env}`, {
    stdio: 'inherit',
  });

  if (!result.success) {
    // Check for specific error types
    const errorOutput = result.error ? String(result.error) : '';

    if (errorOutput.includes('This Worker does not exist')) {
      logWarning('Worker does not exist. This is normal for first-time deployments.');
      log('Please create the worker manually in Cloudflare Dashboard or run:');
      log(`  wrangler deploy --env ${env} --name ${deploymentInfo.workerName}`);
      log('');
    }

    logError(`Deployment failed. Check the error messages above.`);
    return { success: false, previousDeploymentId: currentDeploymentId };
  }

  // Get new deployment ID
  let newDeploymentId = null;
  try {
    newDeploymentId = await getCurrentDeploymentId(env, deploymentInfo.workerName);
  } catch (error) {
    // If we can't get deployment ID, use timestamp
    newDeploymentId = `deployment-${Date.now()}`;
  }

  // Save deployment info for rollback
  saveDeploymentInfo(env, newDeploymentId);

  logSuccess(`Deployed to ${env} successfully`);
  return { success: true, deploymentId: newDeploymentId, previousDeploymentId: currentDeploymentId };
}

async function getCurrentDeploymentId(env, workerName) {
  try {
    // Try to get deployment ID from wrangler
    const output = execSync(`npx wrangler deployments list --env ${env} --name ${workerName} --json`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });
    
    const deployments = JSON.parse(output);
    if (deployments && deployments.length > 0) {
      return deployments[0].id;
    }
  } catch (error) {
    // If we can't get deployment ID, use timestamp
    return `deployment-${Date.now()}`;
  }
  return `deployment-${Date.now()}`;
}

async function runSmokeTests(env) {
  logStep('4/5', 'Running smoke tests...');
  
  const smokeTestScript = join(__dirname, 'smoke-tests.js');
  if (!existsSync(smokeTestScript)) {
    logWarning('Smoke test script not found, skipping smoke tests');
    return { success: true };
  }
  
  const result = exec(`node ${smokeTestScript} ${env}`, {
    stdio: 'inherit',
  });
  
  if (!result.success) {
    logError('Smoke tests failed');
    return { success: false };
  }
  
  logSuccess('Smoke tests passed');
  return { success: true };
}

async function rollback(env, previousDeploymentId) {
  logStep('ROLLBACK', `Rolling back ${env} deployment...`);
  
  if (!previousDeploymentId) {
    logError('No previous deployment ID found. Manual rollback required.');
    log('To rollback manually, run: npx wrangler rollback --env ' + env);
    return { success: false };
  }
  
  const deploymentInfo = getDeploymentInfo(env);
  log(`Rolling back to previous deployment: ${previousDeploymentId}`, 'yellow');
  
  try {
    const result = exec(`npx wrangler rollback --env ${env} --message "Automatic rollback after failed deployment"`, {
      stdio: 'inherit',
    });
    
    if (!result.success) {
      logError('Rollback failed. Manual intervention required.');
      return { success: false };
    }
    
    logSuccess(`Rolled back ${env} successfully`);
    return { success: true };
  } catch (error) {
    logError(`Rollback error: ${error.message}`);
    return { success: false };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const env = args[0] || 'staging';
  
  if (!['staging', 'production'].includes(env)) {
    logError(`Invalid environment: ${env}. Must be 'staging' or 'production'`);
    process.exit(1);
  }
  
  if (env === 'production') {
    logWarning('⚠️  PRODUCTION DEPLOYMENT ⚠️');
    log('This will deploy to production. Are you sure?', 'yellow');
    // In a real scenario, you might want to add a confirmation prompt here
  }
  
  log(`\n🚀 Starting deployment to ${env.toUpperCase()}`, 'blue');
  log(`Time: ${new Date().toISOString()}\n`);
  
  let previousDeploymentId = null;
  let deploymentResult = null;
  
  try {
    // Step 1: Run tests
    await runTests();
    
    // Step 2: Build worker
    buildWorker();
    
    // Step 3: Deploy
    deploymentResult = await deployToCloudflare(env);
    if (!deploymentResult.success) {
      throw new Error('Deployment failed');
    }
    previousDeploymentId = deploymentResult.previousDeploymentId;
    
    // Step 4: Run smoke tests
    const smokeTestResult = await runSmokeTests(env);
    if (!smokeTestResult.success) {
      logError('Smoke tests failed. Initiating rollback...');
      await rollback(env, previousDeploymentId);
      process.exit(1);
    }
    
    // Step 5: Success
    logStep('5/5', 'Deployment complete!');
    logSuccess(`Successfully deployed to ${env}`);
    log(`Deployment ID: ${deploymentResult.deploymentId}`, 'blue');
    
  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    
    if (deploymentResult && deploymentResult.success) {
      logWarning('Deployment succeeded but smoke tests failed. Rolling back...');
      await rollback(env, previousDeploymentId);
    }
    
    process.exit(1);
  }
}

main().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

