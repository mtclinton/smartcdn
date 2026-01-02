/**
 * HTTP Method Handlers
 * 
 * Handlers for different HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
 */

import { generateCacheKey, handleConditionalRequest, applyCacheHeaders, getCacheTTL } from '../utils/cache.js';
import { getContentType } from '../utils/request.js';
import { isImagePath } from '../utils/image.js';
import { addDeviceHeaders, addImageHeaders, addABTestHeaders, addGeoRoutingHeaders, addRegionContentHeaders, addTimingHeaders, getNegotiatedContentType } from '../utils/headers.js';
import { setTestVariantCookie } from '../utils/variants.js';
import { buildOriginUrl } from '../utils/geo-routing.js';
import { createTimingTracker, formatTiming } from '../utils/timing.js';
import { isRequestCacheable, isResponseCacheable, determineCacheStatus, recordCacheEvent } from '../utils/cache-tracking.js';
import { logRequest } from '../utils/logging.js';
import { shouldBypassCache, getBypassReason } from '../utils/cache-bypass.js';
import { 
  shouldUseStaleWhileRevalidate, 
  isCachedResponseStale, 
  canServeStaleContent, 
  getCacheFreshnessStatus,
  revalidateCacheInBackground,
  buildRevalidationUrl,
  addSWRHeaders,
} from '../utils/stale-while-revalidate.js';
import { getRateLimitInfo, addRateLimitHeaders } from '../utils/rate-limiting.js';

/**
 * Handles GET requests with caching, A/B testing, and image optimization
 */
