/**
 * Image Optimization Utilities
 * 
 * Functions for image format negotiation, resizing, and optimization
 */

/**
 * Checks if a pathname represents an image file
 * @param {string} pathname - The request pathname
 * @returns {boolean} True if the path is an image
 */
export function isImagePath(pathname) {
  const lowerPath = pathname.toLowerCase();
  const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'ico', 'avif', 'bmp'];
  const lastDot = lowerPath.lastIndexOf('.');
  if (lastDot === -1) return false;
  const extension = lowerPath.substring(lastDot + 1);
  return imageExtensions.includes(extension);
}

/**
 * Parses the Accept header to determine supported image formats
 * @param {Request} request - The incoming request
 * @returns {Object} Object with supported formats and their quality values
 */
export function parseAcceptHeader(request) {
  const acceptHeader = request.headers.get('Accept') || '';
  const supportedFormats = {
    avif: false,
    webp: false,
    jpeg: false,
    jpg: false,
    png: false,
    gif: false,
    svg: false,
  };
  
  // Parse Accept header (format: "image/avif,image/webp,image/*;q=0.8")
  const parts = acceptHeader.split(',');
  const formatQuality = {};
  
  for (const part of parts) {
    const trimmed = part.trim();
    const [mimeType, qualityStr] = trimmed.split(';');
    const quality = qualityStr ? parseFloat(qualityStr.replace('q=', '')) : 1.0;
    
    if (mimeType) {
      const normalized = mimeType.trim().toLowerCase();
      
      // Map MIME types to format names
      if (normalized.includes('image/avif') || normalized.includes('avif')) {
        supportedFormats.avif = true;
        formatQuality.avif = quality;
      } else if (normalized.includes('image/webp') || normalized.includes('webp')) {
        supportedFormats.webp = true;
        formatQuality.webp = quality;
      } else if (normalized.includes('image/jpeg') || normalized.includes('image/jpg')) {
        supportedFormats.jpeg = true;
        supportedFormats.jpg = true;
        formatQuality.jpeg = quality;
        formatQuality.jpg = quality;
      } else if (normalized.includes('image/png')) {
        supportedFormats.png = true;
        formatQuality.png = quality;
      } else if (normalized.includes('image/gif')) {
        supportedFormats.gif = true;
        formatQuality.gif = quality;
      } else if (normalized.includes('image/svg')) {
        supportedFormats.svg = true;
        formatQuality.svg = quality;
      } else if (normalized.includes('image/*')) {
        // Wildcard - supports all image formats
        Object.keys(supportedFormats).forEach(format => {
          if (!supportedFormats[format]) {
            supportedFormats[format] = true;
            formatQuality[format] = quality;
          }
        });
      }
    }
  }
  
  return {
    supportedFormats,
    formatQuality,
    rawAccept: acceptHeader,
  };
}

/**
 * Determines the best image format to serve based on browser support and original format
 * Priority: AVIF > WebP > Original format
 * @param {string} originalPath - The original image path
 * @param {Object} acceptInfo - Parsed Accept header information
 * @returns {Object} Object with bestFormat, shouldTransform, and transformedPath
 */
export function negotiateImageFormat(originalPath, acceptInfo) {
  const { supportedFormats, formatQuality } = acceptInfo;
  
  // Get original file extension
  const lastDot = originalPath.lastIndexOf('.');
  if (lastDot === -1) {
    return {
      bestFormat: null,
      shouldTransform: false,
      transformedPath: originalPath,
      originalFormat: null,
    };
  }
  
  const extension = originalPath.substring(lastDot + 1).toLowerCase();
  const originalFormat = extension;
  
  // Only negotiate for JPEG and PNG (common formats that can be optimized)
  const optimizableFormats = ['jpg', 'jpeg', 'png'];
  if (!optimizableFormats.includes(extension)) {
    return {
      bestFormat: extension,
      shouldTransform: false,
      transformedPath: originalPath,
      originalFormat,
    };
  }
  
  // Priority order: AVIF > WebP > Original
  // Check AVIF support (best compression)
  if (supportedFormats.avif && formatQuality.avif > 0) {
    const newPath = originalPath.substring(0, lastDot) + '.avif';
    return {
      bestFormat: 'avif',
      shouldTransform: true,
      transformedPath: newPath,
      originalFormat,
      quality: formatQuality.avif,
    };
  }
  
  // Check WebP support (good compression, wider support)
  if (supportedFormats.webp && formatQuality.webp > 0) {
    const newPath = originalPath.substring(0, lastDot) + '.webp';
    return {
      bestFormat: 'webp',
      shouldTransform: true,
      transformedPath: newPath,
      originalFormat,
      quality: formatQuality.webp,
    };
  }
  
  // Fallback to original format
  return {
    bestFormat: extension,
    shouldTransform: false,
    transformedPath: originalPath,
    originalFormat,
  };
}

