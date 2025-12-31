# SmartCDN

A Cloudflare Workers-based CDN with advanced features including A/B testing, image optimization, device detection, and intelligent caching.

## Project Structure

```
smartcdn/
├── src/
│   ├── config/
│   │   └── ab-tests.js          # A/B test configuration
│   ├── utils/
│   │   ├── ab-testing.js        # A/B testing logic (validation, path matching, variant assignment)
│   │   ├── routing.js           # Routing strategies for A/B tests
│   │   ├── cache.js             # Cache TTL, headers, and cache key generation
│   │   ├── device.js             # Device detection and optimization parameters
│   │   ├── image.js              # Image format negotiation and resizing
│   │   ├── request.js            # Request parsing utilities
│   │   ├── variants.js           # Variant assignment and cookie management
│   │   └── headers.js            # Response header building utilities
│   ├── handlers/
│   │   └── index.js             # HTTP method handlers (GET, POST, PUT, etc.)
│   └── index.js                  # Main worker entry point
├── wrangler.toml                 # Cloudflare Workers configuration
└── README.md                     # This file
```

## Features

### A/B Testing
- Multiple concurrent tests with priority-based selection
- Flexible routing strategies (path-suffix, different-origin, query-param, subdomain)
- Consistent variant assignment based on IP or cookies
- Test-specific cookies with 30-day expiration

### Image Optimization
- Content negotiation (WebP, AVIF support)
- Cloudflare Image Resizing integration
- Query parameter support (`?width=800&quality=80`)
- Automatic mobile reduction (50% for mobile devices)

### Caching
- Content-type based TTL (images: 30 days, CSS/JS: 7 days, HTML: 1 hour)
- Custom cache keys with tracking parameter filtering
- ETag and Last-Modified support
- Conditional request handling (304 Not Modified)

### Device Detection
- Automatic device type detection (Mobile, Tablet, Desktop)
- Device-specific image optimization parameters
- DPR (Device Pixel Ratio) hints

## Configuration

### A/B Tests

Edit `src/config/ab-tests.js` to add or modify A/B tests:

```javascript
{
  id: 'my-test',
  name: 'My Test',
  enabled: true,
  priority: 10,
  trafficAllocation: { A: 50, B: 50 },
  pathMatching: {
    include: ['/path/*'],
    exclude: [],
    matchType: 'wildcard',
  },
  variants: {
    A: { strategy: 'path-suffix', config: { suffix: '' } },
    B: { strategy: 'path-suffix', config: { suffix: '-v2' } },
  },
}
```

## Development

```bash
# Install dependencies (if any)
npm install

# Run locally
wrangler dev

# Deploy
wrangler publish
```

## Module Overview

- **config/ab-tests.js**: A/B test configuration array and global settings
- **utils/ab-testing.js**: Test validation, path matching, variant assignment
- **utils/routing.js**: URL transformation strategies for A/B tests
- **utils/cache.js**: Cache TTL calculation, cache headers, cache key generation
- **utils/device.js**: User-Agent parsing and device detection
- **utils/image.js**: Image format negotiation and Cloudflare Image Resizing
- **utils/request.js**: Request parsing (IP, cookies, content-type)
- **utils/variants.js**: Variant assignment and cookie management
- **utils/headers.js**: Response header building utilities
- **handlers/index.js**: HTTP method handlers
- **index.js**: Main worker orchestrator

