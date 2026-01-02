/**
 * Stale-While-Revalidate Utilities
 * 
 * Functions for implementing stale-while-revalidate caching pattern
 */

import { STALE_WHILE_REVALIDATE_ENABLED, SWR_CONFIG, getTotalCacheLifetime } from '../config/stale-while-revalidate.js';
import { buildOriginUrl } from './geo-routing.js';

/**
 * Checks if stale-while-revalidate should be used for a request
 * @param {Request} request - The incoming request
 * @param {string} pathname - Request pathname
 * @returns {boolean} True if SWR should be used
 */
export function shouldUseStaleWhileRevalidate(request, pathname) {
  if (!STALE_WHILE_REVALIDATE_ENABLED) {
    return false;
  }

  // Check if path is disabled
  for (const disabledPath of SWR_CONFIG.disabledForPaths) {
    if (pathname.startsWith(disabledPath)) {
      return false;
    }
  }

  // Check custom function
  if (typeof SWR_CONFIG.shouldUseSWR === 'function') {
    if (!SWR_CONFIG.shouldUseSWR(request, pathname)) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if a cached response is stale
 * @param {Response} cachedResponse - The cached response
 * @param {number} maxAge - Maximum age in seconds (default from config)
 * @returns {boolean} True if response is stale
 */
export function isCachedResponseStale(cachedResponse, maxAge = null) {
  if (!cachedResponse) {
    return true;
  }

  const age = maxAge || SWR_CONFIG.maxAge;
  
  // Check Cache-Control header for max-age
  const cacheControl = cachedResponse.headers.get('Cache-Control');
  if (cacheControl) {
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    if (maxAgeMatch) {
      const headerMaxAge = parseInt(maxAgeMatch[1], 10);
      // Use the minimum of config and header max-age
      const effectiveMaxAge = Math.min(age, headerMaxAge);
      return isResponseOlderThan(cachedResponse, effectiveMaxAge);
    }
  }

  // Check Age header
  const ageHeader = cachedResponse.headers.get('Age');
  if (ageHeader) {
    const ageSeconds = parseInt(ageHeader, 10);
    return ageSeconds >= age;
  }

  // Check Date header
  return isResponseOlderThan(cachedResponse, age);
}

/**
 * Checks if a response is older than specified age
 * @param {Response} response - The response to check
 * @param {number} ageSeconds - Age in seconds
 * @returns {boolean} True if response is older than age
 */
function isResponseOlderThan(response, ageSeconds) {
  const dateHeader = response.headers.get('Date');
  if (!dateHeader) {
    // If no Date header, assume it's stale
    return true;
  }

  const responseDate = new Date(dateHeader);
  const now = new Date();
  const ageMs = (now - responseDate) / 1000; // Age in seconds

  return ageMs >= ageSeconds;
}

/**
 * Checks if stale content can still be served (within stale-while-revalidate window)
 * @param {Response} cachedResponse - The cached response
 * @returns {boolean} True if stale content can be served
 */
export function canServeStaleContent(cachedResponse) {
  if (!cachedResponse) {
    return false;
  }

  const totalLifetime = getTotalCacheLifetime();
  return !isResponseOlderThan(cachedResponse, totalLifetime);
}

/**
 * Determines cache freshness status
 * @param {Response} cachedResponse - The cached response
 * @returns {string} 'fresh', 'stale', or 'expired'
 */
export function getCacheFreshnessStatus(cachedResponse) {
  if (!cachedResponse) {
    return 'expired';
  }

  if (!isCachedResponseStale(cachedResponse)) {
    return 'fresh';
  }

  if (canServeStaleContent(cachedResponse)) {
    return 'stale';
  }

  return 'expired';
}

/**
 * Revalidates cache in the background
 * @param {Request} request - Original request
 * @param {URL} originUrl - Origin URL to fetch from
 * @param {Request} cacheKey - Cache key for storing response
 * @param {Cache} cache - Cache instance
 * @param {Object} geoRoutingInfo - Geographic routing info (optional)
 * @returns {Promise<void>}
 */
export async function revalidateCacheInBackground(request, originUrl, cacheKey, cache, geoRoutingInfo = null) {
  try {
    console.log(`[SWR] Background revalidation: ${originUrl.href}`);

    // Create a new request to the origin
    const revalidateRequest = new Request(originUrl.href, {
      method: request.method,
      headers: request.headers,
    });

    // Fetch fresh content from origin
    const freshResponse = await fetch(revalidateRequest);

    if (freshResponse.ok) {
      // Clone response for caching
      const responseToCache = freshResponse.clone();

      // Update cache with fresh content
      await cache.put(cacheKey, responseToCache);
      console.log(`[SWR] Cache updated with fresh content: ${originUrl.href}`);
    } else {
      console.warn(`[SWR] Revalidation failed with status ${freshResponse.status}: ${originUrl.href}`);
    }
  } catch (error) {
    console.error(`[SWR] Error during background revalidation: ${error.message}`, error);
    // Don't throw - background revalidation failures shouldn't affect the user
  }
}

/**
 * Builds origin URL for revalidation
 * @param {URL} finalUrl - Final URL after transformations
 * @param {Object} geoRoutingInfo - Geographic routing info
 * @returns {URL} Origin URL for revalidation
 */
export function buildRevalidationUrl(finalUrl, geoRoutingInfo) {
  if (geoRoutingInfo && geoRoutingInfo.enabled) {
    return buildOriginUrl(finalUrl, geoRoutingInfo.origin);
  }
  return finalUrl;
}

/**
 * Adds stale-while-revalidate headers to response
 * @param {Headers} headers - Response headers
 * @param {string} freshnessStatus - Cache freshness status ('fresh', 'stale', 'expired')
 * @param {boolean} isRevalidating - Whether background revalidation is happening
 */
export function addSWRHeaders(headers, freshnessStatus, isRevalidating = false) {
  headers.set('X-Cache-Freshness', freshnessStatus);
  
  if (isRevalidating) {
    headers.set('X-Cache-Revalidating', 'true');
  }

  // Add Cache-Control with stale-while-revalidate directive
  const existingCacheControl = headers.get('Cache-Control');
  if (existingCacheControl) {
    // Append stale-while-revalidate if not already present
    if (!existingCacheControl.includes('stale-while-revalidate')) {
      const swrValue = SWR_CONFIG.staleWhileRevalidate;
      headers.set('Cache-Control', `${existingCacheControl}, stale-while-revalidate=${swrValue}`);
    }
  } else {
    // Set Cache-Control with stale-while-revalidate
    const maxAge = SWR_CONFIG.maxAge;
    const swrValue = SWR_CONFIG.staleWhileRevalidate;
    headers.set('Cache-Control', `max-age=${maxAge}, stale-while-revalidate=${swrValue}`);
  }
}

