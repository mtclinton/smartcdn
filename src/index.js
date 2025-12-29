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
 * @returns {string} Cache-Control header value
 */
function getCacheControlHeader(ttlSeconds) {
  return `public, max-age=${ttlSeconds}`;
}

export default {
  async fetch(request, env, ctx) {
    try {
      // Extract request information
      const url = new URL(request.url);
      const method = request.method;
      const headers = Object.fromEntries(request.headers.entries());

      // Log basic request information
      console.log(`[${new Date().toISOString()}] ${method} ${url.pathname}`);
      console.log('Request URL:', url.href);
      console.log('Request Method:', method);
      console.log('Request Headers:', JSON.stringify(headers, null, 2));

      // Handle different request methods
      switch (method) {
        case 'GET':
          // Check cache first
          const cache = caches.default;
          const cacheKey = new Request(url.href, request);
          const cachedResponse = await cache.match(cacheKey);
          
          if (cachedResponse) {
            console.log('Cache HIT for:', url.pathname);
            return cachedResponse;
          }
          
          console.log('Cache MISS for:', url.pathname);
          
          // Determine cache TTL based on content type
          const ttlSeconds = getCacheTTL(url.pathname);
          const cacheControl = getCacheControlHeader(ttlSeconds);
          
          console.log(`Cache TTL: ${ttlSeconds} seconds (${Math.round(ttlSeconds / 60)} minutes)`);
          
          // Create response with cache headers
          const response = new Response("Hello from SmartCDN - GET request", {
            status: 200,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
              "Cache-Control": cacheControl,
            },
          });
          
          // Cache the response
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

          return new Response("Hello from SmartCDN - POST request received", {
            status: 201,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
            },
          });

        case 'PUT':
          return new Response("Hello from SmartCDN - PUT request received", {
            status: 200,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
            },
          });

        case 'DELETE':
          return new Response("Hello from SmartCDN - DELETE request received", {
            status: 200,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
            },
          });

        case 'PATCH':
          return new Response("Hello from SmartCDN - PATCH request received", {
            status: 200,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
            },
          });

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
          // Check cache first for HEAD requests too
          const headCache = caches.default;
          const headCacheKey = new Request(url.href, request);
          const cachedHeadResponse = await headCache.match(headCacheKey);
          
          if (cachedHeadResponse) {
            console.log('Cache HIT (HEAD) for:', url.pathname);
            // Return HEAD response with same headers but no body
            return new Response(null, {
              status: cachedHeadResponse.status,
              headers: cachedHeadResponse.headers,
            });
          }
          
          console.log('Cache MISS (HEAD) for:', url.pathname);
          
          // Determine cache TTL
          const headTtlSeconds = getCacheTTL(url.pathname);
          const headCacheControl = getCacheControlHeader(headTtlSeconds);
          
          const headResponse = new Response(null, {
            status: 200,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
              "Cache-Control": headCacheControl,
            },
          });
          
          // Cache the response
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

