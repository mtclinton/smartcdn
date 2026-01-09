# SmartCDN Deployment Guide

## Overview

SmartCDN is a Cloudflare Workers-based CDN with advanced features including A/B testing, image optimization, device detection, geographic routing, and intelligent caching. This guide covers deployment to Cloudflare and provides recommendations for usage and testing.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Cloudflare Setup](#cloudflare-setup)
3. [Local Development](#local-development)
4. [Environment Configuration](#environment-configuration)
5. [Deployment Process](#deployment-process)
6. [Usage Recommendations](#usage-recommendations)
7. [Demo/Test Setup](#demo-test-setup)
8. [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)

## Prerequisites

### Required Software

- **Node.js 24+** - SmartCDN requires Node.js 24 or higher
- **Wrangler CLI** - Cloudflare's command-line tool for Workers
- **Git** - For version control

### Installation

```bash
# Install Node.js 24+ (using nvm recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 24
nvm use 24

# Install Wrangler CLI globally
npm install -g wrangler

# Clone and setup SmartCDN
git clone <your-repo-url>
cd smartcdn
npm install
```

### Cloudflare Account Setup

1. **Sign up for Cloudflare** (if you don't have an account)
   - Visit [cloudflare.com](https://cloudflare.com)
   - Create a free account or use existing paid account

2. **Install Wrangler CLI** (already covered above)

3. **Authenticate Wrangler**
   ```bash
   wrangler auth login
   ```

4. **Create a Cloudflare Workers account**
   - Workers are available on all Cloudflare plans (including free)
   - No additional setup required beyond authentication

## Cloudflare Setup

### 1. Create API Token (Optional but Recommended)

For automated deployments, create an API token:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template
4. Set permissions:
   - Account: Cloudflare Workers:Edit
   - Zone: DNS:Edit (if using custom domains)
5. Set resources to "All accounts" and "All zones"
6. Save the token securely

### 2. Configure Worker Domains

SmartCDN can work with:
- **Default workers.dev domain**: `https://smartcdn.your-subdomain.workers.dev`
- **Custom domain**: Point your domain to Cloudflare and configure routes

For custom domains:
1. Add your domain to Cloudflare
2. Configure DNS (typically CNAME to workers.dev)
3. Update `wrangler.toml` routes section

## Local Development

### Start Development Server

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start local development server
wrangler dev

# Or run with specific environment
wrangler dev --env development
```

### Test Locally

```bash
# Run unit tests
npm run test:unit

# Run integration tests (may have limitations)
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Configure Your Origin

Before deployment, configure your origin server URLs in `wrangler.toml`:

```toml
[env.staging.vars]
GEO_ORIGIN_NA = "https://staging-us.your-origin.com"
GEO_ORIGIN_EU = "https://staging-eu.your-origin.com"
GEO_ORIGIN_ASIA = "https://staging-asia.your-origin.com"
GEO_ORIGIN_DEFAULT = "https://staging.your-origin.com"
```

## Environment Configuration

SmartCDN supports multiple environments with different configurations:

### Development
- Shorter cache TTLs
- Most features enabled for testing
- Higher rate limits
- Detailed logging

### Staging
- Production-like settings
- Moderate cache TTLs
- All features enabled
- Realistic rate limits

### Production
- Optimized cache TTLs
- Strict rate limits
- All features enabled
- Minimal logging

### Configuration Variables

Update these in `wrangler.toml` for each environment:

```toml
[env.production.vars]
# Environment
ENVIRONMENT = "production"

# Origin URLs
GEO_ORIGIN_NA = "https://us.your-cdn.com"
GEO_ORIGIN_EU = "https://eu.your-cdn.com"
GEO_ORIGIN_ASIA = "https://asia.your-cdn.com"
GEO_ORIGIN_DEFAULT = "https://global.your-cdn.com"

# Cache TTLs (in seconds)
CACHE_TTL_IMAGES = "2592000"  # 30 days
CACHE_TTL_CSS_JS = "604800"   # 7 days
CACHE_TTL_HTML = "3600"       # 1 hour
CACHE_TTL_API = "300"         # 5 minutes

# Feature Flags
FEATURE_AB_TESTING = "true"
FEATURE_GEO_ROUTING = "true"
FEATURE_REGION_CONTENT = "true"
FEATURE_RATE_LIMITING = "true"
FEATURE_STALE_WHILE_REVALIDATE = "true"
FEATURE_CACHE_BYPASS = "true"

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS = "100"
RATE_LIMIT_WINDOW_SECONDS = "60"
```

## Deployment Process

### Automated Deployment (Recommended)

SmartCDN includes automated deployment scripts with testing and rollback:

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production (after staging verification)
npm run deploy:production
```

### Manual Deployment

If you prefer manual deployment:

```bash
# Test first
npm run test:unit

# Deploy to staging
wrangler deploy --env staging

# Run smoke tests
npm run smoke:staging

# If tests pass, deploy to production
wrangler deploy --env production

# Run production smoke tests
npm run smoke:production
```

## 🚨 Known Wrangler ES Module Issue

**Important**: SmartCDN uses ES modules which have known compatibility issues with Wrangler's build process. The automated scripts will guide you through the manual deployment process.

## ✅ Working Deployment Solution

### Step 1: Build the Project
```bash
npm run build
```
This creates deployment-ready files in the `dist/` directory.

### Step 2: Manual Deployment
Since Wrangler has ES module compatibility issues, use this manual approach:

1. **Start development server first** (this validates the code):
   ```bash
   wrangler dev --env staging
   ```
   If this works, press `Ctrl+C` to stop it.

2. **Deploy manually**:
   ```bash
   # Use the built files in dist/
   cd dist
   wrangler deploy --env staging
   ```

### Step 3: Verify Deployment
```bash
npm run smoke:staging
```

## 📋 Complete Manual Deployment Process

```bash
# 1. Build the project
npm run build

# 2. Test with dev server (optional validation)
wrangler dev --env staging
# Press Ctrl+C when you see it working

# 3. Deploy from dist directory
cd dist
wrangler deploy --env staging

# 4. Return to project root and run smoke tests
cd ..
npm run smoke:staging
```

## 🔧 Why This Works

- **ES Module Issue**: Wrangler's build process can't handle complex ES module imports
- **Build Step**: Pre-builds the project to resolve import paths
- **Manual Deploy**: Bypasses Wrangler's problematic build process
- **Validation**: Development server confirms code works before deployment

## 🐛 Troubleshooting

### If `wrangler dev` fails:
- The ES module issue affects both dev and deploy
- Check that all imports are correct
- Verify Node.js version (24+ required)

### If deployment succeeds but smoke tests fail:
- Check your origin URLs in `wrangler.toml`
- Verify network connectivity to origins
- Check Cloudflare account permissions

### For production deployment:
```bash
npm run build
cd dist
wrangler deploy --env production
cd ..
npm run smoke:production
```

This manual process works reliably and bypasses Wrangler's ES module limitations.

### Rollback (if needed)

```bash
# Rollback staging
npm run rollback:staging

# Rollback production
npm run rollback:production
```

## Usage Recommendations

### 1. CDN Integration

#### Basic Usage

Replace your origin URLs with SmartCDN:

```html
<!-- Before -->
<img src="https://your-origin.com/images/hero.jpg" alt="Hero">

<!-- After -->
<img src="https://smartcdn.your-domain.com/images/hero.jpg" alt="Hero">
```

#### WordPress Integration

```php
// functions.php
function smartcdn_url($url) {
    return str_replace('https://your-origin.com', 'https://smartcdn.your-domain.com', $url);
}
add_filter('wp_get_attachment_url', 'smartcdn_url');
add_filter('the_content', function($content) {
    return str_replace('https://your-origin.com', 'https://smartcdn.your-domain.com', $content);
});
```

#### JavaScript/SPA Integration

```javascript
// config.js
const CDN_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://smartcdn.your-domain.com'
  : 'https://your-origin.com';

// Usage
const imageUrl = `${CDN_BASE_URL}/images/${imageName}`;
```

### 2. Feature Configuration

#### A/B Testing Setup

Configure tests in `src/config/ab-tests.js`:

```javascript
export const AB_TESTS = {
  'homepage-design': {
    enabled: true,
    variants: ['control', 'variant-a', 'variant-b'],
    distribution: [50, 25, 25], // percentages
    cookieName: 'ab_homepage',
    cookieMaxAge: 86400 * 7, // 7 days
  }
};
```

#### Geographic Routing

Configure regions in `src/config/geo-routing.js`:

```javascript
export const REGION_MAPPING = {
  'NA': ['US', 'CA', 'MX'],
  'EU': ['GB', 'DE', 'FR', 'IT', 'ES', 'NL'],
  'ASIA': ['JP', 'KR', 'SG', 'AU'],
};
```

#### Image Optimization

SmartCDN automatically optimizes images based on:
- Device type (mobile, tablet, desktop)
- Browser support (WebP, AVIF)
- Screen density (retina displays)

#### Cache Bypass Rules

Configure in `src/config/cache-bypass.js`:

```javascript
export const CACHE_BYPASS_RULES = [
  {
    name: 'session-cookies',
    condition: (request) => request.headers.get('cookie')?.includes('session'),
    reason: 'Session cookie detected',
  },
  {
    name: 'no-cache-header',
    condition: (request) => request.headers.get('cache-control') === 'no-cache',
    reason: 'Cache-Control: no-cache header',
  },
];
```

### 3. Performance Optimization

#### Cache TTL Recommendations

- **Images**: 30 days (2,592,000 seconds)
- **CSS/JS**: 7 days (604,800 seconds)
- **HTML**: 1 hour (3,600 seconds)
- **API responses**: 5 minutes (300 seconds)

#### Stale-While-Revalidate

Enabled by default with:
- Max Age: 1 hour for production
- Stale While Revalidate: 24 hours

### 4. Security Considerations

#### Rate Limiting

SmartCDN includes rate limiting (100 requests/minute per IP in production):
- Protects against abuse
- Prevents origin overload
- Returns 429 status for exceeded limits

#### Cache Bypass

Automatic bypass for:
- Authenticated requests
- Session cookies
- Cache-Control headers
- Bot detection

## Demo/Test Setup

### Quick Demo Setup

1. **Deploy to staging**:
   ```bash
   npm run deploy:staging
   ```

2. **Set up a test origin** (simple static server):
   ```bash
   # Create a test directory
   mkdir test-origin
   cd test-origin

   # Create test files
   echo "<h1>Hello from SmartCDN!</h1>" > index.html
   mkdir images
   curl -o images/test.jpg "https://picsum.photos/800/600"

   # Start a simple HTTP server
   python3 -m http.server 8080
   ```

3. **Update wrangler.toml**:
   ```toml
   [env.staging.vars]
   GEO_ORIGIN_DEFAULT = "http://localhost:8080"
   ```

4. **Test the deployment**:
   ```bash
   # Test basic functionality
   curl -H "CF-IPCountry: US" https://smartcdn-staging.your-subdomain.workers.dev/

   # Test image optimization
   curl -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)" \
        https://smartcdn-staging.your-subdomain.workers.dev/images/test.jpg
   ```

### Comprehensive Test Suite

#### 1. Performance Testing

```bash
# Install load testing tools
npm install -g artillery

# Create test script (load-test.yml)
config:
  target: 'https://smartcdn.your-domain.com'
  phases:
    - duration: 60
      arrivalRate: 10
  defaults:
    headers:
      User-Agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'

scenarios:
  - name: 'Image requests'
    requests:
      - get:
          url: '/images/test.jpg'
      - get:
          url: '/images/test.jpg'  # Cache hit test

# Run load test
artillery run load-test.yml
```

#### 2. Geographic Routing Tests

```bash
# Test different regions
curl -H "CF-IPCountry: US" https://smartcdn.your-domain.com/test
curl -H "CF-IPCountry: GB" https://smartcdn.your-domain.com/test
curl -H "CF-IPCountry: JP" https://smartcdn.your-domain.com/test

# Check response headers for geo info
curl -I -H "CF-IPCountry: US" https://smartcdn.your-domain.com/test
```

#### 3. A/B Testing Tests

```bash
# First request (gets assigned variant)
curl -c cookies.txt https://smartcdn.your-domain.com/

# Subsequent requests should get same variant
curl -b cookies.txt https://smartcdn.your-domain.com/

# Check variant assignment header
curl -I -b cookies.txt https://smartcdn.your-domain.com/
```

#### 4. Image Optimization Tests

```bash
# Mobile device
curl -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)" \
     -I https://smartcdn.your-domain.com/images/test.jpg

# Desktop device
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)" \
     -I https://smartcdn.your-domain.com/images/test.jpg

# Check for WebP support
curl -H "Accept: image/webp,image/*" \
     -I https://smartcdn.your-domain.com/images/test.jpg
```

#### 5. Cache Testing

```bash
# First request (cache miss)
curl -I https://smartcdn.your-domain.com/test.css

# Second request (should be cache hit)
curl -I https://smartcdn.your-domain.com/test.css

# Check cache headers
curl -H "Cache-Control: no-cache" \
     -I https://smartcdn.your-domain.com/test.css
```

### Automated Testing Pipeline

Create a test script for comprehensive validation:

```bash
#!/bin/bash
# test-deployment.sh

ENVIRONMENT=$1
WORKER_URL="https://smartcdn-${ENVIRONMENT}.your-subdomain.workers.dev"

echo "Testing SmartCDN ${ENVIRONMENT} deployment..."

# Health check
if ! curl -f -s "$WORKER_URL" > /dev/null; then
    echo "❌ Health check failed"
    exit 1
fi

# Image optimization test
if ! curl -f -s -H "User-Agent: Mozilla/5.0 (iPhone)" \
    "$WORKER_URL/images/test.jpg" > /dev/null; then
    echo "❌ Image optimization failed"
    exit 1
fi

# Geographic routing test
if ! curl -f -s -H "CF-IPCountry: US" \
    "$WORKER_URL" | grep -q "X-Geo-Region"; then
    echo "❌ Geographic routing failed"
    exit 1
fi

echo "✅ All tests passed"
```

Run automated tests:

```bash
chmod +x test-deployment.sh
./test-deployment.sh staging
./test-deployment.sh production
```

## Monitoring and Troubleshooting

### Monitoring

SmartCDN provides extensive logging and monitoring:

#### Response Headers

Check these headers in responses:
- `X-Cache-Status`: HIT, MISS, or BYPASS
- `X-Response-Time`: Total response time
- `X-Origin-Time`: Origin fetch time
- `X-Geo-Region`: Geographic region
- `X-Device-Type`: Detected device type

#### Cloudflare Analytics

Monitor through Cloudflare Dashboard:
- Request volume
- Response times
- Error rates
- Geographic distribution

### Troubleshooting

#### Common Issues

1. **Deployment Fails**
   ```bash
   # Check wrangler configuration
   wrangler whoami

   # Validate wrangler.toml
   wrangler deploy --dry-run --env staging
   ```

2. **Origin Connection Issues**
   ```bash
   # Test origin directly
   curl -I https://your-origin.com

   # Check origin URLs in wrangler.toml
   grep "GEO_ORIGIN" wrangler.toml
   ```

3. **Image Optimization Not Working**
   ```bash
   # Check if image is served from origin
   curl -I https://smartcdn.your-domain.com/images/test.jpg

   # Verify image format support
   curl -H "Accept: image/webp" \
        -I https://smartcdn.your-domain.com/images/test.jpg
   ```

4. **Cache Issues**
   ```bash
   # Purge cache if needed
   wrangler kv:key delete --binding CACHE --key "your-cache-key"

   # Check cache headers
   curl -I https://smartcdn.your-domain.com/test.css
   ```

#### Rollback Procedures

```bash
# Immediate rollback
npm run rollback:production

# Check rollback status
npm run smoke:production

# Verify with real traffic
curl -I https://smartcdn.your-domain.com/
```

### Performance Tuning

#### Cache Configuration

Adjust TTLs based on your content:

```toml
# For frequently changing content
CACHE_TTL_HTML = "1800"    # 30 minutes

# For static assets
CACHE_TTL_IMAGES = "2592000"  # 30 days

# For API responses
CACHE_TTL_API = "60"       # 1 minute
```

#### Feature Flags

Disable features for troubleshooting:

```toml
[env.debug.vars]
FEATURE_AB_TESTING = "false"
FEATURE_GEO_ROUTING = "false"
FEATURE_IMAGE_OPTIMIZATION = "false"
```

## Support and Resources

- **Cloudflare Workers Documentation**: [developers.cloudflare.com/workers](https://developers.cloudflare.com/workers)
- **Wrangler CLI Reference**: [developers.cloudflare.com/workers/wrangler](https://developers.cloudflare.com/workers/wrangler)
- **SmartCDN Issues**: Check the project's issue tracker

## Next Steps

1. Complete the prerequisites and Cloudflare setup
2. Configure your origin URLs in `wrangler.toml`
3. Deploy to staging and run tests
4. Verify functionality with your demo setup
5. Deploy to production
6. Monitor performance and adjust configuration as needed

SmartCDN is designed to be drop-in replacement for traditional CDNs with enhanced features. Start with basic functionality and gradually enable advanced features as needed.
