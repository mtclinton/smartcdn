/**
 * Feature Flags Configuration
 * 
 * Runtime feature flags that can be toggled without redeployment.
 * Flags can be overridden via Cloudflare KV store for runtime updates.
 */

/**
 * Default feature flags configuration
 * These can be easily modified and will be used if KV store is not available
 */
export const DEFAULT_FEATURE_FLAGS = {
  /**
   * A/B Testing feature flag
   * When disabled, all A/B tests are bypassed
   */
  abTesting: {
    enabled: true,
    description: 'Enable/disable A/B testing functionality',
    lastUpdated: null,
  },

  /**
   * Image Optimization feature flag
   * When disabled, image resizing and format negotiation are bypassed
   */
  imageOptimization: {
    enabled: true,
    description: 'Enable/disable image optimization (resizing, format negotiation)',
    lastUpdated: null,
  },

  /**
   * Geographic Routing feature flag
   * When disabled, all requests route to default origin
   */
  geoRouting: {
    enabled: true,
    description: 'Enable/disable geographic routing to region-specific origins',
    lastUpdated: null,
  },

  /**
   * Rate Limiting feature flag
   * When disabled, rate limiting checks are bypassed
   */
  rateLimiting: {
    enabled: true,
    description: 'Enable/disable rate limiting protection',
    lastUpdated: null,
  },

  /**
   * Region-Specific Content feature flag
   * When disabled, region-specific content mapping is bypassed
   */
  regionContent: {
    enabled: true,
    description: 'Enable/disable region-specific content serving',
    lastUpdated: null,
  },

  /**
   * Stale-While-Revalidate feature flag
   * When disabled, SWR caching pattern is not used
   */
  staleWhileRevalidate: {
    enabled: true,
    description: 'Enable/disable stale-while-revalidate caching pattern',
    lastUpdated: null,
  },

  /**
   * Cache Bypass feature flag
   * When disabled, cache bypass rules are not checked
   */
  cacheBypass: {
    enabled: true,
    description: 'Enable/disable cache bypass rules',
    lastUpdated: null,
  },
};

/**
 * Feature flag keys for KV store
 */
export const FEATURE_FLAG_KEYS = {
  AB_TESTING: 'feature_flag:ab_testing',
  IMAGE_OPTIMIZATION: 'feature_flag:image_optimization',
  GEO_ROUTING: 'feature_flag:geo_routing',
  RATE_LIMITING: 'feature_flag:rate_limiting',
  REGION_CONTENT: 'feature_flag:region_content',
  STALE_WHILE_REVALIDATE: 'feature_flag:stale_while_revalidate',
  CACHE_BYPASS: 'feature_flag:cache_bypass',
};

/**
 * Gets the KV namespace name for feature flags
 * Set this in wrangler.toml if using KV
 */
export const FEATURE_FLAGS_KV_NAMESPACE = 'FEATURE_FLAGS';


