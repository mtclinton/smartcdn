# SmartCDN Setup Guide

This guide will help you set up SmartCDN for your own use.

## Prerequisites

- Node.js 24+ installed
- npm or yarn package manager
- Cloudflare account with Workers access
- Origin server or website to proxy

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd smartcdn
npm install
```

### 2. Configure Wrangler

Copy the example configuration:

```bash
cp wrangler.toml.example wrangler.toml
```

### 3. Update Configuration

Edit `wrangler.toml` and update the following:

#### Origin URLs

Replace the placeholder URLs with your actual origin server:

```toml
[env.staging.vars]
GEO_ORIGIN_DEFAULT = "https://your-actual-origin.com"
GEO_ORIGIN_NA = "https://your-na-origin.com"  # Optional: for geo-routing
GEO_ORIGIN_EU = "https://your-eu-origin.com"  # Optional: for geo-routing
GEO_ORIGIN_ASIA = "https://your-asia-origin.com"  # Optional: for geo-routing
```

**Note:** If you only have one origin server, set all `GEO_ORIGIN_*` variables to the same URL.

#### Worker Name (Optional)

Change the worker name to match your preference:

```toml
[env.staging]
name = "your-cdn-name"  # This will be your-worker-name.YOUR_SUBDOMAIN.workers.dev
```

#### Service Binding (Optional but Recommended)

If your origin is also a Cloudflare Worker, configure service binding for better performance:

```toml
[[env.staging.services]]
binding = "ORIGIN"
service = "your-origin-worker-name"  # Name of your origin Worker
```

**Requirements for Service Binding:**
- Both workers must be in the same Cloudflare account
- Origin worker must be deployed first
- This enables direct Worker-to-Worker communication (faster and more reliable)

### 4. Login to Cloudflare

```bash
npx wrangler login
```

This will open a browser window to authenticate with Cloudflare.

### 5. Configure A/B Tests (Optional)

Edit `src/config/ab-tests.js` to configure your A/B tests. See the file for examples.

### 6. Build

```bash
npm run build
```

### 7. Deploy

```bash
# Deploy to staging
npm run deploy:staging

# Or deploy to production
npm run deploy:production
```

### 8. Test

After deployment, test your CDN:

```bash
# Replace with your actual worker URL
curl -I https://your-worker-name.YOUR_SUBDOMAIN.workers.dev/
```

You should see SmartCDN headers like `X-Cache-Status`, `X-Device-Type`, etc.

## Configuration Options

### Environment Variables

All configuration is done via environment variables in `wrangler.toml`:

#### Cache TTLs

Control how long different content types are cached:

```toml
CACHE_TTL_IMAGES = "2592000"  # 30 days (images)
CACHE_TTL_CSS_JS = "604800"   # 7 days (static assets)
CACHE_TTL_HTML = "3600"       # 1 hour (HTML pages)
CACHE_TTL_API = "300"         # 5 minutes (API responses)
CACHE_TTL_DEFAULT = "86400"   # 1 day (default)
```

#### Feature Flags

Enable or disable features:

```toml
FEATURE_AB_TESTING = "true"           # A/B testing framework
FEATURE_GEO_ROUTING = "true"          # Geographic routing
FEATURE_REGION_CONTENT = "true"       # Region-specific content
FEATURE_RATE_LIMITING = "true"        # Rate limiting
FEATURE_STALE_WHILE_REVALIDATE = "true"  # Stale-while-revalidate caching
FEATURE_CACHE_BYPASS = "true"         # Cache bypass rules
```

#### Rate Limiting

Configure rate limiting:

```toml
RATE_LIMIT_MAX_REQUESTS = "200"       # Requests per window
RATE_LIMIT_WINDOW_SECONDS = "60"      # Time window in seconds
```

#### Stale-While-Revalidate

Configure SWR caching:

```toml
SWR_MAX_AGE = "1800"                  # Maximum cache age
SWR_STALE_WHILE_REVALIDATE = "7200"   # How long to serve stale content
```

## Origin Server Requirements

Your origin server should:

1. **Return proper HTTP status codes** (200, 304, 404, etc.)
2. **Support conditional requests** (ETag and/or Last-Modified headers recommended)
3. **Handle HEAD requests** (SmartCDN uses HEAD for cache validation)
4. **Be accessible from Cloudflare's edge locations**

### Single Origin Setup

If you have one origin server:

```toml
GEO_ORIGIN_NA = "https://your-origin.com"
GEO_ORIGIN_EU = "https://your-origin.com"
GEO_ORIGIN_ASIA = "https://your-origin.com"
GEO_ORIGIN_DEFAULT = "https://your-origin.com"
```

### Multi-Region Setup

If you have origin servers in different regions:

```toml
GEO_ORIGIN_NA = "https://us-origin.example.com"
GEO_ORIGIN_EU = "https://eu-origin.example.com"
GEO_ORIGIN_ASIA = "https://asia-origin.example.com"
GEO_ORIGIN_DEFAULT = "https://global-origin.example.com"
```

## Custom Domain (Optional)

After deployment, you can add a custom domain:

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your SmartCDN worker
3. Go to Settings → Triggers
4. Add a custom domain
5. Update your DNS to point to Cloudflare

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Monitoring

### Analytics Endpoint

SmartCDN provides built-in analytics:

```bash
# Summary
curl https://your-worker-name.YOUR_SUBDOMAIN.workers.dev/__analytics

# Detailed cache statistics
curl https://your-worker-name.YOUR_SUBDOMAIN.workers.dev/__analytics/cache

# Log statistics
curl https://your-worker-name.YOUR_SUBDOMAIN.workers.dev/__analytics/logs
```

### Cloudflare Dashboard

Monitor your worker in the Cloudflare Dashboard:
- Metrics (requests, errors, CPU time)
- Real-time logs
- Performance analytics

### Wrangler Tail

View live logs:

```bash
npx wrangler tail your-worker-name
```

## Troubleshooting

### Worker returns 502/503 errors

- Check that your origin server is accessible
- Verify origin URLs in `wrangler.toml` are correct
- Check Cloudflare Workers logs for errors

### Service binding not working

- Ensure both workers are in the same Cloudflare account
- Verify the origin worker name matches exactly
- Deploy the origin worker first, then SmartCDN

### Cache not working

- Check that `FEATURE_CACHE_BYPASS` is not forcing bypasses
- Verify Cache API is available (free tier has limitations)
- Check response headers from origin (should be cacheable)

### Rate limiting too aggressive

- Adjust `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_SECONDS`
- Check if your origin is rate limiting requests

## Next Steps

- Configure A/B tests in `src/config/ab-tests.js`
- Set up geographic routing if you have multiple origins
- Customize cache bypass rules in `src/config/cache-bypass.js`
- Enable feature flags as needed
- Read the [USAGE.md](USAGE.md) guide for integration examples

## Support

For issues and questions:
- Check the [README.md](README.md) for feature documentation
- Review [USAGE.md](USAGE.md) for integration examples
- Open an issue on GitHub

