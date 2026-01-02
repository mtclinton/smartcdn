# SmartCDN

A Cloudflare Workers-based CDN with advanced features including A/B testing, image optimization, device detection, and intelligent caching.

## Project Structure

```
smartcdn/
├── src/
│   ├── config/
│   │   ├── ab-tests.js          # A/B test configuration
│   │   ├── cache-bypass.js     # Cache bypass rules
│   │   ├── feature-flags.js    # Feature flags configuration
│   │   ├── geo-routing.js      # Geographic routing configuration
│   │   ├── rate-limiting.js    # Rate limiting configuration
│   │   ├── region-content.js   # Region-specific content configuration
│   │   └── stale-while-revalidate.js  # SWR configuration
│   ├── utils/
│   │   ├── ab-testing.js       # A/B testing logic
│   │   ├── cache.js            # Cache TTL, headers, and cache key generation
│   │   ├── cache-bypass.js     # Cache bypass logic
│   │   ├── cache-tracking.js   # Cache hit/miss tracking
│   │   ├── device.js           # Device detection
│   │   ├── env-config.js       # Environment configuration
│   │   ├── feature-flags.js    # Feature flags management
│   │   ├── geo-routing.js      # Geographic routing utilities
│   │   ├── headers.js          # Response header building
│   │   ├── image.js             # Image format negotiation and resizing
│   │   ├── logging.js          # Structured logging
│   │   ├── rate-limiting.js    # Rate limiting utilities
│   │   ├── region-content.js   # Region-specific content utilities
│   │   ├── request.js           # Request parsing utilities
│   │   ├── routing.js           # Routing strategies for A/B tests
│   │   ├── stale-while-revalidate.js  # SWR utilities
│   │   ├── timing.js            # Performance timing
│   │   └── variants.js         # Variant assignment and cookie management
│   ├── handlers/
│   │   └── index.js           # HTTP method handlers
│   └── index.js                # Main worker entry point
├── test/
│   ├── setup.js                # Test setup and mocks
│   ├── cache-ttl.test.js      # Cache TTL tests
│   ├── cache-key.test.js      # Cache key generation tests
│   ├── ab-variant.test.js     # A/B variant assignment tests
│   └── device-detection.test.js  # Device detection tests
├── wrangler.toml              # Cloudflare Workers configuration
├── package.json               # Dependencies and scripts
├── vitest.config.js           # Vitest configuration
└── README.md                  # This file
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
- Stale-while-revalidate pattern

### Device Detection
- Automatic device type detection (Mobile, Tablet, Desktop)
- Device-specific image optimization parameters
- DPR (Device Pixel Ratio) hints

### Geographic Routing
- Route users to nearest origin server based on country
- Configurable region-to-origin mappings
- Region-specific content serving

### Rate Limiting
- Per-IP rate limiting (configurable limits)
- Cache API storage for persistence
- 429 Too Many Requests responses

### Feature Flags
- Runtime feature toggling without redeployment
- KV store support for dynamic updates
- Environment-specific configurations

## Development

### Prerequisites
- Node.js 24+
- npm or yarn
- Cloudflare account with Workers access

### Installation

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Local Development

```bash
# Run locally
wrangler dev

# Deploy to development
wrangler deploy --env development

# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production
```

## Testing

The project uses [Vitest](https://vitest.dev/) for unit testing. Tests are located in the `test/` directory.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Coverage

Tests cover the following core functions:
- **Cache TTL Calculation**: Tests for different file types and paths
- **A/B Variant Assignment**: Tests for consistent variant assignment
- **Device Detection**: Tests for mobile, tablet, and desktop detection
- **Cache Key Generation**: Tests for query parameter filtering and normalization

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

### Environment Configuration

Environment-specific settings are configured in `wrangler.toml`:
- Origin URLs
- Cache TTLs
- Feature flags
- Rate limiting settings
- Stale-while-revalidate settings

### Feature Flags

Feature flags can be configured in `src/config/feature-flags.js` or updated via KV store for runtime changes without redeployment.

## Module Overview

- **config/**: Configuration files for all features
- **utils/**: Utility functions for core functionality
- **handlers/**: HTTP method handlers
- **index.js**: Main worker orchestrator
- **test/**: Unit tests for core functions
