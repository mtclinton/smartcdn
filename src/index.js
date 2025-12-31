/**
 * A/B Testing Configuration System
 * 
 * This system supports multiple concurrent A/B tests with flexible routing strategies.
 * Each test can have its own traffic allocation, path matching, and routing configuration.
 * 
 * To add a new test, simply add a new object to the AB_TESTS array below.
 */

// Global master switch - set to false to disable ALL tests
const AB_TESTING_GLOBAL_ENABLED = true;

/**
 * A/B Test Configuration Array
 * Each object represents a single A/B test
 */
const AB_TESTS = [
  // Example 1: Simple 50/50 homepage test
  {
    id: 'homepage-redesign-2025',
    name: 'Homepage Redesign Test',
    enabled: true,
    priority: 10,
    trafficAllocation: { A: 50, B: 50 },
    pathMatching: {
      include: ['/'],
      exclude: [],
      matchType: 'exact',
    },
    variants: {
      A: {
        strategy: 'path-suffix',
        config: { suffix: '' }, // Original path
      },
      B: {
        strategy: 'path-suffix',
        config: { suffix: '-v2' },
      },
    },
    description: 'Testing new homepage design vs current',
  },

  // Example 2: 80/20 gradual rollout test
  {
    id: 'pricing-page-update',
    name: 'Pricing Page Update',
    enabled: true,
    priority: 8,
    trafficAllocation: { A: 80, B: 20 },
    pathMatching: {
      include: ['/pricing', '/pricing/*'],
      exclude: ['/pricing/admin/*'],
      matchType: 'wildcard',
    },
    variants: {
      A: {
        strategy: 'path-suffix',
        config: { suffix: '' },
      },
      B: {
        strategy: 'different-origin',
        config: { origin: 'https://v2.example.com' },
      },
    },
    description: 'Gradual rollout of new pricing page',
  },

  // Example 3: A/B/C test with three variants
  {
    id: 'landing-page-variants',
    name: 'Landing Page A/B/C Test',
    enabled: true,
    priority: 5,
    trafficAllocation: { A: 33, B: 33, C: 34 },
    pathMatching: {
      include: ['/landing/*'],
      exclude: [],
      matchType: 'wildcard',
    },
    variants: {
      A: {
        strategy: 'path-suffix',
        config: { suffix: '' },
      },
      B: {
        strategy: 'path-suffix',
        config: { suffix: '-variant-b' },
      },
      C: {
        strategy: 'query-param',
        config: { param: 'variant=c' },
      },
    },
    description: 'Testing three different landing page designs',
  },

  // Example 4: Subdomain routing test
  {
    id: 'mobile-app-redirect',
    name: 'Mobile App Redirect Test',
    enabled: false, // Disabled example
    priority: 3,
    trafficAllocation: { A: 50, B: 50 },
    pathMatching: {
      include: ['/app/*'],
      exclude: [],
      matchType: 'wildcard',
    },
    variants: {
      A: {
        strategy: 'path-suffix',
        config: { suffix: '' },
      },
      B: {
        strategy: 'subdomain',
        config: { subdomain: 'app' },
      },
    },
    description: 'Testing subdomain routing for mobile app',
  },
];

/**
 * ============================================================================
 * A/B TESTING CORE FUNCTIONS
 * ============================================================================
 */

/**
 * Checks if A/B testing is globally enabled
 * @returns {boolean} True if A/B testing is enabled
 */
function isABTestingEnabled() {
  return AB_TESTING_GLOBAL_ENABLED;
}

