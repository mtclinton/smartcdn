/**
 * Rate Limiting Utilities
 * 
 * Functions for implementing rate limiting per IP address
 */

import { RATE_LIMITING_ENABLED, RATE_LIMIT_CONFIG } from '../config/rate-limiting.js';
import { getClientIP } from './request.js';

/**
 * In-memory rate limit storage (fallback when Cache API is not used)
 * Structure: { [ip]: { count: number, resetTime: number } }
 */
const inMemoryRateLimits = new Map();

/**
 * Gets the cache key for rate limit data
 * @param {string} ip - IP address
 * @returns {string} Cache key
 */
function getRateLimitCacheKey(ip) {
  return `${RATE_LIMIT_CONFIG.cacheKeyPrefix}${ip}`;
}

/**
 * Gets rate limit data from cache or memory
 * @param {string} ip - IP address
 * @param {Cache} cache - Cache instance (optional)
 * @returns {Promise<Object|null>} Rate limit data or null
 */
async function getRateLimitData(ip, cache = null) {
  if (RATE_LIMIT_CONFIG.useCacheAPI && cache) {
    try {
      const cacheKey = getRateLimitCacheKey(ip);
      const cached = await cache.match(cacheKey);
      if (cached) {
        const data = await cached.json();
        return data;
      }
    } catch (error) {
      console.warn('Error reading rate limit from cache:', error);
      // Fall back to in-memory
    }
  }

  // Fallback to in-memory storage
  return inMemoryRateLimits.get(ip) || null;
}

/**
 * Stores rate limit data in cache or memory
 * @param {string} ip - IP address
 * @param {Object} data - Rate limit data
 * @param {Cache} cache - Cache instance (optional)
 * @param {ExecutionContext} ctx - Execution context for waitUntil (optional)
 * @returns {Promise<void>}
 */
async function setRateLimitData(ip, data, cache = null, ctx = null) {
  if (RATE_LIMIT_CONFIG.useCacheAPI && cache) {
    try {
      const cacheKey = getRateLimitCacheKey(ip);
      const response = new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // Store in cache with TTL equal to window duration
      const cacheRequest = new Request(cacheKey);
      if (ctx) {
        ctx.waitUntil(cache.put(cacheRequest, response));
      } else {
        await cache.put(cacheRequest, response);
      }
    } catch (error) {
      console.warn('Error storing rate limit in cache:', error);
      // Fall back to in-memory
      inMemoryRateLimits.set(ip, data);
    }
  } else {
    // Store in memory
    inMemoryRateLimits.set(ip, data);
  }
}

/**
 * Checks if rate limiting should be applied to a request
 * @param {Request} request - The incoming request
 * @param {string} pathname - Request pathname
 * @returns {boolean} True if rate limiting should be applied
 */
export function shouldApplyRateLimit(request, pathname) {
  if (!RATE_LIMITING_ENABLED) {
    return false;
  }

  // Check if path is disabled
  for (const disabledPath of RATE_LIMIT_CONFIG.disabledForPaths) {
    if (pathname.startsWith(disabledPath)) {
      return false;
    }
  }

  // Check if path is enabled (if enabledForPaths is not empty)
  if (RATE_LIMIT_CONFIG.enabledForPaths.length > 0) {
    let isEnabled = false;
    for (const enabledPath of RATE_LIMIT_CONFIG.enabledForPaths) {
      if (pathname.startsWith(enabledPath)) {
        isEnabled = true;
        break;
      }
    }
    if (!isEnabled) {
      return false;
    }
  }

  // Check custom function
  if (typeof RATE_LIMIT_CONFIG.shouldRateLimit === 'function') {
    if (!RATE_LIMIT_CONFIG.shouldRateLimit(request, pathname)) {
      return false;
    }
  }

  return true;
}

/**
 * Checks rate limit for an IP address
 * @param {string} ip - IP address
 * @param {Cache} cache - Cache instance (optional)
 * @returns {Promise<Object>} Rate limit check result
 */
