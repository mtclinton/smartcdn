/**
 * Cache Statistics Tracking
 * 
 * Tracks cache hit/miss/bypass ratios and prepares data for analytics
 */

/**
 * Cache status types
 */
export const CACHE_STATUS = {
  HIT: 'HIT',
  MISS: 'MISS',
  BYPASS: 'BYPASS',
};

/**
 * In-memory cache statistics storage
 * In production, this could be stored in KV, Durable Objects, or external analytics service
 */
const cacheStats = {
  hits: 0,
  misses: 0,
  bypasses: 0,
  total: 0,
  byPath: new Map(), // Track stats per path pattern
  byStatus: new Map(), // Track stats by HTTP status code
  byMethod: new Map(), // Track stats by HTTP method
  recentRequests: [], // Store recent requests for analytics (limited to last N)
};

// Maximum number of recent requests to store
const MAX_RECENT_REQUESTS = 1000;

/**
 * Determines if a request is cacheable
 * @param {Request} request - The incoming request
 * @param {string} method - HTTP method
 * @returns {boolean} True if request is cacheable
 */
export function isRequestCacheable(request, method) {
  // Non-idempotent methods are not cacheable
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return false;
  }

  // Check Cache-Control header
  const cacheControl = request.headers.get('Cache-Control');
  if (cacheControl) {
    const directives = cacheControl.toLowerCase();
    if (directives.includes('no-store') || directives.includes('no-cache')) {
      return false;
    }
  }

  // Check Pragma header (HTTP/1.0 compatibility)
  const pragma = request.headers.get('Pragma');
  if (pragma && pragma.toLowerCase().includes('no-cache')) {
    return false;
  }

  return true;
}

/**
 * Determines if a response is cacheable
 * @param {Response} response - The response object
 * @returns {boolean} True if response is cacheable
 */
export function isResponseCacheable(response) {
  if (!response) {
    return false;
  }

  // Error responses (4xx, 5xx) are typically not cached
  const status = response.status;
  if (status >= 400) {
    // Some 4xx responses might be cacheable (like 404), but we'll be conservative
    // Only cache 304 Not Modified
    if (status === 304) {
      return true;
    }
    return false;
  }

  // Check Cache-Control header
  const cacheControl = response.headers.get('Cache-Control');
  if (cacheControl) {
    const directives = cacheControl.toLowerCase();
    if (directives.includes('no-store') || directives.includes('private')) {
      return false;
    }
    // no-cache allows caching but requires revalidation
    if (directives.includes('no-cache')) {
      return true; // Still cacheable, just needs revalidation
    }
  }

  return true;
}

/**
 * Determines cache status for a request
 * @param {boolean} wasCached - Whether response was found in cache
 * @param {boolean} requestCacheable - Whether request is cacheable
 * @param {boolean} responseCacheable - Whether response is cacheable
 * @returns {string} Cache status (HIT, MISS, or BYPASS)
 */
export function determineCacheStatus(wasCached, requestCacheable, responseCacheable) {
  // If request or response is not cacheable, it's a BYPASS
  if (!requestCacheable || !responseCacheable) {
    return CACHE_STATUS.BYPASS;
  }

  // If it was cached, it's a HIT
  if (wasCached) {
    return CACHE_STATUS.HIT;
  }

  // Otherwise it's a MISS
  return CACHE_STATUS.MISS;
}

/**
 * Records a cache event
 * @param {Object} event - Cache event data
 * @param {string} event.status - Cache status (HIT, MISS, BYPASS)
 * @param {string} event.path - Request pathname
 * @param {string} event.method - HTTP method
 * @param {number} event.statusCode - HTTP status code
 * @param {string} event.country - Country code (optional)
 * @param {string} event.region - Region (optional)
 * @param {number} event.cacheLookupTime - Cache lookup time in ms (optional)
 * @param {number} event.originFetchTime - Origin fetch time in ms (optional)
 * @param {number} event.totalTime - Total response time in ms (optional)
 */
