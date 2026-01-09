/**
 * Variant Management Utilities
 * 
 * Functions for managing A/B test variant assignment and cookies
 */

import { getClientIP } from './request.js';
import { getVariantForTest } from './ab-testing.js';
import { parseCookies } from './request.js';

/**
 * Gets or assigns a variant for a specific test
 * Checks cookie first, then falls back to IP-based assignment
 * @param {Request} request - The incoming request
 * @param {Object} test - Test configuration
 * @returns {Object} Object with variant and isNewAssignment (boolean)
 */
export function getOrAssignVariantForTest(request, test) {
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
export function setTestVariantCookie(response, testId, variant) {
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


