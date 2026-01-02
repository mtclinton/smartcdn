/**
 * Rate Limiting Configuration
 * 
 * Configuration for rate limiting to protect the origin
 */

/**
 * Global master switch for rate limiting
 */
export const RATE_LIMITING_ENABLED = true;

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMIT_CONFIG = {
  /**
   * Maximum number of requests allowed per time window
   */
  maxRequests: 100,

  /**
   * Time window in seconds
   */
  windowSeconds: 60, // 1 minute

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