export async function handleGET(request, url, imageUrl, deviceInfo, imageOptParams, testInfo, routingInfo, formatNegotiation, resizeParams, shouldResize, geoRoutingInfo, regionContentInfo, ctx) {
  // Create timing tracker for this request
  const timing = createTimingTracker();

  // Check if request is cacheable
  const requestCacheable = isRequestCacheable(request, 'GET');

  // Check if cache should be bypassed
  const bypassInfo = shouldBypassCache(request);
  const shouldBypass = bypassInfo !== null;

  const cache = caches.default;
  const finalUrl = imageUrl; // imageUrl is the final URL after all transformations
  let cacheKey = generateCacheKey(request, finalUrl);

  // Add test ID, variant, format, resize params, geographic routing, and region content to cache key
  const enhancedCacheKeyUrl = new URL(cacheKey.url);
  if (testInfo) {
    enhancedCacheKeyUrl.searchParams.set('_test', testInfo.testId);
    enhancedCacheKeyUrl.searchParams.set('_variant', testInfo.variant);
  }
  if (formatNegotiation && formatNegotiation.shouldTransform) {
    enhancedCacheKeyUrl.searchParams.set('_format', formatNegotiation.bestFormat);
  }
  if (resizeParams) {
    if (resizeParams.width) enhancedCacheKeyUrl.searchParams.set('_width', resizeParams.width.toString());
    if (resizeParams.height) enhancedCacheKeyUrl.searchParams.set('_height', resizeParams.height.toString());
    if (resizeParams.quality !== null) enhancedCacheKeyUrl.searchParams.set('_quality', resizeParams.quality.toString());
  }
  // Add geographic routing to cache key to ensure different regions get different cache entries
  if (geoRoutingInfo && geoRoutingInfo.enabled) {
    enhancedCacheKeyUrl.searchParams.set('_geo_region', geoRoutingInfo.region);
  }
  // Add region-specific content to cache key
  if (regionContentInfo && regionContentInfo.enabled) {
    enhancedCacheKeyUrl.searchParams.set('_region_content', regionContentInfo.mappingId);
    enhancedCacheKeyUrl.searchParams.set('_region_content_path', regionContentInfo.contentPath);
  }
  cacheKey = new Request(enhancedCacheKeyUrl.toString(), {
    method: request.method,
    headers: request.headers,
  });

  // Check cache with timing (only if request is cacheable and not bypassed)
  let cachedResponse = null;
  if (requestCacheable && !shouldBypass) {
    timing.startCacheLookup();
    cachedResponse = await cache.match(cacheKey);
    timing.endCacheLookup();
  } else if (shouldBypass) {
    console.log(`Cache BYPASS: ${getBypassReason(bypassInfo)}`);
  }
  
  if (cachedResponse) {
    const cacheLookupTime = timing.getCacheLookupTime();
    
    // Check if we should use stale-while-revalidate
    const useSWR = shouldUseStaleWhileRevalidate(request, url.pathname);
    const freshnessStatus = useSWR ? getCacheFreshnessStatus(cachedResponse) : 'fresh';
    const isStale = useSWR && isCachedResponseStale(cachedResponse);
    const canServeStale = useSWR && canServeStaleContent(cachedResponse);
    
    // If stale but can serve stale content, serve it and revalidate in background
    if (isStale && canServeStale) {
      console.log(`Cache HIT (STALE) for: ${url.pathname} (lookup: ${formatTiming(cacheLookupTime)}ms) - serving stale, revalidating in background`);
      
      // Trigger background revalidation
      const revalidationUrl = buildRevalidationUrl(finalUrl, geoRoutingInfo);
      ctx.waitUntil(
        revalidateCacheInBackground(request, revalidationUrl, cacheKey, cache, geoRoutingInfo)
      );
      
      timing.endTotal();
      const metrics = timing.getMetrics();
      console.log('Timing Metrics:', JSON.stringify(metrics, null, 2));
      
      // Track cache event
      const responseCacheable = isResponseCacheable(cachedResponse);
      const cacheStatus = determineCacheStatus(true, requestCacheable, responseCacheable);
      recordCacheEvent({
        status: cacheStatus,
        path: url.pathname,
        method: 'GET',
        statusCode: cachedResponse.status,
        country: geoRoutingInfo?.country || null,
        region: geoRoutingInfo?.region || null,
        cacheLookupTime: timing.getCacheLookupTime(),
        originFetchTime: null,
        totalTime: timing.getTotalTime(),
      });
      
      const response = buildCachedResponse(cachedResponse, deviceInfo, imageOptParams, testInfo, formatNegotiation, resizeParams, shouldResize, url.pathname, request, geoRoutingInfo, regionContentInfo, timing, false, cacheStatus);
      
      // Add SWR headers
      addSWRHeaders(response.headers, freshnessStatus, true);
      
      // Structured logging for stale cache hit
      logRequest({
        requestUrl: url.href,
        method: 'GET',
        country: geoRoutingInfo?.country || null,
        deviceType: deviceInfo.deviceType,
        abTestVariant: testInfo?.variant || null,
        cacheStatus: cacheStatus,
        responseTime: timing.getTotalTime(),
        statusCode: response.status,
        additionalData: {
          path: url.pathname,
          region: geoRoutingInfo?.region || null,
          cacheLookupTime: timing.getCacheLookupTime(),
          originFetchTime: null,
          testId: testInfo?.testId || null,
          regionContent: regionContentInfo?.enabled ? {
            mappingId: regionContentInfo.mappingId,
            originalPath: regionContentInfo.originalPath,
            contentPath: regionContentInfo.contentPath,
          } : null,
          staleWhileRevalidate: {
            enabled: true,
            freshnessStatus: freshnessStatus,
            revalidating: true,
          },
        },
      });
      
      return response;
    } else if (!isStale) {
      // Fresh cache hit
      console.log(`Cache HIT (FRESH) for: ${url.pathname} (lookup: ${formatTiming(cacheLookupTime)}ms)`);
      
      timing.endTotal();
      const metrics = timing.getMetrics();
      console.log('Timing Metrics:', JSON.stringify(metrics, null, 2));
      
      // Track cache event
      const responseCacheable = isResponseCacheable(cachedResponse);
      const cacheStatus = determineCacheStatus(true, requestCacheable, responseCacheable);
      recordCacheEvent({
        status: cacheStatus,
        path: url.pathname,
        method: 'GET',
        statusCode: cachedResponse.status,
        country: geoRoutingInfo?.country || null,
        region: geoRoutingInfo?.region || null,
        cacheLookupTime: timing.getCacheLookupTime(),
        originFetchTime: null,
        totalTime: timing.getTotalTime(),
      });
      
      const response = buildCachedResponse(cachedResponse, deviceInfo, imageOptParams, testInfo, formatNegotiation, resizeParams, shouldResize, url.pathname, request, geoRoutingInfo, regionContentInfo, timing, false, cacheStatus);
      
      // Add SWR headers (fresh content)
      if (useSWR) {
        addSWRHeaders(response.headers, freshnessStatus, false);
      }
      
      // Add rate limit headers
      const freshRateLimitInfo = await getRateLimitInfo(request, cache);
      addRateLimitHeaders(response.headers, freshRateLimitInfo);
      
      // Structured logging for cache hit
      logRequest({
        requestUrl: url.href,
        method: 'GET',
        country: geoRoutingInfo?.country || null,
        deviceType: deviceInfo.deviceType,
        abTestVariant: testInfo?.variant || null,
        cacheStatus: cacheStatus,
        responseTime: timing.getTotalTime(),
        statusCode: response.status,
        additionalData: {
          path: url.pathname,
          region: geoRoutingInfo?.region || null,
          cacheLookupTime: timing.getCacheLookupTime(),
          originFetchTime: null,
          testId: testInfo?.testId || null,
          regionContent: regionContentInfo?.enabled ? {
            mappingId: regionContentInfo.mappingId,
            originalPath: regionContentInfo.originalPath,
            contentPath: regionContentInfo.contentPath,
          } : null,
        },
      });
      
      return response;
    }
    // If stale and expired, fall through to fetch fresh content
    console.log(`Cache HIT (EXPIRED) for: ${url.pathname} - fetching fresh content`);
  }

  const cacheLookupTime = timing.getCacheLookupTime();
  console.log(`Cache MISS for: ${url.pathname} (lookup: ${formatTiming(cacheLookupTime)}ms)`);

  // Fetch from geographic origin with timing
  let originResponse = null;
  let originUrl = null;
  
  timing.startOriginFetch();
  
  if (geoRoutingInfo && geoRoutingInfo.enabled) {
    // Build origin URL using geographic routing
    // finalUrl already includes region-specific content path if applicable
    originUrl = buildOriginUrl(finalUrl, geoRoutingInfo.origin);
    let logMessage = `Fetching from geographic origin: ${originUrl.href} (region: ${geoRoutingInfo.region}, country: ${geoRoutingInfo.country || 'unknown'})`;
    if (regionContentInfo && regionContentInfo.enabled) {
      logMessage += ` [Region-specific content: ${regionContentInfo.originalPath} -> ${regionContentInfo.contentPath}]`;
    }
    console.log(logMessage);
    
    try {
      // Create a new request to the origin, preserving method and headers
      const originRequest = new Request(originUrl.href, {
        method: request.method,
        headers: request.headers,
      });
      originResponse = await fetch(originRequest);
      timing.endOriginFetch();
      const originFetchTime = timing.getOriginFetchTime();
      console.log(`Origin response status: ${originResponse.status} (fetch: ${formatTiming(originFetchTime)}ms)`);
    } catch (error) {
      timing.endOriginFetch();
      const originFetchTime = timing.getOriginFetchTime();
      console.error(`Error fetching from geographic origin: ${error.message} (fetch: ${formatTiming(originFetchTime)}ms)`);
      // Continue with null originResponse - will use default response
    }
  } else if (finalUrl.href !== url.href) {
    // Fallback: if A/B test routing changed the URL, use that
    console.log(`Fetching from A/B test origin: ${finalUrl.href} (original: ${url.href})`);
    try {
      originResponse = await fetch(finalUrl.href, request);
      timing.endOriginFetch();
      const originFetchTime = timing.getOriginFetchTime();
      console.log(`Origin response status: ${originResponse.status} (fetch: ${formatTiming(originFetchTime)}ms)`);
    } catch (error) {
      timing.endOriginFetch();
      const originFetchTime = timing.getOriginFetchTime();
      console.error(`Error fetching from A/B test origin: ${error.message} (fetch: ${formatTiming(originFetchTime)}ms)`);
    }
  } else {
    // No origin fetch needed
    timing.endOriginFetch();
  }

  // Build response
  let contentType = getNegotiatedContentType(finalUrl.pathname, formatNegotiation) || getContentType(finalUrl.pathname);
  const responseHeaders = new Headers({
    'Content-Type': contentType,
    'X-Request-Method': 'GET',
  });

  // Add all headers
  addDeviceHeaders(responseHeaders, deviceInfo);
  addImageHeaders(responseHeaders, url.pathname, imageOptParams, formatNegotiation, resizeParams, shouldResize);
  addABTestHeaders(responseHeaders, testInfo, routingInfo);
  addGeoRoutingHeaders(responseHeaders, geoRoutingInfo);
  addRegionContentHeaders(responseHeaders, regionContentInfo);

  // Use origin response body if available, otherwise use default
  let responseBody = "Hello from SmartCDN - GET request";
  let responseStatus = 200;
  
  if (originResponse) {
    responseStatus = originResponse.status;
    responseBody = await originResponse.clone().text();
  }

  // Apply cache headers
  applyCacheHeaders(originResponse, finalUrl.pathname, responseHeaders);

  const ttlSeconds = getCacheTTL(finalUrl.pathname);
  console.log(`Cache TTL: ${ttlSeconds} seconds (${Math.round(ttlSeconds / 60)} minutes)`);

  let response = new Response(responseBody, {
    status: responseStatus,
    headers: responseHeaders,
  });

  // Set cookie if needed
  if (testInfo && testInfo.isNewAssignment) {
    response = setTestVariantCookie(response, testInfo.testId, testInfo.variant);
  }

  // Check conditional request
  const conditionalCheck = handleConditionalRequest(request, response);
  if (conditionalCheck) {
    console.log('Conditional request validated - returning 304 Not Modified');
    if (testInfo && testInfo.isNewAssignment) {
      return setTestVariantCookie(conditionalCheck, testInfo.testId, testInfo.variant);
    }
    return conditionalCheck;
  }

  // Cache the response (only if both request and response are cacheable and not bypassed)
  const responseCacheable = isResponseCacheable(response);
  if (requestCacheable && responseCacheable && !shouldBypass) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }
  
  // End timing
  timing.endTotal();
  const metrics = timing.getMetrics();
  console.log('Timing Metrics:', JSON.stringify(metrics, null, 2));
  
  // Track cache event
  // If bypassed, treat as BYPASS status
  const wasCached = cachedResponse !== null;
  let cacheStatus;
  if (shouldBypass) {
    cacheStatus = 'BYPASS';
  } else {
    cacheStatus = determineCacheStatus(wasCached, requestCacheable, responseCacheable);
  }
  
  recordCacheEvent({
    status: cacheStatus,
    path: url.pathname,
    method: 'GET',
    statusCode: response.status,
    country: geoRoutingInfo?.country || null,
    region: geoRoutingInfo?.region || null,
    cacheLookupTime: timing.getCacheLookupTime(),
    originFetchTime: timing.getOriginFetchTime(),
    totalTime: timing.getTotalTime(),
  });
  
  const cacheStatusMessage = shouldBypass 
    ? `Cache Status: ${cacheStatus} (bypassed: ${getBypassReason(bypassInfo)})`
    : `Cache Status: ${cacheStatus} (request cacheable: ${requestCacheable}, response cacheable: ${responseCacheable})`;
  console.log(cacheStatusMessage);
  
  // Add timing headers with cache status
  addTimingHeaders(response.headers, timing, cacheStatus);
  
  // Add SWR headers if applicable (for fresh responses)
  if (!shouldBypass && shouldUseStaleWhileRevalidate(request, url.pathname)) {
    addSWRHeaders(response.headers, 'fresh', false);
  }
  
  // Add bypass header if applicable
  if (shouldBypass && bypassInfo) {
    response.headers.set('X-Cache-Bypass', 'true');
    response.headers.set('X-Cache-Bypass-Reason', bypassInfo.reason);
    response.headers.set('X-Cache-Bypass-Rule', bypassInfo.matchedRule);
  }
  
  // Structured logging
  logRequest({
    requestUrl: url.href,
    method: 'GET',
    country: geoRoutingInfo?.country || null,
    deviceType: deviceInfo.deviceType,
    abTestVariant: testInfo?.variant || null,
    cacheStatus: cacheStatus,
    responseTime: timing.getTotalTime(),
    statusCode: response.status,
    additionalData: {
      path: url.pathname,
      region: geoRoutingInfo?.region || null,
      cacheLookupTime: timing.getCacheLookupTime(),
      originFetchTime: timing.getOriginFetchTime(),
      testId: testInfo?.testId || null,
      regionContent: regionContentInfo?.enabled ? {
        mappingId: regionContentInfo.mappingId,
        originalPath: regionContentInfo.originalPath,
        contentPath: regionContentInfo.contentPath,
      } : null,
      cacheBypass: shouldBypass ? {
        reason: bypassInfo.reason,
        matchedRule: bypassInfo.matchedRule,
        description: bypassInfo.description,
      } : null,
    },
  });
  
  return response;
}