/**
 * Validates a single test configuration
 * @param {Object} test - Test configuration object
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateTestConfig(test) {
  const errors = [];
  
  if (!test.id || typeof test.id !== 'string') {
    errors.push(`Test ${test.id || 'unknown'}: Missing or invalid 'id'`);
  }
  
  if (typeof test.enabled !== 'boolean') {
    errors.push(`Test ${test.id}: Missing or invalid 'enabled' flag`);
  }
  
  if (!test.trafficAllocation || typeof test.trafficAllocation !== 'object') {
    errors.push(`Test ${test.id}: Missing or invalid 'trafficAllocation'`);
  } else {
    const percentages = Object.values(test.trafficAllocation);
    const sum = percentages.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 0.01) {
      errors.push(`Test ${test.id}: trafficAllocation percentages must sum to 100 (got ${sum})`);
    }
    if (percentages.some(p => p < 0 || p > 100)) {
      errors.push(`Test ${test.id}: trafficAllocation percentages must be between 0 and 100`);
    }
  }
  
  if (!test.variants || typeof test.variants !== 'object') {
    errors.push(`Test ${test.id}: Missing or invalid 'variants'`);
  } else {
    const variantKeys = Object.keys(test.variants);
    const allocationKeys = Object.keys(test.trafficAllocation || {});
    if (variantKeys.length !== allocationKeys.length) {
      errors.push(`Test ${test.id}: Number of variants doesn't match trafficAllocation keys`);
    }
    variantKeys.forEach(variant => {
      if (!test.variants[variant].strategy) {
        errors.push(`Test ${test.id}: Variant ${variant} missing 'strategy'`);
      }
    });
  }
  
  if (!test.pathMatching || typeof test.pathMatching !== 'object') {
    errors.push(`Test ${test.id}: Missing or invalid 'pathMatching'`);
  }
  
  if (typeof test.priority !== 'number') {
    errors.push(`Test ${test.id}: Missing or invalid 'priority' (must be a number)`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates the entire A/B testing configuration
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateABTestConfig() {
  const errors = [];
  const warnings = [];
  
  if (!Array.isArray(AB_TESTS)) {
    errors.push('AB_TESTS must be an array');
    return { valid: false, errors, warnings };
  }
  
  const testIds = new Set();
  
  AB_TESTS.forEach((test, index) => {
    // Check for duplicate IDs
    if (testIds.has(test.id)) {
      errors.push(`Duplicate test ID: ${test.id}`);
    }
    testIds.add(test.id);
    
    // Validate individual test
    const validation = validateTestConfig(test);
    if (!validation.valid) {
      errors.push(...validation.errors);
    }
    
    // Check date ranges
    if (test.startDate && test.endDate) {
      const start = new Date(test.startDate);
      const end = new Date(test.endDate);
      if (start > end) {
        errors.push(`Test ${test.id}: startDate must be before endDate`);
      }
      const now = new Date();
      if (end < now) {
        warnings.push(`Test ${test.id}: endDate is in the past`);
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Checks if a path matches a pattern based on match type
 * @param {string} pathname - The path to check
 * @param {string} pattern - The pattern to match against
 * @param {string} matchType - 'exact', 'prefix', 'regex', or 'wildcard'
 * @returns {boolean} True if path matches
 */
function matchesPathPattern(pathname, pattern, matchType) {
  switch (matchType) {
    case 'exact':
      return pathname === pattern;
    
    case 'prefix':
      return pathname.startsWith(pattern);
    
    case 'regex':
      try {
        const regex = new RegExp(pattern);
        return regex.test(pathname);
      } catch (e) {
        console.error(`Invalid regex pattern: ${pattern}`, e);
        return false;
      }
    
    case 'wildcard':
      // Convert wildcard pattern to regex
      // * matches any characters except /
      // ** matches any characters including /
      const regexPattern = pattern
        .replace(/\*\*/g, '___DOUBLE_STAR___')
        .replace(/\*/g, '[^/]*')
        .replace(/___DOUBLE_STAR___/g, '.*');
      try {
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(pathname);
      } catch (e) {
        console.error(`Invalid wildcard pattern: ${pattern}`, e);
        return false;
      }
    
    default:
      console.warn(`Unknown matchType: ${matchType}, defaulting to exact match`);
      return pathname === pattern;
  }
}

/**
 * Checks if a path matches a test's path matching rules
 * @param {string} pathname - The path to check
 * @param {Object} pathMatching - Path matching configuration
 * @returns {boolean} True if path matches the test
 */
