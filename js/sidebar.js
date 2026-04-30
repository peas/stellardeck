// ============================================================
// Sidebar / activity rail mode switcher
//
// The activity rail (`#activity-rail`) holds N buttons; each maps to a
// "sidebar mode" via data-mode. The active mode is stored on
// document.body[data-sidebar-mode]; CSS uses that selector to swap which
// pane is rendered inside #tab-bar. Render functions for each mode are
// registered here.
//
// Phase 3 step 2: rail + active-mode tracking only. Pane rendering for
// each mode lives in separate steps (decks/diagnostics/theme).
// ============================================================

import { IS_DESKTOP } from './desktop.js';
import { renderTabs } from './tabs.js';
import { renderDiagnosticsSidebar } from './sidebar-diagnostics.js';

const MODES = ['decks', 'diagnostics', 'theme'];
const renderers = new Map([
  ['decks', renderTabs],
  ['diagnostics', renderDiagnosticsSidebar],
  // 'theme' registers itself in checkpoint 5
]);

export function registerSidebarRenderer(mode, fn) {
  renderers.set(mode, fn);
}

export function getActiveMode() {
  return document.body.dataset.sidebarMode || 'decks';
}

export function setActiveMode(mode) {
  if (!MODES.includes(mode)) return;
  document.body.dataset.sidebarMode = mode;

  // Highlight the right rail button
  document.querySelectorAll('#activity-rail .rail-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const fn = renderers.get(mode);
  if (fn) fn();
}

export function setupActivityRail() {
  if (!IS_DESKTOP) return;

  const rail = document.getElementById('activity-rail');
  if (!rail) return;

  // Show the rail (HTML default is hidden so non-desktop modes ignore it).
  rail.hidden = false;

  rail.querySelectorAll('.rail-btn').forEach(btn => {
    btn.addEventListener('click', () => setActiveMode(btn.dataset.mode));
  });

  // Cmd+1/2/3 jump straight to a mode. Cmd+B toggles the whole sidebar
  // (existing behavior in fullscreen.js — we just register the mode keys).
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const idx = ['1', '2', '3'].indexOf(e.key);
    if (idx === -1) return;
    e.preventDefault();
    setActiveMode(MODES[idx]);
  });

  // Default mode on first activation
  setActiveMode(getActiveMode());
}

export function updateDiagnosticsBadge(count) {
  const badge = document.getElementById('rail-diag-count');
  if (!badge) return;
  if (count > 0) {
    badge.hidden = false;
    badge.textContent = count > 99 ? '99+' : String(count);
  } else {
    badge.hidden = true;
  }
}

// Called by render.js after a renderDeck completes. Re-renders the
// diagnostics view if it's the active sidebar mode, and always updates
// the rail's counter badge so the user sees a nudge even from another mode.
export function notifyDiagnosticsChanged(totalAcrossDecks) {
  updateDiagnosticsBadge(totalAcrossDecks);
  if (getActiveMode() === 'diagnostics') {
    const fn = renderers.get('diagnostics');
    if (fn) fn();
  } else if (getActiveMode() === 'decks') {
    // Also refresh decks view so per-deck warning badges update
    const fn = renderers.get('decks');
    if (fn) fn();
  }
}
