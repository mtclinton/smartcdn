/**
 * Rate Limiting Configuration
 * 
 * Configuration for rate limiting to protect the origin
 */

import { getEnvConfig } from '../utils/env-config.js';

/**
 * Gets rate limiting configuration from environment
 * @param {Object} env - Worker environment object
 * @returns {Object} Rate limiting configuration
 */
export function getRateLimitConfig(env = {}) {
  const envConfig = getEnvConfig(env);
  
  return {
    /**
     * Maximum number of requests allowed per time window
     */
    maxRequests: envConfig.rateLimiting.maxRequests,

    /**
     * Time window in seconds
     */
    windowSeconds: envConfig.rateLimiting.windowSeconds,

    /**
     * Enable rate limiting for specific paths
     * If empty array, applies to all paths
     */
    enabledForPaths: [
      // '/api/',
      // '/admin/',
    ], // Empty array means enabled for all paths

    /**
     * Disable rate limiting for specific paths
     */
    disabledForPaths: [
      // '/health',
      // '/status',
    ],

    /**
     * Custom function to determine if rate limiting should be applied
     * Return true to apply rate limiting, false to skip
     * @param {Request} request - The incoming request
     * @param {string} pathname - Request pathname
     * @returns {boolean} Whether to apply rate limiting
     */
    shouldRateLimit: (request, pathname) => {
      // Default: apply rate limiting to all requests (unless disabled by other rules)
      return true;
    },

    /**
     * Use Cache API for rate limit storage (recommended for Cloudflare Workers)
     * If false, uses in-memory storage (resets on worker restart)
     */
    useCacheAPI: true,

    /**
     * Cache key prefix for rate limit data
     */
    cacheKeyPrefix: 'rate_limit:',
  };
}

/**
 * Default configuration (for backward compatibility)
 */
export const RATE_LIMIT_CONFIG = getRateLimitConfig({});

/**
 * Gets rate limiting enabled status from environment
 * @param {Object} env - Worker environment object
 * @returns {boolean} Whether rate limiting is enabled
 */
export function isRateLimitingEnabled(env = {}) {
  const envConfig = getEnvConfig(env);
  return envConfig.features.rateLimiting;
}

/**
 * Global master switch for rate limiting (default, can be overridden by env)
 */
export const RATE_LIMITING_ENABLED = true;