function pathMatchesTest(pathname, pathMatching) {
  const { include, exclude, matchType } = pathMatching;
  
  // Check exclusions first (takes precedence)
  if (exclude && exclude.length > 0) {
    for (const excludePattern of exclude) {
      if (matchesPathPattern(pathname, excludePattern, matchType)) {
        return false;
      }
    }
  }
  
  // Check includes
  if (!include || include.length === 0) {
    return false; // No includes means no match
  }
  
  for (const includePattern of include) {
    if (matchesPathPattern(pathname, includePattern, matchType)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Checks if a test is currently active (enabled, within date range)
 * @param {Object} test - Test configuration
 * @returns {boolean} True if test is active
 */
function isTestActive(test) {
  if (!test.enabled) {
    return false;
  }
  
  const now = new Date();
  
  if (test.startDate) {
    const start = new Date(test.startDate);
    if (now < start) {
      return false;
    }
  }
  
  if (test.endDate) {
    const end = new Date(test.endDate);
    if (now > end) {
      return false;
    }
  }
  
  return true;
}

/**
 * Gets all active tests that apply to a given path
 * @param {string} pathname - The request pathname
 * @returns {Array} Array of test objects, sorted by priority (highest first)
 */
function getActiveTests(pathname) {
  if (!isABTestingEnabled()) {
    return [];
  }
  
  const activeTests = AB_TESTS
    .filter(test => isTestActive(test))
    .filter(test => pathMatchesTest(pathname, test.pathMatching))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  return activeTests;
}

/**
 * Gets the highest priority active test for a path
 * @param {string} pathname - The request pathname
 * @returns {Object|null} The highest priority test or null
 */
function getPrimaryTest(pathname) {
  const activeTests = getActiveTests(pathname);
  return activeTests.length > 0 ? activeTests[0] : null;
}

/**
 * Hashes a string to a number between 0 and 100 for consistent variant assignment
 * @param {string} input - The string to hash
 * @returns {number} Hash value between 0 and 100
 */
function hashToPercentage(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100;
}

/**
 * Determines which variant a user should be assigned to for a specific test
 * @param {Object} test - Test configuration
 * @param {string} userId - User identifier (IP address or cookie value)
 * @returns {string} Variant identifier (A, B, C, etc.)
 */
function getVariantForTest(test, userId) {
  const { trafficAllocation } = test;
  const hashValue = hashToPercentage(`${test.id}-${userId}`);
  
  // Build cumulative ranges
  let cumulative = 0;
  const variants = Object.keys(trafficAllocation).sort();
  
  for (const variant of variants) {
    cumulative += trafficAllocation[variant];
    if (hashValue < cumulative) {
      return variant;
    }
  }
  
  // Fallback to first variant (shouldn't happen if config is valid)
  return variants[0] || 'A';
}

/**
 * ============================================================================
 * ROUTING STRATEGIES
 * ============================================================================
 * Each strategy is a function that transforms a URL based on variant configuration
 */

/**
 * Routing Strategy Registry
 * Maps strategy names to their implementation functions
 */
const ROUTING_STRATEGIES = {
  /**
   * Path Suffix Strategy
   * Adds a suffix to the path (e.g., /page.html -> /page-v2.html)
   * Config: { suffix: string, applyToExtensions?: string[] }
   */
  'path-suffix': (url, variantConfig) => {
    const { suffix = '' } = variantConfig.config || {};
    if (!suffix) {
      return url; // No transformation
    }
    
    const newUrl = new URL(url);
    const pathname = newUrl.pathname;
    
    // Check if path has a file extension
    const lastDot = pathname.lastIndexOf('.');
    const lastSlash = pathname.lastIndexOf('/');
    
    if (lastDot > lastSlash && lastDot !== -1) {
      // Has file extension
      const extension = pathname.substring(lastDot);
      const basePath = pathname.substring(0, lastDot);
      const extWithoutDot = extension.substring(1).toLowerCase();
      const applyToExtensions = variantConfig.config?.applyToExtensions || [];
      
      // If applyToExtensions is empty or includes this extension, insert suffix before extension
      if (applyToExtensions.length === 0 || applyToExtensions.includes(extWithoutDot)) {
        newUrl.pathname = `${basePath}${suffix}${extension}`;
        return newUrl;
      }
    }
    
    // No extension or extension not in list, append suffix
    newUrl.pathname = `${pathname}${suffix}`;
    return newUrl;
  },
  
  /**
   * Different Origin Strategy
   * Routes to a completely different origin
   * Config: { origin: string }
   */
  'different-origin': (url, variantConfig) => {
    const { origin } = variantConfig.config || {};
    if (!origin) {
      return url; // No transformation
    }
    
    return new URL(url.pathname + url.search, origin);
  },
  
  /**
   * Query Parameter Strategy
   * Adds a query parameter to the URL
   * Config: { param: string } (e.g., "version=new" or "variant=b")
   */
  'query-param': (url, variantConfig) => {
    const { param } = variantConfig.config || {};
    if (!param) {
      return url; // No transformation
    }
    
    const newUrl = new URL(url);
    const [key, value] = param.split('=');
    if (key && value) {
      newUrl.searchParams.set(key.trim(), value.trim());
    }
    return newUrl;
  },
  
  /**
   * Subdomain Strategy
   * Changes the subdomain of the URL
   * Config: { subdomain: string }
   */
  'subdomain': (url, variantConfig) => {
    const { subdomain } = variantConfig.config || {};
    if (!subdomain) {
      return url; // No transformation
    }
    
    const newUrl = new URL(url);
    const hostname = newUrl.hostname;
    const parts = hostname.split('.');
    
    if (parts.length >= 2) {
      // Replace first part (subdomain) with new subdomain
      parts[0] = subdomain;
      newUrl.hostname = parts.join('.');
    }
    
    return newUrl;
  },
};

/**
 * Transforms a URL based on test and variant
 * @param {URL} url - The original URL
 * @param {Object} test - Test configuration
 * @param {string} variant - Assigned variant (A, B, C, etc.)
 * @returns {URL} The transformed URL
 */
function transformUrlForTest(url, test, variant) {
  const variantConfig = test.variants[variant];
  if (!variantConfig) {
    console.warn(`Test ${test.id}: Variant ${variant} not found`);
    return url;
  }
  
  const strategy = variantConfig.strategy;
  const strategyFunction = ROUTING_STRATEGIES[strategy];
  
  if (!strategyFunction) {
    console.warn(`Test ${test.id}: Unknown routing strategy: ${strategy}`);
    return url;
  }
  
  return strategyFunction(url, variantConfig);
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
 * Parses cookies from request header
 * @param {Request} request - The incoming request
 * @returns {Object} Object mapping cookie names to values
 */
function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return {};
  }
  
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      acc[key.trim()] = decodeURIComponent(value);
    }
    return acc;
  }, {});
}

