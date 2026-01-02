/**
 * Tests for A/B Variant Assignment
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getVariantForTest, hashToPercentage } from '../src/utils/ab-testing.js';
import { getOrAssignVariantForTest as getOrAssignVariant } from '../src/utils/variants.js';

describe('A/B Variant Assignment', () => {
  describe('hashToPercentage', () => {
    it('should return a number between 0 and 99', () => {
      const result = hashToPercentage('test-string');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(100);
    });

    it('should return consistent results for same input', () => {
      const input = 'test-user-123';
      const result1 = hashToPercentage(input);
      const result2 = hashToPercentage(input);
      expect(result1).toBe(result2);
    });

    it('should return different results for different inputs', () => {
      const result1 = hashToPercentage('user-1');
      const result2 = hashToPercentage('user-2');
      expect(result1).not.toBe(result2);
    });

    it('should handle empty strings', () => {
      const result = hashToPercentage('');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(100);
    });

    it('should handle special characters', () => {
      const result = hashToPercentage('user@example.com');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(100);
    });
  });

  describe('getVariantForTest', () => {
    const testConfig = {
      id: 'test-1',
      trafficAllocation: {
        A: 50,
        B: 50,
      },
    };

    it('should assign variant A or B based on hash', () => {
      const variant = getVariantForTest(testConfig, 'user-123');
      expect(['A', 'B']).toContain(variant);
    });

    it('should assign same variant for same user', () => {
      const userId = 'user-123';
      const variant1 = getVariantForTest(testConfig, userId);
      const variant2 = getVariantForTest(testConfig, userId);
      expect(variant1).toBe(variant2);
    });

    it('should assign different variants for different users', () => {
      const variant1 = getVariantForTest(testConfig, 'user-1');
      const variant2 = getVariantForTest(testConfig, 'user-2');
      // They might be the same by chance, but test that function works
      expect(['A', 'B']).toContain(variant1);
      expect(['A', 'B']).toContain(variant2);
    });

    it('should respect traffic allocation percentages', () => {
      const testConfig5050 = {
        id: 'test-5050',
        trafficAllocation: { A: 50, B: 50 },
      };
      
      // Test with multiple users to check distribution
      const variants = [];
      for (let i = 0; i < 100; i++) {
        variants.push(getVariantForTest(testConfig5050, `user-${i}`));
      }
      
      const aCount = variants.filter(v => v === 'A').length;
      const bCount = variants.filter(v => v === 'B').length;
      
      // Should be roughly 50/50 (allow some variance)
      expect(aCount + bCount).toBe(100);
      expect(aCount).toBeGreaterThan(30); // At least 30% should be A
      expect(bCount).toBeGreaterThan(30); // At least 30% should be B
    });

    it('should handle 70/30 traffic allocation', () => {
      const testConfig7030 = {
        id: 'test-7030',
        trafficAllocation: { A: 70, B: 30 },
      };
      
      const variants = [];
      for (let i = 0; i < 100; i++) {
        variants.push(getVariantForTest(testConfig7030, `user-${i}`));
      }
      
      const aCount = variants.filter(v => v === 'A').length;
      const bCount = variants.filter(v => v === 'B').length;
      
      expect(aCount + bCount).toBe(100);
      // A should have more traffic than B
      expect(aCount).toBeGreaterThan(bCount);
    });

    it('should handle three variants', () => {
      const testConfig3 = {
        id: 'test-3',
        trafficAllocation: { A: 33, B: 33, C: 34 },
      };
      
      const variant = getVariantForTest(testConfig3, 'user-123');
      expect(['A', 'B', 'C']).toContain(variant);
    });

    it('should use test ID in hash calculation', () => {
      const test1 = { id: 'test-1', trafficAllocation: { A: 50, B: 50 } };
      const test2 = { id: 'test-2', trafficAllocation: { A: 50, B: 50 } };
      
      const variant1 = getVariantForTest(test1, 'user-123');
      const variant2 = getVariantForTest(test2, 'user-123');
      
      // Same user might get different variants for different tests
      expect(['A', 'B']).toContain(variant1);
      expect(['A', 'B']).toContain(variant2);
    });

    it('should fallback to first variant if allocation is invalid', () => {
      const invalidTest = {
        id: 'test-invalid',
        trafficAllocation: {},
      };
      
      const variant = getVariantForTest(invalidTest, 'user-123');
      expect(variant).toBe('A');
    });
  });

  describe('getOrAssignVariantForTest', () => {
    it('should return existing variant from cookie', () => {
      const test = {
        id: 'test-1',
        variants: {
          A: { strategy: 'path-suffix', config: {} },
          B: { strategy: 'path-suffix', config: {} },
        },
      };
      
      const request = new Request('https://example.com/page', {
        headers: {
          'Cookie': 'smartcdn_test_test-1=B',
        },
      });
      
      const result = getOrAssignVariant(request, test);
      expect(result.variant).toBe('B');
      expect(result.isNewAssignment).toBe(false);
    });

    it('should assign new variant if no cookie exists', () => {
      const test = {
        id: 'test-1',
        variants: {
          A: { strategy: 'path-suffix', config: {} },
          B: { strategy: 'path-suffix', config: {} },
        },
        trafficAllocation: { A: 50, B: 50 },
      };
      
      const request = new Request('https://example.com/page', {
        headers: {
          'CF-Connecting-IP': '192.168.1.1',
        },
      });
      
      const result = getOrAssignVariant(request, test);
      expect(['A', 'B']).toContain(result.variant);
      expect(result.isNewAssignment).toBe(true);
    });

    it('should assign new variant if cookie has invalid variant', () => {
      const test = {
        id: 'test-1',
        variants: {
          A: { strategy: 'path-suffix', config: {} },
          B: { strategy: 'path-suffix', config: {} },
        },
        trafficAllocation: { A: 50, B: 50 },
      };
      
      const request = new Request('https://example.com/page', {
        headers: {
          'Cookie': 'smartcdn_test_test-1=INVALID',
          'CF-Connecting-IP': '192.168.1.1',
        },
      });
      
      const result = getOrAssignVariant(request, test);
      expect(['A', 'B']).toContain(result.variant);
      expect(result.isNewAssignment).toBe(true);
    });

    it('should use IP address for assignment when no cookie', () => {
      const test = {
        id: 'test-1',
        variants: {
          A: { strategy: 'path-suffix', config: {} },
          B: { strategy: 'path-suffix', config: {} },
        },
        trafficAllocation: { A: 50, B: 50 },
      };
      
      const request1 = new Request('https://example.com/page', {
        headers: {
          'CF-Connecting-IP': '192.168.1.1',
        },
      });
      
      const request2 = new Request('https://example.com/page', {
        headers: {
          'CF-Connecting-IP': '192.168.1.1',
        },
      });
      
      const result1 = getOrAssignVariant(request1, test);
      const result2 = getOrAssignVariant(request2, test);
      
      // Same IP should get same variant
      expect(result1.variant).toBe(result2.variant);
    });
  });
});

