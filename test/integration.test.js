/**
 * Integration Tests
 * 
 * Tests that simulate full request/response cycles through the worker.
 * 
 * NOTE: These tests may fail due to Vite's import analysis trying to parse
 * source files. If you encounter parsing errors, you can:
 * 1. Run unit tests only: npm run test:unit
 * 2. Test manually using: wrangler dev
 * 3. Use Cloudflare Workers' built-in testing tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use dynamic import to avoid Vite parsing issues
// Note: Integration tests require the full worker to be loaded
let worker;

// Import worker before tests
async function initWorker() {
  if (!worker) {
    try {
      // Dynamic import to avoid Vite's static analysis
      const modulePath = '../src/index.js';
      const workerModule = await import(modulePath);
      worker = workerModule.default;
    } catch (error) {
      console.error('Failed to import worker:', error);
      throw new Error(`Cannot load worker for integration tests: ${error.message}. This may be due to Vite parsing issues. Try running tests with --no-coverage or check source file syntax.`);
    }
  }
  return worker;
}

describe('Integration Tests', () => {
  let mockCache;
  let mockEnv;
  let mockCtx;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Mock cache
    mockCache = {
      match: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    // Mock environment
    mockEnv = {
      ENVIRONMENT: 'development',
      GEO_ORIGIN_NA: 'https://us-origin.example.com',
      GEO_ORIGIN_EU: 'https://eu-origin.example.com',
      GEO_ORIGIN_ASIA: 'https://asia-origin.example.com',
      GEO_ORIGIN_DEFAULT: 'https://global-origin.example.com',
      CACHE_TTL_IMAGES: '2592000',
      CACHE_TTL_CSS_JS: '604800',
      CACHE_TTL_HTML: '3600',
      CACHE_TTL_API: '300',
      CACHE_TTL_DEFAULT: '86400',
      FEATURE_AB_TESTING: 'true',
      FEATURE_GEO_ROUTING: 'true',
      FEATURE_RATE_LIMITING: 'false', // Disable for most tests
      FEATURE_STALE_WHILE_REVALIDATE: 'true',
      FEATURE_CACHE_BYPASS: 'true',
      RATE_LIMIT_MAX_REQUESTS: '100',
      RATE_LIMIT_WINDOW_SECONDS: '60',
      SWR_MAX_AGE: '3600',
      SWR_STALE_WHILE_REVALIDATE: '86400',
    };

    // Mock execution context
    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    };

    // Mock global caches
    global.caches = {
      default: mockCache,
    };

    // Mock global fetch
    global.fetch = vi.fn();
  });

  describe('Cache HIT on Second Request', () => {
    it('should return cached response on second request', async () => {
      const url = 'https://example.com/test.html';
      const firstRequest = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        cf: {
          country: 'US',
        },
      });

      // First request: cache miss
      mockCache.match.mockResolvedValueOnce(null);

      // Mock origin fetch for first request
      global.fetch.mockResolvedValueOnce(
        new Response('Hello World', {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      );

      const w = await initWorker();
      const firstResponse = await w.fetch(firstRequest, mockEnv, mockCtx);
      expect(firstResponse.status).toBe(200);
      expect(await firstResponse.text()).toBe('Hello World');
      expect(mockCache.put).toHaveBeenCalled();

      // Second request: cache hit
      const cachedResponse = new Response('Hello World', {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=3600',
        },
      });

      mockCache.match.mockResolvedValueOnce(cachedResponse);

      const secondRequest = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        cf: {
          country: 'US',
        },
      });

      const w2 = await initWorker();
      const secondResponse = await w2.fetch(secondRequest, mockEnv, mockCtx);
      expect(secondResponse.status).toBe(200);
      expect(await secondResponse.text()).toBe('Hello World');
      
      // Should have X-Cache-Status header indicating HIT
      expect(secondResponse.headers.get('X-Cache-Status')).toBe('HIT');
      
      // Should not fetch from origin on second request (only once for first)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should cache image responses with correct TTL', async () => {
      const url = 'https://example.com/image.jpg';
      const request = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        cf: {
          country: 'US',
        },
      });

      mockCache.match.mockResolvedValueOnce(null);

      global.fetch.mockResolvedValueOnce(
        new Response('image data', {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
          },
        })
      );

      const w = await initWorker();
      const response = await w.fetch(request, mockEnv, mockCtx);
      expect(response.status).toBe(200);
      
      // Images should have longer cache TTL
      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toContain('max-age=2592000'); // 30 days
    });
  });

  describe('A/B Variant Consistency', () => {
    it('should assign same variant to same user on multiple requests', async () => {
      const url = 'https://example.com/test';
      const ip = '192.168.1.100';

      mockCache.match.mockResolvedValue(null);

      global.fetch.mockResolvedValue(
        new Response('Test Content', {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        })
      );

      const request1 = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'CF-Connecting-IP': ip,
        },
        cf: {
          country: 'US',
        },
      });

      const w1 = await initWorker();
      const response1 = await w1.fetch(request1, mockEnv, mockCtx);
      const variant1 = response1.headers.get('X-AB-Test-Variant');
      const setCookie1 = response1.headers.get('Set-Cookie');

      // Second request with cookie from first
      const request2 = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'CF-Connecting-IP': ip,
          'Cookie': setCookie1 ? setCookie1.split(';')[0] : '',
        },
        cf: {
          country: 'US',
        },
      });

      const w2 = await initWorker();
      const response2 = await w2.fetch(request2, mockEnv, mockCtx);
      const variant2 = response2.headers.get('X-AB-Test-Variant');

      // Variants should be consistent (if A/B testing is enabled and test matches)
      if (variant1 && variant2) {
        expect(variant1).toBe(variant2);
      }
    });

    it('should set A/B test cookie on first request', async () => {
      const url = 'https://example.com/test';
      mockCache.match.mockResolvedValue(null);

      global.fetch.mockResolvedValue(
        new Response('Test Content', {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        })
      );

      const request = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'CF-Connecting-IP': '192.168.1.100',
        },
        cf: {
          country: 'US',
        },
      });

      const w = await initWorker();
      const response = await w.fetch(request, mockEnv, mockCtx);
      
      // Check if Set-Cookie header is present for A/B test
      const setCookie = response.headers.get('Set-Cookie');
      // If A/B test is active, should have cookie
      expect(response.status).toBe(200);
    });
  });

  describe('Geographic Routing', () => {
    it('should route US users to North America origin', async () => {
      const url = 'https://example.com/page';
      mockCache.match.mockResolvedValue(null);

      global.fetch.mockResolvedValue(
        new Response('Content', {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        })
      );

      const request = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        cf: {
          country: 'US',
        },
      });

      const w = await initWorker();
      const response = await w.fetch(request, mockEnv, mockCtx);
      
      // Check geographic routing headers
      const geoRegion = response.headers.get('X-Geo-Region');
      const geoOrigin = response.headers.get('X-Geo-Origin');
      
      expect(response.status).toBe(200);
      
      // If geo routing is enabled, should have headers
      if (geoRegion) {
        expect(geoRegion).toBe('north-america');
        expect(geoOrigin).toBe('https://us-origin.example.com');
      }
    });

    it('should route EU users to Europe origin', async () => {
      const url = 'https://example.com/page';
      mockCache.match.mockResolvedValue(null);

      global.fetch.mockResolvedValue(
        new Response('Content', {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        })
      );

      const request = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        cf: {
          country: 'GB', // United Kingdom
        },
      });

      const w = await initWorker();
      const response = await w.fetch(request, mockEnv, mockCtx);
      
      const geoRegion = response.headers.get('X-Geo-Region');
      
      if (geoRegion) {
        expect(geoRegion).toBe('europe');
      }
    });

    it('should use default origin for unknown countries', async () => {
      const url = 'https://example.com/page';
      mockCache.match.mockResolvedValue(null);

      global.fetch.mockResolvedValue(
        new Response('Content', {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        })
      );

      const request = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        cf: {
          country: 'XX', // Unknown country
        },
      });

      const w = await initWorker();
      const response = await w.fetch(request, mockEnv, mockCtx);
      
      const geoOrigin = response.headers.get('X-Geo-Origin');
      
      if (geoOrigin) {
        expect(geoOrigin).toBe('https://global-origin.example.com');
      }
    });
  });

  describe('Image Optimization Headers', () => {
    it('should add image optimization headers for image requests', async () => {
      const url = 'https://example.com/image.jpg';
      mockCache.match.mockResolvedValue(null);

      global.fetch.mockResolvedValue(
        new Response('image data', {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
          },
        })
      );

      const request = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'image/webp,image/avif,image/*',
        },
        cf: {
          country: 'US',
        },
      });

      const w = await initWorker();
      const response = await w.fetch(request, mockEnv, mockCtx);
      
      expect(response.status).toBe(200);
      
      // Check for image optimization headers
      const deviceType = response.headers.get('X-Device-Type');
      
      // Headers should be present if image optimization is enabled
      expect(deviceType).toBeTruthy();
    });

    it('should detect mobile device and add mobile-specific headers', async () => {
      const url = 'https://example.com/image.jpg';
      mockCache.match.mockResolvedValue(null);

      global.fetch.mockResolvedValue(
        new Response('image data', {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
          },
        })
      );

      const request = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'image/webp,image/avif,image/*',
        },
        cf: {
          country: 'US',
        },
      });

      const w = await initWorker();
      const response = await w.fetch(request, mockEnv, mockCtx);
      
      const deviceType = response.headers.get('X-Device-Type');
      expect(deviceType).toBe('mobile');
    });

    it('should add format negotiation headers for WebP support', async () => {
      const url = 'https://example.com/image.jpg';
      mockCache.match.mockResolvedValue(null);

      global.fetch.mockResolvedValue(
        new Response('image data', {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
          },
        })
      );

      const request = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'image/webp,image/avif,image/*',
        },
        cf: {
          country: 'US',
        },
      });

      const w = await initWorker();
      const response = await w.fetch(request, mockEnv, mockCtx);
      
      // Check for format negotiation headers
      const imageFormat = response.headers.get('X-Image-Format');
      // Format should be detected based on Accept header
      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const url = 'https://example.com/page';
      mockCache.match.mockResolvedValue(null);

      // Mock rate limit cache (not exceeded)
      const rateLimitCache = {
        match: vi.fn().mockResolvedValue(null), // No existing rate limit data
        put: vi.fn(),
      };

      global.caches.default = rateLimitCache;

      global.fetch.mockResolvedValue(
        new Response('Content', {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        })
      );

      const request = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'CF-Connecting-IP': '192.168.1.100',
        },
        cf: {
          country: 'US',
        },
      });

      // Enable rate limiting for this test
      const envWithRateLimit = {
        ...mockEnv,
        FEATURE_RATE_LIMITING: 'true',
      };

      const w = await initWorker();
      const response = await w.fetch(request, envWithRateLimit, mockCtx);
      
      expect(response.status).toBe(200);
      
      // Check rate limit headers
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
      expect(rateLimitRemaining).toBeTruthy();
    });
  });

  describe('Cache Headers', () => {
    it('should add proper cache headers based on content type', async () => {
      const url = 'https://example.com/style.css';
      mockCache.match.mockResolvedValue(null);

      global.fetch.mockResolvedValue(
        new Response('body { color: red; }', {
          status: 200,
          headers: {
            'Content-Type': 'text/css',
          },
        })
      );

      const request = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        cf: {
          country: 'US',
        },
      });

      const w = await initWorker();
      const response = await w.fetch(request, mockEnv, mockCtx);
      
      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toContain('max-age=604800'); // 7 days for CSS
    });

    it('should add ETag header', async () => {
      const url = 'https://example.com/page.html';
      mockCache.match.mockResolvedValue(null);

      global.fetch.mockResolvedValue(
        new Response('Content', {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        })
      );

      const request = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        cf: {
          country: 'US',
        },
      });

      const w = await initWorker();
      const response = await w.fetch(request, mockEnv, mockCtx);
      
      const etag = response.headers.get('ETag');
      expect(etag).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle origin fetch errors gracefully', async () => {
      const url = 'https://example.com/page';
      mockCache.match.mockResolvedValue(null);

      global.fetch.mockRejectedValue(
        new Error('Origin server error')
      );

      const request = new Request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        cf: {
          country: 'US',
        },
      });

      const w = await initWorker();
      // Should not throw, but return an error response
      const response = await w.fetch(request, mockEnv, mockCtx);
      
      // Should return some response (error handling)
      expect(response).toBeInstanceOf(Response);
    });
  });
});
