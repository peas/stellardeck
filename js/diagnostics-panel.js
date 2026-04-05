/**
 * diagnostics-panel.js — toolbar badge + floating panel for deck warnings.
 *
 * Consumes structured warnings from window.StellarDiagnostics (set by
 * diagnostics.js) and stored per-tab by render.js. The panel lists warnings
 * grouped by slide; clicking an item navigates there.
 */

const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 };
const SEVERITY_LABEL = { error: 'Error', warn: 'Warning', info: 'Info' };

/**
 * Update the toolbar badge and, if open, refresh the panel.
 * Called after every renderDeck() completes.
 */
export function refreshDiagnosticsUI(warnings = []) {
  const btn = document.getElementById('btn-diagnostics');
  const count = document.getElementById('diag-count');
  if (!btn || !count) return;

  if (warnings.length === 0) {
    btn.hidden = true;
    closePanel();
    return;
  }

  btn.hidden = false;
  count.textContent = warnings.length;

  // Color by most-severe warning
  const worst = warnings.reduce((acc, w) => {
    return SEVERITY_ORDER[w.severity] < SEVERITY_ORDER[acc] ? w.severity : acc;
  }, 'info');
  btn.dataset.severity = worst;

  const panel = document.getElementById('diagnostics-panel');
  if (panel && !panel.hidden) renderPanel(warnings);
}

function renderPanel(warnings) {
  const list = document.getElementById('diag-list');
  if (!list) return;
  list.innerHTML = '';

  // Sort: errors first, then warns, then infos; within severity, by slide index
  const sorted = [...warnings].sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return (a.slide ?? -1) - (b.slide ?? -1);
  });

  for (const w of sorted) {
    const item = document.createElement('div');
    item.className = `diag-item diag-${w.severity}`;
    const slideLabel = w.slide != null ? `Slide ${w.slide}` : 'Deck';
    item.innerHTML = `
      <div class="diag-meta">
        <span class="diag-type">${w.type}</span>
        <span class="diag-slide">${slideLabel}</span>
      </div>
      <div class="diag-message">${escapeHtml(w.message)}</div>
    `;
    if (w.slide != null && window.Reveal) {
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        window.Reveal.slide(w.slide - 1);
      });
    }
    list.appendChild(item);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function openPanel(warnings) {
  const panel = document.getElementById('diagnostics-panel');
  if (!panel) return;
  renderPanel(warnings);
  panel.hidden = false;
}

function closePanel() {
  const panel = document.getElementById('diagnostics-panel');
  if (panel) panel.hidden = true;
}

export function setupDiagnosticsPanel(getWarnings) {
  const btn = document.getElementById('btn-diagnostics');
  const close = document.getElementById('close-diag');
  const panel = document.getElementById('diagnostics-panel');
  if (!btn || !panel) return;

  btn.addEventListener('click', () => {
    if (panel.hidden) openPanel(getWarnings());
    else closePanel();
  });
  if (close) close.addEventListener('click', closePanel);

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) closePanel();
  });
}
