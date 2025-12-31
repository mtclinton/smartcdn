/**
 * Cache Utilities
 * 
 * Functions for cache TTL calculation, cache headers, and cache key generation
 */

/**
 * Checks if a pathname represents an image file
 * @param {string} pathname - The request pathname
 * @returns {boolean} True if the path is an image
 */
function isImagePath(pathname) {
  const lowerPath = pathname.toLowerCase();
  const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'ico', 'avif', 'bmp'];
  const lastDot = lowerPath.lastIndexOf('.');
  if (lastDot === -1) return false;
  const extension = lowerPath.substring(lastDot + 1);
  return imageExtensions.includes(extension);
}

/**
 * Determines cache TTL in seconds based on file extension or path
 * @param {string} pathname - The request pathname
 * @returns {number} Cache TTL in seconds
 */
export function getCacheTTL(pathname) {
  const lowerPath = pathname.toLowerCase();
  
  // API responses: 5 minutes
  if (lowerPath.startsWith('/api/')) {
    return 5 * 60; // 5 minutes
  }
  
  // Get file extension
  const lastDot = lowerPath.lastIndexOf('.');
  if (lastDot === -1) {
    // No extension, check if it's HTML-like
    if (lowerPath.endsWith('/') || lowerPath === '' || !lowerPath.includes('.')) {
      return 60 * 60; // 1 hour (treat as HTML)
    }
    return 24 * 60 * 60; // Default: 1 day
  }
  
  const extension = lowerPath.substring(lastDot + 1);
  
  // Images: 30 days
  const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'ico'];
  if (imageExtensions.includes(extension)) {
    return 30 * 24 * 60 * 60; // 30 days
  }
  
  // CSS/JS: 7 days
  if (extension === 'css' || extension === 'js') {
    return 7 * 24 * 60 * 60; // 7 days
  }
  
  // HTML: 1 hour
  if (extension === 'html' || extension === 'htm') {
    return 60 * 60; // 1 hour
  }
  
  // Default: 1 day
  return 24 * 60 * 60; // 1 day
}

/**
 * Formats TTL in seconds to Cache-Control max-age directive
 * @param {number} ttlSeconds - TTL in seconds
 * @param {boolean} immutable - Whether the content is immutable
 * @returns {string} Cache-Control header value
 */
export function getCacheControlHeader(ttlSeconds, immutable = false) {
  const directives = ['public', `max-age=${ttlSeconds}`];
  if (immutable) {
    directives.push('immutable');
  }
  return directives.join(', ');
}

/**
 * Generates an ETag from content
 * @param {string|ArrayBuffer} content - The response content
 * @param {string} url - The request URL (for consistency)
 * @returns {string} ETag value
 */
export function generateETag(content, url) {
  // Create a hash from content and URL for consistent ETags
  const data = typeof content === 'string' ? content : url;
  // Simple hash function (in production, you might want to use crypto.subtle)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `"${Math.abs(hash).toString(16)}"`;
}

/**
 * Gets Last-Modified header value (current time for now, could be from origin)
 * @param {Response|null} originResponse - Optional origin response to extract from
 * @returns {string} Last-Modified header value
 */
export function getLastModified(originResponse = null) {
  if (originResponse && originResponse.headers.get('Last-Modified')) {
    return originResponse.headers.get('Last-Modified');
  }
  // Use current time as default
  return new Date().toUTCString();
}

/**
 * Merges origin cache headers with edge caching rules
 * @param {Response|null} originResponse - The origin response (if any)
 * @param {string} pathname - The request pathname
 * @param {Headers} responseHeaders - The response headers to populate
 */
export function applyCacheHeaders(originResponse, pathname, responseHeaders) {
  // Determine our edge cache TTL
  const edgeTtl = getCacheTTL(pathname);
  
  // Check if content is immutable (images, fonts, etc.)
  const isImmutable = isImagePath(pathname) || 
                      pathname.toLowerCase().match(/\.(woff2?|ttf|otf|eot)$/);
  
  // If we have an origin response, check its cache headers
  if (originResponse) {
    const originCacheControl = originResponse.headers.get('Cache-Control');
    const originETag = originResponse.headers.get('ETag');
    const originLastModified = originResponse.headers.get('Last-Modified');
    
    // Use origin ETag if available
    if (originETag) {
      responseHeaders.set('ETag', originETag);
    }
    
    // Use origin Last-Modified if available
    if (originLastModified) {
      responseHeaders.set('Last-Modified', originLastModified);
    }
    
    // Parse origin Cache-Control
    if (originCacheControl) {
      // Check if origin says no-cache or no-store
      if (originCacheControl.includes('no-cache') || originCacheControl.includes('no-store')) {
        // Respect origin's no-cache directive but still apply our edge caching
        responseHeaders.set('Cache-Control', getCacheControlHeader(Math.min(edgeTtl, 60), isImmutable));
        responseHeaders.set('Vary', 'Origin');
        return;
      }
      
      // Extract max-age from origin if present
      const maxAgeMatch = originCacheControl.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        const originMaxAge = parseInt(maxAgeMatch[1], 10);
        // Use the minimum of origin and edge TTL
        const finalTtl = Math.min(edgeTtl, originMaxAge);
        responseHeaders.set('Cache-Control', getCacheControlHeader(finalTtl, isImmutable));
        return;
      }
    }
  }
  
  // Apply our edge caching rules (no origin response or no cache headers)
  responseHeaders.set('Cache-Control', getCacheControlHeader(edgeTtl, isImmutable));
  
  // Generate ETag if not from origin
  if (!originResponse || !originResponse.headers.get('ETag')) {
    const etag = generateETag(pathname, pathname);
    responseHeaders.set('ETag', etag);
  }
  
  // Set Last-Modified if not from origin
  if (!originResponse || !originResponse.headers.get('Last-Modified')) {
    responseHeaders.set('Last-Modified', getLastModified(originResponse));
  }
}

