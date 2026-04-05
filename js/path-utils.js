// Pure path utility functions (no dependencies)
// Used by js/images.js (ES module import) and test/viewer-helpers.test.js (CJS require)

// Convert absolute filesystem path to localfile:// URL for images
export function convertFileSrc(filePath) {
  // Encode each path segment individually, keep slashes intact
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  return navigator.userAgent.includes('Windows')
    ? `https://localfile.localhost${encoded}`
    : `localfile://localhost${encoded}`;
}

// Resolve a relative path against a base directory
export function resolveRelativePath(baseDir, relativePath) {
  const parts = baseDir.replace(/\/+$/, '').split('/');
  for (const segment of relativePath.split('/')) {
    if (segment === '..') parts.pop();
    else if (segment !== '.' && segment !== '') parts.push(segment);
  }
  return parts.join('/');
}

// Node.js CommonJS compatibility (for tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { convertFileSrc, resolveRelativePath };
}