/**
 * Handles HEAD requests (similar to GET but no body)
 */
export async function handleHEAD(request, url, imageUrl, deviceInfo, imageOptParams, testInfo, routingInfo, formatNegotiation, resizeParams, shouldResize, geoRoutingInfo, regionContentInfo, ctx) {
  // Create timing tracker for this request
  const headTiming = createTimingTracker();

  // Check if request is cacheable
  const headRequestCacheable = isRequestCacheable(request, 'HEAD');

  const headCache = caches.default;
  const headFinalUrl = imageUrl;
  let headCacheKey = generateCacheKey(request, headFinalUrl);

  // Add metadata to cache key
  const headEnhancedCacheKeyUrl = new URL(headCacheKey.url);
  if (testInfo) {
    headEnhancedCacheKeyUrl.searchParams.set('_test', testInfo.testId);
    headEnhancedCacheKeyUrl.searchParams.set('_variant', testInfo.variant);
  }
  if (formatNegotiation && formatNegotiation.shouldTransform) {
    headEnhancedCacheKeyUrl.searchParams.set('_format', formatNegotiation.bestFormat);
  }
  if (resizeParams) {
    if (resizeParams.width) headEnhancedCacheKeyUrl.searchParams.set('_width', resizeParams.width.toString());
    if (resizeParams.height) headEnhancedCacheKeyUrl.searchParams.set('_height', resizeParams.height.toString());
    if (resizeParams.quality !== null) headEnhancedCacheKeyUrl.searchParams.set('_quality', resizeParams.quality.toString());
  }
  // Add geographic routing to cache key
  if (geoRoutingInfo && geoRoutingInfo.enabled) {
    headEnhancedCacheKeyUrl.searchParams.set('_geo_region', geoRoutingInfo.region);
  }
  // Add region-specific content to cache key
  if (regionContentInfo && regionContentInfo.enabled) {
    headEnhancedCacheKeyUrl.searchParams.set('_region_content', regionContentInfo.mappingId);
    headEnhancedCacheKeyUrl.searchParams.set('_region_content_path', regionContentInfo.contentPath);
  }
  headCacheKey = new Request(headEnhancedCacheKeyUrl.toString(), {
    method: request.method,
    headers: request.headers,
  });

  // Check cache with timing (only if request is cacheable and not bypassed)
  let cachedHeadResponse = null;
  if (headRequestCacheable && !headShouldBypass) {
    headTiming.startCacheLookup();
    cachedHeadResponse = await headCache.match(headCacheKey);
    headTiming.endCacheLookup();
  } else if (headShouldBypass) {
    console.log(`Cache BYPASS (HEAD): ${getBypassReason(headBypassInfo)}`);
  }
  
  if (cachedHeadResponse) {
    // Check if we should use stale-while-revalidate
    const headUseSWR = shouldUseStaleWhileRevalidate(request, url.pathname);
    const headFreshnessStatus = headUseSWR ? getCacheFreshnessStatus(cachedHeadResponse) : 'fresh';
    const headIsStale = headUseSWR && isCachedResponseStale(cachedHeadResponse);
    const headCanServeStale = headUseSWR && canServeStaleContent(cachedHeadResponse);
    
    // If stale but can serve stale content, serve it and revalidate in background
    if (headIsStale && headCanServeStale) {
      console.log(`Cache HIT (STALE) (HEAD) for: ${url.pathname} - serving stale, revalidating in background`);
      
      // Trigger background revalidation
      const headRevalidationUrl = buildRevalidationUrl(headFinalUrl, geoRoutingInfo);
      ctx.waitUntil(
        revalidateCacheInBackground(request, headRevalidationUrl, headCacheKey, headCache, geoRoutingInfo)
      );
      
      // Track cache event
      const headResponseCacheable = isResponseCacheable(cachedHeadResponse);
      const headCacheStatus = determineCacheStatus(true, headRequestCacheable, headResponseCacheable);
      recordCacheEvent({
        status: headCacheStatus,
        path: url.pathname,
        method: 'HEAD',
        statusCode: cachedHeadResponse.status,
        country: geoRoutingInfo?.country || null,
        region: geoRoutingInfo?.region || null,
        cacheLookupTime: headTiming.getCacheLookupTime(),
        originFetchTime: null,
        totalTime: headTiming.getTotalTime(),
      });
      
      const response = buildCachedResponse(cachedHeadResponse, deviceInfo, imageOptParams, testInfo, formatNegotiation, resizeParams, shouldResize, url.pathname, request, geoRoutingInfo, regionContentInfo, headTiming, true, headCacheStatus);
      
      // Add SWR headers
      addSWRHeaders(response.headers, headFreshnessStatus, true);
      
      // Add rate limit headers
      const headStaleRateLimitInfo = await getRateLimitInfo(request, headCache);
      addRateLimitHeaders(response.headers, headStaleRateLimitInfo);
      
      return response;
    } else if (!headIsStale) {
      // Fresh cache hit
    const cacheLookupTime = headTiming.getCacheLookupTime();
    console.log(`Cache HIT (HEAD) for: ${url.pathname} (lookup: ${formatTiming(cacheLookupTime)}ms)`);
    
    headTiming.endTotal();
    const metrics = headTiming.getMetrics();
    console.log('Timing Metrics (HEAD):', JSON.stringify(metrics, null, 2));
    
    // Track cache event
    const headResponseCacheable = isResponseCacheable(cachedHeadResponse);
    const headCacheStatus = determineCacheStatus(true, headRequestCacheable, headResponseCacheable);
    recordCacheEvent({
      status: headCacheStatus,
      path: url.pathname,
      method: 'HEAD',
      statusCode: cachedHeadResponse.status,
      country: geoRoutingInfo?.country || null,
      region: geoRoutingInfo?.region || null,
      cacheLookupTime: headTiming.getCacheLookupTime(),
      originFetchTime: null,
      totalTime: headTiming.getTotalTime(),
    });
    
    const response = buildCachedResponse(cachedHeadResponse, deviceInfo, imageOptParams, testInfo, formatNegotiation, resizeParams, shouldResize, url.pathname, request, geoRoutingInfo, regionContentInfo, headTiming, true, headCacheStatus);
    return response;
  }

  const cacheLookupTime = headTiming.getCacheLookupTime();
  console.log(`Cache MISS (HEAD) for: ${url.pathname} (lookup: ${formatTiming(cacheLookupTime)}ms)`);

  // Fetch from geographic origin (HEAD request) with timing
  let headOriginResponse = null;
  
  headTiming.startOriginFetch();
  
  if (geoRoutingInfo && geoRoutingInfo.enabled) {
    const headOriginUrl = buildOriginUrl(headFinalUrl, geoRoutingInfo.origin);
    console.log(`Fetching HEAD from geographic origin: ${headOriginUrl.href} (region: ${geoRoutingInfo.region})`);
    
    try {
      const headOriginRequest = new Request(headOriginUrl.href, {
        method: 'HEAD',
        headers: request.headers,
      });
      headOriginResponse = await fetch(headOriginRequest);
      headTiming.endOriginFetch();
      const originFetchTime = headTiming.getOriginFetchTime();
      console.log(`Origin HEAD response status: ${headOriginResponse.status} (fetch: ${formatTiming(originFetchTime)}ms)`);
    } catch (error) {
      headTiming.endOriginFetch();
      const originFetchTime = headTiming.getOriginFetchTime();
      console.error(`Error fetching HEAD from geographic origin: ${error.message} (fetch: ${formatTiming(originFetchTime)}ms)`);
    }
  } else {
    // No origin fetch needed
    headTiming.endOriginFetch();
  }

  // Build response headers
  let headContentType = getNegotiatedContentType(headFinalUrl.pathname, formatNegotiation) || getContentType(headFinalUrl.pathname);
  const headResponseHeaders = new Headers({
    'Content-Type': headContentType,
    'X-Request-Method': 'HEAD',
  });

  addDeviceHeaders(headResponseHeaders, deviceInfo);
  addImageHeaders(headResponseHeaders, url.pathname, imageOptParams, formatNegotiation, resizeParams, shouldResize);
  addABTestHeaders(headResponseHeaders, testInfo, routingInfo);
  addGeoRoutingHeaders(headResponseHeaders, geoRoutingInfo);
  addRegionContentHeaders(headResponseHeaders, regionContentInfo);

  applyCacheHeaders(headOriginResponse, headFinalUrl.pathname, headResponseHeaders);

  let headResponseStatus = 200;
  if (headOriginResponse) {
    headResponseStatus = headOriginResponse.status;
    // Copy relevant headers from origin response
    headOriginResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-length' && key.toLowerCase() !== 'transfer-encoding') {
        headResponseHeaders.set(key, value);
      }
    });
  }

  let headResponse = new Response(null, {
    status: headResponseStatus,
    headers: headResponseHeaders,
  });

  if (testInfo && testInfo.isNewAssignment) {
    headResponse = setTestVariantCookie(headResponse, testInfo.testId, testInfo.variant);
  }

  const headConditionalCheck = handleConditionalRequest(request, headResponse);
  if (headConditionalCheck) {
    console.log('Conditional request validated (HEAD) - returning 304 Not Modified');
    if (testInfo && testInfo.isNewAssignment) {
      return setTestVariantCookie(headConditionalCheck, testInfo.testId, testInfo.variant);
    }
    return headConditionalCheck;
  }

  // Cache the response (only if both request and response are cacheable and not bypassed)
  const headResponseCacheable = isResponseCacheable(headResponse);
  if (headRequestCacheable && headResponseCacheable && !headShouldBypass) {
    ctx.waitUntil(headCache.put(headCacheKey, headResponse.clone()));
  }
  
  // End timing
  headTiming.endTotal();
  const metrics = headTiming.getMetrics();
  console.log('Timing Metrics (HEAD):', JSON.stringify(metrics, null, 2));
  
  // Track cache event
  // If bypassed, treat as BYPASS status
  const headWasCached = cachedHeadResponse !== null;
  let headCacheStatus;
  if (headShouldBypass) {
    headCacheStatus = 'BYPASS';
  } else {
    headCacheStatus = determineCacheStatus(headWasCached, headRequestCacheable, headResponseCacheable);
  }
  
  recordCacheEvent({
    status: headCacheStatus,
    path: url.pathname,
    method: 'HEAD',
    statusCode: headResponse.status,
    country: geoRoutingInfo?.country || null,
    region: geoRoutingInfo?.region || null,
    cacheLookupTime: headTiming.getCacheLookupTime(),
    originFetchTime: headTiming.getOriginFetchTime(),
    totalTime: headTiming.getTotalTime(),
  });
  
  const headCacheStatusMessage = headShouldBypass
    ? `Cache Status (HEAD): ${headCacheStatus} (bypassed: ${getBypassReason(headBypassInfo)})`
    : `Cache Status (HEAD): ${headCacheStatus} (request cacheable: ${headRequestCacheable}, response cacheable: ${headResponseCacheable})`;
  console.log(headCacheStatusMessage);
  
  // Add timing headers with cache status
  addTimingHeaders(headResponse.headers, headTiming, headCacheStatus);
  
  // Add SWR headers if applicable (for fresh responses)
  if (!headShouldBypass && shouldUseStaleWhileRevalidate(request, url.pathname)) {
    addSWRHeaders(headResponse.headers, 'fresh', false);
  }
  
  // Add rate limit headers
  const headRateLimitInfo = await getRateLimitInfo(request, headCache);
  addRateLimitHeaders(headResponse.headers, headRateLimitInfo);
  
  // Add bypass header if applicable
  if (headShouldBypass && headBypassInfo) {
    headResponse.headers.set('X-Cache-Bypass', 'true');
    headResponse.headers.set('X-Cache-Bypass-Reason', headBypassInfo.reason);
    headResponse.headers.set('X-Cache-Bypass-Rule', headBypassInfo.matchedRule);
  }
  
  // Structured logging
  logRequest({
    requestUrl: url.href,
    method: 'HEAD',
    country: geoRoutingInfo?.country || null,
    deviceType: deviceInfo.deviceType,
    abTestVariant: testInfo?.variant || null,
    cacheStatus: headCacheStatus,
    responseTime: headTiming.getTotalTime(),
    statusCode: headResponse.status,
    additionalData: {
      path: url.pathname,
      region: geoRoutingInfo?.region || null,
      cacheLookupTime: headTiming.getCacheLookupTime(),
      originFetchTime: headTiming.getOriginFetchTime(),
      testId: testInfo?.testId || null,
      cacheBypass: headShouldBypass ? {
        reason: headBypassInfo.reason,
        matchedRule: headBypassInfo.matchedRule,
        description: headBypassInfo.description,
      } : null,
    },
  });
  
  return headResponse;
}