/**
 * Transforms an image URL to request optimized format from origin
 * @param {URL} url - The original URL
 * @param {Object} formatNegotiation - Format negotiation result from negotiateImageFormat
 * @returns {URL} The transformed URL with optimized format
 */
export function transformImageUrlForFormat(url, formatNegotiation) {
  if (!formatNegotiation.shouldTransform) {
    return url;
  }
  
  const newUrl = new URL(url);
  newUrl.pathname = formatNegotiation.transformedPath;
  
  // Optionally add format hint as query parameter for origin to know we want this format
  // This can be useful if origin needs to transform on-the-fly
  newUrl.searchParams.set('_format', formatNegotiation.bestFormat);
  newUrl.searchParams.set('_from', formatNegotiation.originalFormat);
  
  return newUrl;
}

/**
 * Parses image resizing parameters from query string
 * @param {URL} url - The request URL
 * @param {Object} deviceInfo - Device information
 * @param {Object} imageOptParams - Image optimization parameters
 * @returns {Object} Resizing parameters (width, height, quality, etc.)
 */
export function parseImageResizeParams(url, deviceInfo, imageOptParams) {
  const params = {
    width: null,
    height: null,
    quality: null,
    fit: 'scale-down', // Default fit mode for Cloudflare
    sharpen: null,
    blur: null,
    dpr: deviceInfo.isMobile || deviceInfo.isTablet ? 2 : 1,
  };
  
  // Parse width from query parameter
  const widthParam = url.searchParams.get('width') || url.searchParams.get('w');
  if (widthParam) {
    const width = parseInt(widthParam, 10);
    if (!isNaN(width) && width > 0) {
      params.width = width;
    }
  }
  
  // Parse height from query parameter
  const heightParam = url.searchParams.get('height') || url.searchParams.get('h');
  if (heightParam) {
    const height = parseInt(heightParam, 10);
    if (!isNaN(height) && height > 0) {
      params.height = height;
    }
  }
  
  // Parse quality from query parameter
  const qualityParam = url.searchParams.get('quality') || url.searchParams.get('q');
  if (qualityParam) {
    const quality = parseInt(qualityParam, 10);
    if (!isNaN(quality) && quality >= 0 && quality <= 100) {
      params.quality = quality;
    }
  } else {
    // Use device-specific default quality if not specified
    params.quality = imageOptParams.quality;
  }
  
  // Parse fit mode
  const fitParam = url.searchParams.get('fit');
  if (fitParam && ['scale-down', 'contain', 'cover', 'crop', 'pad'].includes(fitParam)) {
    params.fit = fitParam;
  }
  
  // Parse sharpen
  const sharpenParam = url.searchParams.get('sharpen');
  if (sharpenParam) {
    const sharpen = parseInt(sharpenParam, 10);
    if (!isNaN(sharpen) && sharpen >= 0) {
      params.sharpen = sharpen;
    }
  }
  
  // Parse blur
  const blurParam = url.searchParams.get('blur');
  if (blurParam) {
    const blur = parseInt(blurParam, 10);
    if (!isNaN(blur) && blur >= 0) {
      params.blur = blur;
    }
  }
  
  // Apply automatic mobile reduction: reduce dimensions by 50% if no width specified
  if (deviceInfo.isMobile && !params.width && !params.height) {
    // If no explicit dimensions, we'll apply reduction when building the resize URL
    params.autoReduce = true;
    params.reductionFactor = 0.5;
  }
  
  return params;
}