/**
 * Checks if a request is a conditional request and validates it
 * @param {Request} request - The incoming request
 * @param {Response} response - The response to check against
 * @returns {Response|null} 304 Not Modified response if valid, null otherwise
 */
export function handleConditionalRequest(request, response) {
  const ifNoneMatch = request.headers.get('If-None-Match');
  const ifModifiedSince = request.headers.get('If-Modified-Since');
  const etag = response.headers.get('ETag');
  const lastModified = response.headers.get('Last-Modified');
  
  // Check ETag (strong validator, takes precedence)
  if (ifNoneMatch && etag) {
    // ETag comparison (handle multiple ETags in If-None-Match)
    const etags = ifNoneMatch.split(',').map(e => e.trim());
    if (etags.includes(etag) || etags.includes('*')) {
      return new Response(null, {
        status: 304,
        headers: response.headers,
      });
    }
  }
  
  // Check Last-Modified (weak validator)
  if (ifModifiedSince && lastModified && !ifNoneMatch) {
    const ifModifiedSinceDate = new Date(ifModifiedSince);
    const lastModifiedDate = new Date(lastModified);
    if (lastModifiedDate <= ifModifiedSinceDate) {
      return new Response(null, {
        status: 304,
        headers: response.headers,
      });
    }
  }
  
  return null;
}

/**
 * Generates a custom cache key URL by filtering query parameters
 * For images: includes relevant params (width, height, quality, format) but excludes tracking params
 * For non-images: excludes tracking params but keeps other params
 * @param {Request} request - The original request
 * @param {URL} url - The request URL
 * @returns {Request} A new Request object with the normalized cache key URL
 */
export function generateCacheKey(request, url) {
  // Tracking parameters to exclude
  const trackingParams = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'ref', 'source', 'campaign', 'medium',
    '_ga', '_gid', 'mc_cid', 'mc_eid', 'igshid', 'twclid',
    'yclid', 'tt_medium', 'tt_content', 'affiliate_id', 'affid'
  ];
  
  // Image-specific parameters to include (if it's an image)
  const imageParams = [
    'width', 'w', 'height', 'h', 'quality', 'q', 'format', 'f',
    'fit', 'crop', 'gravity', 'resize', 'scale', 'dpr', 'auto'
  ];
  
  const isImage = isImagePath(url.pathname);
  const filteredParams = new URLSearchParams();
  
  // Process all query parameters
  for (const [key, value] of url.searchParams.entries()) {
    const lowerKey = key.toLowerCase();
    
    // Always exclude tracking parameters
    if (trackingParams.some(tp => lowerKey === tp || lowerKey.startsWith(tp + '_'))) {
      continue;
    }
    
    // For images, include image-specific params and all other non-tracking params
    // For non-images, include all non-tracking params
    if (isImage) {
      // Include image params or any other non-tracking param
      if (imageParams.includes(lowerKey) || !trackingParams.some(tp => lowerKey.startsWith(tp))) {
        filteredParams.append(key, value);
      }
    } else {
      // For non-images, include all non-tracking params
      filteredParams.append(key, value);
    }
  }
  
  // Build the normalized cache key URL
  const cacheKeyUrl = new URL(url);
  cacheKeyUrl.search = filteredParams.toString();
  
  // Sort query params for consistent cache keys (optional but good practice)
  if (cacheKeyUrl.search) {
    const sortedParams = new URLSearchParams();
    const entries = Array.from(filteredParams.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    entries.forEach(([key, value]) => sortedParams.append(key, value));
    cacheKeyUrl.search = sortedParams.toString();
  }
  
  // Create a new Request with the normalized URL for cache key
  // Preserve the original request method and headers
  return new Request(cacheKeyUrl.toString(), {
    method: request.method,
    headers: request.headers,
  });
}