/**
 * Handles POST requests
 */
export async function handlePOST(request, deviceInfo, testInfo) {
  // Try to read request body
  try {
    const body = await request.text();
    if (body) {
      console.log('Request Body:', body);
    }
  } catch (e) {
    console.warn('Could not read request body:', e.message);
  }

  const postHeaders = new Headers({
    "Content-Type": "text/plain",
    "X-Request-Method": "POST",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  });

  addDeviceHeaders(postHeaders, deviceInfo);
  addABTestHeaders(postHeaders, testInfo);

  let postResponse = new Response("Hello from SmartCDN - POST request received", {
    status: 201,
    headers: postHeaders,
  });

  if (testInfo && testInfo.isNewAssignment) {
    postResponse = setTestVariantCookie(postResponse, testInfo.testId, testInfo.variant);
  }

  // Track cache event (POST requests are always BYPASS)
  const url = new URL(request.url);
  recordCacheEvent({
    status: 'BYPASS',
    path: url.pathname,
    method: 'POST',
    statusCode: postResponse.status,
    country: null,
    region: null,
    cacheLookupTime: null,
    originFetchTime: null,
    totalTime: null,
  });

  return postResponse;
}

/**
 * Handles PUT requests
 */
export function handlePUT(request, deviceInfo, testInfo) {
  const putHeaders = new Headers({
    "Content-Type": "text/plain",
    "X-Request-Method": "PUT",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  });

  addDeviceHeaders(putHeaders, deviceInfo);
  addABTestHeaders(putHeaders, testInfo);

  let putResponse = new Response("Hello from SmartCDN - PUT request received", {
    status: 200,
    headers: putHeaders,
  });

  if (testInfo && testInfo.isNewAssignment) {
    putResponse = setTestVariantCookie(putResponse, testInfo.testId, testInfo.variant);
  }

  // Track cache event (PUT requests are always BYPASS)
  const url = new URL(request.url);
  recordCacheEvent({
    status: 'BYPASS',
    path: url.pathname,
    method: 'PUT',
    statusCode: putResponse.status,
    country: null,
    region: null,
    cacheLookupTime: null,
    originFetchTime: null,
    totalTime: null,
  });

  // Structured logging
  logRequest({
    requestUrl: url.href,
    method: 'PUT',
    country: null,
    deviceType: deviceInfo.deviceType,
    abTestVariant: testInfo?.variant || null,
    cacheStatus: 'BYPASS',
    responseTime: null,
    statusCode: putResponse.status,
    additionalData: {
      path: url.pathname,
      testId: testInfo?.testId || null,
    },
  });

  return putResponse;
}

