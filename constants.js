/**
 * constants.js — shared constants across browser app and Node CLI.
 *
 * Exposes `window.StellarConstants` in browser contexts and `module.exports`
 * for CommonJS (Node). Loaded by viewer.html before other scripts.
 */
(function () {
  'use strict';

  const CDN = {
    HTML2CANVAS: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    PDFLIB:      'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    HLJS:        'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
    HLJS_THEME:  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/monokai.min.css',
    KATEX:       'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js',
    KATEX_CSS:   'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css',
    MERMAID:     'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js',
    QRCODE:      'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
  };

  const SLIDE = {
    WIDTH:  1280,
    HEIGHT: 720,
  };

  const API = { CDN, SLIDE };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
  if (typeof window !== 'undefined') {
    window.StellarConstants = API;
  }
})();
