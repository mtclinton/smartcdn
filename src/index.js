/**
 * A/B Testing Configuration
 * Configure which paths should be tested and routing behavior
 */
const AB_TEST_CONFIG = {
  // Enable or disable A/B testing globally
  enabled: true,
  
  // Paths to test (supports exact matches, prefixes, or regex patterns)
  // Empty array means test all paths
  testPaths: [
    // Example: test all HTML pages
    { pattern: /\.html?$/i, type: 'regex' },
    // Example: test specific paths
    { pattern: '/', type: 'exact' },
    { pattern: '/index', type: 'exact' },
    // Example: test paths with prefix
    { pattern: '/products', type: 'prefix' },
  ],
  
  // Paths to exclude from A/B testing (takes precedence over testPaths)
  excludePaths: [
    { pattern: /\.(css|js|jpg|jpeg|png|gif|webp|svg|ico|woff|woff2|ttf|otf)$/i, type: 'regex' },
    { pattern: '/api/', type: 'prefix' },
    { pattern: '/admin', type: 'prefix' },
    { pattern: '/static', type: 'prefix' },
  ],
  
  // Routing configuration for variant B
  variantBRouting: {
    // Strategy: 'path-suffix' or 'origin'
    strategy: 'path-suffix',
    
    // For path-suffix strategy: suffix to add (e.g., '-v2')
    pathSuffix: '-v2',
    
    // For origin strategy: alternative origin URL
    // originUrl: 'https://v2.example.com',
    
    // File extensions to apply suffix to (empty = all)
    // For path-suffix: if file has extension, insert before extension
    // Example: /page.html -> /page-v2.html
    applyToExtensions: ['html', 'htm', 'js', 'css'],
  },
};

/**
 * Checks if A/B testing is enabled
 * @returns {boolean} True if A/B testing is enabled
 */
function isABTestingEnabled() {
  return AB_TEST_CONFIG.enabled;
}

/**
 * Checks if a path matches a pattern
 * @param {string} pathname - The path to check
 * @param {Object} patternConfig - Pattern configuration with 'pattern' and 'type'
 * @returns {boolean} True if path matches
 */
function matchesPattern(pathname, patternConfig) {
  const { pattern, type } = patternConfig;
  
  switch (type) {
    case 'exact':
      return pathname === pattern;
    case 'prefix':
      return pathname.startsWith(pattern);
    case 'regex':
      return pattern.test(pathname);
    default:
      return false;
  }
}

/**
 * Checks if a path should be included in A/B testing
 * @param {string} pathname - The request pathname
 * @returns {boolean} True if path should be tested
 */