/**
 * Handles DELETE requests
 */
export function handleDELETE(request, deviceInfo, testInfo) {
  const deleteHeaders = new Headers({
    "Content-Type": "text/plain",
    "X-Request-Method": "DELETE",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  });

  addDeviceHeaders(deleteHeaders, deviceInfo);
  addABTestHeaders(deleteHeaders, testInfo);

  let deleteResponse = new Response("Hello from SmartCDN - DELETE request received", {
    status: 200,
    headers: deleteHeaders,
  });

  if (testInfo && testInfo.isNewAssignment) {
    deleteResponse = setTestVariantCookie(deleteResponse, testInfo.testId, testInfo.variant);
  }

  // Track cache event (DELETE requests are always BYPASS)
  const url = new URL(request.url);
  recordCacheEvent({
    status: 'BYPASS',
    path: url.pathname,
    method: 'DELETE',
    statusCode: deleteResponse.status,
    country: null,
    region: null,
    cacheLookupTime: null,
    originFetchTime: null,
    totalTime: null,
  });

  // Structured logging
  logRequest({
    requestUrl: url.href,
    method: 'DELETE',
    country: null,
    deviceType: deviceInfo.deviceType,
    abTestVariant: testInfo?.variant || null,
    cacheStatus: 'BYPASS',
    responseTime: null,
    statusCode: deleteResponse.status,
    additionalData: {
      path: url.pathname,
      testId: testInfo?.testId || null,
    },
  });

  return deleteResponse;
}

