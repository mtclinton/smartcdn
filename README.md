# SmartCDN

A Cloudflare Workers-based CDN with advanced features including A/B testing, image optimization, device detection, and intelligent caching.

## Features

- **A/B Testing** - Route users to different variants with cookie persistence
- **Image Optimization** - Automatic WebP/AVIF conversion and mobile resizing
- **Intelligent Caching** - Content-type based TTLs with stale-while-revalidate
- **Device Detection** - Optimize for mobile/tablet/desktop
- **Geographic Routing** - Route to nearest origin server
- **Rate Limiting** - Protect against abuse
- **Real-time Analytics** - Built-in API endpoints for monitoring

## Quick Start

```bash
# Install dependencies
npm install

# Configure
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml with your origin URLs

# Login to Cloudflare
npx wrangler login

# Deploy
npm run deploy:staging
```

See [SETUP.md](SETUP.md) for detailed setup instructions.

## Documentation

- [Setup Guide](SETUP.md) - Complete setup instructions
- [Usage Guide](USAGE.md) - Feature usage and integrations
- [Analytics Guide](ANALYTICS.md) - Monitoring and statistics
- [Deployment Guide](DEPLOYMENT.md) - Advanced deployment options
- [Scripts Documentation](scripts/README.md) - Deployment automation

## Development

```bash
# Run tests
npm test

# Build
npm run build

# Local development
npx wrangler dev
```

## Configuration

All configuration is done via environment variables in `wrangler.toml`:
- Origin URLs
- Cache TTLs
- Feature flags
- Rate limiting thresholds
- Stale-while-revalidate settings

See `wrangler.toml.example` for all available options.

## Service Bindings

For Worker-to-Worker communication (recommended if your origin is also a Cloudflare Worker):

```toml
[[env.staging.services]]
binding = "ORIGIN"
service = "your-origin-worker-name"
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
