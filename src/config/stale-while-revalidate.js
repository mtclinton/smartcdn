/**
 * Stale-While-Revalidate Configuration
 * 
 * Configuration for stale-while-revalidate caching pattern
 */

import { getEnvConfig } from '../utils/env-config.js';

/**
 * Gets stale-while-revalidate configuration from environment
 * @param {Object} env - Worker environment object
 * @returns {Object} Stale-while-revalidate configuration
 */
export function getSWRConfig(env = {}) {
  const envConfig = getEnvConfig(env);
  
  return {
    /**
     * Maximum age (in seconds) for content to be considered fresh
     * After this time, content is considered stale but can still be served
     */
    maxAge: envConfig.staleWhileRevalidate.maxAge,

    /**
     * Stale-while-revalidate window (in seconds)
     * During this window after maxAge, stale content can be served while revalidating
     * After maxAge + staleWhileRevalidate, content must be revalidated before serving
     */
    staleWhileRevalidate: envConfig.staleWhileRevalidate.staleWhileRevalidate,

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
}

/**
 * Default configuration (for backward compatibility)
 */
export const SWR_CONFIG = getSWRConfig({});

/**
 * Gets stale-while-revalidate enabled status from environment
 * @param {Object} env - Worker environment object
 * @returns {boolean} Whether stale-while-revalidate is enabled
 */
export function isStaleWhileRevalidateEnabled(env = {}) {
  const envConfig = getEnvConfig(env);
  return envConfig.features.staleWhileRevalidate;
}

/**
 * Global master switch for stale-while-revalidate (default, can be overridden by env)
 */
export const STALE_WHILE_REVALIDATE_ENABLED = true;

/**
 * Gets the total cache lifetime (maxAge + staleWhileRevalidate)
 * @param {Object} env - Worker environment object (optional)
 * @returns {number} Total lifetime in seconds
 */
export function getTotalCacheLifetime(env = {}) {
  const config = getSWRConfig(env);
  return config.maxAge + config.staleWhileRevalidate;
}

