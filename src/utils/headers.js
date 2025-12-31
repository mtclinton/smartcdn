/**
 * Response Header Utilities
 * 
 * Functions for building and managing response headers
 */

import { isImagePath } from './image.js';

/**
 * Adds device information headers to response
 * @param {Headers} headers - Response headers to modify
 * @param {Object} deviceInfo - Device information from detectDevice()
 */
export function addDeviceHeaders(headers, deviceInfo) {
  headers.set('X-Device-Type', deviceInfo.deviceType);
  headers.set('X-Device-Is-Mobile', deviceInfo.isMobile.toString());
  headers.set('X-Device-Is-Tablet', deviceInfo.isTablet.toString());
  headers.set('X-Device-Is-Desktop', deviceInfo.isDesktop.toString());
}

/**
 * Adds image optimization headers to response
 * @param {Headers} headers - Response headers to modify
 * @param {string} pathname - Request pathname
 * @param {Object} imageOptParams - Image optimization parameters
 * @param {Object} formatNegotiation - Format negotiation result (optional)
 * @param {Object} resizeParams - Resize parameters (optional)
 * @param {boolean} shouldResize - Whether resizing was applied
 */
export function addImageHeaders(headers, pathname, imageOptParams, formatNegotiation = null, resizeParams = null, shouldResize = false) {
  if (!isImagePath(pathname)) {
    return;
  }

  // Device-specific optimization hints
  headers.set('X-Image-Max-Width', imageOptParams.maxWidth.toString());
  headers.set('X-Image-Quality', imageOptParams.quality.toString());
  headers.set('X-Image-Preferred-Format', imageOptParams.preferredFormat);
  headers.set('X-Image-DPR', imageOptParams.dpr.toString());

  // Format negotiation info
  if (formatNegotiation) {
    headers.set('X-Image-Original-Format', formatNegotiation.originalFormat || 'unknown');
    headers.set('X-Image-Served-Format', formatNegotiation.bestFormat || 'unknown');
    headers.set('X-Image-Format-Negotiated', formatNegotiation.shouldTransform ? 'true' : 'false');
  }

  // Resizing info
  if (resizeParams) {
    headers.set('X-Image-Resized', shouldResize ? 'true' : 'false');
    if (resizeParams.width) {
      headers.set('X-Image-Width', resizeParams.width.toString());
    }
    if (resizeParams.height) {
      headers.set('X-Image-Height', resizeParams.height.toString());
    }
    if (resizeParams.quality !== null) {
      headers.set('X-Image-Quality-Applied', resizeParams.quality.toString());
    }
    if (resizeParams.autoReduce) {
      headers.set('X-Image-Auto-Reduced', 'true');
    }
  }
}

/**
 * Adds A/B test information headers to response
 * @param {Headers} headers - Response headers to modify
 * @param {Object} testInfo - Test information object
 * @param {Object} routingInfo - Routing information (optional)
 */
export function addABTestHeaders(headers, testInfo, routingInfo = null) {
  if (!testInfo) {
    return;
  }

  headers.set('X-AB-Test-Id', testInfo.testId);
  headers.set('X-AB-Test-Name', testInfo.testName);
  headers.set('X-AB-Test-Variant', testInfo.variant);

  if (routingInfo) {
    headers.set('X-AB-Test-Routed', 'true');
    headers.set('X-AB-Test-Original-Path', routingInfo.originalPath);
    headers.set('X-AB-Test-Routed-Path', routingInfo.routedPath);
    headers.set('X-AB-Test-Strategy', routingInfo.strategy);
  }
}

/**
 * Adds geographic routing information headers to response
 * @param {Headers} headers - Response headers to modify
 * @param {Object} geoRoutingInfo - Geographic routing information object
 */
export function addGeoRoutingHeaders(headers, geoRoutingInfo) {
  if (!geoRoutingInfo || !geoRoutingInfo.enabled) {
    return;
  }

  headers.set('X-Geo-Routing-Enabled', 'true');
  if (geoRoutingInfo.country) {
    headers.set('X-Geo-Country', geoRoutingInfo.country);
  }
  headers.set('X-Geo-Region', geoRoutingInfo.region);
  headers.set('X-Geo-Origin', geoRoutingInfo.origin);
}

/**
 * Adds region-specific content information headers to response
 * @param {Headers} headers - Response headers to modify
 * @param {Object} regionContentInfo - Region-specific content information object
 */
export function addRegionContentHeaders(headers, regionContentInfo) {
  if (!regionContentInfo || !regionContentInfo.enabled) {
    return;
  }

  headers.set('X-Region-Content-Enabled', 'true');
  headers.set('X-Region-Content-Mapping-Id', regionContentInfo.mappingId);
  headers.set('X-Region-Content-Mapping-Name', regionContentInfo.mappingName);
  headers.set('X-Region-Content-Original-Path', regionContentInfo.originalPath);
  headers.set('X-Region-Content-Served-Path', regionContentInfo.contentPath);
  if (regionContentInfo.country) {
    headers.set('X-Region-Content-Country', regionContentInfo.country);
  }
  headers.set('X-Region-Content-Region', regionContentInfo.region);
}

/**
 * Gets Content-Type for negotiated format
 * @param {string} pathname - Request pathname
 * @param {Object} formatNegotiation - Format negotiation result (optional)
 * @returns {string} Content-Type header value
 */
export function getNegotiatedContentType(pathname, formatNegotiation = null) {
  const formatMimeTypes = {
    'avif': 'image/avif',
    'webp': 'image/webp',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
  };

  // If format negotiation occurred, use negotiated format
  if (formatNegotiation && formatNegotiation.shouldTransform) {
    const negotiatedMimeType = formatMimeTypes[formatNegotiation.bestFormat];
    if (negotiatedMimeType) {
      return negotiatedMimeType;
    }
  }

  // Fallback to default content type detection
  return null; // Caller should use getContentType() as fallback
}

