/**
 * Analytics Handler
 * 
 * Provides endpoints to view SmartCDN usage statistics and analytics
 */

import { getCacheStatistics, getAnalyticsData } from '../utils/cache-tracking.js';
import { getLogStatistics } from '../utils/logging.js';

/**
 * Handle analytics requests
 * @param {Request} request - The incoming request
 * @param {URL} url - Parsed URL object
 * @returns {Response} Analytics response
 */
export async function handleAnalytics(request, url) {
  const pathname = url.pathname;
  
  // Check for authentication if needed (add your own auth logic)
  // For now, we'll allow access to analytics endpoints
  
  if (pathname === '/__analytics' || pathname === '/__analytics/') {
    return handleAnalyticsSummary();
  }
  
  if (pathname === '/__analytics/detailed' || pathname === '/__analytics/detailed/') {
    return handleAnalyticsDetailed();
  }
  
  if (pathname === '/__analytics/cache' || pathname === '/__analytics/cache/') {
    return handleCacheAnalytics();
  }
  
  if (pathname === '/__analytics/logs' || pathname === '/__analytics/logs/') {
    return handleLogAnalytics();
  }
  
  return new Response('Analytics endpoint not found', { status: 404 });
}

/**
 * Get analytics summary
 */
function handleAnalyticsSummary() {
  const cacheStats = getCacheStatistics();
  const logStats = getLogStatistics();
  
  const summary = {
    timestamp: new Date().toISOString(),
    cache: {
      summary: cacheStats.summary,
      hitRate: cacheStats.summary.hitRate,
      missRate: cacheStats.summary.missRate,
      bypassRate: cacheStats.summary.bypassRate,
    },
    logs: logStats,
    recentRequests: cacheStats.recentRequests.length,
  };
  
  return new Response(JSON.stringify(summary, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Get detailed analytics
 */
function handleAnalyticsDetailed() {
  const analyticsData = getAnalyticsData();
  
  return new Response(JSON.stringify(analyticsData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Get cache-specific analytics
 */
function handleCacheAnalytics() {
  const cacheStats = getCacheStatistics();
  
  const response = {
    timestamp: new Date().toISOString(),
    ...cacheStats,
  };
  
  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Get log statistics
 */
function handleLogAnalytics() {
  const logStats = getLogStatistics();
  
  const response = {
    timestamp: new Date().toISOString(),
    ...logStats,
  };
  
  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

