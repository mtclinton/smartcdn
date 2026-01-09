# SmartCDN Usage Guide

SmartCDN is a feature-rich Cloudflare Workers-based CDN that enhances your website's performance and user experience. This guide covers practical usage scenarios and integration examples.

## Quick Start

### Basic Integration

Replace your origin URLs with SmartCDN:

```html
<!-- Before -->
<img src="https://your-site.com/images/photo.jpg" alt="Photo">
<link rel="stylesheet" href="https://your-site.com/css/styles.css">

<!-- After -->
<img src="https://smartcdn.your-site.com/images/photo.jpg" alt="Photo">
<link rel="stylesheet" href="https://smartcdn.your-site.com/css/styles.css">
```

### WordPress Integration

Add this to your `functions.php`:

```php
function smartcdn_rewrite_urls($url) {
    $origin = 'https://your-site.com';
    $cdn = 'https://smartcdn.your-site.com';
    return str_replace($origin, $cdn, $url);
}

// Rewrite attachment URLs
add_filter('wp_get_attachment_url', 'smartcdn_rewrite_urls');

// Rewrite content URLs
add_filter('the_content', function($content) {
    return smartcdn_rewrite_urls($content);
});

// Rewrite stylesheet and script URLs
add_filter('style_loader_src', 'smartcdn_rewrite_urls');
add_filter('script_loader_src', 'smartcdn_rewrite_urls');
```

### JavaScript/SPA Integration

```javascript
// config.js
const config = {
  development: {
    cdnBaseUrl: 'https://your-site.com'
  },
  production: {
    cdnBaseUrl: 'https://smartcdn.your-site.com'
  }
};

const env = process.env.NODE_ENV || 'development';
export const CDN_BASE_URL = config[env].cdnBaseUrl;

// Usage in components
import { CDN_BASE_URL } from './config';

const imageUrl = `${CDN_BASE_URL}/images/${imageName}.jpg`;
const cssUrl = `${CDN_BASE_URL}/css/styles.css`;
```

## Feature Usage

### Image Optimization

SmartCDN automatically optimizes images based on device and browser capabilities:

```html
<!-- Basic image - automatically optimized -->
<img src="https://smartcdn.your-site.com/images/photo.jpg" alt="Photo">

<!-- Responsive images with SmartCDN -->
<picture>
  <source srcset="https://smartcdn.your-site.com/images/photo.avif" type="image/avif">
  <source srcset="https://smartcdn.your-site.com/images/photo.webp" type="image/webp">
  <img src="https://smartcdn.your-site.com/images/photo.jpg" alt="Photo">
</picture>
```

**Automatic Optimizations:**
- Format conversion (WebP, AVIF)
- Responsive sizing for mobile/tablet
- Quality optimization
- Lazy loading support

### Geographic Routing

SmartCDN routes users to the nearest geographic region:

```javascript
// Check which region is serving your content
fetch('https://smartcdn.your-site.com/api/status')
  .then(response => {
    const region = response.headers.get('X-Geo-Region');
    const origin = response.headers.get('X-Geo-Origin');
    console.log(`Served from ${region} region: ${origin}`);
  });
```

**Region Mapping:**
- **NA**: North America (US, CA, MX)
- **EU**: Europe (GB, DE, FR, IT, ES, NL)
- **ASIA**: Asia Pacific (JP, KR, SG, AU)

### A/B Testing

Implement A/B tests for content optimization:

```javascript
// Example: Test different button colors
const variants = {
  'control': { buttonClass: 'btn-primary', text: 'Sign Up' },
  'variant-a': { buttonClass: 'btn-success', text: 'Get Started' },
  'variant-b': { buttonClass: 'btn-warning', text: 'Join Now' }
};

// SmartCDN handles variant assignment automatically
// Check the response header for assigned variant
fetch('https://smartcdn.your-site.com/')
  .then(response => {
    const variant = response.headers.get('X-AB-Variant-homepage-test');
    const config = variants[variant] || variants.control;
    // Apply variant configuration
  });
```

### Cache Management

SmartCDN provides intelligent caching with different strategies:

```javascript
// Check cache status
fetch('https://smartcdn.your-site.com/css/styles.css')
  .then(response => {
    const cacheStatus = response.headers.get('X-Cache-Status');
    const responseTime = response.headers.get('X-Response-Time');

    console.log(`Cache: ${cacheStatus}, Response Time: ${responseTime}ms`);
  });

// Force cache bypass for dynamic content
fetch('https://smartcdn.your-site.com/api/data', {
  headers: {
    'Cache-Control': 'no-cache'
  }
});
```

### Performance Monitoring

Monitor SmartCDN performance through response headers:

```javascript
// Create a performance monitor
class SmartCDNMonitor {
  static monitorRequest(url) {
    const startTime = performance.now();

    return fetch(url).then(response => {
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      // Check SmartCDN headers
      const cacheStatus = response.headers.get('X-Cache-Status');
      const originTime = response.headers.get('X-Origin-Time');
      const geoRegion = response.headers.get('X-Geo-Region');
      const deviceType = response.headers.get('X-Device-Type');

      return {
        url,
        responseTime,
        cacheStatus,
        originTime,
        geoRegion,
        deviceType,
        status: response.status
      };
    });
  }
}

// Monitor page assets
Promise.all([
  SmartCDNMonitor.monitorRequest('https://smartcdn.your-site.com/css/styles.css'),
  SmartCDNMonitor.monitorRequest('https://smartcdn.your-site.com/js/app.js'),
  SmartCDNMonitor.monitorRequest('https://smartcdn.your-site.com/images/hero.jpg')
]).then(results => {
  console.table(results);
});
```

## Advanced Usage

### E-commerce Integration

For e-commerce sites, SmartCDN optimizes product images and handles user-specific content:

