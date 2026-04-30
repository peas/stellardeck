// Pure path utility functions (no dependencies)
// Used by js/images.js (ES module import) and test/viewer-helpers.test.js (CJS require)

// Convert absolute filesystem path to a URL the renderer can load.
// - Electron: deck://./<encoded-path> via window.stellardeck.fileSrc
// - Browser fallback: leave as-is (only matters in test fixtures where
//   convertFileSrc was historically called directly).
export function convertFileSrc(filePath) {
  if (typeof window !== 'undefined' && window.stellardeck && typeof window.stellardeck.fileSrc === 'function') {
    return window.stellardeck.fileSrc(filePath);
  }
  // Pre-Electron Tauri tests imported this and asserted the localfile://
  // shape; that scheme no longer exists. Returning encoded as a relative
  // path keeps existing tests parsing while not silently mapping to a
  // dead protocol.
  return filePath.split('/').map(s => encodeURIComponent(s)).join('/');
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
