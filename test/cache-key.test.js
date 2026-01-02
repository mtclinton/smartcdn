/**
 * Tests for Cache Key Generation
 */

import { describe, it, expect } from 'vitest';
import { generateCacheKey } from '../src/utils/cache.js';

describe('Cache Key Generation', () => {
  it('should generate cache key from URL', () => {
    const request = new Request('https://example.com/page');
    const url = new URL('https://example.com/page');
    const cacheKeyRequest = generateCacheKey(request, url);
    
    expect(cacheKeyRequest).toBeInstanceOf(Request);
    expect(cacheKeyRequest.url).toBe('https://example.com/page');
  });

  it('should generate consistent keys for same URL', () => {
    const request1 = new Request('https://example.com/page');
    const request2 = new Request('https://example.com/page');
    const url = new URL('https://example.com/page');
    
    const key1 = generateCacheKey(request1, url);
    const key2 = generateCacheKey(request2, url);
    
    expect(new URL(key1.url).href).toBe(new URL(key2.url).href);
  });

  it('should generate different keys for different URLs', () => {
    const request1 = new Request('https://example.com/page1');
    const request2 = new Request('https://example.com/page2');
    const url1 = new URL('https://example.com/page1');
    const url2 = new URL('https://example.com/page2');
    
    const key1 = generateCacheKey(request1, url1);
    const key2 = generateCacheKey(request2, url2);
    
    expect(new URL(key1.url).href).not.toBe(new URL(key2.url).href);
  });

  it('should include query parameters in cache key', () => {
    const request1 = new Request('https://example.com/page?param=value1');
    const request2 = new Request('https://example.com/page?param=value2');
    const url1 = new URL('https://example.com/page?param=value1');
    const url2 = new URL('https://example.com/page?param=value2');
    
    const key1 = generateCacheKey(request1, url1);
    const key2 = generateCacheKey(request2, url2);
    
    expect(new URL(key1.url).search).not.toBe(new URL(key2.url).search);
  });

  it('should filter out tracking parameters', () => {
    const request1 = new Request('https://example.com/page?utm_source=test&id=123');
    const request2 = new Request('https://example.com/page?utm_campaign=test&id=123');
    const url1 = new URL('https://example.com/page?utm_source=test&id=123');
    const url2 = new URL('https://example.com/page?utm_campaign=test&id=123');
    
    const key1 = generateCacheKey(request1, url1);
    const key2 = generateCacheKey(request2, url2);
    
    const key1Url = new URL(key1.url);
    const key2Url = new URL(key2.url);
    
    // Both should have id=123 but no utm_ params
    expect(key1Url.searchParams.has('utm_source')).toBe(false);
    expect(key2Url.searchParams.has('utm_campaign')).toBe(false);
    expect(key1Url.searchParams.get('id')).toBe('123');
    expect(key2Url.searchParams.get('id')).toBe('123');
  });

  it('should filter multiple tracking parameters', () => {
    const request = new Request('https://example.com/page?utm_source=test&utm_medium=email&fbclid=123&gclid=456&id=789');
    const url = new URL('https://example.com/page?utm_source=test&utm_medium=email&fbclid=123&gclid=456&id=789');
    
    const cacheKeyRequest = generateCacheKey(request, url);
    const cacheKeyUrl = new URL(cacheKeyRequest.url);
    
    expect(cacheKeyUrl.searchParams.has('utm_source')).toBe(false);
    expect(cacheKeyUrl.searchParams.has('utm_medium')).toBe(false);
    expect(cacheKeyUrl.searchParams.has('fbclid')).toBe(false);
    expect(cacheKeyUrl.searchParams.has('gclid')).toBe(false);
    expect(cacheKeyUrl.searchParams.get('id')).toBe('789');
  });

  it('should preserve image-specific parameters for images', () => {
    const request = new Request('https://example.com/image.jpg?width=800&height=600&quality=80&utm_source=test');
    const url = new URL('https://example.com/image.jpg?width=800&height=600&quality=80&utm_source=test');
    
    const cacheKeyRequest = generateCacheKey(request, url);
    const cacheKeyUrl = new URL(cacheKeyRequest.url);
    
    expect(cacheKeyUrl.searchParams.get('width')).toBe('800');
    expect(cacheKeyUrl.searchParams.get('height')).toBe('600');
    expect(cacheKeyUrl.searchParams.get('quality')).toBe('80');
    expect(cacheKeyUrl.searchParams.has('utm_source')).toBe(false);
  });

  it('should preserve non-tracking parameters for non-images', () => {
    const request = new Request('https://example.com/page?category=shoes&size=10&utm_source=test');
    const url = new URL('https://example.com/page?category=shoes&size=10&utm_source=test');
    
    const cacheKeyRequest = generateCacheKey(request, url);
    const cacheKeyUrl = new URL(cacheKeyRequest.url);
    
    expect(cacheKeyUrl.searchParams.get('category')).toBe('shoes');
    expect(cacheKeyUrl.searchParams.get('size')).toBe('10');
    expect(cacheKeyUrl.searchParams.has('utm_source')).toBe(false);
  });

  it('should sort query parameters for consistent cache keys', () => {
    const request1 = new Request('https://example.com/page?b=2&a=1');
    const request2 = new Request('https://example.com/page?a=1&b=2');
    const url1 = new URL('https://example.com/page?b=2&a=1');
    const url2 = new URL('https://example.com/page?a=1&b=2');
    
    const key1 = generateCacheKey(request1, url1);
    const key2 = generateCacheKey(request2, url2);
    
    // After sorting, both should have same order
    const key1Url = new URL(key1.url);
    const key2Url = new URL(key2.url);
    
    const key1Params = Array.from(key1Url.searchParams.entries()).sort();
    const key2Params = Array.from(key2Url.searchParams.entries()).sort();
    
    expect(key1Params).toEqual(key2Params);
  });

  it('should preserve request method and headers', () => {
    const request = new Request('https://example.com/page', {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Test-Agent',
      },
    });
    const url = new URL('https://example.com/page');
    
    const cacheKeyRequest = generateCacheKey(request, url);
    
    expect(cacheKeyRequest.method).toBe('GET');
    expect(cacheKeyRequest.headers.get('Accept')).toBe('text/html');
    expect(cacheKeyRequest.headers.get('User-Agent')).toBe('Test-Agent');
  });

  it('should handle URLs without query parameters', () => {
    const request = new Request('https://example.com/page');
    const url = new URL('https://example.com/page');
    
    const cacheKeyRequest = generateCacheKey(request, url);
    
    expect(new URL(cacheKeyRequest.url).search).toBe('');
  });

  it('should handle case-insensitive tracking parameter detection', () => {
    const request = new Request('https://example.com/page?UTM_SOURCE=test&Utm_Medium=email');
    const url = new URL('https://example.com/page?UTM_SOURCE=test&Utm_Medium=email');
    
    const cacheKeyRequest = generateCacheKey(request, url);
    const cacheKeyUrl = new URL(cacheKeyRequest.url);
    
    expect(cacheKeyUrl.searchParams.has('UTM_SOURCE')).toBe(false);
    expect(cacheKeyUrl.searchParams.has('Utm_Medium')).toBe(false);
  });

  it('should filter tracking parameters with prefixes', () => {
    const request = new Request('https://example.com/page?utm_source_test=value&utm_campaign_id=123');
    const url = new URL('https://example.com/page?utm_source_test=value&utm_campaign_id=123');
    
    const cacheKeyRequest = generateCacheKey(request, url);
    const cacheKeyUrl = new URL(cacheKeyRequest.url);
    
    expect(cacheKeyUrl.searchParams.has('utm_source_test')).toBe(false);
    expect(cacheKeyUrl.searchParams.has('utm_campaign_id')).toBe(false);
  });
});

