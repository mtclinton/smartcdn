/**
 * Tests for Cache TTL Calculation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getCacheTTL, getCacheControlHeader } from '../src/utils/cache.js';

describe('Cache TTL Calculation', () => {
  const defaultEnv = {};

  describe('getCacheTTL', () => {
    it('should return correct TTL for image files', () => {
      expect(getCacheTTL('/image.jpg', defaultEnv)).toBe(30 * 24 * 60 * 60); // 30 days
      expect(getCacheTTL('/photo.png', defaultEnv)).toBe(30 * 24 * 60 * 60);
      expect(getCacheTTL('/picture.webp', defaultEnv)).toBe(30 * 24 * 60 * 60);
      expect(getCacheTTL('/icon.gif', defaultEnv)).toBe(30 * 24 * 60 * 60);
      expect(getCacheTTL('/logo.svg', defaultEnv)).toBe(30 * 24 * 60 * 60);
      expect(getCacheTTL('/favicon.ico', defaultEnv)).toBe(30 * 24 * 60 * 60);
    });

    it('should return correct TTL for CSS files', () => {
      expect(getCacheTTL('/style.css', defaultEnv)).toBe(7 * 24 * 60 * 60); // 7 days
      expect(getCacheTTL('/theme.css', defaultEnv)).toBe(7 * 24 * 60 * 60);
    });

    it('should return correct TTL for JavaScript files', () => {
      expect(getCacheTTL('/script.js', defaultEnv)).toBe(7 * 24 * 60 * 60); // 7 days
      expect(getCacheTTL('/app.js', defaultEnv)).toBe(7 * 24 * 60 * 60);
      expect(getCacheTTL('/bundle.min.js', defaultEnv)).toBe(7 * 24 * 60 * 60);
    });

    it('should return correct TTL for HTML files', () => {
      expect(getCacheTTL('/index.html', defaultEnv)).toBe(60 * 60); // 1 hour
      expect(getCacheTTL('/page.htm', defaultEnv)).toBe(60 * 60);
    });

    it('should return correct TTL for API paths', () => {
      expect(getCacheTTL('/api/users', defaultEnv)).toBe(5 * 60); // 5 minutes
      expect(getCacheTTL('/api/data.json', defaultEnv)).toBe(5 * 60);
      expect(getCacheTTL('/api/v1/products', defaultEnv)).toBe(5 * 60);
    });

    it('should return correct TTL for paths without extension', () => {
      expect(getCacheTTL('/', defaultEnv)).toBe(60 * 60); // 1 hour (treated as HTML)
      expect(getCacheTTL('/about', defaultEnv)).toBe(60 * 60);
      expect(getCacheTTL('/products/', defaultEnv)).toBe(60 * 60);
    });

    it('should return default TTL for unknown file types', () => {
      expect(getCacheTTL('/file.txt', defaultEnv)).toBe(24 * 60 * 60); // 1 day
      expect(getCacheTTL('/data.xml', defaultEnv)).toBe(24 * 60 * 60);
      expect(getCacheTTL('/document.pdf', defaultEnv)).toBe(24 * 60 * 60);
    });

    it('should be case-insensitive', () => {
      expect(getCacheTTL('/IMAGE.JPG', defaultEnv)).toBe(30 * 24 * 60 * 60);
      expect(getCacheTTL('/Style.CSS', defaultEnv)).toBe(7 * 24 * 60 * 60);
      expect(getCacheTTL('/Index.HTML', defaultEnv)).toBe(60 * 60);
    });

    it('should use environment-specific TTL values', () => {
      const customEnv = {
        CACHE_TTL_IMAGES: '3600', // 1 hour
        CACHE_TTL_CSS_JS: '1800', // 30 minutes
        CACHE_TTL_HTML: '900', // 15 minutes
        CACHE_TTL_API: '60', // 1 minute
        CACHE_TTL_DEFAULT: '7200', // 2 hours
      };

      expect(getCacheTTL('/image.jpg', customEnv)).toBe(3600);
      expect(getCacheTTL('/style.css', customEnv)).toBe(1800);
      expect(getCacheTTL('/index.html', customEnv)).toBe(900);
      expect(getCacheTTL('/api/data', customEnv)).toBe(60);
      expect(getCacheTTL('/file.txt', customEnv)).toBe(7200);
    });
  });

  describe('getCacheControlHeader', () => {
    it('should generate correct Cache-Control header', () => {
      expect(getCacheControlHeader(3600)).toBe('public, max-age=3600');
      expect(getCacheControlHeader(86400)).toBe('public, max-age=86400');
    });

    it('should include immutable directive when specified', () => {
      expect(getCacheControlHeader(3600, true)).toBe('public, max-age=3600, immutable');
      expect(getCacheControlHeader(86400, false)).toBe('public, max-age=86400');
    });
  });

});

