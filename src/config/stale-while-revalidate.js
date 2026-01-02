/**
 * Stale-While-Revalidate Configuration
 * 
 * Configuration for stale-while-revalidate caching pattern
 */

/**
 * Global master switch for stale-while-revalidate
 */
export const STALE_WHILE_REVALIDATE_ENABLED = true;

/**
 * Stale-While-Revalidate Configuration
 */
export const SWR_CONFIG = {
  /**
   * Maximum age (in seconds) for content to be considered fresh
   * After this time, content is considered stale but can still be served
   */
  maxAge: 60 * 60, // 1 hour (3600 seconds)

  /**
   * Stale-while-revalidate window (in seconds)
   * During this window after maxAge, stale content can be served while revalidating
   * After maxAge + staleWhileRevalidate, content must be revalidated before serving
   */
  staleWhileRevalidate: 24 * 60 * 60, // 24 hours (86400 seconds)

  /**
   * Enable stale-while-revalidate for specific content types
   * If empty array, applies to all content types
   */
  enabledForContentTypes: [
    // 'text/html',
    // 'application/json',
    // 'text/css',
    // 'application/javascript',
  ], // Empty array means enabled for all types

  /**
   * Disable stale-while-revalidate for specific paths
   */
  disabledForPaths: [
    '/api/',
    '/admin/',
  ],

  /**
   * Custom function to determine if SWR should be used for a request
   * Return true to enable SWR, false to disable
   * @param {Request} request - The incoming request
   * @param {string} pathname - Request pathname
   * @returns {boolean} Whether to use SWR
   */
  shouldUseSWR: (request, pathname) => {
    // Default: use SWR for all requests (unless disabled by other rules)
    return true;
  },
};

/**
 * Gets the total cache lifetime (maxAge + staleWhileRevalidate)
 * @returns {number} Total lifetime in seconds
 */
export function getTotalCacheLifetime() {
  return SWR_CONFIG.maxAge + SWR_CONFIG.staleWhileRevalidate;
}