/**
 * Handles PATCH requests
 */
export function handlePATCH(request, deviceInfo, testInfo) {
  const patchHeaders = new Headers({
    "Content-Type": "text/plain",
    "X-Request-Method": "PATCH",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  });

  addDeviceHeaders(patchHeaders, deviceInfo);
  addABTestHeaders(patchHeaders, testInfo);

  let patchResponse = new Response("Hello from SmartCDN - PATCH request received", {
    status: 200,
    headers: patchHeaders,
  });

  if (testInfo && testInfo.isNewAssignment) {
    patchResponse = setTestVariantCookie(patchResponse, testInfo.testId, testInfo.variant);
  }

  // Track cache event (PATCH requests are always BYPASS)
  const url = new URL(request.url);
  recordCacheEvent({
    status: 'BYPASS',
    path: url.pathname,
    method: 'PATCH',
    statusCode: patchResponse.status,
    country: null,
    region: null,
    cacheLookupTime: null,
    originFetchTime: null,
    totalTime: null,
  });

  // Structured logging
  logRequest({
    requestUrl: url.href,
    method: 'PATCH',
    country: null,
    deviceType: deviceInfo.deviceType,
    abTestVariant: testInfo?.variant || null,
    cacheStatus: 'BYPASS',
    responseTime: null,
    statusCode: patchResponse.status,
    additionalData: {
      path: url.pathname,
      testId: testInfo?.testId || null,
    },
  });

  return patchResponse;
}

