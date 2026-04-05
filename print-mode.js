/**
 * print-mode.js — enter/exit "print mode" for slide capture
 *
 * Used by both the in-app PDF export (js/pdf-export.js) and the CLI exporter
 * (scripts/export.js, injected via addScriptTag). Hides chrome, fixes the
 * slide container at exact pixel dimensions, and returns a cleanup function.
 *
 * Modes:
 *   full: false (default) → app mode: toolbar/sidebar stay visible; overlay
 *     only covers the slide area. Used by the in-app "Export PDF" button.
 *   full: true → CLI mode: hide everything (toolbar, tab-bar, status-bar,
 *     toast). Used by headless Playwright captures.
 */
(function () {
  'use strict';

  const ALWAYS_HIDE = ['welcome-screen', 'grid-overlay'];
  const FULL_HIDE = ['toolbar', 'tab-bar', 'status-bar', 'toast'];

  /**
   * Enter print mode. Returns a cleanup function that restores original styles.
   * @param {object} [options]
   * @param {number} [options.width=1280]
   * @param {number} [options.height=720]
   * @param {boolean} [options.full=false]  Hide toolbar/sidebar (CLI-style)
   */
  function enter(options) {
    const opts = options || {};
    const width = opts.width || 1280;
    const height = opts.height || 720;
    const full = !!opts.full;

    const hideIds = full ? ALWAYS_HIDE.concat(FULL_HIDE) : ALWAYS_HIDE;
    const saved = {};

    for (const id of hideIds) {
      const el = document.getElementById(id);
      if (el) { saved[id] = el.style.cssText; el.style.display = 'none'; }
    }
    const decorations = document.querySelectorAll('.sd-slide-number, .sd-progress');
    decorations.forEach((el) => { el.style.display = 'none'; });

    const slideArea = document.getElementById('slide-area');
    saved.slideArea = slideArea && slideArea.style.cssText;
    if (slideArea) {
      slideArea.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;padding:0;';
    }

    document.body.style.setProperty('--chrome-height', '0px');

    const reveal = document.querySelector('.reveal');
    saved.reveal = reveal && reveal.style.cssText;
    if (reveal) {
      reveal.style.cssText =
        'width:' + width + 'px !important;' +
        'height:' + height + 'px !important;' +
        'max-width:none;max-height:none;box-shadow:none;margin:0;';
    }

    if (window.Reveal && typeof window.Reveal.layout === 'function') {
      window.Reveal.layout();
    }

    return function exit() {
      for (const id of hideIds) {
        const el = document.getElementById(id);
        if (el) el.style.cssText = saved[id] || '';
      }
      decorations.forEach((el) => { el.style.display = ''; });
      if (slideArea) slideArea.style.cssText = saved.slideArea || '';
      if (reveal) reveal.style.cssText = saved.reveal || '';
      document.body.style.removeProperty('--chrome-height');
      if (window.Reveal && typeof window.Reveal.layout === 'function') {
        window.Reveal.layout();
      }
    };
  }

  window.StellarPrintMode = { enter };
})();
