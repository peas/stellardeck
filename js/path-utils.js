// Pure path utility functions (no dependencies)
// Used by js/images.js (ES module import) and test/viewer-helpers.test.js (CJS require)

// Convert absolute filesystem path to a URL the renderer can load.
// - Electron: deck://./<encoded-path> (custom protocol, see electron/main.js)
// - Tauri:    localfile://localhost/<encoded-path>  (or https://localfile.localhost on Windows)
export function convertFileSrc(filePath) {
  // Encode each path segment individually, keep slashes intact
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  // Electron exposes a typed helper from the preload — use it when present
  if (typeof window !== 'undefined' && window.stellardeck && typeof window.stellardeck.fileSrc === 'function') {
    return window.stellardeck.fileSrc(filePath);
  }
  // navigator is undefined in Node <21; fall back to non-Windows scheme.
  // In the browser/WKWebView this branch is always taken.
  const isWindows = typeof navigator !== 'undefined'
    && navigator.userAgent
    && navigator.userAgent.includes('Windows');
  return isWindows
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
