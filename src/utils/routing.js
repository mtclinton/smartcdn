/**
 * Routing Strategies
 * 
 * Implements different routing strategies for A/B testing variants
 */

/**
 * Routing Strategy Registry
 * Maps strategy names to their implementation functions
 */
export const ROUTING_STRATEGIES = {
  /**
   * Path Suffix Strategy
   * Adds a suffix to the path (e.g., /page.html -> /page-v2.html)
   * Config: { suffix: string, applyToExtensions?: string[] }
   */
  'path-suffix': (url, variantConfig) => {
    const { suffix = '' } = variantConfig.config || {};
    if (!suffix) {
      return url; // No transformation
    }
    
    const newUrl = new URL(url);
    const pathname = newUrl.pathname;
    
    // Check if path has a file extension
    const lastDot = pathname.lastIndexOf('.');
    const lastSlash = pathname.lastIndexOf('/');
    
    if (lastDot > lastSlash && lastDot !== -1) {
      // Has file extension
      const extension = pathname.substring(lastDot);
      const basePath = pathname.substring(0, lastDot);
      const extWithoutDot = extension.substring(1).toLowerCase();
      const applyToExtensions = variantConfig.config?.applyToExtensions || [];
      
      // If applyToExtensions is empty or includes this extension, insert suffix before extension
      if (applyToExtensions.length === 0 || applyToExtensions.includes(extWithoutDot)) {
        newUrl.pathname = `${basePath}${suffix}${extension}`;
        return newUrl;
      }
    }
    
    // No extension or extension not in list, append suffix
    newUrl.pathname = `${pathname}${suffix}`;
    return newUrl;
  },
  
  /**
   * Different Origin Strategy
   * Routes to a completely different origin
   * Config: { origin: string }
   */
  'different-origin': (url, variantConfig) => {
    const { origin } = variantConfig.config || {};
    if (!origin) {
      return url; // No transformation
    }
    
    return new URL(url.pathname + url.search, origin);
  },
  
  /**
   * Query Parameter Strategy
   * Adds a query parameter to the URL
   * Config: { param: string } (e.g., "version=new" or "variant=b")
   */
  'query-param': (url, variantConfig) => {
    const { param } = variantConfig.config || {};
    if (!param) {
      return url; // No transformation
    }
    
    const newUrl = new URL(url);
    const [key, value] = param.split('=');
    if (key && value) {
      newUrl.searchParams.set(key.trim(), value.trim());
    }
    return newUrl;
  },
  
  /**
   * Subdomain Strategy
   * Changes the subdomain of the URL
   * Config: { subdomain: string }
   */
  'subdomain': (url, variantConfig) => {
    const { subdomain } = variantConfig.config || {};
    if (!subdomain) {
      return url; // No transformation
    }
    
    const newUrl = new URL(url);
    const hostname = newUrl.hostname;
    const parts = hostname.split('.');
    
    if (parts.length >= 2) {
      // Replace first part (subdomain) with new subdomain
      parts[0] = subdomain;
      newUrl.hostname = parts.join('.');
    }
    
    return newUrl;
  },
};

/**
 * Transforms a URL based on test and variant
 * @param {URL} url - The original URL
 * @param {Object} test - Test configuration
 * @param {string} variant - Assigned variant (A, B, C, etc.)
 * @returns {URL} The transformed URL
 */
export function transformUrlForTest(url, test, variant) {
  const variantConfig = test.variants[variant];
  if (!variantConfig) {
    console.warn(`Test ${test.id}: Variant ${variant} not found`);
    return url;
  }
  
  const strategy = variantConfig.strategy;
  const strategyFunction = ROUTING_STRATEGIES[strategy];
  
  if (!strategyFunction) {
    console.warn(`Test ${test.id}: Unknown routing strategy: ${strategy}`);
    return url;
  }
  
  return strategyFunction(url, variantConfig);
}


