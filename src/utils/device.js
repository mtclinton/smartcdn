/**
 * Device Detection Utilities
 * 
 * Functions for detecting device type from User-Agent and providing optimization parameters
 */

/**
 * Detects device type from User-Agent header
 * @param {Request} request - The incoming request
 * @returns {Object} Object with deviceType ('mobile', 'tablet', 'desktop') and details
 */
export function detectDevice(request) {
  const userAgent = request.headers.get('User-Agent') || '';
  const ua = userAgent.toLowerCase();
  
  // Check for mobile device patterns
  const mobilePatterns = [
    /android.*mobile/,
    /iphone/,
    /ipod/,
    /blackberry/,
    /windows phone/,
    /opera mini/,
    /mobile/,
    /webos/,
    /palm/,
    /fennec/,
    /maemo/,
    /symbian/,
    /symbos/,
    /series60/,
    /series40/,
    /smartphone/,
  ];
  
  // Check for tablet patterns
  const tabletPatterns = [
    /ipad/,
    /android(?!.*mobile)/,
    /tablet/,
    /playbook/,
    /kindle/,
    /silk/,
    /gt-p/,
    /gt-n/,
    /sm-t/,
    /nexus.*tablet/,
    /windows.*touch/,
    /touchpad/,
    /hp-tablet/,
    /kindle fire/,
    /playbook/,
    /bb10.*touch/,
  ];
  
  // Check for desktop patterns (more specific)
  const desktopPatterns = [
    /windows nt/,
    /macintosh/,
    /mac os x/,
    /linux/,
    /x11/,
    /unix/,
    /freebsd/,
    /openbsd/,
    /netbsd/,
  ];
  
  // Check for tablet first (tablets often match mobile patterns too)
  for (const pattern of tabletPatterns) {
    if (pattern.test(ua)) {
      return {
        deviceType: 'tablet',
        userAgent: userAgent,
        isMobile: false,
        isTablet: true,
        isDesktop: false,
      };
    }
  }
  
  // Check for mobile devices
  for (const pattern of mobilePatterns) {
    if (pattern.test(ua)) {
      return {
        deviceType: 'mobile',
        userAgent: userAgent,
        isMobile: true,
        isTablet: false,
        isDesktop: false,
      };
    }
  }
  
  // Check for desktop (if it matches desktop patterns and not mobile/tablet)
  let isDesktop = false;
  for (const pattern of desktopPatterns) {
    if (pattern.test(ua)) {
      isDesktop = true;
      break;
    }
  }
  
  // Default to desktop if no mobile/tablet patterns matched
  // or if desktop patterns are present
  if (isDesktop || (!ua.includes('mobile') && !ua.includes('tablet'))) {
    return {
      deviceType: 'desktop',
      userAgent: userAgent,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    };
  }
  
  // Fallback to desktop if uncertain
  return {
    deviceType: 'desktop',
    userAgent: userAgent,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  };
}

/**
 * Gets device-specific image optimization parameters
 * @param {Object} deviceInfo - Device information from detectDevice()
 * @returns {Object} Image optimization parameters (width, quality, format suggestions)
 */
export function getImageOptimizationParams(deviceInfo) {
  const { deviceType, isMobile, isTablet } = deviceInfo;
  
  // Default optimization parameters
  const params = {
    deviceType,
    // Suggested max width based on device type
    maxWidth: 1920,
    // Suggested quality (0-100)
    quality: 85,
    // Preferred format
    preferredFormat: 'webp',
    // DPR (Device Pixel Ratio) hint
    dpr: 1,
  };
  
  if (isMobile) {
    params.maxWidth = 768;
    params.quality = 80;
    params.dpr = 2; // Most mobile devices are high-DPI
  } else if (isTablet) {
    params.maxWidth = 1024;
    params.quality = 82;
    params.dpr = 2;
  } else {
    // Desktop
    params.maxWidth = 1920;
    params.quality = 85;
    params.dpr = 1;
  }
  
  return params;
}


