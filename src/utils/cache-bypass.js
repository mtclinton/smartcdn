/**
 * Cache Bypass Utilities
 * 
 * Functions for determining if a request should bypass the cache
 */

import { CACHE_BYPASS_ENABLED, CACHE_BYPASS_RULES, getBypassReasonDescription } from '../config/cache-bypass.js';
import { parseCookies } from './request.js';

/**
 * Checks if a cookie matches bypass rules
 * @param {Request} request - The incoming request
 * @param {Object} cookieRules - Cookie bypass rules configuration
 * @returns {Object|null} Bypass info if matched, null otherwise
 */
function checkCookieBypass(request, cookieRules) {
  if (!cookieRules.enabled) {
    return null;
  }

  const cookies = parseCookies(request);
  const { cookies: bypassCookies, matchMode } = cookieRules;

  for (const cookieName of bypassCookies) {
    if (matchMode === 'exact') {
      if (cookies[cookieName] !== undefined) {
        return {
          reason: 'cookie',
          matchedRule: cookieName,
          description: getBypassReasonDescription('cookie'),
        };
      }
    } else if (matchMode === 'prefix') {
      // Check if any cookie name starts with the prefix
      for (const cookieKey in cookies) {
        if (cookieKey.startsWith(cookieName)) {
          return {
            reason: 'cookie',
            matchedRule: cookieName,
            description: getBypassReasonDescription('cookie'),
          };
        }
      }
    }
  }

  return null;
}

/**
 * Checks if user agent matches bypass rules
 * @param {Request} request - The incoming request
 * @param {Object} userAgentRules - User-Agent bypass rules configuration
 * @returns {Object|null} Bypass info if matched, null otherwise
 */
function checkUserAgentBypass(request, userAgentRules) {
  if (!userAgentRules.enabled) {
    return null;
  }

  const userAgent = request.headers.get('User-Agent');
  if (!userAgent) {
    return null;
  }

  const { patterns, matchMode, caseSensitive } = userAgentRules;
  const testUserAgent = caseSensitive ? userAgent : userAgent.toLowerCase();

  for (const pattern of patterns) {
    const testPattern = caseSensitive ? pattern : pattern.toLowerCase();

    if (matchMode === 'contains') {
      if (testUserAgent.includes(testPattern)) {
        return {
          reason: 'user-agent',
          matchedRule: pattern,
          description: getBypassReasonDescription('user-agent'),
        };
      }
    } else if (matchMode === 'regex') {
      try {
        const regex = new RegExp(testPattern, caseSensitive ? '' : 'i');
        if (regex.test(userAgent)) {
          return {
            reason: 'user-agent',
            matchedRule: pattern,
            description: getBypassReasonDescription('user-agent'),
          };
        }
      } catch (e) {
        console.warn(`Invalid regex pattern in user-agent bypass rules: ${pattern}`, e);
      }
    }
  }

  return null;
}

/**
 * Checks if Cache-Control header indicates bypass
 * @param {Request} request - The incoming request
 * @param {Object} cacheControlRules - Cache-Control bypass rules configuration
 * @returns {Object|null} Bypass info if matched, null otherwise
 */
function checkCacheControlBypass(request, cacheControlRules) {
  if (!cacheControlRules.enabled) {
    return null;
  }

  const cacheControl = request.headers.get('Cache-Control');
  if (!cacheControl) {
    return null;
  }

  const directives = cacheControl.toLowerCase();
  const { bypassDirectives } = cacheControlRules;

  for (const directive of bypassDirectives) {
    if (directives.includes(directive.toLowerCase())) {
      return {
        reason: 'cache-control',
        matchedRule: directive,
        description: getBypassReasonDescription('cache-control'),
      };
    }
  }

  return null;
}

/**
 * Checks if Authorization header indicates bypass
 * @param {Request} request - The incoming request
 * @param {Object} authRules - Authorization bypass rules configuration
 * @returns {Object|null} Bypass info if matched, null otherwise
 */
function checkAuthorizationBypass(request, authRules) {
  if (!authRules.enabled) {
    return null;
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return null;
  }

  const { bypassAnyAuth, bypassAuthTypes } = authRules;

  // If bypassAnyAuth is true, bypass on any Authorization header
  if (bypassAnyAuth) {
    return {
      reason: 'authorization',
      matchedRule: 'any',
      description: getBypassReasonDescription('authorization'),
    };
  }

  // Otherwise, check specific auth types
  for (const authType of bypassAuthTypes) {
    if (authorization.startsWith(authType)) {
      return {
        reason: 'authorization',
        matchedRule: authType,
        description: getBypassReasonDescription('authorization'),
      };
    }
  }

  return null;
}

/**
 * Checks if request should bypass cache based on all configured rules
 * @param {Request} request - The incoming request
 * @returns {Object|null} Bypass info if cache should be bypassed, null otherwise
 */
export function shouldBypassCache(request) {
  if (!CACHE_BYPASS_ENABLED) {
    return null;
  }

  const rules = CACHE_BYPASS_RULES;

  // Check cookie-based bypass
  const cookieBypass = checkCookieBypass(request, rules.cookies);
  if (cookieBypass) {
    return cookieBypass;
  }

  // Check user-agent-based bypass
  const userAgentBypass = checkUserAgentBypass(request, rules.userAgents);
  if (userAgentBypass) {
    return userAgentBypass;
  }

  // Check Cache-Control header bypass
  const cacheControlBypass = checkCacheControlBypass(request, rules.cacheControl);
  if (cacheControlBypass) {
    return cacheControlBypass;
  }

  // Check Authorization header bypass
  const authBypass = checkAuthorizationBypass(request, rules.authorization);
  if (authBypass) {
    return authBypass;
  }

  // Check custom bypass rules
  if (rules.custom.enabled && typeof rules.custom.function === 'function') {
    try {
      if (rules.custom.function(request)) {
        return {
          reason: 'custom',
          matchedRule: 'custom',
          description: getBypassReasonDescription('custom'),
        };
      }
    } catch (e) {
      console.error('Error in custom bypass function:', e);
    }
  }

  return null;
}

/**
 * Gets a human-readable bypass reason
 * @param {Object} bypassInfo - Bypass info object
 * @returns {string} Human-readable bypass reason
 */
export function getBypassReason(bypassInfo) {
  if (!bypassInfo) {
    return null;
  }
  return `${bypassInfo.description} (${bypassInfo.matchedRule})`;
}

