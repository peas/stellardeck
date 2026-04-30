// ============================================================
// Sidebar mode "diagnostics" — Problems-panel-style view
//
// Renders all open decks' diagnostics in #tab-bar, grouped by deck.
// Each item is clickable: switches to the right tab + jumps to the slide.
//
// Triggered when the activity rail's diagnostics button is clicked
// (via registerSidebarRenderer in sidebar.js) and re-rendered after
// each renderDeck() so counts stay live.
// ============================================================

import { state } from './state.js';
import { switchTab } from './tabs.js';

const SEVERITY_LABEL = { error: 'Error', warn: 'Warning', info: 'Info' };
const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 };

export function renderDiagnosticsSidebar() {
  const bar = document.getElementById('tab-bar');
  if (!bar) return;

  bar.innerHTML = '';
  bar.classList.add('visible');

  const header = document.createElement('div');
  header.className = 'sb-section-header';
  const total = state.tabs.reduce((sum, t) => sum + (t.diagnostics?.length || 0), 0);
  header.innerHTML = `PROBLEMS <span class="sb-section-meta">${total}</span>`;
  bar.appendChild(header);

  if (total === 0) {
    const empty = document.createElement('div');
    empty.className = 'sb-empty';
    empty.textContent = 'No problems detected.';
    bar.appendChild(empty);
    return;
  }

  state.tabs.forEach((tab, tabIndex) => {
    const warnings = tab.diagnostics || [];
    if (warnings.length === 0) return;

    const group = document.createElement('div');
    group.className = 'sb-diag-group';
    const name = tab.file.split('/').pop();
    group.innerHTML = `<div class="sb-diag-deck">
      <span class="sb-diag-deck-name">${escapeHtml(name)}</span>
      <span class="sb-diag-count">${warnings.length}</span>
    </div>`;
    bar.appendChild(group);

    // Sort: errors first, then warns, then by slide
    const sorted = [...warnings].sort((a, b) => {
      const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sev !== 0) return sev;
      return (a.slide ?? -1) - (b.slide ?? -1);
    });

    for (const w of sorted) {
      const item = document.createElement('div');
      item.className = `sb-diag-item sb-diag-${w.severity}`;
      const slideLabel = w.slide != null ? `Slide ${w.slide}` : 'Deck';
      item.innerHTML = `
        <div class="sb-diag-meta">
          <span class="sb-diag-type">${escapeHtml(w.type)}</span>
          <span class="sb-diag-slide">${slideLabel}</span>
        </div>
        <div class="sb-diag-msg">${escapeHtml(w.message)}</div>
      `;
      item.addEventListener('click', async () => {
        if (tabIndex !== state.activeTabIndex) {
          await switchTab(tabIndex);
        }
        if (w.slide != null && typeof Reveal !== 'undefined' && Reveal.slide) {
          Reveal.slide(Math.max(0, w.slide - 1));
        }
      });
      bar.appendChild(item);
    }
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