```javascript
// Product image optimization
const productImageUrl = (productId, size = 'medium') => {
  return `https://smartcdn.your-site.com/products/${productId}/${size}.jpg`;
};

// Usage in React/Vue component
<img
  src={productImageUrl(product.id, 'large')}
  srcset={`
    ${productImageUrl(product.id, 'small')} 400w,
    ${productImageUrl(product.id, 'medium')} 800w,
    ${productImageUrl(product.id, 'large')} 1200w
  `}
  sizes="(max-width: 768px) 400px, 800px"
  alt={product.name}
/>
```

### API Caching

SmartCDN can cache API responses for improved performance:

```javascript
// Cache API responses for 5 minutes
const apiUrl = 'https://smartcdn.your-site.com/api/products';

// SmartCDN will cache this response
fetch(apiUrl)
  .then(response => response.json())
  .then(products => {
    // Products are served from cache if available
    displayProducts(products);
  });

// For dynamic content that shouldn't be cached
fetch('https://smartcdn.your-site.com/api/user/profile', {
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Cache-Control': 'no-cache' // Bypass cache for authenticated requests
  }
});
```

### Progressive Web App (PWA) Integration

SmartCDN works seamlessly with PWAs:

```javascript
// service-worker.js
const CACHE_NAME = 'smartcdn-v1';
const CDN_BASE = 'https://smartcdn.your-site.com';

self.addEventListener('fetch', event => {
  // Only cache CDN requests
  if (event.request.url.startsWith(CDN_BASE)) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // Return cached version or fetch from network
          return response || fetch(event.request);
        })
    );
  }
});
```

## Configuration Examples

### Basic Configuration

For simple websites, minimal configuration is needed:

```toml
# wrangler.toml
[env.production.vars]
ENVIRONMENT = "production"
GEO_ORIGIN_DEFAULT = "https://your-site.com"
FEATURE_AB_TESTING = "false"
FEATURE_GEO_ROUTING = "true"
FEATURE_IMAGE_OPTIMIZATION = "true"
```

### Advanced Configuration

For complex applications with multiple features:

```toml
[env.production.vars]
ENVIRONMENT = "production"

# Geographic routing
GEO_ORIGIN_NA = "https://us.your-site.com"
GEO_ORIGIN_EU = "https://eu.your-site.com"
GEO_ORIGIN_ASIA = "https://asia.your-site.com"
GEO_ORIGIN_DEFAULT = "https://global.your-site.com"

# Cache TTLs
CACHE_TTL_IMAGES = "2592000"  # 30 days
CACHE_TTL_CSS_JS = "604800"   # 7 days
CACHE_TTL_HTML = "3600"       # 1 hour
CACHE_TTL_API = "300"         # 5 minutes

# Features
FEATURE_AB_TESTING = "true"
FEATURE_GEO_ROUTING = "true"
FEATURE_REGION_CONTENT = "true"
FEATURE_RATE_LIMITING = "true"
FEATURE_STALE_WHILE_REVALIDATE = "true"

# Performance
RATE_LIMIT_MAX_REQUESTS = "100"
RATE_LIMIT_WINDOW_SECONDS = "60"
SWR_MAX_AGE = "3600"
SWR_STALE_WHILE_REVALIDATE = "86400"
```

## Troubleshooting

### Common Issues

1. **Images not optimizing**
   - Check if the image URL is going through SmartCDN
   - Verify User-Agent header is being sent
   - Check response headers for optimization info

2. **Cache not working**
   - Verify cache TTL configuration
   - Check for cache bypass rules (cookies, auth headers)
   - Use browser dev tools to inspect cache headers

3. **Slow performance**
   - Check geographic routing is working
   - Verify origin server performance
   - Monitor response times with provided headers

### Debug Headers

SmartCDN provides extensive debug information:

```javascript
// Check all SmartCDN headers
fetch('https://smartcdn.your-site.com/test')
  .then(response => {
    const headers = {};
    [
      'X-Cache-Status',
      'X-Response-Time',
      'X-Origin-Time',
      'X-Geo-Region',
      'X-Geo-Origin',
      'X-Device-Type',
      'X-AB-Variant-*',
      'X-RateLimit-Remaining',
      'X-RateLimit-Limit'
    ].forEach(header => {
      headers[header] = response.headers.get(header);
    });

    console.table(headers);
    return response;
  });
```

## Best Practices

### 1. URL Structure

- Use consistent URL patterns
- Include version numbers for cache busting: `/css/app.v123.css`
- Use descriptive filenames for images

### 2. Cache Strategy

- Static assets: Long TTL (days/weeks)
- HTML pages: Short TTL (minutes/hours)
- API responses: Very short TTL (seconds/minutes)
- User-specific content: No caching or cache bypass

### 3. Performance Monitoring

- Monitor cache hit rates (>80% ideal)
- Track response times (<100ms ideal)
- Monitor error rates (<1% ideal)
- Set up alerts for performance degradation

### 4. Security

- Use HTTPS only
- Implement proper CORS policies
- Regular security audits
- Monitor for abuse patterns

### 5. Scaling

- Start with conservative rate limits
- Monitor usage patterns
- Scale origin infrastructure as needed
- Use multiple geographic regions for global scale

## Migration Checklist

- [ ] Set up SmartCDN staging environment
- [ ] Test all content types (HTML, CSS, JS, images, API)
- [ ] Verify A/B testing functionality
- [ ] Test geographic routing
- [ ] Check image optimization
- [ ] Monitor cache performance
- [ ] Update DNS/URLs in production
- [ ] Monitor post-migration performance
- [ ] Set up monitoring and alerting

SmartCDN is designed to be a drop-in replacement for traditional CDNs while providing advanced features. Start with basic functionality and gradually enable more features as you become familiar with the system.