export function recordCacheEvent(event) {
  const { status, path, method, statusCode, country, region, cacheLookupTime, originFetchTime, totalTime } = event;

  // Update global statistics
  cacheStats.total++;
  switch (status) {
    case CACHE_STATUS.HIT:
      cacheStats.hits++;
      break;
    case CACHE_STATUS.MISS:
      cacheStats.misses++;
      break;
    case CACHE_STATUS.BYPASS:
      cacheStats.bypasses++;
      break;
  }

  // Track by path pattern (simplified - just use pathname)
  const pathKey = path || 'unknown';
  if (!cacheStats.byPath.has(pathKey)) {
    cacheStats.byPath.set(pathKey, { hits: 0, misses: 0, bypasses: 0, total: 0 });
  }
  const pathStats = cacheStats.byPath.get(pathKey);
  pathStats.total++;
  if (status === CACHE_STATUS.HIT) pathStats.hits++;
  else if (status === CACHE_STATUS.MISS) pathStats.misses++;
  else if (status === CACHE_STATUS.BYPASS) pathStats.bypasses++;

  // Track by HTTP status code
  const statusKey = statusCode || 'unknown';
  if (!cacheStats.byStatus.has(statusKey)) {
    cacheStats.byStatus.set(statusKey, { hits: 0, misses: 0, bypasses: 0, total: 0 });
  }
  const statusStats = cacheStats.byStatus.get(statusKey);
  statusStats.total++;
  if (status === CACHE_STATUS.HIT) statusStats.hits++;
  else if (status === CACHE_STATUS.MISS) statusStats.misses++;
  else if (status === CACHE_STATUS.BYPASS) statusStats.bypasses++;

  // Track by HTTP method
  const methodKey = method || 'unknown';
  if (!cacheStats.byMethod.has(methodKey)) {
    cacheStats.byMethod.set(methodKey, { hits: 0, misses: 0, bypasses: 0, total: 0 });
  }
  const methodStats = cacheStats.byMethod.get(methodKey);
  methodStats.total++;
  if (status === CACHE_STATUS.HIT) methodStats.hits++;
  else if (status === CACHE_STATUS.MISS) methodStats.misses++;
  else if (status === CACHE_STATUS.BYPASS) methodStats.bypasses++;

  // Store recent request for analytics
  const requestData = {
    timestamp: new Date().toISOString(),
    status,
    path,
    method,
    statusCode,
    country,
    region,
    cacheLookupTime,
    originFetchTime,
    totalTime,
  };

  cacheStats.recentRequests.push(requestData);
  
  // Limit recent requests array size
  if (cacheStats.recentRequests.length > MAX_RECENT_REQUESTS) {
    cacheStats.recentRequests.shift(); // Remove oldest
  }
}

/**
 * Gets current cache statistics
 * @returns {Object} Cache statistics object
 */
export function getCacheStatistics() {
  const hitRate = cacheStats.total > 0 
    ? ((cacheStats.hits / cacheStats.total) * 100).toFixed(2) 
    : '0.00';
  const missRate = cacheStats.total > 0 
    ? ((cacheStats.misses / cacheStats.total) * 100).toFixed(2) 
    : '0.00';
  const bypassRate = cacheStats.total > 0 
    ? ((cacheStats.bypasses / cacheStats.total) * 100).toFixed(2) 
    : '0.00';

  return {
    summary: {
      total: cacheStats.total,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      bypasses: cacheStats.bypasses,
      hitRate: `${hitRate}%`,
      missRate: `${missRate}%`,
      bypassRate: `${bypassRate}%`,
    },
    byPath: Object.fromEntries(cacheStats.byPath),
    byStatus: Object.fromEntries(cacheStats.byStatus),
    byMethod: Object.fromEntries(cacheStats.byMethod),
    recentRequests: cacheStats.recentRequests.slice(-100), // Last 100 requests
  };
}

/**
 * Gets analytics-ready data for cache statistics
 * @returns {Object} Analytics data structure
 */
export function getAnalyticsData() {
  const stats = getCacheStatistics();
  
  return {
    timestamp: new Date().toISOString(),
    summary: stats.summary,
    breakdown: {
      byPath: stats.byPath,
      byStatus: stats.byStatus,
      byMethod: stats.byMethod,
    },
    recentRequests: stats.recentRequests,
    // Additional metadata for analytics
    metadata: {
      sampleSize: cacheStats.recentRequests.length,
      timeRange: cacheStats.recentRequests.length > 0 
        ? {
            oldest: cacheStats.recentRequests[0]?.timestamp,
            newest: cacheStats.recentRequests[cacheStats.recentRequests.length - 1]?.timestamp,
          }
        : null,
    },
  };
}

/**
 * Resets cache statistics (useful for testing or periodic resets)
 */
export function resetCacheStatistics() {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.bypasses = 0;
  cacheStats.total = 0;
  cacheStats.byPath.clear();
  cacheStats.byStatus.clear();
  cacheStats.byMethod.clear();
  cacheStats.recentRequests = [];
}

