/**
 * Region-Specific Content Utilities
 * 
 * Functions for determining and serving region-specific content based on country/region
 */

import { REGION_CONTENT_ENABLED, REGION_CONTENT_MAPPINGS } from '../config/region-content.js';
import { matchesPathPattern } from './ab-testing.js';
import { getRegionForCountry } from './geo-routing.js';

/**
 * Checks if region-specific content is globally enabled
 * @returns {boolean} True if region-specific content is enabled
 */
export function isRegionContentEnabled() {
  return REGION_CONTENT_ENABLED;
}

/**
 * Checks if a path matches a region content mapping
 * @param {string} pathname - The path to check
 * @param {Object} mapping - Region content mapping configuration
 * @returns {boolean} True if path matches
 */
export function pathMatchesRegionContent(pathname, mapping) {
  if (!mapping.enabled) {
    return false;
  }

  const { paths, matchType } = mapping;
  
  if (!paths || paths.length === 0) {
    return false;
  }

  for (const pattern of paths) {
    if (matchesPathPattern(pathname, pattern, matchType)) {
      return true;
    }
  }

  return false;
}

/**
 * Gets the region-specific content path for a given mapping and country
 * @param {Object} mapping - Region content mapping configuration
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @param {string} region - Region name (north-america, europe, asia, default)
 * @returns {string} Content path/URL
 */
export function getRegionContentPath(mapping, countryCode, region) {
  const { contentMap, defaultContent } = mapping;

  // First, try country-specific content
  if (countryCode && contentMap[countryCode]) {
    return contentMap[countryCode];
  }

  // Then, try region-specific content
  if (region && contentMap[region]) {
    return contentMap[region];
  }

  // Fallback to default content
  return defaultContent || null;
}

/**
 * Gets region-specific content information for a path
 * @param {string} pathname - The request pathname
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @param {string} region - Region name (north-america, europe, asia, default)
 * @returns {Object|null} Region content information or null if no match
 */
export function getRegionContentInfo(pathname, countryCode, region) {
  if (!isRegionContentEnabled()) {
    return null;
  }

  // Find the first matching mapping (can be extended to support priority/ordering)
  for (const mapping of REGION_CONTENT_MAPPINGS) {
    if (pathMatchesRegionContent(pathname, mapping)) {
      const contentPath = getRegionContentPath(mapping, countryCode, region);
      
      if (contentPath) {
        return {
          mappingId: mapping.id,
          mappingName: mapping.name,
          originalPath: pathname,
          contentPath: contentPath,
          country: countryCode,
          region: region,
          enabled: true,
        };
      }
    }
  }

  return null;
}

/**
 * Builds a full URL for region-specific content
 * @param {URL} originalUrl - The original request URL
 * @param {string} contentPath - The region-specific content path
 * @returns {URL} Full URL for the region-specific content
 */
export function buildRegionContentUrl(originalUrl, contentPath) {
  // If contentPath is a full URL, use it directly
  if (contentPath.startsWith('http://') || contentPath.startsWith('https://')) {
    return new URL(contentPath);
  }

  // Otherwise, replace the pathname with the content path
  // Preserve query parameters from the original URL
  const newUrl = new URL(originalUrl);
  newUrl.pathname = contentPath;
  return newUrl;
}

/**
 * Gets region-specific content information for a request
 * @param {Request} request - The incoming request
 * @param {string} pathname - The request pathname
 * @param {Object} geoRoutingInfo - Geographic routing information (optional)
 * @returns {Object|null} Region content information or null
 */
export function getRegionContentForRequest(request, pathname, geoRoutingInfo = null) {
  if (!isRegionContentEnabled()) {
    return null;
  }

  // Get country and region from geoRoutingInfo if available, otherwise from request
  let countryCode = null;
  let region = 'default';

  if (geoRoutingInfo && geoRoutingInfo.enabled) {
    countryCode = geoRoutingInfo.country;
    region = geoRoutingInfo.region;
  } else {
    // Fallback: get country directly from request
    countryCode = request.cf?.country || null;
    if (countryCode) {
      region = getRegionForCountry(countryCode);
    }
  }

  return getRegionContentInfo(pathname, countryCode, region);
}

