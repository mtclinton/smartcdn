/**
 * Timing Utilities
 * 
 * Functions for measuring and tracking request lifecycle timings
 */

/**
 * Creates a timing tracker for a request
 * @returns {Object} Timing tracker object
 */
export function createTimingTracker() {
  const startTime = Date.now();
  const timings = {
    startTime: startTime,
    cacheLookupStart: null,
    cacheLookupEnd: null,
    originFetchStart: null,
    originFetchEnd: null,
    totalEnd: null,
  };

  return {
    /**
     * Start timing cache lookup
     */
    startCacheLookup() {
      timings.cacheLookupStart = Date.now();
    },

    /**
     * End timing cache lookup
     */
    endCacheLookup() {
      timings.cacheLookupEnd = Date.now();
    },

    /**
     * Start timing origin fetch
     */
    startOriginFetch() {
      timings.originFetchStart = Date.now();
    },

    /**
     * End timing origin fetch
     */
    endOriginFetch() {
      timings.originFetchEnd = Date.now();
    },

    /**
     * Mark total response time
     */
    endTotal() {
      timings.totalEnd = Date.now();
    },

    /**
     * Get cache lookup time in milliseconds
     * @returns {number|null} Cache lookup time or null if not measured
     */
    getCacheLookupTime() {
      if (timings.cacheLookupStart && timings.cacheLookupEnd) {
        return timings.cacheLookupEnd - timings.cacheLookupStart;
      }
      return null;
    },

    /**
     * Get origin fetch time in milliseconds
     * @returns {number|null} Origin fetch time or null if not measured
     */
    getOriginFetchTime() {
      if (timings.originFetchStart && timings.originFetchEnd) {
        return timings.originFetchEnd - timings.originFetchStart;
      }
      return null;
    },

    /**
     * Get total response time in milliseconds
     * @returns {number} Total response time
     */
    getTotalTime() {
      const endTime = timings.totalEnd || Date.now();
      return endTime - timings.startTime;
    },

    /**
     * Get all timing metrics
     * @returns {Object} Object containing all timing metrics
     */
    getMetrics() {
      return {
        cacheLookupTime: this.getCacheLookupTime(),
        originFetchTime: this.getOriginFetchTime(),
        totalTime: this.getTotalTime(),
        cacheHit: timings.cacheLookupEnd !== null && timings.originFetchStart === null,
      };
    },

    /**
     * Get cache status string (HIT or MISS)
     * @returns {string} Cache status
     */
    getCacheStatus() {
      // If we have cache lookup end but no origin fetch start, it's a cache HIT
      if (timings.cacheLookupEnd !== null && timings.originFetchStart === null) {
        return 'HIT';
      }
      // If we have origin fetch start, it's a cache MISS
      if (timings.originFetchStart !== null) {
        return 'MISS';
      }
      return 'UNKNOWN';
    },
  };
}

/**
 * Formats timing value for headers (milliseconds with 2 decimal places)
 * @param {number|null} timeMs - Time in milliseconds
 * @returns {string} Formatted time string
 */
export function formatTiming(timeMs) {
  if (timeMs === null || timeMs === undefined) {
    return '0';
  }
  return timeMs.toFixed(2);
}


