/**
 * Request Utilities
 * 
 * Helper functions for working with HTTP requests
 */

/**
 * Gets the client IP address from the request
 * @param {Request} request - The incoming request
 * @returns {string} Client IP address
 */
export function getClientIP(request) {
  // Cloudflare Workers provides the client IP in the CF object
  // Also check for forwarded headers as fallback
  if (request.cf && request.cf.connectingIp) {
    return request.cf.connectingIp;
  }
  
  // Fallback to X-Forwarded-For or X-Real-IP
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) {
    return xRealIP;
  }
  
  return 'unknown';
}

/**
 * Gets the content type for a given pathname
 * @param {string} pathname - The pathname
 * @returns {string} Content type
 */
export function getContentType(pathname) {
  const ext = pathname.split('.').pop().toLowerCase();
  const contentTypes = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'avif': 'image/avif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'txt': 'text/plain',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Parses cookies from a request
 * @param {Request} request - The incoming request
 * @returns {Object} Object mapping cookie names to values
 */
export function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return {};
  }
  
  const cookies = {};
  const cookiePairs = cookieHeader.split(';');
  
  for (const pair of cookiePairs) {
    const [name, ...valueParts] = pair.trim().split('=');
    if (name) {
      cookies[name.trim()] = valueParts.join('=').trim();
    }
  }
  
  return cookies;
}

/**
 * Cleans headers for origin requests
 * Removes headers that should not be forwarded to the origin
 * For Worker-to-Worker communication, we need to be careful about headers
 * @param {Headers} originalHeaders - Original request headers
 * @param {string} originUrl - The origin URL being fetched (optional, for debugging)
 * @returns {Headers} Cleaned headers for origin request
 */
export function cleanHeadersForOrigin(originalHeaders, originUrl = null) {
  const cleanedHeaders = new Headers();
  
  // Headers to skip (Cloudflare-specific or proxy headers)
  // NOTE: For Worker-to-Worker communication, we might need to preserve Host header
  // or set it explicitly based on the origin URL
  const skipHeaders = [
    // 'host' - DO NOT skip host header, fetch API should set it, but we'll let it through
    // Actually, let's set it explicitly if we have the origin URL
    'cf-ray',                  // Cloudflare-specific - routing header
    'cf-connecting-ip',        // Cloudflare-specific
    'cf-visitor',              // Cloudflare-specific
    'cf-ipcountry',            // Cloudflare-specific - we'll pass this differently if needed
    'cf-request-id',           // Cloudflare request ID
    'x-forwarded-proto',       // Proxy header
    'x-forwarded-for',         // Proxy header - can cause routing issues
    'x-real-ip',               // Proxy header
    'connection',              // Connection header - HTTP/1.1 specific
    'upgrade',                 // Upgrade header
    'te',                      // Transfer encoding
    'expect',                  // Expect header
    'keep-alive',              // Keep-alive header
    'proxy-connection',        // Proxy connection
    'x-cloudflare-*',          // Any Cloudflare-specific headers
  ];
  
  // Preserve important headers
  const preserveHeaders = [
    'user-agent',
    'accept',
    'accept-language',
    'accept-encoding',
    'referer',
    'cookie',
    'authorization',
    'content-type',
    'if-none-match',
    'if-modified-since',
    'range',
  ];
  
  // Copy headers that we want to preserve
  for (const [key, value] of originalHeaders.entries()) {
    const lowerKey = key.toLowerCase();
    
    // Skip headers in skip list
    if (skipHeaders.some(skip => lowerKey === skip || lowerKey.startsWith(skip.replace('*', '')))) {
      continue;
    }
    
    // Always preserve important headers (even if in skip list, these are exceptions)
    if (preserveHeaders.includes(lowerKey)) {
      cleanedHeaders.set(key, value);
      continue;
    }
    
    // Skip any cf-* headers (Cloudflare-specific)
    if (lowerKey.startsWith('cf-')) {
      continue;
    }
    
    // Otherwise, preserve the header
    cleanedHeaders.set(key, value);
  }
  
  // Add a custom header to identify this as a fetch from SmartCDN
  cleanedHeaders.set('X-Forwarded-By', 'SmartCDN');
  
  // DO NOT set Host header - let fetch API handle it automatically
  // Setting Host manually can cause routing issues in Cloudflare Workers
  
  return cleanedHeaders;
}
