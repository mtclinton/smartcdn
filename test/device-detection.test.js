/**
 * Tests for Device Detection
 */

import { describe, it, expect } from 'vitest';
import { detectDevice, getImageOptimizationParams } from '../src/utils/device.js';

describe('Device Detection', () => {
  describe('detectDevice', () => {
    it('should detect iPhone as mobile', () => {
      const request = new Request('https://example.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        },
      });
      
      const device = detectDevice(request);
      expect(device.deviceType).toBe('mobile');
      expect(device.isMobile).toBe(true);
      expect(device.isTablet).toBe(false);
      expect(device.isDesktop).toBe(false);
    });

    it('should detect Android phone as mobile', () => {
      const request = new Request('https://example.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        },
      });
      
      const device = detectDevice(request);
      expect(device.deviceType).toBe('mobile');
      expect(device.isMobile).toBe(true);
    });

    it('should detect iPad as tablet', () => {
      const request = new Request('https://example.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        },
      });
      
      const device = detectDevice(request);
      expect(device.deviceType).toBe('tablet');
      expect(device.isTablet).toBe(true);
      expect(device.isMobile).toBe(false);
      expect(device.isDesktop).toBe(false);
    });

    it('should detect Android tablet as tablet', () => {
      const request = new Request('https://example.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-T860) AppleWebKit/537.36',
        },
      });
      
      const device = detectDevice(request);
      expect(device.deviceType).toBe('tablet');
      expect(device.isTablet).toBe(true);
    });

    it('should detect Windows desktop as desktop', () => {
      const request = new Request('https://example.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      const device = detectDevice(request);
      expect(device.deviceType).toBe('desktop');
      expect(device.isDesktop).toBe(true);
      expect(device.isMobile).toBe(false);
      expect(device.isTablet).toBe(false);
    });

    it('should detect macOS desktop as desktop', () => {
      const request = new Request('https://example.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
      
      const device = detectDevice(request);
      expect(device.deviceType).toBe('desktop');
      expect(device.isDesktop).toBe(true);
    });

    it('should detect Linux desktop as desktop', () => {
      const request = new Request('https://example.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        },
      });
      
      const device = detectDevice(request);
      expect(device.deviceType).toBe('desktop');
      expect(device.isDesktop).toBe(true);
    });

    it('should default to desktop for unknown user agents', () => {
      const request = new Request('https://example.com', {
        headers: {
          'User-Agent': 'Unknown-Bot/1.0',
        },
      });
      
      const device = detectDevice(request);
      expect(device.deviceType).toBe('desktop');
      expect(device.isDesktop).toBe(true);
    });

    it('should handle missing User-Agent header', () => {
      const request = new Request('https://example.com', {
        headers: {},
      });
      
      const device = detectDevice(request);
      expect(device.deviceType).toBe('desktop');
      expect(device.userAgent).toBe('');
    });

    it('should preserve original User-Agent in response', () => {
      const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';
      const request = new Request('https://example.com', {
        headers: {
          'User-Agent': userAgent,
        },
      });
      
      const device = detectDevice(request);
      expect(device.userAgent).toBe(userAgent);
    });

    it('should be case-insensitive', () => {
      const request = new Request('https://example.com', {
        headers: {
          'User-Agent': 'MOZILLA/5.0 (IPHONE; CPU IPHONE OS 14_0)',
        },
      });
      
      const device = detectDevice(request);
      expect(device.deviceType).toBe('mobile');
    });
  });

  describe('getImageOptimizationParams', () => {
    it('should return mobile-specific params for mobile device', () => {
      const deviceInfo = {
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
      };
      
      const params = getImageOptimizationParams(deviceInfo);
      expect(params.deviceType).toBe('mobile');
      expect(params.maxWidth).toBe(768);
      expect(params.quality).toBe(80);
      expect(params.dpr).toBe(2);
      expect(params.preferredFormat).toBe('webp');
    });

    it('should return tablet-specific params for tablet device', () => {
      const deviceInfo = {
        deviceType: 'tablet',
        isMobile: false,
        isTablet: true,
        isDesktop: false,
      };
      
      const params = getImageOptimizationParams(deviceInfo);
      expect(params.deviceType).toBe('tablet');
      expect(params.maxWidth).toBe(1024);
      expect(params.quality).toBe(82);
      expect(params.dpr).toBe(2);
    });

    it('should return desktop-specific params for desktop device', () => {
      const deviceInfo = {
        deviceType: 'desktop',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
      };
      
      const params = getImageOptimizationParams(deviceInfo);
      expect(params.deviceType).toBe('desktop');
      expect(params.maxWidth).toBe(1920);
      expect(params.quality).toBe(85);
      expect(params.dpr).toBe(1);
    });

    it('should always include required properties', () => {
      const deviceInfo = {
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
      };
      
      const params = getImageOptimizationParams(deviceInfo);
      expect(params).toHaveProperty('deviceType');
      expect(params).toHaveProperty('maxWidth');
      expect(params).toHaveProperty('quality');
      expect(params).toHaveProperty('dpr');
      expect(params).toHaveProperty('preferredFormat');
    });
  });
});