/**
 * Gets or assigns a variant for a specific test
 * Checks cookie first, then falls back to IP-based assignment
 * @param {Request} request - The incoming request
 * @param {Object} test - Test configuration
 * @returns {Object} Object with variant and isNewAssignment (boolean)
 */
function getOrAssignVariantForTest(request, test) {
  const cookieName = `smartcdn_test_${test.id}`;
  const cookies = parseCookies(request);
  
  // Check for existing cookie
  if (cookies[cookieName]) {
    const variant = cookies[cookieName];
    // Validate variant exists in test
    if (test.variants[variant]) {
      console.log(`A/B Test [${test.id}]: Existing variant found in cookie - ${variant}`);
      return {
        variant,
        isNewAssignment: false,
      };
    }
  }
  
  // No valid cookie found, assign based on IP address + test ID
  const clientIP = getClientIP(request);
  const variant = getVariantForTest(test, clientIP);
  
  console.log(`A/B Test [${test.id}]: New assignment - IP: ${clientIP}, Variant: ${variant}`);
  
  return {
    variant,
    isNewAssignment: true,
  };
}

/**
 * Sets a test-specific variant cookie in the response
 * @param {Response} response - The response to modify
 * @param {string} testId - The test ID
 * @param {string} variant - The variant ('A', 'B', 'C', etc.)
 * @returns {Response} The response with the cookie set
 */
