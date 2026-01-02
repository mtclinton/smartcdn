/**
 * A/B Testing Utilities
 * 
 * Functions for managing A/B tests: validation, path matching, variant assignment
 */

import { AB_TESTING_GLOBAL_ENABLED, AB_TESTS } from '../config/ab-tests.js';

/**
 * Checks if A/B testing is globally enabled
 * @param {Object} env - Worker environment object (optional)
 * @param {boolean} featureFlagEnabled - Whether feature flag is enabled (optional, will check if not provided)
 * @returns {Promise<boolean>} True if A/B testing is enabled
 */
export async function isABTestingEnabled(env = {}, featureFlagEnabled = null) {
  // Check feature flag if not provided
  if (featureFlagEnabled === null) {
    const { isABTestingEnabled: checkABTesting } = await import('./feature-flags.js');
    featureFlagEnabled = await checkABTesting(env);
  }
  
  // Feature flag takes precedence over config
  return featureFlagEnabled && AB_TESTING_GLOBAL_ENABLED;
}

/**
 * Validates a single test configuration
 * @param {Object} test - Test configuration object
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateTestConfig(test) {
  const errors = [];
  
  if (!test.id || typeof test.id !== 'string') {
    errors.push(`Test ${test.id || 'unknown'}: Missing or invalid 'id'`);
  }
  
  if (typeof test.enabled !== 'boolean') {
    errors.push(`Test ${test.id}: Missing or invalid 'enabled' flag`);
  }
  
  if (!test.trafficAllocation || typeof test.trafficAllocation !== 'object') {
    errors.push(`Test ${test.id}: Missing or invalid 'trafficAllocation'`);
  } else {
    const percentages = Object.values(test.trafficAllocation);
    const sum = percentages.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 0.01) {
      errors.push(`Test ${test.id}: trafficAllocation percentages must sum to 100 (got ${sum})`);
    }
    if (percentages.some(p => p < 0 || p > 100)) {
      errors.push(`Test ${test.id}: trafficAllocation percentages must be between 0 and 100`);
    }
  }
  
  if (!test.variants || typeof test.variants !== 'object') {
    errors.push(`Test ${test.id}: Missing or invalid 'variants'`);
  } else {
    const variantKeys = Object.keys(test.variants);
    const allocationKeys = Object.keys(test.trafficAllocation || {});
    if (variantKeys.length !== allocationKeys.length) {
      errors.push(`Test ${test.id}: Number of variants doesn't match trafficAllocation keys`);
    }
    variantKeys.forEach(variant => {
      if (!test.variants[variant].strategy) {
        errors.push(`Test ${test.id}: Variant ${variant} missing 'strategy'`);
      }
    });
  }
  
  if (!test.pathMatching || typeof test.pathMatching !== 'object') {
    errors.push(`Test ${test.id}: Missing or invalid 'pathMatching'`);
  }
  
  if (typeof test.priority !== 'number') {
    errors.push(`Test ${test.id}: Missing or invalid 'priority' (must be a number)`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates the entire A/B testing configuration
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateABTestConfig() {
  const errors = [];
  const warnings = [];
  
  if (!Array.isArray(AB_TESTS)) {
    errors.push('AB_TESTS must be an array');
    return { valid: false, errors, warnings };
  }
  
  const testIds = new Set();
  
  AB_TESTS.forEach((test) => {
    // Check for duplicate IDs
    if (testIds.has(test.id)) {
      errors.push(`Duplicate test ID: ${test.id}`);
    }
    testIds.add(test.id);
    
    // Validate individual test
    const validation = validateTestConfig(test);
    if (!validation.valid) {
      errors.push(...validation.errors);
    }
    
    // Check date ranges
    if (test.startDate && test.endDate) {
      const start = new Date(test.startDate);
      const end = new Date(test.endDate);
      if (start > end) {
        errors.push(`Test ${test.id}: startDate must be before endDate`);
      }
      const now = new Date();
      if (end < now) {
        warnings.push(`Test ${test.id}: endDate is in the past`);
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Checks if a path matches a pattern based on match type
 * @param {string} pathname - The path to check
 * @param {string} pattern - The pattern to match against
 * @param {string} matchType - 'exact', 'prefix', 'regex', or 'wildcard'
 * @returns {boolean} True if path matches
 */