/**
 * Handles OPTIONS requests (CORS preflight)
 */
export function handleOPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

/**
 * Builds a response from cached data with all headers
 */
function buildCachedResponse(cachedResponse, deviceInfo, imageOptParams, testInfo, formatNegotiation, resizeParams, shouldResize, pathname, request, geoRoutingInfo = null, regionContentInfo = null, timing = null, isHead = false, cacheStatus = null) {
  const response = new Response(
    isHead ? null : cachedResponse.body,
    {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: cachedResponse.headers,
    }
  );

  addDeviceHeaders(response.headers, deviceInfo);
  addImageHeaders(response.headers, pathname, imageOptParams, formatNegotiation, resizeParams, shouldResize);
  addABTestHeaders(response.headers, testInfo);
  addGeoRoutingHeaders(response.headers, geoRoutingInfo);
  addRegionContentHeaders(response.headers, regionContentInfo);
  addTimingHeaders(response.headers, timing, cacheStatus);

  // Set cookie if needed
  let finalResponse = response;
  if (testInfo && testInfo.isNewAssignment) {
    finalResponse = setTestVariantCookie(response, testInfo.testId, testInfo.variant);
  }

  // Check conditional request
  const conditionalResponse = handleConditionalRequest(request, finalResponse);
  if (conditionalResponse) {
    console.log(`Conditional request validated${isHead ? ' (HEAD)' : ''} - returning 304 Not Modified`);
    if (testInfo && testInfo.isNewAssignment) {
      return setTestVariantCookie(conditionalResponse, testInfo.testId, testInfo.variant);
    }
    return conditionalResponse;
  }

  return finalResponse;
}