function setTestVariantCookie(response, testId, variant) {
  const cookieName = `smartcdn_test_${testId}`;
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
      // Validate A/B test configuration on first request (could be optimized with caching)
      // In production, you might want to validate once at startup
      const configValidation = validateABTestConfig();
      if (!configValidation.valid) {
        console.error('A/B Test Configuration Errors:', configValidation.errors);
        // Continue with request but log errors
      }
      if (configValidation.warnings.length > 0) {
        console.warn('A/B Test Configuration Warnings:', configValidation.warnings);
      }
      
      // Extract request information
      const url = new URL(request.url);
      const method = request.method;
      const headers = Object.fromEntries(request.headers.entries());

      // Get primary A/B test for this path (highest priority)
      const primaryTest = getPrimaryTest(url.pathname);
      let testInfo = null;
      let routingUrl = url;
      let routingInfo = null;

      if (primaryTest) {
        // Get or assign variant for this test
        const variantInfo = getOrAssignVariantForTest(request, primaryTest);
        const variant = variantInfo.variant;
        const isNewAssignment = variantInfo.isNewAssignment;

        // Transform URL based on test and variant
        routingUrl = transformUrlForTest(url, primaryTest, variant);
        
        testInfo = {
          testId: primaryTest.id,
          testName: primaryTest.name,
          variant,
          isNewAssignment,
          routed: routingUrl.href !== url.href,
        };

        if (routingUrl.href !== url.href) {
          routingInfo = {
            originalPath: url.pathname,
            routedPath: routingUrl.pathname,
            originalOrigin: url.origin,
            routedOrigin: routingUrl.origin,
            strategy: primaryTest.variants[variant].strategy,
          };
        }

        console.log(`A/B Test [${primaryTest.id}]: Variant ${variant}`, isNewAssignment ? '(new assignment)' : '(from cookie)');
        if (routingInfo) {
          console.log('A/B Test Routing:', JSON.stringify(routingInfo, null, 2));
        }
      }

      // Log basic request information
      console.log(`[${new Date().toISOString()}] ${method} ${url.pathname}`);
      console.log('Request URL:', url.href);
      console.log('Request Method:', method);
      if (testInfo) {
        console.log('A/B Test:', testInfo.testName, `(${testInfo.testId})`);
        console.log('A/B Test Variant:', testInfo.variant);
        if (routingInfo) {
          console.log('Routed URL:', routingUrl.href);
        }
      } else {
        console.log('A/B Testing: No active test for this path');
      }
      console.log('Request Headers:', JSON.stringify(headers, null, 2));

      // Handle different request methods
      switch (method) {
        case 'GET':
          // Generate custom cache key (normalizes query params)
          // Use routed URL if A/B testing is active
          const cache = caches.default;
          const cacheKeyUrl = testInfo && testInfo.routed ? routingUrl : url;
          let cacheKey = generateCacheKey(request, cacheKeyUrl);
          
          // Add test ID and variant to cache key if testing is active
          // This ensures different variants are cached separately
          if (testInfo) {
            const variantCacheKeyUrl = new URL(cacheKey.url);
            variantCacheKeyUrl.searchParams.set('_test', testInfo.testId);
            variantCacheKeyUrl.searchParams.set('_variant', testInfo.variant);
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
            
            // Add test info headers to cached response
            const cachedResponseWithTest = new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers: cachedResponse.headers,
            });
            
            if (testInfo) {
              cachedResponseWithTest.headers.set('X-AB-Test-Id', testInfo.testId);
              cachedResponseWithTest.headers.set('X-AB-Test-Variant', testInfo.variant);
            }
            
            // Set cookie if this is a new assignment (cookie might have been cleared)
            let finalCachedResponse = cachedResponseWithTest;
            if (testInfo && testInfo.isNewAssignment) {
              finalCachedResponse = setTestVariantCookie(cachedResponseWithTest, testInfo.testId, testInfo.variant);
            }
            
            // Check for conditional request (If-None-Match, If-Modified-Since)
            const conditionalResponse = handleConditionalRequest(request, finalCachedResponse);
            if (conditionalResponse) {
              console.log('Conditional request validated - returning 304 Not Modified');
              // Still set cookie on 304 responses if needed
              if (testInfo && testInfo.isNewAssignment) {
                return setTestVariantCookie(conditionalResponse, testInfo.testId, testInfo.variant);
              }
              return conditionalResponse;
            }
            
            return finalCachedResponse;
          }
          
          console.log('Cache MISS for:', url.pathname);
          
          // Fetch from origin using routed URL if A/B testing is active
          // In a real scenario, you would fetch from origin here
          let originResponse = null;
          if (testInfo && routingInfo && routingInfo.routedOrigin !== routingInfo.originalOrigin) {
            // Different origin - fetch from variant origin
            console.log(`Fetching from variant origin: ${routingUrl.href}`);
            // Uncomment when ready to fetch from origin:
            // const originRequest = new Request(routingUrl.href, {
            //   method: request.method,
            //   headers: request.headers,
            // });
            // originResponse = await fetch(originRequest);
          } else if (testInfo && routingInfo) {
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
          });
          
          // Add test info headers if A/B testing is active
          if (testInfo) {
            responseHeaders.set('X-AB-Test-Id', testInfo.testId);
            responseHeaders.set('X-AB-Test-Name', testInfo.testName);
            responseHeaders.set('X-AB-Test-Variant', testInfo.variant);
            
            // Add routing info header if routing occurred
            if (routingInfo) {
              responseHeaders.set('X-AB-Test-Routed', 'true');
              responseHeaders.set('X-AB-Test-Original-Path', routingInfo.originalPath);
              responseHeaders.set('X-AB-Test-Routed-Path', routingInfo.routedPath);
              responseHeaders.set('X-AB-Test-Strategy', routingInfo.strategy);
            }
          }
          
          // Apply cache headers (respects origin headers if available)
          // Use routed pathname for cache TTL calculation
          const pathnameForCache = testInfo && testInfo.routed ? routingUrl.pathname : url.pathname;
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
          
          // Set test variant cookie if this is a new assignment
          if (testInfo && testInfo.isNewAssignment) {
            response = setTestVariantCookie(response, testInfo.testId, testInfo.variant);
          }
          
          // Check for conditional request before caching
          const conditionalCheck = handleConditionalRequest(request, response);
          if (conditionalCheck) {
            console.log('Conditional request validated - returning 304 Not Modified');
            // Still set cookie on 304 responses if needed
            if (testInfo && testInfo.isNewAssignment) {
              return setTestVariantCookie(conditionalCheck, testInfo.testId, testInfo.variant);
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

          const postHeaders = new Headers({
            "Content-Type": "text/plain",
            "X-Request-Method": method,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          });
          
          if (testInfo) {
            postHeaders.set("X-AB-Test-Id", testInfo.testId);
            postHeaders.set("X-AB-Test-Variant", testInfo.variant);
          }

          let postResponse = new Response("Hello from SmartCDN - POST request received", {
            status: 201,
            headers: postHeaders,
          });
          
          // Set test variant cookie if this is a new assignment
          if (testInfo && testInfo.isNewAssignment) {
            postResponse = setTestVariantCookie(postResponse, testInfo.testId, testInfo.variant);
          }
          
          return postResponse;

        case 'PUT':
          const putHeaders = new Headers({
            "Content-Type": "text/plain",
            "X-Request-Method": method,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          });
          if (testInfo) {
            putHeaders.set("X-AB-Test-Id", testInfo.testId);
            putHeaders.set("X-AB-Test-Variant", testInfo.variant);
          }
          let putResponse = new Response("Hello from SmartCDN - PUT request received", {
            status: 200,
            headers: putHeaders,
          });
          if (testInfo && testInfo.isNewAssignment) {
            putResponse = setTestVariantCookie(putResponse, testInfo.testId, testInfo.variant);
          }
          return putResponse;

        case 'DELETE':
          const deleteHeaders = new Headers({
            "Content-Type": "text/plain",
            "X-Request-Method": method,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          });
          if (testInfo) {
            deleteHeaders.set("X-AB-Test-Id", testInfo.testId);
            deleteHeaders.set("X-AB-Test-Variant", testInfo.variant);
          }
          let deleteResponse = new Response("Hello from SmartCDN - DELETE request received", {
            status: 200,
            headers: deleteHeaders,
          });
          if (testInfo && testInfo.isNewAssignment) {
            deleteResponse = setTestVariantCookie(deleteResponse, testInfo.testId, testInfo.variant);
          }
          return deleteResponse;

        case 'PATCH':
          const patchHeaders = new Headers({
            "Content-Type": "text/plain",
            "X-Request-Method": method,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          });
          if (testInfo) {
            patchHeaders.set("X-AB-Test-Id", testInfo.testId);
            patchHeaders.set("X-AB-Test-Variant", testInfo.variant);
          }
          let patchResponse = new Response("Hello from SmartCDN - PATCH request received", {
            status: 200,
            headers: patchHeaders,
          });
          if (testInfo && testInfo.isNewAssignment) {
            patchResponse = setTestVariantCookie(patchResponse, testInfo.testId, testInfo.variant);
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
          const headCacheKeyUrl = testInfo && testInfo.routed ? routingUrl : url;
          let headCacheKey = generateCacheKey(request, headCacheKeyUrl);
          
          // Add test ID and variant to cache key if testing is active
          if (testInfo) {
            const headVariantCacheKeyUrl = new URL(headCacheKey.url);
            headVariantCacheKeyUrl.searchParams.set('_test', testInfo.testId);
            headVariantCacheKeyUrl.searchParams.set('_variant', testInfo.variant);
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
            
            // Add test info headers to cached response
            const cachedHeadResponseWithTest = new Response(null, {
              status: cachedHeadResponse.status,
              statusText: cachedHeadResponse.statusText,
              headers: cachedHeadResponse.headers,
            });
            
            if (testInfo) {
              cachedHeadResponseWithTest.headers.set('X-AB-Test-Id', testInfo.testId);
              cachedHeadResponseWithTest.headers.set('X-AB-Test-Variant', testInfo.variant);
            }
            
            // Set cookie if this is a new assignment
            let finalCachedHeadResponse = cachedHeadResponseWithTest;
            if (testInfo && testInfo.isNewAssignment) {
              finalCachedHeadResponse = setTestVariantCookie(cachedHeadResponseWithTest, testInfo.testId, testInfo.variant);
            }
            
            // Check for conditional request
            const headConditionalResponse = handleConditionalRequest(request, finalCachedHeadResponse);
            if (headConditionalResponse) {
              console.log('Conditional request validated (HEAD) - returning 304 Not Modified');
              // Still set cookie on 304 responses if needed
              if (testInfo && testInfo.isNewAssignment) {
                return setTestVariantCookie(headConditionalResponse, testInfo.testId, testInfo.variant);
              }
              return headConditionalResponse;
            }
            
            return finalCachedHeadResponse;
          }
          
          console.log('Cache MISS (HEAD) for:', url.pathname);
          
          // Fetch from origin using routed URL if A/B testing is active
          let headOriginResponse = null;
          if (testInfo && routingInfo) {
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
          });
          
          // Add test info headers if A/B testing is active
          if (testInfo) {
            headResponseHeaders.set('X-AB-Test-Id', testInfo.testId);
            headResponseHeaders.set('X-AB-Test-Name', testInfo.testName);
            headResponseHeaders.set('X-AB-Test-Variant', testInfo.variant);
            
            // Add routing info header if routing occurred
            if (routingInfo) {
              headResponseHeaders.set('X-AB-Test-Routed', 'true');
              headResponseHeaders.set('X-AB-Test-Original-Path', routingInfo.originalPath);
              headResponseHeaders.set('X-AB-Test-Routed-Path', routingInfo.routedPath);
              headResponseHeaders.set('X-AB-Test-Strategy', routingInfo.strategy);
            }
          }
          
          // Apply cache headers (use routed pathname for cache TTL)
          const headPathnameForCache = testInfo && testInfo.routed ? routingUrl.pathname : url.pathname;
          applyCacheHeaders(headOriginResponse, headPathnameForCache, headResponseHeaders);
          
          const headTtlSeconds = getCacheTTL(headPathnameForCache);
          console.log(`Cache TTL (HEAD): ${headTtlSeconds} seconds (${Math.round(headTtlSeconds / 60)} minutes)`);
          
          let headResponse = new Response(null, {
            status: 200,
            headers: headResponseHeaders,
          });
          
          // Set test variant cookie if this is a new assignment
          if (testInfo && testInfo.isNewAssignment) {
            headResponse = setTestVariantCookie(headResponse, testInfo.testId, testInfo.variant);
          }
          
          // Check for conditional request
          const headConditionalCheck = handleConditionalRequest(request, headResponse);
          if (headConditionalCheck) {
            console.log('Conditional request validated (HEAD) - returning 304 Not Modified');
            // Still set cookie on 304 responses if needed
            if (testInfo && testInfo.isNewAssignment) {
              return setTestVariantCookie(headConditionalCheck, testInfo.testId, testInfo.variant);
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

