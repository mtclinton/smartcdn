/**
 * Geographic Routing Utilities
 * 
 * Functions for determining the appropriate origin server based on geographic location
 */

import { getGeoRoutingConfig, isGeoRoutingEnabled, GEO_ROUTING_ENABLED } from '../config/geo-routing.js';

/**
 * Country to Region Mapping
 * Maps ISO 3166-1 alpha-2 country codes to regions
 */
const COUNTRY_TO_REGION = {
  // North America
  'US': 'north-america', // United States
  'CA': 'north-america', // Canada
  'MX': 'north-america', // Mexico
  'GT': 'north-america', // Guatemala
  'BZ': 'north-america', // Belize
  'SV': 'north-america', // El Salvador
  'HN': 'north-america', // Honduras
  'NI': 'north-america', // Nicaragua
  'CR': 'north-america', // Costa Rica
  'PA': 'north-america', // Panama
  'CU': 'north-america', // Cuba
  'JM': 'north-america', // Jamaica
  'HT': 'north-america', // Haiti
  'DO': 'north-america', // Dominican Republic
  'BS': 'north-america', // Bahamas
  'BB': 'north-america', // Barbados
  'TT': 'north-america', // Trinidad and Tobago
  'GD': 'north-america', // Grenada
  'LC': 'north-america', // Saint Lucia
  'VC': 'north-america', // Saint Vincent and the Grenadines
  'AG': 'north-america', // Antigua and Barbuda
  'DM': 'north-america', // Dominica
  'KN': 'north-america', // Saint Kitts and Nevis
  
  // Europe
  'GB': 'europe', // United Kingdom
  'IE': 'europe', // Ireland
  'FR': 'europe', // France
  'DE': 'europe', // Germany
  'IT': 'europe', // Italy
  'ES': 'europe', // Spain
  'PT': 'europe', // Portugal
  'NL': 'europe', // Netherlands
  'BE': 'europe', // Belgium
  'LU': 'europe', // Luxembourg
  'CH': 'europe', // Switzerland
  'AT': 'europe', // Austria
  'PL': 'europe', // Poland
  'CZ': 'europe', // Czech Republic
  'SK': 'europe', // Slovakia
  'HU': 'europe', // Hungary
  'RO': 'europe', // Romania
  'BG': 'europe', // Bulgaria
  'GR': 'europe', // Greece
  'SE': 'europe', // Sweden
  'NO': 'europe', // Norway
  'DK': 'europe', // Denmark
  'FI': 'europe', // Finland
  'IS': 'europe', // Iceland
  'EE': 'europe', // Estonia
  'LV': 'europe', // Latvia
  'LT': 'europe', // Lithuania
  'SI': 'europe', // Slovenia
  'HR': 'europe', // Croatia
  'RS': 'europe', // Serbia
  'BA': 'europe', // Bosnia and Herzegovina
  'MK': 'europe', // North Macedonia
  'AL': 'europe', // Albania
  'ME': 'europe', // Montenegro
  'XK': 'europe', // Kosovo
  'UA': 'europe', // Ukraine
  'BY': 'europe', // Belarus
  'MD': 'europe', // Moldova
  'RU': 'europe', // Russia (European part)
  
  // Asia
  'CN': 'asia', // China
  'JP': 'asia', // Japan
  'KR': 'asia', // South Korea
  'IN': 'asia', // India
  'ID': 'asia', // Indonesia
  'PH': 'asia', // Philippines
  'VN': 'asia', // Vietnam
  'TH': 'asia', // Thailand
  'MY': 'asia', // Malaysia
  'SG': 'asia', // Singapore
  'BN': 'asia', // Brunei
  'MM': 'asia', // Myanmar
  'LA': 'asia', // Laos
  'KH': 'asia', // Cambodia
  'TW': 'asia', // Taiwan
  'HK': 'asia', // Hong Kong
  'MO': 'asia', // Macau
  'MN': 'asia', // Mongolia
  'KP': 'asia', // North Korea
  'BD': 'asia', // Bangladesh
  'PK': 'asia', // Pakistan
  'AF': 'asia', // Afghanistan
  'IR': 'asia', // Iran
  'IQ': 'asia', // Iraq
  'SA': 'asia', // Saudi Arabia
  'AE': 'asia', // United Arab Emirates
  'OM': 'asia', // Oman
  'YE': 'asia', // Yemen
  'KW': 'asia', // Kuwait
  'QA': 'asia', // Qatar
  'BH': 'asia', // Bahrain
  'JO': 'asia', // Jordan
  'LB': 'asia', // Lebanon
  'SY': 'asia', // Syria
  'IL': 'asia', // Israel
  'PS': 'asia', // Palestine
  'TR': 'asia', // Turkey (partially in Asia)
  'GE': 'asia', // Georgia
  'AM': 'asia', // Armenia
  'AZ': 'asia', // Azerbaijan
  'KZ': 'asia', // Kazakhstan
  'UZ': 'asia', // Uzbekistan
  'TM': 'asia', // Turkmenistan
  'TJ': 'asia', // Tajikistan
  'KG': 'asia', // Kyrgyzstan
  'LK': 'asia', // Sri Lanka
  'MV': 'asia', // Maldives
  'NP': 'asia', // Nepal
  'BT': 'asia', // Bhutan
};

