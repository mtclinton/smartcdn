/**
 * Structured Logging System
 * 
 * Provides structured JSON logging for requests with support for sending to logging service
 */

/**
 * Log levels
 */
export const LOG_LEVEL = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

/**
 * In-memory log buffer (for batching before sending to logging service)
 * In production, this could be sent to Cloudflare Workers Analytics Engine, 
 * external logging service, or stored in KV/Durable Objects
 */
const logBuffer = [];
const MAX_BUFFER_SIZE = 1000;

/**
 * Creates a structured log entry
 * @param {Object} data - Log data
 * @param {string} data.requestUrl - Request URL
 * @param {string} data.method - HTTP method
 * @param {string} data.country - User's country code
 * @param {string} data.deviceType - Device type (Mobile, Tablet, Desktop)
 * @param {string} data.abTestVariant - A/B test variant (optional)
 * @param {string} data.cacheStatus - Cache status (HIT, MISS, BYPASS)
 * @param {number} data.responseTime - Response time in milliseconds
 * @param {number} data.statusCode - HTTP status code
 * @param {string} data.level - Log level (default: INFO)
 * @param {Object} data.additionalData - Additional context data (optional)
 * @returns {Object} Structured log entry
 */
export function createLogEntry(data) {
  const {
    requestUrl,
    method,
    country,
    deviceType,
    abTestVariant = null,
    cacheStatus,
    responseTime,
    statusCode,
    level = LOG_LEVEL.INFO,
    additionalData = {},
  } = data;

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    request: {
      url: requestUrl,
      method: method,
    },
    user: {
      country: country || null,
      deviceType: deviceType || null,
    },
    abTest: {
      variant: abTestVariant,
    },
    cache: {
      status: cacheStatus,
    },
    response: {
      statusCode: statusCode,
      timeMs: responseTime,
    },
    ...additionalData,
  };

  return logEntry;
}

/**
 * Logs a structured entry
 * @param {Object} logEntry - Log entry object
 * @param {boolean} immediate - Whether to log immediately (default: true)
 */
export function logStructuredEntry(logEntry, immediate = true) {
  // Always output to console for debugging
  console.log(JSON.stringify(logEntry));

  // Add to buffer for batch sending to logging service
  logBuffer.push(logEntry);

  // If buffer is full, flush it (in production, this would send to logging service)
  if (logBuffer.length >= MAX_BUFFER_SIZE) {
    flushLogs();
  }

  // If immediate flag is set and we have a logging service, send immediately
  // This will be implemented in the next phase
  if (immediate) {
    // Future: sendToLoggingService(logEntry);
  }
}

/**
 * Creates and logs a request entry
 * @param {Object} params - Request log parameters
 * @param {string} params.requestUrl - Request URL
 * @param {string} params.method - HTTP method
 * @param {string} params.country - User's country code
 * @param {string} params.deviceType - Device type
 * @param {string} params.abTestVariant - A/B test variant
 * @param {string} params.cacheStatus - Cache status
 * @param {number} params.responseTime - Response time in ms
 * @param {number} params.statusCode - HTTP status code
 * @param {Object} params.additionalData - Additional context
 */
export function logRequest(params) {
  const logEntry = createLogEntry({
    requestUrl: params.requestUrl,
    method: params.method,
    country: params.country,
    deviceType: params.deviceType,
    abTestVariant: params.abTestVariant,
    cacheStatus: params.cacheStatus,
    responseTime: params.responseTime,
    statusCode: params.statusCode,
    level: LOG_LEVEL.INFO,
    additionalData: params.additionalData || {},
  });

  logStructuredEntry(logEntry);
}

/**
 * Creates and logs an error entry
 * @param {Object} params - Error log parameters
 * @param {string} params.requestUrl - Request URL
 * @param {string} params.method - HTTP method
 * @param {Error} params.error - Error object
 * @param {Object} params.context - Additional context
 */
export function logError(params) {
  const logEntry = createLogEntry({
    requestUrl: params.requestUrl || 'unknown',
    method: params.method || 'unknown',
    country: params.country || null,
    deviceType: params.deviceType || null,
    abTestVariant: params.abTestVariant || null,
    cacheStatus: 'ERROR',
    responseTime: params.responseTime || null,
    statusCode: 500,
    level: LOG_LEVEL.ERROR,
    additionalData: {
      error: {
        message: params.error?.message || 'Unknown error',
        stack: params.error?.stack || null,
        name: params.error?.name || 'Error',
      },
      context: params.context || {},
    },
  });

  logStructuredEntry(logEntry, true); // Always log errors immediately
}

/**
 * Gets buffered logs (for batch sending to logging service)
 * @returns {Array} Array of log entries
 */
export function getBufferedLogs() {
  return [...logBuffer];
}

/**
 * Flushes log buffer (sends to logging service and clears buffer)
 * This will be implemented in the next phase to send to actual logging service
 */
export function flushLogs() {
  const logs = getBufferedLogs();
  
  if (logs.length === 0) {
    return;
  }

  // In production, this would send to logging service:
  // await sendToLoggingService(logs);
  
  console.log(`[Logging] Flushing ${logs.length} log entries to logging service`);
  console.log(`[Logging] Sample entry:`, JSON.stringify(logs[0], null, 2));
  
  // Clear buffer after sending
  logBuffer.length = 0;
}

/**
 * Clears the log buffer (useful for testing)
 */
export function clearLogBuffer() {
  logBuffer.length = 0;
}

/**
 * Gets log statistics
 * @returns {Object} Log statistics
 */
export function getLogStatistics() {
  return {
    bufferedLogs: logBuffer.length,
    maxBufferSize: MAX_BUFFER_SIZE,
    bufferUsagePercent: ((logBuffer.length / MAX_BUFFER_SIZE) * 100).toFixed(2),
  };
}

