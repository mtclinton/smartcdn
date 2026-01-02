/**
 * Geographic Routing Configuration
 * 
 * Maps regions to origin server URLs for geographic routing
 */

import { getEnvConfig } from '../utils/env-config.js';

/**
 * Gets geographic routing configuration from environment
 * @param {Object} env - Worker environment object
 * @returns {Object} Geographic routing configuration
 */
export function getGeoRoutingConfig(env = {}) {
  const envConfig = getEnvConfig(env);
  
  return {
    'north-america': {
      origin: envConfig.geoRouting.northAmerica,
      description: 'North America region origin server',
    },
    'europe': {
      origin: envConfig.geoRouting.europe,
      description: 'Europe region origin server',
    },
    'asia': {
      origin: envConfig.geoRouting.asia,
      description: 'Asia region origin server',
    },
    'default': {
      origin: envConfig.geoRouting.default,
      description: 'Default/Global origin server',
    },
  };
}

/**
 * Default configuration (for backward compatibility)
 */
export const GEO_ROUTING_CONFIG = getGeoRoutingConfig({});

/**
 * Gets geographic routing enabled status from environment
 * @param {Object} env - Worker environment object
 * @returns {boolean} Whether geographic routing is enabled
 */
export function isGeoRoutingEnabled(env = {}) {
  const envConfig = getEnvConfig(env);
  return envConfig.features.geoRouting;
}

/**
 * Global master switch for geographic routing (default, can be overridden by env)
 */
export const GEO_ROUTING_ENABLED = true;