/**
 * Builds a Cloudflare Image Resizing URL
 * Cloudflare Image Resizing uses the /cdn-cgi/image/ path prefix
 * @param {URL} originalUrl - The original image URL
 * @param {Object} resizeParams - Resizing parameters
 * @param {Object} formatNegotiation - Format negotiation result (optional)
 * @returns {URL} The Cloudflare Image Resizing URL
 */
export function buildCloudflareImageResizeUrl(originalUrl, resizeParams, formatNegotiation = null) {
  // Build the path for Cloudflare Image Resizing
  // Format: /cdn-cgi/image/{options}/{original-path}
  const options = [];
  
  // Add width
  if (resizeParams.width) {
    options.push(`width=${resizeParams.width}`);
  }
  
  // Add height
  if (resizeParams.height) {
    options.push(`height=${resizeParams.height}`);
  }
  
  // Add quality
  if (resizeParams.quality !== null) {
    options.push(`quality=${resizeParams.quality}`);
  }
  
  // Add fit mode
  if (resizeParams.fit) {
    options.push(`fit=${resizeParams.fit}`);
  }
  
  // Add format (from format negotiation)
  if (formatNegotiation && formatNegotiation.shouldTransform) {
    options.push(`format=${formatNegotiation.bestFormat}`);
  }
  
  // Add DPR
  if (resizeParams.dpr && resizeParams.dpr > 1) {
    options.push(`dpr=${resizeParams.dpr}`);
  }
  
  // Add sharpen
  if (resizeParams.sharpen !== null) {
    options.push(`sharpen=${resizeParams.sharpen}`);
  }
  
  // Add blur
  if (resizeParams.blur !== null) {
    options.push(`blur=${resizeParams.blur}`);
  }
  
  // Build the new URL
  const newUrl = new URL(originalUrl);
  
  // Get the image path (which may already have A/B routing applied)
  let imagePath = originalUrl.pathname;
  
  // Apply format negotiation to the current path if needed
  if (formatNegotiation && formatNegotiation.shouldTransform) {
    // Apply format change to the current pathname
    const lastDot = imagePath.lastIndexOf('.');
    if (lastDot !== -1) {
      const basePath = imagePath.substring(0, lastDot);
      const extension = `.${formatNegotiation.bestFormat}`;
      imagePath = basePath + extension;
    }
  }
  
  // Remove leading slash for Cloudflare format
  if (imagePath.startsWith('/')) {
    imagePath = imagePath.substring(1);
  }
  
  // Build Cloudflare Image Resizing path
  // Format: /cdn-cgi/image/{options}/{path}
  const optionsStr = options.length > 0 ? options.join(',') : '';
  const resizePath = optionsStr 
    ? `/cdn-cgi/image/${optionsStr}/${imagePath}`
    : `/cdn-cgi/image/${imagePath}`;
  
  newUrl.pathname = resizePath;
  
  // Preserve original query parameters (except resize params which are now in the path)
  const preserveParams = ['_format', '_from', '_test', '_variant'];
  const newSearchParams = new URLSearchParams();
  for (const [key, value] of originalUrl.searchParams.entries()) {
    // Skip resize-related params (they're in the path now)
    if (!['width', 'w', 'height', 'h', 'quality', 'q', 'fit', 'sharpen', 'blur'].includes(key.toLowerCase())) {
      // But preserve special params
      if (preserveParams.includes(key) || key.startsWith('_')) {
        newSearchParams.set(key, value);
      }
    }
  }
  newUrl.search = newSearchParams.toString();
  
  return newUrl;
}

/**
 * Determines if image resizing should be applied
 * @param {URL} url - The request URL
 * @param {Object} deviceInfo - Device information
 * @param {Object} imageOptParams - Image optimization parameters
 * @returns {boolean} True if resizing should be applied
 */
export function shouldResizeImage(url, deviceInfo, imageOptParams) {
  if (!isImagePath(url.pathname)) {
    return false;
  }
  
  // Check if resize parameters are present
  const hasWidth = url.searchParams.has('width') || url.searchParams.has('w');
  const hasHeight = url.searchParams.has('height') || url.searchParams.has('h');
  const hasQuality = url.searchParams.has('quality') || url.searchParams.has('q');
  
  // Resize if explicit params are present OR if mobile device (auto-reduce)
  return hasWidth || hasHeight || hasQuality || deviceInfo.isMobile;
}

