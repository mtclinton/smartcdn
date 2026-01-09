/**
 * Region-Specific Content Configuration
 * 
 * Maps paths to region-specific content based on country/region
 */

/**
 * Global master switch for region-specific content
 */
export const REGION_CONTENT_ENABLED = true;

/**
 * Region-Specific Content Mappings
 * 
 * Each entry defines:
 * - paths: Array of path patterns to match (supports wildcard patterns like '/promo/*')
 * - matchType: 'exact' or 'wildcard'
 * - contentMap: Object mapping country codes or regions to content paths/URLs
 * - defaultContent: Default content path/URL if country/region not found
 */
export const REGION_CONTENT_MAPPINGS = [
  {
    id: 'promo-content',
    name: 'Promotional Content',
    enabled: true,
    paths: ['/promo', '/promo/*'],
    matchType: 'wildcard',
    contentMap: {
      // Country-specific content
      'US': '/promo/us',
      'CA': '/promo/ca',
      'GB': '/promo/uk',
      'FR': '/promo/fr',
      'DE': '/promo/de',
      'JP': '/promo/jp',
      'CN': '/promo/cn',
      'IN': '/promo/in',
      'AU': '/promo/au',
      // Region-specific content (fallback)
      'north-america': '/promo/na',
      'europe': '/promo/eu',
      'asia': '/promo/asia',
    },
    defaultContent: '/promo/default',
    description: 'Region-specific promotional content',
  },
  {
    id: 'featured-content',
    name: 'Featured Content',
    enabled: true,
    paths: ['/featured', '/featured/*'],
    matchType: 'wildcard',
    contentMap: {
      // Country-specific content
      'US': '/featured/us',
      'CA': '/featured/ca',
      'MX': '/featured/mx',
      'GB': '/featured/uk',
      'FR': '/featured/fr',
      'DE': '/featured/de',
      'IT': '/featured/it',
      'ES': '/featured/es',
      'JP': '/featured/jp',
      'CN': '/featured/cn',
      'KR': '/featured/kr',
      'IN': '/featured/in',
      'AU': '/featured/au',
      // Region-specific content
      'north-america': '/featured/na',
      'europe': '/featured/eu',
      'asia': '/featured/asia',
    },
    defaultContent: '/featured/default',
    description: 'Region-specific featured content',
  },
];