function shouldTestPath(pathname) {
  // Check exclusions first (takes precedence)
  for (const excludePattern of AB_TEST_CONFIG.excludePaths) {
    if (matchesPattern(pathname, excludePattern)) {
      return false;
    }
  }
  
  // If testPaths is empty, test all paths (except excluded)
  if (AB_TEST_CONFIG.testPaths.length === 0) {
    return true;
  }
  
  // Check if path matches any test pattern
  for (const testPattern of AB_TEST_CONFIG.testPaths) {
    if (matchesPattern(pathname, testPattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Transforms a URL path based on variant B routing strategy
 * @param {string} pathname - The original pathname
 * @param {string} variant - The assigned variant ('A' or 'B')
 * @returns {string} The transformed pathname (or original if variant A)
 */
function transformPathForVariant(pathname, variant) {
  // Variant A: return original path
  if (variant === 'A') {
    return pathname;
  }
  
  // Variant B: apply routing transformation
  const routing = AB_TEST_CONFIG.variantBRouting;
  
  if (routing.strategy === 'path-suffix') {
    const suffix = routing.pathSuffix || '-v2';
    
    // Check if path has a file extension
    const lastDot = pathname.lastIndexOf('.');
    const lastSlash = pathname.lastIndexOf('/');
    
    if (lastDot > lastSlash && lastDot !== -1) {
      // Has file extension
      const extension = pathname.substring(lastDot);
      const basePath = pathname.substring(0, lastDot);
      
      // Check if we should apply suffix to this extension
      const extWithoutDot = extension.substring(1).toLowerCase();
      const applyToExtensions = routing.applyToExtensions || [];
      
      if (applyToExtensions.length === 0 || applyToExtensions.includes(extWithoutDot)) {
        // Insert suffix before extension
        return `${basePath}${suffix}${extension}`;
      }
    }
    
    // No extension or extension not in list, append suffix
    return `${pathname}${suffix}`;
  }
  
  // For 'origin' strategy, path transformation might not be needed
  // (origin change is handled separately)
  return pathname;
}

/**
 * Gets the origin URL for variant B if origin strategy is used
 * @param {string} originalUrl - The original request URL
 * @param {string} variant - The assigned variant ('A' or 'B')
 * @returns {string|null} The origin URL for variant B, or null if not applicable
 */
function getVariantOrigin(originalUrl, variant) {
  if (variant === 'A') {
    return null; // Use original origin
  }
  
  const routing = AB_TEST_CONFIG.variantBRouting;
  if (routing.strategy === 'origin' && routing.originUrl) {
    return routing.originUrl;
  }
  
  return null;
}

/**
 * Transforms a request URL based on variant
 * @param {URL} url - The original URL
 * @param {string} variant - The assigned variant ('A' or 'B')
 * @returns {URL} The transformed URL
 */
function transformUrlForVariant(url, variant) {
  // Check if this path should be tested
  if (!shouldTestPath(url.pathname)) {
    return url;
  }
  
  // Transform path
  const transformedPath = transformPathForVariant(url.pathname, variant);
  
  // Check for origin change
  const variantOrigin = getVariantOrigin(url.href, variant);
  
  if (variantOrigin) {
    // Create new URL with different origin
    const newUrl = new URL(transformedPath + url.search, variantOrigin);
    return newUrl;
  }
  
  // Just update the pathname
  const newUrl = new URL(url);
  newUrl.pathname = transformedPath;
  return newUrl;
}

/**
 * Determines cache TTL in seconds based on file extension or path
 * @param {string} pathname - The request pathname
 * @returns {number} Cache TTL in seconds
 */
function getCacheTTL(pathname) {
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
function getCacheControlHeader(ttlSeconds, immutable = false) {
  const directives = ['public', `max-age=${ttlSeconds}`];
  if (immutable) {
    directives.push('immutable');
  }
  return directives.join(', ');
}

/**
 * Determines Content-Type based on file extension
 * @param {string} pathname - The request pathname
 * @returns {string} Content-Type header value
 */
function getContentType(pathname) {
  const lowerPath = pathname.toLowerCase();
  const lastDot = lowerPath.lastIndexOf('.');
  if (lastDot === -1) {
    return 'text/html; charset=utf-8';
  }
  
  const extension = lowerPath.substring(lastDot + 1);
  const contentTypes = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'avif': 'image/avif',
    'bmp': 'image/bmp',
    // Text
    'html': 'text/html; charset=utf-8',
    'htm': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'json': 'application/json; charset=utf-8',
    'xml': 'application/xml; charset=utf-8',
    'txt': 'text/plain; charset=utf-8',
    // Fonts
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    // Other
    'pdf': 'application/pdf',
    'zip': 'application/zip',
  };
  
  return contentTypes[extension] || 'application/octet-stream';
}

/**
 * Generates an ETag from content
 * @param {string|ArrayBuffer} content - The response content
 * @param {string} url - The request URL (for consistency)
 * @returns {string} ETag value
 */
function generateETag(content, url) {
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
function getLastModified(originResponse = null) {
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
function applyCacheHeaders(originResponse, pathname, responseHeaders) {
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
function handleConditionalRequest(request, response) {
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
 * Gets the client IP address from the request
 * @param {Request} request - The incoming request
 * @returns {string} The client IP address
 */
function getClientIP(request) {
  // Check CF-Connecting-IP header (Cloudflare provides this)
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) {
    return cfIP;
  }
  
  // Fallback to X-Forwarded-For header
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim();
  }
  
  // Fallback to X-Real-IP
  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) {
    return xRealIP;
  }
  
  // Last resort: return a default value
  return 'unknown';
}

/**
 * Hashes a string to a number for consistent variant assignment
 * @param {string} input - The string to hash
 * @returns {number} A hash value between 0 and 100
 */
function hashToVariant(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Return a value between 0 and 100
  return Math.abs(hash) % 100;
}

/**
 * Determines A/B test variant (A or B) based on a hash value
 * @param {number} hashValue - Hash value between 0 and 100
 * @param {number} splitPercent - Percentage for variant A (default 50)
 * @returns {string} 'A' or 'B'
 */
function getVariantFromHash(hashValue, splitPercent = 50) {
  return hashValue < splitPercent ? 'A' : 'B';
}

/**
 * Gets or assigns an A/B test variant for a user
 * Checks cookie first, then falls back to IP-based assignment
 * @param {Request} request - The incoming request
 * @returns {Object} Object with variant ('A' or 'B') and isNewAssignment (boolean)
 */
function getOrAssignVariant(request) {
  const cookieName = 'smartcdn_variant';
  
  // Check for existing cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc[key.trim()] = decodeURIComponent(value);
      }
      return acc;
    }, {});
    
    if (cookies[cookieName] && (cookies[cookieName] === 'A' || cookies[cookieName] === 'B')) {
      console.log(`A/B Test: Existing variant found in cookie - ${cookies[cookieName]}`);
      return {
        variant: cookies[cookieName],
        isNewAssignment: false,
      };
    }
  }
  
  // No valid cookie found, assign based on IP address
  const clientIP = getClientIP(request);
  const hashValue = hashToVariant(clientIP);
  const variant = getVariantFromHash(hashValue);
  
  console.log(`A/B Test: New assignment - IP: ${clientIP}, Hash: ${hashValue}, Variant: ${variant}`);
  
  return {
    variant,
    isNewAssignment: true,
  };
}

/**
 * Sets the smartcdn_variant cookie in the response
 * @param {Response} response - The response to modify
 * @param {string} variant - The variant ('A' or 'B')
 * @returns {Response} The response with the cookie set
 */
function setVariantCookie(response, variant) {
  const cookieName = 'smartcdn_variant';
  const cookieValue = variant;
  const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
  const expires = new Date(Date.now() + maxAge * 1000).toUTCString();
  
  // Set cookie with SameSite=Lax for better compatibility
  const cookieString = `${cookieName}=${cookieValue}; Path=/; Max-Age=${maxAge}; Expires=${expires}; SameSite=Lax; Secure`;
  
  // Clone response and add cookie header
  const newResponse = response.clone();
  newResponse.headers.append('Set-Cookie', cookieString);
  
  return newResponse;
}

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
 * Generates a custom cache key URL by filtering query parameters
 * For images: includes relevant params (width, height, quality, format) but excludes tracking params
 * For non-images: excludes tracking params but keeps other params
 * @param {URL} url - The request URL
 * @returns {Request} A new Request object with the normalized cache key URL
 */
function generateCacheKey(request, url) {
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

export default {
  async fetch(request, env, ctx) {
    try {
      // Extract request information
      const url = new URL(request.url);
      const method = request.method;
      const headers = Object.fromEntries(request.headers.entries());

      // Get or assign A/B test variant
      const variantInfo = getOrAssignVariant(request);
      const variant = variantInfo.variant;
      const isNewAssignment = variantInfo.isNewAssignment;

      // Check if A/B testing is enabled and if this path should be tested
      const shouldTest = isABTestingEnabled() && shouldTestPath(url.pathname);
      let routingUrl = url;
      let routingInfo = null;

      if (shouldTest) {
        // Transform URL based on variant
        routingUrl = transformUrlForVariant(url, variant);
        if (routingUrl.href !== url.href) {
          routingInfo = {
            originalPath: url.pathname,
            routedPath: routingUrl.pathname,
            originalOrigin: url.origin,
            routedOrigin: routingUrl.origin,
            strategy: AB_TEST_CONFIG.variantBRouting.strategy,
          };
          console.log('A/B Test Routing:', JSON.stringify(routingInfo, null, 2));
        }
      }

      // Log basic request information
      console.log(`[${new Date().toISOString()}] ${method} ${url.pathname}`);
      console.log('Request URL:', url.href);
      console.log('Request Method:', method);
      console.log('A/B Test Variant:', variant, isNewAssignment ? '(new assignment)' : '(from cookie)');
      console.log('A/B Testing:', shouldTest ? 'enabled for this path' : 'disabled or path excluded');
      if (routingInfo) {
        console.log('Routed URL:', routingUrl.href);
      }
      console.log('Request Headers:', JSON.stringify(headers, null, 2));

      // Handle different request methods
      switch (method) {
        case 'GET':
          // Generate custom cache key (normalizes query params)
          // Use routed URL if A/B testing is active
          const cache = caches.default;
          const cacheKeyUrl = shouldTest ? routingUrl : url;
          let cacheKey = generateCacheKey(request, cacheKeyUrl);
          
          // Add variant to cache key if testing is enabled
          // This ensures different variants are cached separately
          if (shouldTest) {
            const variantCacheKeyUrl = new URL(cacheKey.url);
            variantCacheKeyUrl.searchParams.set('_variant', variant);
            cacheKey = new Request(variantCacheKeyUrl.toString(), {
              method: request.method,
              headers: request.headers,
            });
          }
          
          // Log cache key info
          const originalQuery = url.search;
          const cacheKeyQuery = new URL(cacheKey.url).search;
          if (originalQuery !== cacheKeyQuery) {
            console.log('Cache key normalized - Original:', originalQuery, 'Normalized:', cacheKeyQuery);
          }
          
          const cachedResponse = await cache.match(cacheKey);
          
          if (cachedResponse) {
            console.log('Cache HIT for:', url.pathname);
            
            // Add variant header to cached response
            const cachedResponseWithVariant = new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers: cachedResponse.headers,
            });
            cachedResponseWithVariant.headers.set('X-AB-Test-Variant', variant);
            
            // Set cookie if this is a new assignment (cookie might have been cleared)
            let finalCachedResponse = cachedResponseWithVariant;
            if (isNewAssignment) {
              finalCachedResponse = setVariantCookie(cachedResponseWithVariant, variant);
            }
            
            // Check for conditional request (If-None-Match, If-Modified-Since)
            const conditionalResponse = handleConditionalRequest(request, finalCachedResponse);
            if (conditionalResponse) {
              console.log('Conditional request validated - returning 304 Not Modified');
              // Still set cookie on 304 responses if needed
              if (isNewAssignment) {
                return setVariantCookie(conditionalResponse, variant);
              }
              return conditionalResponse;
            }
            
            return finalCachedResponse;
          }
          
          console.log('Cache MISS for:', url.pathname);
          
          // Fetch from origin using routed URL if A/B testing is active
          // In a real scenario, you would fetch from origin here
          let originResponse = null;
          if (shouldTest && routingInfo && routingInfo.routedOrigin !== routingInfo.originalOrigin) {
            // Different origin - fetch from variant origin
            console.log(`Fetching from variant origin: ${routingUrl.href}`);
            // Uncomment when ready to fetch from origin:
            // const originRequest = new Request(routingUrl.href, {
            //   method: request.method,
            //   headers: request.headers,
            // });
            // originResponse = await fetch(originRequest);
          } else if (shouldTest && routingInfo) {
            // Same origin, different path - fetch from routed path
            console.log(`Fetching from routed path: ${routingUrl.pathname}`);
            // Uncomment when ready to fetch from origin:
            // const originRequest = new Request(routingUrl.href, {
            //   method: request.method,
            //   headers: request.headers,
            // });
            // originResponse = await fetch(originRequest);
          }
          // For now, we'll create a response as if it came from origin
          // Replace with: await fetch(routingUrl.href, request);
          
          // Determine content type (use original pathname for content type detection)
          const contentType = getContentType(url.pathname);
          
          // Create response headers
          const responseHeaders = new Headers({
            'Content-Type': contentType,
            'X-Request-Method': method,
            'X-AB-Test-Variant': variant, // Add variant to response headers
          });
          
          // Add routing info header if routing occurred
          if (routingInfo) {
            responseHeaders.set('X-AB-Test-Routed', 'true');
            responseHeaders.set('X-AB-Test-Original-Path', routingInfo.originalPath);
            responseHeaders.set('X-AB-Test-Routed-Path', routingInfo.routedPath);
          }
          
          // Apply cache headers (respects origin headers if available)
          // Use routed pathname for cache TTL calculation
          const pathnameForCache = shouldTest ? routingUrl.pathname : url.pathname;
          applyCacheHeaders(originResponse, pathnameForCache, responseHeaders);
          
          const ttlSeconds = getCacheTTL(pathnameForCache);
          console.log(`Cache TTL: ${ttlSeconds} seconds (${Math.round(ttlSeconds / 60)} minutes)`);
          console.log('Cache-Control:', responseHeaders.get('Cache-Control'));
          console.log('ETag:', responseHeaders.get('ETag'));
          console.log('Last-Modified:', responseHeaders.get('Last-Modified'));
          
          // Create response with all cache headers
          let response = new Response("Hello from SmartCDN - GET request", {
            status: 200,
            headers: responseHeaders,
          });
          
          // Set variant cookie if this is a new assignment
          if (isNewAssignment) {
            response = setVariantCookie(response, variant);
          }
          
          // Check for conditional request before caching
          const conditionalCheck = handleConditionalRequest(request, response);
          if (conditionalCheck) {
            console.log('Conditional request validated - returning 304 Not Modified');
            // Still set cookie on 304 responses if needed
            if (isNewAssignment) {
              return setVariantCookie(conditionalCheck, variant);
            }
            return conditionalCheck;
          }
          
          // Cache the response using the normalized cache key
          // Use waitUntil to cache in the background without blocking the response
          ctx.waitUntil(cache.put(cacheKey, response.clone()));
          
          return response;

        case 'POST':
          // Try to read request body if present
          let body = null;
          try {
            body = await request.text();
            if (body) {
              console.log('Request Body:', body);
            }
          } catch (e) {
            console.warn('Could not read request body:', e.message);
          }

          let postResponse = new Response("Hello from SmartCDN - POST request received", {
            status: 201,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
              "X-AB-Test-Variant": variant,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
            },
          });
          
          // Set variant cookie if this is a new assignment
          if (isNewAssignment) {
            postResponse = setVariantCookie(postResponse, variant);
          }
          
          return postResponse;

        case 'PUT':
          let putResponse = new Response("Hello from SmartCDN - PUT request received", {
            status: 200,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
              "X-AB-Test-Variant": variant,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
            },
          });
          if (isNewAssignment) {
            putResponse = setVariantCookie(putResponse, variant);
          }
          return putResponse;

        case 'DELETE':
          let deleteResponse = new Response("Hello from SmartCDN - DELETE request received", {
            status: 200,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
              "X-AB-Test-Variant": variant,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
            },
          });
          if (isNewAssignment) {
            deleteResponse = setVariantCookie(deleteResponse, variant);
          }
          return deleteResponse;

        case 'PATCH':
          let patchResponse = new Response("Hello from SmartCDN - PATCH request received", {
            status: 200,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
              "X-AB-Test-Variant": variant,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
            },
          });
          if (isNewAssignment) {
            patchResponse = setVariantCookie(patchResponse, variant);
          }
          return patchResponse;

        case 'OPTIONS':
          // Handle CORS preflight requests
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          });

        case 'HEAD':
          // Generate custom cache key for HEAD requests too
          // Use routed URL if A/B testing is active
          const headCache = caches.default;
          const headCacheKeyUrl = shouldTest ? routingUrl : url;
          let headCacheKey = generateCacheKey(request, headCacheKeyUrl);
          
          // Add variant to cache key if testing is enabled
          if (shouldTest) {
            const headVariantCacheKeyUrl = new URL(headCacheKey.url);
            headVariantCacheKeyUrl.searchParams.set('_variant', variant);
            headCacheKey = new Request(headVariantCacheKeyUrl.toString(), {
              method: request.method,
              headers: request.headers,
            });
          }
          
          // Log cache key info
          const headOriginalQuery = url.search;
          const headCacheKeyQuery = new URL(headCacheKey.url).search;
          if (headOriginalQuery !== headCacheKeyQuery) {
            console.log('Cache key normalized (HEAD) - Original:', headOriginalQuery, 'Normalized:', headCacheKeyQuery);
          }
          
          const cachedHeadResponse = await headCache.match(headCacheKey);
          
          if (cachedHeadResponse) {
            console.log('Cache HIT (HEAD) for:', url.pathname);
            
            // Add variant header to cached response
            const cachedHeadResponseWithVariant = new Response(null, {
              status: cachedHeadResponse.status,
              statusText: cachedHeadResponse.statusText,
              headers: cachedHeadResponse.headers,
            });
            cachedHeadResponseWithVariant.headers.set('X-AB-Test-Variant', variant);
            
            // Set cookie if this is a new assignment
            let finalCachedHeadResponse = cachedHeadResponseWithVariant;
            if (isNewAssignment) {
              finalCachedHeadResponse = setVariantCookie(cachedHeadResponseWithVariant, variant);
            }
            
            // Check for conditional request
            const headConditionalResponse = handleConditionalRequest(request, finalCachedHeadResponse);
            if (headConditionalResponse) {
              console.log('Conditional request validated (HEAD) - returning 304 Not Modified');
              // Still set cookie on 304 responses if needed
              if (isNewAssignment) {
                return setVariantCookie(headConditionalResponse, variant);
              }
              return headConditionalResponse;
            }
            
            return finalCachedHeadResponse;
          }
          
          console.log('Cache MISS (HEAD) for:', url.pathname);
          
          // Fetch from origin using routed URL if A/B testing is active
          let headOriginResponse = null;
          if (shouldTest && routingInfo) {
            console.log(`Fetching from routed path (HEAD): ${routingUrl.pathname}`);
            // Uncomment when ready to fetch from origin:
            // const headOriginRequest = new Request(routingUrl.href, {
            //   method: request.method,
            //   headers: request.headers,
            // });
            // headOriginResponse = await fetch(headOriginRequest);
          }
          
          // Determine content type (use original pathname)
          const headContentType = getContentType(url.pathname);
          
          // Create response headers
          const headResponseHeaders = new Headers({
            'Content-Type': headContentType,
            'X-Request-Method': method,
            'X-AB-Test-Variant': variant, // Add variant to response headers
          });
          
          // Add routing info header if routing occurred
          if (routingInfo) {
            headResponseHeaders.set('X-AB-Test-Routed', 'true');
            headResponseHeaders.set('X-AB-Test-Original-Path', routingInfo.originalPath);
            headResponseHeaders.set('X-AB-Test-Routed-Path', routingInfo.routedPath);
          }
          
          // Apply cache headers (use routed pathname for cache TTL)
          const headPathnameForCache = shouldTest ? routingUrl.pathname : url.pathname;
          applyCacheHeaders(headOriginResponse, headPathnameForCache, headResponseHeaders);
          
          const headTtlSeconds = getCacheTTL(headPathnameForCache);
          console.log(`Cache TTL (HEAD): ${headTtlSeconds} seconds (${Math.round(headTtlSeconds / 60)} minutes)`);
          
          let headResponse = new Response(null, {
            status: 200,
            headers: headResponseHeaders,
          });
          
          // Set variant cookie if this is a new assignment
          if (isNewAssignment) {
            headResponse = setVariantCookie(headResponse, variant);
          }
          
          // Check for conditional request
          const headConditionalCheck = handleConditionalRequest(request, headResponse);
          if (headConditionalCheck) {
            console.log('Conditional request validated (HEAD) - returning 304 Not Modified');
            // Still set cookie on 304 responses if needed
            if (isNewAssignment) {
              return setVariantCookie(headConditionalCheck, variant);
            }
            return headConditionalCheck;
          }
          
          // Cache the response using the normalized cache key
          ctx.waitUntil(headCache.put(headCacheKey, headResponse.clone()));
          
          return headResponse;

        default:
          return new Response(`Method ${method} not allowed`, {
            status: 405,
            headers: { 
              "Content-Type": "text/plain",
              "Allow": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
            },
          });
      }
    } catch (error) {
      // Error handling
      console.error('Error processing request:', error);
      console.error('Error stack:', error.stack);

      return new Response(`Internal Server Error: ${error.message}`, {
        status: 500,
        headers: { 
          "Content-Type": "text/plain",
        },
      });
    }
  },
};