export async function checkRateLimit(ip, cache = null) {
  const now = Date.now();
  const windowMs = RATE_LIMIT_CONFIG.windowSeconds * 1000;
  const maxRequests = RATE_LIMIT_CONFIG.maxRequests;

  // Get current rate limit data
  const rateLimitData = await getRateLimitData(ip, cache);

  if (!rateLimitData) {
    // First request from this IP
    const newData = {
      count: 1,
      resetTime: now + windowMs,
      firstRequestTime: now,
    };
    await setRateLimitData(ip, newData, cache);
    
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: newData.resetTime,
      retryAfter: null,
    };
  }

  // Check if window has expired
  if (now >= rateLimitData.resetTime) {
    // Reset window
    const newData = {
      count: 1,
      resetTime: now + windowMs,
      firstRequestTime: now,
    };
    await setRateLimitData(ip, newData, cache);
    
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: newData.resetTime,
      retryAfter: null,
    };
  }

  // Check if limit exceeded
  if (rateLimitData.count >= maxRequests) {
    const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: rateLimitData.resetTime,
      retryAfter: retryAfter,
    };
  }

  // Increment count
  rateLimitData.count += 1;
  await setRateLimitData(ip, rateLimitData, cache);
  
  return {
    allowed: true,
    remaining: maxRequests - rateLimitData.count,
    resetTime: rateLimitData.resetTime,
    retryAfter: null,
  };
}

/**
 * Gets rate limit information for a request (without incrementing counter)
 * @param {Request} request - The incoming request
 * @param {Cache} cache - Cache instance (optional)
 * @returns {Promise<Object>} Rate limit information
 */
export async function getRateLimitInfo(request, cache = null) {
  const ip = getClientIP(request);
  const now = Date.now();
  const windowMs = RATE_LIMIT_CONFIG.windowSeconds * 1000;
  const maxRequests = RATE_LIMIT_CONFIG.maxRequests;

  // Get current rate limit data (without incrementing)
  const rateLimitData = await getRateLimitData(ip, cache);

  if (!rateLimitData) {
    return {
      allowed: true,
      remaining: maxRequests,
      resetTime: now + windowMs,
      retryAfter: null,
    };
  }

  // Check if window has expired
  if (now >= rateLimitData.resetTime) {
    return {
      allowed: true,
      remaining: maxRequests,
      resetTime: now + windowMs,
      retryAfter: null,
    };
  }

  // Return current state
  const remaining = Math.max(0, maxRequests - rateLimitData.count);
  const retryAfter = rateLimitData.count >= maxRequests 
    ? Math.ceil((rateLimitData.resetTime - now) / 1000)
    : null;

  return {
    allowed: rateLimitData.count < maxRequests,
    remaining: remaining,
    resetTime: rateLimitData.resetTime,
    retryAfter: retryAfter,
  };
}

/**
 * Creates a 429 Too Many Requests response
 * @param {number} retryAfter - Seconds until retry is allowed
 * @returns {Response} 429 response
 */
export function createRateLimitResponse(retryAfter) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Retry-After': retryAfter.toString(),
    'X-RateLimit-Limit': RATE_LIMIT_CONFIG.maxRequests.toString(),
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': new Date(Date.now() + retryAfter * 1000).toISOString(),
  });

  const body = JSON.stringify({
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Maximum ${RATE_LIMIT_CONFIG.maxRequests} requests per ${RATE_LIMIT_CONFIG.windowSeconds} seconds.`,
    retryAfter: retryAfter,
  });

  return new Response(body, {
    status: 429,
    statusText: 'Too Many Requests',
    headers: headers,
  });
}

/**
 * Adds rate limit headers to response
 * @param {Headers} headers - Response headers
 * @param {Object} rateLimitInfo - Rate limit information
 */
export function addRateLimitHeaders(headers, rateLimitInfo) {
  headers.set('X-RateLimit-Limit', RATE_LIMIT_CONFIG.maxRequests.toString());
  headers.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
  headers.set('X-RateLimit-Reset', new Date(rateLimitInfo.resetTime).toISOString());
  
  if (rateLimitInfo.retryAfter !== null) {
    headers.set('Retry-After', rateLimitInfo.retryAfter.toString());
  }
}

