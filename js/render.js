import { state } from './state.js';
import { resolveImageSrcs, setupBrokenImageHandlers } from './images.js';
import { syncMeasurer, fitText } from './fittext.js';
import { buildGrid, isGridOpen } from './grid.js';
import { refreshUI } from './toolbar.js';
import { refreshDiagnosticsUI } from './diagnostics-panel.js';

// ============================================================
// Centralized slide re-render — single function for all paths
// ============================================================

/**
 * Re-render the current tab's slides and run all post-processing.
 * Replaces the duplicated pattern across switchTab, closeTab, autoflow toggle,
 * smartReload, and _loadFileFromMenu.
 *
 * @param {object} [opts]
 * @param {number} [opts.slideIndex] - slide to navigate to (default: current)
 * @param {string} [opts.toast] - show toast after render
 * @param {boolean} [opts.skipExtras] - skip renderExtras (QR, math, diagrams, highlight)
 */
export async function renderDeck(opts = {}) {
  const tab = state.tabs[state.activeTabIndex];
  if (!tab) return;

  const currentIdx = opts.slideIndex ?? (typeof Reveal !== 'undefined' && typeof Reveal.getState === 'function'
    ? (Reveal.getState().indexh || 0)
    : 0);

  document.getElementById('slides').innerHTML = parseDecksetMarkdown(
    state.currentMd, { autoflow: tab.autoflow }
  );
  resolveImageSrcs();
  Reveal.sync();

  const targetIdx = Math.min(currentIdx, Reveal.getTotalSlides() - 1);
  Reveal.slide(targetIdx);

  await new Promise(r => requestAnimationFrame(r));

  refreshUI();
  syncMeasurer();
  setupBrokenImageHandlers();
  if (!opts.skipExtras && window._renderExtras) window._renderExtras();
  if (window._sendSlideUpdate) window._sendSlideUpdate();
  requestAnimationFrame(() => fitText());

  state.gridBuilt = false;
  if (isGridOpen()) buildGrid();
  if (window._saveSession) window._saveSession();

  // Run diagnostics on current slide + merge into tab's cumulative list.
  // Incremental approach avoids visible slide-flashing on initial load;
  // warnings accumulate as user navigates through the deck.
  if (window.StellarDiagnostics) {
    tab.diagnostics = tab.diagnostics || [];
    // Clear deck-level diagnostics on each render (they may have changed)
    tab.diagnostics = tab.diagnostics.filter(w => w.slide != null);
    const deckWarnings = window.StellarDiagnostics.diagnoseDeck({ theme: tab.themeOverride });
    const current = window.StellarDiagnostics.diagnoseCurrent({ theme: tab.themeOverride });
    window.StellarDiagnostics.merge(tab.diagnostics, [...deckWarnings, ...current.filter(w => w.slide != null)]);
    refreshDiagnosticsUI(tab.diagnostics);
  }

  if (opts.toast) {
    const { showToast } = await import('./toast.js');
    showToast(opts.toast);
  }
}

/**
 * Check just the current slide + update UI. Called on slide navigation
 * to progressively populate the diagnostics badge.
 */
export function updateDiagnosticsForCurrentSlide() {
  if (!window.StellarDiagnostics) return;
  const tab = state.tabs[state.activeTabIndex];
  if (!tab) return;
  tab.diagnostics = tab.diagnostics || [];
  const current = window.StellarDiagnostics.diagnoseCurrent({ theme: tab.themeOverride });
  const perSlide = current.filter(w => w.slide != null);
  if (perSlide.length === 0) return;
  window.StellarDiagnostics.merge(tab.diagnostics, perSlide);
  refreshDiagnosticsUI(tab.diagnostics);
}
