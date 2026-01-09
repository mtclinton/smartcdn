/**
 * Environment Configuration Utility
 * 
 * Reads and provides environment-specific configuration from env variables
 */

/**
 * Gets the current environment
 * @param {Object} env - Worker environment object
 * @returns {string} Environment name (development, staging, production)
 */
export function getEnvironment(env = {}) {
  return env.ENVIRONMENT || 'development';
}

/**
 * Gets a boolean environment variable
 * @param {Object} env - Worker environment object
 * @param {string} key - Environment variable key
 * @param {boolean} defaultValue - Default value if not set
 * @returns {boolean} Boolean value
 */
export function getEnvBoolean(env, key, defaultValue = false) {
  const value = env[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return defaultValue;
}

/**
 * Gets an integer environment variable
 * @param {Object} env - Worker environment object
 * @param {string} key - Environment variable key
 * @param {number} defaultValue - Default value if not set
 * @returns {number} Integer value
 */
export function getEnvInteger(env, key, defaultValue = 0) {
  const value = env[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'number') {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Gets a string environment variable
 * @param {Object} env - Worker environment object
 * @param {string} key - Environment variable key
 * @param {string} defaultValue - Default value if not set
 * @returns {string} String value
 */
export function getEnvString(env, key, defaultValue = '') {
  const value = env[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return String(value);
}

/**
 * Gets environment configuration object
 * @param {Object} env - Worker environment object
 * @returns {Object} Environment configuration
 */
export function getEnvConfig(env = {}) {
  const environment = getEnvironment(env);

  return {
    environment: environment,
    
    // Geographic Routing Origins
    geoRouting: {
      northAmerica: getEnvString(env, 'GEO_ORIGIN_NA', 'https://us-origin.example.com'),
      europe: getEnvString(env, 'GEO_ORIGIN_EU', 'https://eu-origin.example.com'),
      asia: getEnvString(env, 'GEO_ORIGIN_ASIA', 'https://asia-origin.example.com'),
      default: getEnvString(env, 'GEO_ORIGIN_DEFAULT', 'https://global-origin.example.com'),
    },
    
    // Cache TTLs (in seconds)
    cacheTTL: {
      images: getEnvInteger(env, 'CACHE_TTL_IMAGES', 30 * 24 * 60 * 60),      // 30 days
      cssJs: getEnvInteger(env, 'CACHE_TTL_CSS_JS', 7 * 24 * 60 * 60),         // 7 days
      html: getEnvInteger(env, 'CACHE_TTL_HTML', 60 * 60),                     // 1 hour
      api: getEnvInteger(env, 'CACHE_TTL_API', 5 * 60),                       // 5 minutes
      default: getEnvInteger(env, 'CACHE_TTL_DEFAULT', 24 * 60 * 60),          // 1 day
    },
    
    // Feature Flags
    features: {
      abTesting: getEnvBoolean(env, 'FEATURE_AB_TESTING', true),
      geoRouting: getEnvBoolean(env, 'FEATURE_GEO_ROUTING', true),
      regionContent: getEnvBoolean(env, 'FEATURE_REGION_CONTENT', true),
      rateLimiting: getEnvBoolean(env, 'FEATURE_RATE_LIMITING', true),
      staleWhileRevalidate: getEnvBoolean(env, 'FEATURE_STALE_WHILE_REVALIDATE', true),
      cacheBypass: getEnvBoolean(env, 'FEATURE_CACHE_BYPASS', true),
    },
    
    // Rate Limiting
    rateLimiting: {
      maxRequests: getEnvInteger(env, 'RATE_LIMIT_MAX_REQUESTS', 100),
      windowSeconds: getEnvInteger(env, 'RATE_LIMIT_WINDOW_SECONDS', 60),
    },
    
    // Stale-While-Revalidate
    staleWhileRevalidate: {
      maxAge: getEnvInteger(env, 'SWR_MAX_AGE', 60 * 60),                      // 1 hour
      staleWhileRevalidate: getEnvInteger(env, 'SWR_STALE_WHILE_REVALIDATE', 24 * 60 * 60), // 24 hours
    },
  };
}