/**
 * Determines the region for a given country code
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'JP')
 * @returns {string} Region name ('north-america', 'europe', 'asia', or 'default')
 */
export function getRegionForCountry(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') {
    return 'default';
  }
  
  const upperCountryCode = countryCode.toUpperCase();
  return COUNTRY_TO_REGION[upperCountryCode] || 'default';
}

/**
 * Gets the origin URL for a given region
 * @param {string} region - Region name ('north-america', 'europe', 'asia', 'default')
 * @param {Object} env - Worker environment object (optional)
 * @returns {string} Origin URL
 */
export function getOriginForRegion(region, env = {}) {
  const config = getGeoRoutingConfig(env);
  const regionConfig = config[region];
  if (!regionConfig) {
    // Fallback to default if region not found
    return config.default.origin;
  }
  return regionConfig.origin;
}

/**
 * Determines the appropriate origin URL based on country code
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code from request.cf.country
 * @param {Object} env - Worker environment object (optional)
 * @returns {string} Origin URL for the region
 */
export function getOriginForCountry(countryCode, env = {}) {
  if (!isGeoRoutingEnabled(env)) {
    const config = getGeoRoutingConfig(env);
    return config.default.origin;
  }
  
  const region = getRegionForCountry(countryCode);
  return getOriginForRegion(region, env);
}

/**
 * Gets geographic routing information for a request
 * @param {Request} request - The incoming request
 * @param {Object} env - Worker environment object (optional)
 * @param {boolean} featureFlagEnabled - Whether feature flag is enabled (optional, will check if not provided)
 * @returns {Object} Geographic routing information
 */
export async function getGeoRoutingInfo(request, env = {}, featureFlagEnabled = null) {
  // Check feature flag if not provided
  if (featureFlagEnabled === null) {
    const { isGeoRoutingEnabled: checkGeoRouting } = await import('./feature-flags.js');
    featureFlagEnabled = await checkGeoRouting(env);
  }
  
  const configEnabled = isGeoRoutingEnabled(env);
  const config = getGeoRoutingConfig(env);
  
  // Feature flag takes precedence over config
  if (!featureFlagEnabled || !configEnabled) {
    return {
      enabled: false,
      country: null,
      region: 'default',
      origin: config.default.origin,
    };
  }
  
  // Get country from Cloudflare's request.cf object
  // Note: In Cloudflare Workers, request.cf.country is available
  const country = request.cf?.country || null;
  const region = getRegionForCountry(country);
  const origin = getOriginForRegion(region, env);
  
  return {
    enabled: true,
    country: country,
    region: region,
    origin: origin,
  };
}

/**
 * Builds a full URL for fetching from the geographic origin
 * @param {URL} originalUrl - The original request URL
 * @param {string} originUrl - The origin base URL
 * @returns {URL} Full URL pointing to the origin server
 */
export function buildOriginUrl(originalUrl, originUrl) {
  // Ensure originUrl doesn't end with a slash
  const cleanOriginUrl = originUrl.endsWith('/') ? originUrl.slice(0, -1) : originUrl;
  
  // Build path - ensure pathname starts with / but handle empty pathname
  let path = originalUrl.pathname || '/';
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  // Add search params if they exist
  const search = originalUrl.search || '';
  const fullPath = path + search;
  
  // Construct URL - using string concatenation is more reliable for Worker-to-Worker
  const fullUrl = cleanOriginUrl + fullPath;
  
  // Return as URL object for compatibility
  return new URL(fullUrl);
}