export function matchesPathPattern(pathname, pattern, matchType) {
  switch (matchType) {
    case 'exact':
      return pathname === pattern;
    
    case 'prefix':
      return pathname.startsWith(pattern);
    
    case 'regex':
      try {
        const regex = new RegExp(pattern);
        return regex.test(pathname);
      } catch (e) {
        console.error(`Invalid regex pattern: ${pattern}`, e);
        return false;
      }
    
    case 'wildcard':
      // Convert wildcard pattern to regex
      // * matches any characters except /
      // ** matches any characters including /
      const regexPattern = pattern
        .replace(/\*\*/g, '___DOUBLE_STAR___')
        .replace(/\*/g, '[^/]*')
        .replace(/___DOUBLE_STAR___/g, '.*');
      try {
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(pathname);
      } catch (e) {
        console.error(`Invalid wildcard pattern: ${pattern}`, e);
        return false;
      }
    
    default:
      console.warn(`Unknown matchType: ${matchType}, defaulting to exact match`);
      return pathname === pattern;
  }
}

/**
 * Checks if a path matches a test's path matching rules
 * @param {string} pathname - The path to check
 * @param {Object} pathMatching - Path matching configuration
 * @returns {boolean} True if path matches the test
 */
export function pathMatchesTest(pathname, pathMatching) {
  const { include, exclude, matchType } = pathMatching;
  
  // Check exclusions first (takes precedence)
  if (exclude && exclude.length > 0) {
    for (const excludePattern of exclude) {
      if (matchesPathPattern(pathname, excludePattern, matchType)) {
        return false;
      }
    }
  }
  
  // Check includes
  if (!include || include.length === 0) {
    return false; // No includes means no match
  }
  
  for (const includePattern of include) {
    if (matchesPathPattern(pathname, includePattern, matchType)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Checks if a test is currently active (enabled, within date range)
 * @param {Object} test - Test configuration
 * @returns {boolean} True if test is active
 */
export function isTestActive(test) {
  if (!test.enabled) {
    return false;
  }
  
  const now = new Date();
  
  if (test.startDate) {
    const start = new Date(test.startDate);
    if (now < start) {
      return false;
    }
  }
  
  if (test.endDate) {
    const end = new Date(test.endDate);
    if (now > end) {
      return false;
    }
  }
  
  return true;
}

/**
 * Gets all active tests that apply to a given path
 * @param {string} pathname - The request pathname
 * @returns {Array} Array of test objects, sorted by priority (highest first)
 */
export function getActiveTests(pathname) {
  if (!isABTestingEnabled()) {
    return [];
  }
  
  const activeTests = AB_TESTS
    .filter(test => isTestActive(test))
    .filter(test => pathMatchesTest(pathname, test.pathMatching))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  return activeTests;
}

/**
 * Gets the highest priority active test for a path
 * @param {string} pathname - The request pathname
 * @returns {Object|null} The highest priority test or null
 */
export async function getPrimaryTest(pathname, env = {}, featureFlagEnabled = null) {
  const enabled = await isABTestingEnabled(env, featureFlagEnabled);
  if (!enabled) {
    return null;
  }
  
  const activeTests = getActiveTests(pathname);
  return activeTests.length > 0 ? activeTests[0] : null;
}

/**
 * Hashes a string to a number between 0 and 100 for consistent variant assignment
 * @param {string} input - The string to hash
 * @returns {number} Hash value between 0 and 100
 */
export function hashToPercentage(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100;
}

/**
 * Determines which variant a user should be assigned to for a specific test
 * @param {Object} test - Test configuration
 * @param {string} userId - User identifier (IP address or cookie value)
 * @returns {string} Variant identifier (A, B, C, etc.)
 */
export function getVariantForTest(test, userId) {
  const { trafficAllocation } = test;
  const hashValue = hashToPercentage(`${test.id}-${userId}`);
  
  // Build cumulative ranges
  let cumulative = 0;
  const variants = Object.keys(trafficAllocation).sort();
  
  for (const variant of variants) {
    cumulative += trafficAllocation[variant];
    if (hashValue < cumulative) {
      return variant;
    }
  }
  
  // Fallback to first variant (shouldn't happen if config is valid)
  return variants[0] || 'A';
}

