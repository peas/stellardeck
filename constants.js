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

  // Theme registry — single source of truth for CLI (--list-themes,
  // --list-schemes) and the app's toolbar picker (js/themes.js reads from here).
  const THEMES = {
    '': { label: 'Default (Inter)', schemes: [
      { id: '1', bg: '#0a0a0a', fg: '#f8fafc' },
      { id: '2', bg: '#ffffff', fg: '#111111' },
      { id: '3', bg: '#1e293b', fg: '#e2e8f0' },
    ]},
    'letters-from-brazil': { label: 'Letters from Brazil', schemes: [
      { id: '1', bg: '#47B386', fg: '#2C3850' },
      { id: '2', bg: '#E8D6D2', fg: '#FB6863' },
      { id: '3', bg: '#22A6E3', fg: '#EDEAE3' },
      { id: '4', bg: '#122232', fg: '#FEE04A' },
      { id: '5', bg: '#085293', fg: '#FDCA42' },
      { id: '6', bg: '#FFFFFF', fg: '#000000' },
      { id: '7', bg: '#000000', fg: '#FFFFFF' },
    ]},
    'serif': { label: 'Serif', schemes: [
      { id: '1', bg: '#f5f0eb', fg: '#1a1a1a' },
      { id: '2', bg: '#1a1a2e', fg: '#e0d5c1' },
      { id: '3', bg: '#fefefe', fg: '#2c3e50' },
      { id: '4', bg: '#0d1117', fg: '#f0e6d3' },
    ]},
    'minimal': { label: 'Minimal', schemes: [
      { id: '1', bg: '#ffffff', fg: '#111111' },
      { id: '2', bg: '#0f172a', fg: '#f1f5f9' },
      { id: '3', bg: '#fafaf9', fg: '#1c1917' },
      { id: '4', bg: '#18181b', fg: '#fafafa' },
    ]},
    'hacker': { label: 'Hacker', schemes: [
      { id: '1', bg: '#0d1117', fg: '#58a6ff' },
      { id: '2', bg: '#282a36', fg: '#bd93f9' },
      { id: '3', bg: '#002b36', fg: '#b58900' },
      { id: '4', bg: '#1a1b26', fg: '#7aa2f7' },
    ]},
    'poster': { label: 'Poster', schemes: [
      { id: '1', bg: '#000000', fg: '#ffffff' },
      { id: '2', bg: '#1a0a2e', fg: '#f0e68c' },
      { id: '3', bg: '#ffffff', fg: '#000000' },
      { id: '4', bg: '#0a192f', fg: '#64ffda' },
    ]},
    'borneli': { label: 'Borneli', schemes: [
      { id: '1', bg: '#ece7e2', fg: '#1a1050' },
      { id: '2', bg: '#1a1050', fg: '#ece7e2' },
      { id: '3', bg: '#ffffff', fg: '#1a1050' },
      { id: '4', bg: '#8a2080', fg: '#ffffff' },
      { id: '5', bg: '#f5f0eb', fg: '#1a1050' },
    ]},
    'alun': { label: 'Alun', schemes: [
      { id: '1', bg: '#0d0c0c', fg: '#FF9414' },
      { id: '2', bg: '#0d0c0c', fg: '#ED1460' },
      { id: '3', bg: '#f3f2f2', fg: '#0d0c0c' },
      { id: '4', bg: '#FF9414', fg: '#0d0c0c' },
      { id: '5', bg: '#ED1460', fg: '#ffffff' },
    ]},
    'nordic': { label: 'Nordic', schemes: [
      { id: '1', bg: '#0a1628', fg: '#e2e8f0' },
      { id: '2', bg: '#fafaf9', fg: '#1c1917' },
      { id: '3', bg: '#1e293b', fg: '#f1f5f9' },
      { id: '4', bg: '#0f172a', fg: '#fbbf24' },
      { id: '5', bg: '#ffffff', fg: '#0f172a' },
    ]},
    'keynote': { label: 'Keynote', schemes: [
      { id: '1', bg: '#000000', fg: '#ffffff' },
      { id: '2', bg: '#111827', fg: '#f9fafb' },
      { id: '3', bg: '#ffffff', fg: '#111827' },
      { id: '4', bg: '#0c0a20', fg: '#e0e7ff' },
      { id: '5', bg: '#1c1917', fg: '#fef3c7' },
    ]},
  };

  const API = { CDN, SLIDE, THEMES };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
  if (typeof window !== 'undefined') {
    window.StellarConstants = API;
  }
})();
