/**
 * HTTP Method Handlers
 * 
 * Handlers for different HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
 */

import { generateCacheKey, handleConditionalRequest, applyCacheHeaders, getCacheTTL } from '../utils/cache.js';
import { getContentType } from '../utils/request.js';
import { isImagePath } from '../utils/image.js';
import { addDeviceHeaders, addImageHeaders, addABTestHeaders, addGeoRoutingHeaders, getNegotiatedContentType } from '../utils/headers.js';
import { setTestVariantCookie } from '../utils/variants.js';
import { buildOriginUrl } from '../utils/geo-routing.js';

/**
 * Handles GET requests with caching, A/B testing, and image optimization
 */
export async function handleGET(request, url, imageUrl, deviceInfo, imageOptParams, testInfo, routingInfo, formatNegotiation, resizeParams, shouldResize, geoRoutingInfo, ctx) {
  const cache = caches.default;
  const finalUrl = imageUrl; // imageUrl is the final URL after all transformations
  let cacheKey = generateCacheKey(request, finalUrl);

  // Add test ID, variant, format, resize params, and geographic routing to cache key
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
  cacheKey = new Request(enhancedCacheKeyUrl.toString(), {
    method: request.method,
    headers: request.headers,
  });

  // Check cache
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    console.log('Cache HIT for:', url.pathname);
    return buildCachedResponse(cachedResponse, deviceInfo, imageOptParams, testInfo, formatNegotiation, resizeParams, shouldResize, url.pathname, request, geoRoutingInfo);
  }

  console.log('Cache MISS for:', url.pathname);

  // Fetch from geographic origin
  let originResponse = null;
  let originUrl = null;
  
  if (geoRoutingInfo && geoRoutingInfo.enabled) {
    // Build origin URL using geographic routing
    originUrl = buildOriginUrl(finalUrl, geoRoutingInfo.origin);
    console.log(`Fetching from geographic origin: ${originUrl.href} (region: ${geoRoutingInfo.region}, country: ${geoRoutingInfo.country || 'unknown'})`);
    
    try {
      // Create a new request to the origin, preserving method and headers
      const originRequest = new Request(originUrl.href, {
        method: request.method,
        headers: request.headers,
      });
      originResponse = await fetch(originRequest);
      console.log(`Origin response status: ${originResponse.status}`);
    } catch (error) {
      console.error('Error fetching from geographic origin:', error);
      // Continue with null originResponse - will use default response
    }
  } else if (finalUrl.href !== url.href) {
    // Fallback: if A/B test routing changed the URL, use that
    console.log(`Fetching from A/B test origin: ${finalUrl.href} (original: ${url.href})`);
    try {
      originResponse = await fetch(finalUrl.href, request);
      console.log(`Origin response status: ${originResponse.status}`);
    } catch (error) {
      console.error('Error fetching from A/B test origin:', error);
    }
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

  // Cache the response
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

/**
 * Handles HEAD requests (similar to GET but no body)
 */
export async function handleHEAD(request, url, imageUrl, deviceInfo, imageOptParams, testInfo, routingInfo, formatNegotiation, resizeParams, shouldResize, geoRoutingInfo, ctx) {
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
  headCacheKey = new Request(headEnhancedCacheKeyUrl.toString(), {
    method: request.method,
    headers: request.headers,
  });

  const cachedHeadResponse = await headCache.match(headCacheKey);
  if (cachedHeadResponse) {
    console.log('Cache HIT (HEAD) for:', url.pathname);
    return buildCachedResponse(cachedHeadResponse, deviceInfo, imageOptParams, testInfo, formatNegotiation, resizeParams, shouldResize, url.pathname, request, geoRoutingInfo, true);
  }

  console.log('Cache MISS (HEAD) for:', url.pathname);

  // Fetch from geographic origin (HEAD request)
  let headOriginResponse = null;
  if (geoRoutingInfo && geoRoutingInfo.enabled) {
    const headOriginUrl = buildOriginUrl(headFinalUrl, geoRoutingInfo.origin);
    console.log(`Fetching HEAD from geographic origin: ${headOriginUrl.href} (region: ${geoRoutingInfo.region})`);
    
    try {
      const headOriginRequest = new Request(headOriginUrl.href, {
        method: 'HEAD',
        headers: request.headers,
      });
      headOriginResponse = await fetch(headOriginRequest);
      console.log(`Origin HEAD response status: ${headOriginResponse.status}`);
    } catch (error) {
      console.error('Error fetching HEAD from geographic origin:', error);
    }
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

  ctx.waitUntil(headCache.put(headCacheKey, headResponse.clone()));
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

  return postResponse;
}

/**
 * Handles PUT requests
 */
export function handlePUT(deviceInfo, testInfo) {
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

  return putResponse;
}

/**
 * Handles DELETE requests
 */
export function handleDELETE(deviceInfo, testInfo) {
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

  return deleteResponse;
}

/**
 * Handles PATCH requests
 */
export function handlePATCH(deviceInfo, testInfo) {
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
function buildCachedResponse(cachedResponse, deviceInfo, imageOptParams, testInfo, formatNegotiation, resizeParams, shouldResize, pathname, request, geoRoutingInfo = null, isHead = false) {
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

