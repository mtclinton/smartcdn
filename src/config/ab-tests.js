/**
 * A/B Testing Configuration
 * 
 * This module contains the A/B test configuration and global settings.
 * To add a new test, simply add a new object to the AB_TESTS array.
 */

// Global master switch - set to false to disable ALL tests
export const AB_TESTING_GLOBAL_ENABLED = true;

/**
 * A/B Test Configuration Array
 * Each object represents a single A/B test
 */
export const AB_TESTS = [
  // Example 1: Simple 50/50 homepage test
  {
    id: 'homepage-redesign-2025',
    name: 'Homepage Redesign Test',
    enabled: true,
    priority: 10,
    trafficAllocation: { A: 50, B: 50 },
    pathMatching: {
      include: ['/'],
      exclude: [],
      matchType: 'exact',
    },
    variants: {
      A: {
        strategy: 'path-suffix',
        config: { suffix: '' }, // Original path
      },
      B: {
        strategy: 'path-suffix',
        config: { suffix: '-v2' },
      },
    },
    description: 'Testing new homepage design vs current',
  },

  // Example 2: 80/20 gradual rollout test
  {
    id: 'pricing-page-update',
    name: 'Pricing Page Update',
    enabled: true,
    priority: 8,
    trafficAllocation: { A: 80, B: 20 },
    pathMatching: {
      include: ['/pricing', '/pricing/*'],
      exclude: ['/pricing/admin/*'],
      matchType: 'wildcard',
    },
    variants: {
      A: {
        strategy: 'path-suffix',
        config: { suffix: '' },
      },
      B: {
        strategy: 'different-origin',
        config: { origin: 'https://v2.example.com' },
      },
    },
    description: 'Gradual rollout of new pricing page',
  },

  // Example 3: A/B/C test with three variants
  {
    id: 'landing-page-variants',
    name: 'Landing Page A/B/C Test',
    enabled: true,
    priority: 5,
    trafficAllocation: { A: 33, B: 33, C: 34 },
    pathMatching: {
      include: ['/landing/*'],
      exclude: [],
      matchType: 'wildcard',
    },
    variants: {
      A: {
        strategy: 'path-suffix',
        config: { suffix: '' },
      },
      B: {
        strategy: 'path-suffix',
        config: { suffix: '-variant-b' },
      },
      C: {
        strategy: 'query-param',
        config: { param: 'variant=c' },
      },
    },
    description: 'Testing three different landing page designs',
  },

  // Example 4: Subdomain routing test
  {
    id: 'mobile-app-redirect',
    name: 'Mobile App Redirect Test',
    enabled: false, // Disabled example
    priority: 3,
    trafficAllocation: { A: 50, B: 50 },
    pathMatching: {
      include: ['/app/*'],
      exclude: [],
      matchType: 'wildcard',
    },
    variants: {
      A: {
        strategy: 'path-suffix',
        config: { suffix: '' },
      },
      B: {
        strategy: 'subdomain',
        config: { subdomain: 'app' },
      },
    },
    description: 'Testing subdomain routing for mobile app',
  },
];


