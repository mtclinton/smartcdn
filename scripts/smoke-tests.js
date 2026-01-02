#!/usr/bin/env node
/**
 * Smoke Tests
 * 
 * Basic health checks against deployed worker
 */

import { readFileSync } from 'fs';
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

function getWorkerUrl(env) {
  const wranglerToml = readFileSync(join(ROOT_DIR, 'wrangler.toml'), 'utf-8');
  const envMatch = wranglerToml.match(new RegExp(`\\[env\\.${env}\\]([\\s\\S]*?)(?=\\[env\\.|$)`));
  
  if (!envMatch) {
    throw new Error(`Environment ${env} not found in wrangler.toml`);
  }

  const nameMatch = envMatch[1].match(/name\s*=\s*"([^"]+)"/);
  const workerName = nameMatch ? nameMatch[1] : `smartcdn-${env}`;
  
  // Construct worker URL
  // Format: https://<worker-name>.<account-subdomain>.workers.dev
  // For custom domains, this would need to be configured
  const accountSubdomain = process.env.CLOUDFLARE_ACCOUNT_SUBDOMAIN || 'your-subdomain';
  return `https://${workerName}.${accountSubdomain}.workers.dev`;
}

async function smokeTest(name, testFn) {
  try {
    log(`Testing: ${name}...`, 'blue');
    const result = await testFn();
    if (result.success) {
      logSuccess(`${name}: ${result.message || 'OK'}`);
      return true;
    } else {
      logError(`${name}: ${result.message || 'FAILED'}`);
      return false;
    }
  } catch (error) {
    logError(`${name}: ${error.message}`);
    return false;
  }
}

async function testHealthCheck(workerUrl) {
  try {
    const response = await fetch(workerUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'SmokeTest/1.0',
      },
    });
    
    if (response.status >= 200 && response.status < 500) {
      return { success: true, message: `Status ${response.status}` };
    } else {
      return { success: false, message: `Unexpected status ${response.status}` };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testImageRequest(workerUrl) {
  try {
    const response = await fetch(`${workerUrl}/test-image.jpg`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'image/webp,image/*',
      },
    });
    
    const contentType = response.headers.get('Content-Type');
    const cacheControl = response.headers.get('Cache-Control');
    const deviceType = response.headers.get('X-Device-Type');
    
    if (response.status >= 200 && response.status < 500) {
      const checks = [];
      if (deviceType) checks.push(`Device: ${deviceType}`);
      if (cacheControl) checks.push(`Cache: ${cacheControl}`);
      
      return {
        success: true,
        message: `Status ${response.status}${checks.length ? ` (${checks.join(', ')})` : ''}`,
      };
    } else {
      return { success: false, message: `Unexpected status ${response.status}` };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testCacheHeaders(workerUrl) {
  try {
    const response = await fetch(`${workerUrl}/test.css`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });
    
    const cacheControl = response.headers.get('Cache-Control');
    const etag = response.headers.get('ETag');
    
    if (cacheControl && etag) {
      return {
        success: true,
        message: `Cache headers present (Cache-Control: ${cacheControl.substring(0, 30)}...)`,
      };
    } else {
      return {
        success: false,
        message: `Missing cache headers (Cache-Control: ${cacheControl || 'missing'}, ETag: ${etag || 'missing'})`,
      };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testGeographicRouting(workerUrl) {
  try {
    const response = await fetch(workerUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'CF-IPCountry': 'US', // Simulate US request
      },
    });
    
    const geoRegion = response.headers.get('X-Geo-Region');
    const geoOrigin = response.headers.get('X-Geo-Origin');
    
    if (geoRegion || geoOrigin) {
      return {
        success: true,
        message: `Geo routing active (Region: ${geoRegion || 'N/A'}, Origin: ${geoOrigin ? 'present' : 'N/A'})`,
      };
    } else {
      // Geo routing might be disabled, which is OK
      return {
        success: true,
        message: 'Geo routing headers not present (may be disabled)',
      };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testRateLimiting(workerUrl) {
  try {
    // Make a request and check for rate limit headers
    const response = await fetch(workerUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'SmokeTest/1.0',
      },
    });
    
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateLimitLimit = response.headers.get('X-RateLimit-Limit');
    
    if (response.status === 429) {
      return {
        success: false,
        message: 'Rate limited (429) - this may indicate an issue',
      };
    }
    
    // Rate limit headers are optional, so their absence is OK
    if (rateLimitRemaining || rateLimitLimit) {
      return {
        success: true,
        message: `Rate limiting active (Remaining: ${rateLimitRemaining || 'N/A'}, Limit: ${rateLimitLimit || 'N/A'})`,
      };
    } else {
      return {
        success: true,
        message: 'Rate limiting headers not present (may be disabled)',
      };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const env = args[0] || 'staging';
  
  if (!['staging', 'production'].includes(env)) {
    logError(`Invalid environment: ${env}. Must be 'staging' or 'production'`);
    process.exit(1);
  }
  
  log(`\n🧪 Running smoke tests for ${env}...\n`, 'blue');
  
  let workerUrl;
  try {
    workerUrl = getWorkerUrl(env);
    log(`Worker URL: ${workerUrl}\n`, 'blue');
  } catch (error) {
    logError(`Failed to get worker URL: ${error.message}`);
    log('Note: Set CLOUDFLARE_ACCOUNT_SUBDOMAIN environment variable if using custom subdomain', 'yellow');
    process.exit(1);
  }
  
  const tests = [
    { name: 'Health Check', fn: () => testHealthCheck(workerUrl) },
    { name: 'Image Request', fn: () => testImageRequest(workerUrl) },
    { name: 'Cache Headers', fn: () => testCacheHeaders(workerUrl) },
    { name: 'Geographic Routing', fn: () => testGeographicRouting(workerUrl) },
    { name: 'Rate Limiting', fn: () => testRateLimiting(workerUrl) },
  ];
  
  const results = [];
  for (const test of tests) {
    const passed = await smokeTest(test.name, test.fn);
    results.push({ name: test.name, passed });
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  log(`\n📊 Results: ${passedCount}/${totalCount} tests passed\n`, 'blue');
  
  if (passedCount === totalCount) {
    logSuccess('All smoke tests passed!');
    process.exit(0);
  } else {
    logError(`${totalCount - passedCount} smoke test(s) failed`);
    process.exit(1);
  }
}

main().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

