/**
 * Feature Flags Utility
 * 
 * Functions for reading and managing feature flags.
 * Supports runtime updates via Cloudflare KV store.
 */

import { DEFAULT_FEATURE_FLAGS, FEATURE_FLAG_KEYS, FEATURE_FLAGS_KV_NAMESPACE } from '../config/feature-flags.js';

/**
 * In-memory cache for feature flags (to avoid repeated KV reads)
 * Structure: { [key]: { enabled: boolean, lastUpdated: number } }
 */
const featureFlagsCache = new Map();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Gets a feature flag value from KV store
 * @param {string} key - KV key for the feature flag
 * @param {Object} env - Worker environment object
 * @returns {Promise<boolean|null>} Feature flag value or null if not found
 */
async function getFeatureFlagFromKV(key, env) {
  try {
    // Check if KV namespace is available
    const kvNamespace = env[FEATURE_FLAGS_KV_NAMESPACE];
    if (!kvNamespace) {
      return null;
    }

    const value = await kvNamespace.get(key);
    if (value === null) {
      return null;
    }

    // Parse JSON value
    try {
      const parsed = JSON.parse(value);
      return parsed.enabled === true;
    } catch (e) {
      // If not JSON, treat as boolean string
      return value.toLowerCase() === 'true' || value === '1';
    }
  } catch (error) {
    console.warn(`Error reading feature flag from KV (${key}):`, error);
    return null;
  }
}

/**
 * Gets a feature flag value (from cache, KV, or default)
 * @param {string} flagName - Feature flag name (e.g., 'abTesting')
 * @param {Object} env - Worker environment object
 * @param {boolean} useCache - Whether to use in-memory cache (default: true)
 * @returns {Promise<boolean>} Feature flag value
 */
export async function getFeatureFlag(flagName, env = {}, useCache = true) {
  // Check in-memory cache first
  if (useCache) {
    const cached = featureFlagsCache.get(flagName);
    if (cached && (Date.now() - cached.lastUpdated) < CACHE_TTL_MS) {
      return cached.enabled;
    }
  }

  // Get default value
  const defaultValue = DEFAULT_FEATURE_FLAGS[flagName];
  if (!defaultValue) {
    console.warn(`Unknown feature flag: ${flagName}`);
    return false;
  }

  // Try to get from KV
  const kvKey = FEATURE_FLAG_KEYS[flagName.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '')];
  if (kvKey) {
    const kvValue = await getFeatureFlagFromKV(kvKey, env);
    if (kvValue !== null) {
      // Cache the value
      featureFlagsCache.set(flagName, {
        enabled: kvValue,
        lastUpdated: Date.now(),
      });
      return kvValue;
    }
  }

  // Use default value
  const enabled = defaultValue.enabled;
  
  // Cache the default value
  featureFlagsCache.set(flagName, {
    enabled: enabled,
    lastUpdated: Date.now(),
  });

  return enabled;
}

/**
 * Gets all feature flags
 * @param {Object} env - Worker environment object
 * @returns {Promise<Object>} All feature flags
 */
export async function getAllFeatureFlags(env = {}) {
  const flags = {};
  
  for (const flagName of Object.keys(DEFAULT_FEATURE_FLAGS)) {
    flags[flagName] = await getFeatureFlag(flagName, env);
  }
  
  return flags;
}

/**
 * Sets a feature flag value in KV store
 * @param {string} flagName - Feature flag name
 * @param {boolean} enabled - Whether the feature is enabled
 * @param {Object} env - Worker environment object
 * @returns {Promise<boolean>} Success status
 */
export async function setFeatureFlag(flagName, enabled, env = {}) {
  try {
    const kvNamespace = env[FEATURE_FLAGS_KV_NAMESPACE];
    if (!kvNamespace) {
      console.warn('KV namespace not available for feature flags');
      return false;
    }

    const kvKey = FEATURE_FLAG_KEYS[flagName.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '')];
    if (!kvKey) {
      console.warn(`Unknown feature flag: ${flagName}`);
      return false;
    }

    const value = JSON.stringify({
      enabled: enabled,
      lastUpdated: Date.now(),
    });

    await kvNamespace.put(kvKey, value);
    
    // Update cache
    featureFlagsCache.set(flagName, {
      enabled: enabled,
      lastUpdated: Date.now(),
    });

    return true;
  } catch (error) {
    console.error(`Error setting feature flag (${flagName}):`, error);
    return false;
  }
}

/**
 * Clears the in-memory cache for feature flags
 */
export function clearFeatureFlagsCache() {
  featureFlagsCache.clear();
}

/**
 * Convenience functions for checking specific feature flags
 */

/**
 * Checks if A/B testing is enabled
 * @param {Object} env - Worker environment object
 * @returns {Promise<boolean>} True if A/B testing is enabled
 */
export async function isABTestingEnabled(env = {}) {
  return await getFeatureFlag('abTesting', env);
}

/**
 * Checks if image optimization is enabled
 * @param {Object} env - Worker environment object
 * @returns {Promise<boolean>} True if image optimization is enabled
 */
export async function isImageOptimizationEnabled(env = {}) {
  return await getFeatureFlag('imageOptimization', env);
}

/**
 * Checks if geographic routing is enabled
 * @param {Object} env - Worker environment object
 * @returns {Promise<boolean>} True if geographic routing is enabled
 */
export async function isGeoRoutingEnabled(env = {}) {
  return await getFeatureFlag('geoRouting', env);
}

/**
 * Checks if rate limiting is enabled
 * @param {Object} env - Worker environment object
 * @returns {Promise<boolean>} True if rate limiting is enabled
 */
export async function isRateLimitingEnabled(env = {}) {
  return await getFeatureFlag('rateLimiting', env);
}

/**
 * Checks if region-specific content is enabled
 * @param {Object} env - Worker environment object
 * @returns {Promise<boolean>} True if region-specific content is enabled
 */
export async function isRegionContentEnabled(env = {}) {
  return await getFeatureFlag('regionContent', env);
}

/**
 * Checks if stale-while-revalidate is enabled
 * @param {Object} env - Worker environment object
 * @returns {Promise<boolean>} True if stale-while-revalidate is enabled
 */
export async function isStaleWhileRevalidateEnabled(env = {}) {
  return await getFeatureFlag('staleWhileRevalidate', env);
}

/**
 * Checks if cache bypass is enabled
 * @param {Object} env - Worker environment object
 * @returns {Promise<boolean>} True if cache bypass is enabled
 */
export async function isCacheBypassEnabled(env = {}) {
  return await getFeatureFlag('cacheBypass', env);
}

