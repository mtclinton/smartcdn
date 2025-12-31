/**
 * SmartCDN - Cloudflare Workers CDN with A/B Testing and Image Optimization
 * 
 * Main entry point for the Cloudflare Worker
 */

// Configuration
import { validateABTestConfig } from './utils/ab-testing.js';
import { getPrimaryTest } from './utils/ab-testing.js';
import { transformUrlForTest } from './utils/routing.js';

// Utilities
import { detectDevice, getImageOptimizationParams } from './utils/device.js';
import { getContentType } from './utils/request.js';
import { 
  isImagePath, 
  parseAcceptHeader, 
  negotiateImageFormat, 
  transformImageUrlForFormat,
  parseImageResizeParams,
  buildCloudflareImageResizeUrl,
  shouldResizeImage
} from './utils/image.js';
import { getOrAssignVariantForTest } from './utils/variants.js';
import { getGeoRoutingInfo } from './utils/geo-routing.js';

// Handlers
import {
  handleGET,
  handleHEAD,
  handlePOST,
  handlePUT,
  handleDELETE,
  handlePATCH,
  handleOPTIONS,
} from './handlers/index.js';

/**
 * Main Worker Export
 */
export default {
  async fetch(request, env, ctx) {
    try {
      // Validate A/B test configuration
      const configValidation = validateABTestConfig();
      if (!configValidation.valid) {
        console.error('A/B Test Configuration Errors:', configValidation.errors);
      }
      if (configValidation.warnings.length > 0) {
        console.warn('A/B Test Configuration Warnings:', configValidation.warnings);
      }

      // Extract request information
      const url = new URL(request.url);
      const method = request.method;
      const headers = Object.fromEntries(request.headers.entries());

      // Geographic routing: Determine origin based on country
      const geoRoutingInfo = getGeoRoutingInfo(request);
      console.log('Geographic Routing:', JSON.stringify(geoRoutingInfo, null, 2));

      // Detect device type
      const deviceInfo = detectDevice(request);
      const imageOptParams = getImageOptimizationParams(deviceInfo);

      // Content negotiation for images
      let formatNegotiation = null;
      if (isImagePath(url.pathname)) {
        const acceptInfo = parseAcceptHeader(request);
        formatNegotiation = negotiateImageFormat(url.pathname, acceptInfo);
      }

      // A/B Testing: Get primary test and assign variant
      const primaryTest = getPrimaryTest(url.pathname);
      let testInfo = null;
      let routingUrl = url;
      let routingInfo = null;

      if (primaryTest) {
        const variantInfo = getOrAssignVariantForTest(request, primaryTest);
        routingUrl = transformUrlForTest(url, primaryTest, variantInfo.variant);

        testInfo = {
          testId: primaryTest.id,
          testName: primaryTest.name,
          variant: variantInfo.variant,
          isNewAssignment: variantInfo.isNewAssignment,
          routed: routingUrl.href !== url.href,
        };

        if (routingUrl.href !== url.href) {
          routingInfo = {
            originalPath: url.pathname,
            routedPath: routingUrl.pathname,
            originalOrigin: url.origin,
            routedOrigin: routingUrl.origin,
            strategy: primaryTest.variants[variantInfo.variant].strategy,
          };
        }

        console.log(`A/B Test [${primaryTest.id}]: Variant ${variantInfo.variant}`, variantInfo.isNewAssignment ? '(new assignment)' : '(from cookie)');
        if (routingInfo) {
          console.log('A/B Test Routing:', JSON.stringify(routingInfo, null, 2));
        }
      }

      // Image optimization: resizing and format negotiation
      let resizeParams = null;
      let imageUrl = routingUrl;
      let shouldResize = false;

      if (isImagePath(url.pathname)) {
        resizeParams = parseImageResizeParams(url, deviceInfo, imageOptParams);
        shouldResize = shouldResizeImage(url, deviceInfo, imageOptParams);

        if (shouldResize) {
          // Apply automatic mobile reduction if no width specified
          if (resizeParams.autoReduce && !resizeParams.width && !resizeParams.height) {
            const defaultMobileWidth = Math.floor(imageOptParams.maxWidth * 0.5);
            resizeParams.width = defaultMobileWidth;
            console.log(`Image Resizing: Auto-reducing for mobile device - setting width to ${defaultMobileWidth}px (50% of max)`);
          }

          // Build Cloudflare Image Resizing URL
          imageUrl = buildCloudflareImageResizeUrl(routingUrl, resizeParams, formatNegotiation);
          console.log(`Image Resizing: Applied - Width: ${resizeParams.width || 'auto'}, Height: ${resizeParams.height || 'auto'}, Quality: ${resizeParams.quality}`);
          console.log(`Resized Image URL: ${imageUrl.pathname}`);
        } else if (formatNegotiation && formatNegotiation.shouldTransform) {
          // Only format negotiation, no resizing
          imageUrl = transformImageUrlForFormat(routingUrl, formatNegotiation);
          console.log(`Content Negotiation: ${formatNegotiation.originalFormat} -> ${formatNegotiation.bestFormat}`);
          console.log(`Transformed Image URL: ${imageUrl.pathname}`);
        } else {
          imageUrl = routingUrl;
          if (formatNegotiation) {
            console.log(`Content Negotiation: Using original format (${formatNegotiation.originalFormat})`);
          }
        }
      } else {
        imageUrl = routingUrl;
      }

      // Log request information
      console.log(`[${new Date().toISOString()}] ${method} ${url.pathname}`);
      console.log('Request URL:', url.href);
      console.log('Request Method:', method);
      console.log('Device Type:', deviceInfo.deviceType, `(Mobile: ${deviceInfo.isMobile}, Tablet: ${deviceInfo.isTablet}, Desktop: ${deviceInfo.isDesktop})`);
      if (isImagePath(url.pathname)) {
        console.log('Image Optimization Params:', JSON.stringify(imageOptParams, null, 2));
      }
      if (testInfo) {
        console.log('A/B Test:', testInfo.testName, `(${testInfo.testId})`);
        console.log('A/B Test Variant:', testInfo.variant);
        if (routingInfo) {
          console.log('Routed URL:', routingUrl.href);
        }
      } else {
        console.log('A/B Testing: No active test for this path');
      }

      // Route to appropriate handler
      switch (method) {
        case 'GET':
          return await handleGET(
            request, url, imageUrl, deviceInfo, imageOptParams,
            testInfo, routingInfo, formatNegotiation, resizeParams, shouldResize, geoRoutingInfo, ctx
          );

        case 'HEAD':
          return await handleHEAD(
            request, url, imageUrl, deviceInfo, imageOptParams,
            testInfo, routingInfo, formatNegotiation, resizeParams, shouldResize, geoRoutingInfo, ctx
          );

        case 'POST':
          return await handlePOST(request, deviceInfo, testInfo);

        case 'PUT':
          return handlePUT(deviceInfo, testInfo);

        case 'DELETE':
          return handleDELETE(deviceInfo, testInfo);

        case 'PATCH':
          return handlePATCH(deviceInfo, testInfo);

        case 'OPTIONS':
          return handleOPTIONS();

        default:
          return new Response(`Method ${method} not allowed`, {
            status: 405,
            headers: {
              "Content-Type": "text/plain",
              "Allow": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
            },
          });
      }
    } catch (error) {
      // Error handling
      console.error('Error processing request:', error);
      console.error('Error stack:', error.stack);

      return new Response(`Internal Server Error: ${error.message}`, {
        status: 500,
        headers: {
          "Content-Type": "text/plain",
        },
      });
    }
  },
};
