/**
 * dimensions.js — Slide dimensions bootstrap module
 *
 * Holds default dimensions (1280×720) that can be overridden before
 * Reveal.initialize(). After initialization, all modules should read
 * from Reveal.getConfig().width/height instead.
 *
 * This module exists for the gap between boot and Reveal.initialize(),
 * and as a central place for dimension parsing (frontmatter, URL params).
 */

let _width = window.StellarConstants.SLIDE.WIDTH;
let _height = window.StellarConstants.SLIDE.HEIGHT;

export function setDimensions(w, h) {
  _width = w;
  _height = h;
}

export function getSlideWidth() { return _width; }
export function getSlideHeight() { return _height; }

/**
 * Parse aspect ratio string into width/height.
 * Accepts: "4:3", "16:9", "16:10"
 */
export function parseAspect(aspect) {
  const match = aspect?.match(/^(\d+):(\d+)$/);
  if (!match) return null;
  const [, aw, ah] = match;
  const ratioW = parseInt(aw, 10);
  const ratioH = parseInt(ah, 10);
  // Normalize to height of default (same scale)
  const height = window.StellarConstants.SLIDE.HEIGHT;
  const width = Math.round(height * ratioW / ratioH);
  return { width, height };
}

/**
 * Apply dimensions to CSS custom properties on :root.
 * chrome.css and presenter.css already use --sd-slide-w / --sd-slide-h with fallbacks.
 */
export function applyDimensionVars() {
  const root = document.documentElement;
  root.style.setProperty('--sd-slide-w', _width + 'px');
  root.style.setProperty('--sd-slide-h', _height + 'px');
}
