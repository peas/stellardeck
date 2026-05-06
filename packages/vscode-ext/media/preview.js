// preview.js — runs inside the VS Code webview.
// Receives `setMarkdown` messages from the extension host, parses the
// markdown via the bundled @stellardeck/core globals, renders into #slides,
// and posts diagnostics back.

(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const slidesEl = document.getElementById('slides');
  const emptyEl = document.getElementById('empty');
  const revealEl = document.querySelector('.reveal');

  let deck = null;          // StellarSlides instance
  let lastMarkdown = '';

  // Boot the renderer once. The container is empty until the first
  // setMarkdown message; StellarSlides handles a 0-slide state fine.
  function bootRenderer() {
    if (!window.StellarSlides) {
      log('StellarSlides global not found — renderer script failed to load.');
      return null;
    }
    return new window.StellarSlides(revealEl, {});
  }

  function applyTheme(md) {
    if (!revealEl) return;
    revealEl.className = revealEl.className.replace(/\b(theme|scheme)-\S+/g, '').trim();
    if (!revealEl.classList.contains('reveal')) revealEl.classList.add('reveal');
    const m = md.match(/^theme:\s*(.+)$/im);
    if (m) {
      const parts = m[1].split(',').map(s => s.trim());
      revealEl.classList.add('theme-' + parts[0].toLowerCase().replace(/\s+/g, '-'));
      if (parts[1]) revealEl.classList.add('scheme-' + parts[1]);
    }
  }

  function render(markdown) {
    if (!window.parseDecksetMarkdown) {
      log('parseDecksetMarkdown not loaded — engine bundle missing.');
      return;
    }
    if (!deck) deck = bootRenderer();

    applyTheme(markdown);
    const html = window.parseDecksetMarkdown(markdown, {});
    slidesEl.innerHTML = html;
    if (emptyEl) emptyEl.hidden = true;

    if (deck && typeof deck.sync === 'function') {
      try { deck.sync(); } catch (e) { log('sync() threw: ' + (e && e.message)); }
    }

    postDiagnostics();
  }

  function postDiagnostics() {
    if (!window.StellarDiagnostics || typeof window.StellarDiagnostics.diagnoseAll !== 'function') {
      return;
    }
    let warnings = [];
    try {
      warnings = window.StellarDiagnostics.diagnoseAll() || [];
    } catch (e) {
      log('diagnoseAll threw: ' + (e && e.message));
      return;
    }
    // Strip non-serializable bits before postMessage; VS Code uses
    // structured clone and rejects DOM nodes / functions.
    const safe = warnings.map(w => ({
      type: w.type,
      severity: w.severity,
      slide: typeof w.slide === 'number' ? w.slide : 0,
      message: String(w.message || w.type || 'StellarDeck'),
    }));
    vscode.postMessage({ type: 'diagnostics', warnings: safe });
  }

  function log(message) {
    try { vscode.postMessage({ type: 'log', message }); } catch { /* noop */ }
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'setMarkdown' && typeof msg.text === 'string') {
      if (msg.text === lastMarkdown) return;
      lastMarkdown = msg.text;
      render(msg.text);
    }
  });

  // Tell the host we're alive — useful for debugging activation issues.
  log('preview.js booted');
})();
