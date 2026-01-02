/**
 * Cache Bypass Configuration
 * 
 * Defines rules for when to bypass the cache
 */

/**
 * Global master switch for cache bypass rules
 */
export const CACHE_BYPASS_ENABLED = true;

/**
 * Cache Bypass Rules Configuration
 */
export const CACHE_BYPASS_RULES = {
  /**
   * Cookie-based bypass rules
   * If any of these cookies are present, cache is bypassed
   */
  cookies: {
    enabled: true,
    cookies: [
      'sessionid',        // Common session cookie
      'PHPSESSID',        // PHP session cookie
      'JSESSIONID',       // Java session cookie
      'ASP.NET_SessionId', // ASP.NET session cookie
      'auth_token',       // Authentication token
      'access_token',     // Access token
      'refresh_token',    // Refresh token
      'logged_in',        // Login status cookie
      'user_session',    // User session cookie
    ],
    // Match mode: 'exact' (exact match) or 'prefix' (starts with)
    matchMode: 'exact',
  },

  /**
   * User-Agent-based bypass rules
   * If user agent matches any pattern, cache is bypassed
   */
  userAgents: {
    enabled: true,
    patterns: [
      // Bot user agents that should get fresh content
      'Googlebot',           // Google bot
      'Bingbot',             // Bing bot
      'Slurp',               // Yahoo bot
      'DuckDuckBot',         // DuckDuckGo bot
      'Baiduspider',         // Baidu bot
      'YandexBot',           // Yandex bot
      'facebookexternalhit', // Facebook crawler
      'Twitterbot',          // Twitter bot
      'LinkedInBot',         // LinkedIn bot
      'WhatsApp',            // WhatsApp crawler
      'Applebot',            // Apple bot
      'SemrushBot',          // SEMrush bot
      'AhrefsBot',           // Ahrefs bot
      'MJ12bot',             // Majestic bot
      'DotBot',              // DotBot
      'Barkrowler',          // Barkrowler
      'BLEXBot',             // BLEXBot
      'BLEXBot',             // BLEXBot
    ],
    // Match mode: 'contains' (substring match) or 'regex' (regex match)
    matchMode: 'contains',
    // Case sensitive matching
    caseSensitive: false,
  },

  /**
   * Cache-Control header bypass
   * If request has Cache-Control: no-cache, bypass cache
   */
  cacheControl: {
    enabled: true,
    // Bypass on these Cache-Control directives
    bypassDirectives: [
      'no-cache',
      'no-store',
    ],
  },

  /**
   * Authorization header bypass
   * If Authorization header is present, bypass cache
   */
  authorization: {
    enabled: true,
    // Bypass on any Authorization header
    // Can be configured to bypass only on specific auth types
    bypassAuthTypes: [
      'Bearer',
      'Basic',
      'Digest',
      'OAuth',
    ],
    // If true, bypass on any Authorization header regardless of type
    bypassAnyAuth: true,
  },

  /**
   * Custom bypass rules
   * Add custom logic here
   */
  custom: {
    enabled: false,
    // Custom bypass function (optional)
    // Should return true if cache should be bypassed
    // function: (request) => { return false; },
  },
};

/**
 * Gets bypass reason for logging/debugging
 * @param {string} reason - Bypass reason code
 * @returns {string} Human-readable bypass reason
 */
export function getBypassReasonDescription(reason) {
  const reasons = {
    'cookie': 'Request contains bypass cookie',
    'user-agent': 'Request from bypass user agent',
    'cache-control': 'Request has Cache-Control: no-cache',
    'authorization': 'Request has Authorization header',
    'custom': 'Custom bypass rule matched',
  };
  return reasons[reason] || 'Unknown bypass reason';
}

