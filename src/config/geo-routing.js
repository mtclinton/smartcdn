/**
 * Geographic Routing Configuration
 * 
 * Maps regions to origin server URLs for geographic routing
 */

/**
 * Region to Origin URL Mapping
 */
export const GEO_ROUTING_CONFIG = {
  'north-america': {
    origin: 'https://us-origin.example.com',
    description: 'North America region origin server',
  },
  'europe': {
    origin: 'https://eu-origin.example.com',
    description: 'Europe region origin server',
  },
  'asia': {
    origin: 'https://asia-origin.example.com',
    description: 'Asia region origin server',
  },
  'default': {
    origin: 'https://global-origin.example.com',
    description: 'Default/Global origin server',
  },
};

/**
 * Global master switch for geographic routing
 */
export const GEO_ROUTING_ENABLED = true;

