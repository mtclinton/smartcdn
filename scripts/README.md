# Deployment Scripts

This directory contains deployment automation scripts for the SmartCDN project.

## Scripts

### `deploy.js`

Main deployment script that orchestrates the full deployment process:

1. **Runs Tests**: Executes unit tests to ensure code quality
2. **Builds Worker**: Validates worker code (no build step required for JS)
3. **Deploys**: Deploys to Cloudflare Workers using Wrangler
4. **Smoke Tests**: Runs health checks against the deployed worker
5. **Rollback**: Automatically rolls back if smoke tests fail

**Usage:**
```bash
# Deploy to staging
node scripts/deploy.js staging
npm run deploy:staging

# Deploy to production
node scripts/deploy.js production
npm run deploy:production
```

### `smoke-tests.js`

Runs health checks against a deployed worker to verify it's functioning correctly.

**Tests performed:**
- Health check (basic GET request)
- Image request handling
- Cache headers
- Geographic routing
- Rate limiting

**Usage:**
```bash
# Test staging
node scripts/smoke-tests.js staging
npm run smoke:staging

# Test production
node scripts/smoke-tests.js production
npm run smoke:production
```

**Environment Variables:**
- `CLOUDFLARE_ACCOUNT_SUBDOMAIN`: Your Cloudflare account subdomain (default: 'your-subdomain')
  - Used to construct worker URLs: `https://<worker-name>.<subdomain>.workers.dev`

### `rollback.js`

Rolls back a deployment to the previous version.

**Usage:**
```bash
# Rollback staging
node scripts/rollback.js staging
npm run rollback:staging

# Rollback production
node scripts/rollback.js production
npm run rollback:production

# Rollback to specific deployment ID
node scripts/rollback.js staging <deployment-id>
```

## Deployment Information

Deployment information is stored in `.deployment-info.json` at the project root. This file tracks:
- Current deployment ID
- Previous deployment ID (for rollback)
- Deployment timestamp
- Rollback status

**Note:** This file is git-ignored and should not be committed.

## Workflow

### Standard Deployment

```bash
# 1. Deploy to staging
npm run deploy:staging

# 2. Verify staging works correctly
npm run smoke:staging

# 3. If staging is good, deploy to production
npm run deploy:production

# 4. Verify production
npm run smoke:production
```

### Emergency Rollback

```bash
# If production deployment fails or causes issues
npm run rollback:production

# Verify rollback
npm run smoke:production
```

## Requirements

- Node.js 24+
- Wrangler CLI installed globally or via npx
- Cloudflare account with Workers access
- Properly configured `wrangler.toml` with environment settings

## Error Handling

The deployment script includes comprehensive error handling:

- **Test failures**: Deployment aborts before deploying
- **Deployment failures**: Script exits with error code
- **Smoke test failures**: Automatic rollback to previous deployment
- **Rollback failures**: Manual intervention required (instructions provided)

## Customization

### Custom Worker URLs

If your workers use custom domains instead of `*.workers.dev`, update `smoke-tests.js`:

```javascript
function getWorkerUrl(env) {
  // Return your custom domain URL
  const customDomains = {
    staging: 'https://staging-cdn.example.com',
    production: 'https://cdn.example.com',
  };
  return customDomains[env];
}
```

### Additional Smoke Tests

Add more smoke tests in `smoke-tests.js`:

```javascript
async function testCustomFeature(workerUrl) {
  // Your custom test
}

// Add to tests array
const tests = [
  // ... existing tests
  { name: 'Custom Feature', fn: () => testCustomFeature(workerUrl) },
];
```

