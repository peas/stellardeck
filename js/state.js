// ============================================================
// Shared mutable state — single source of truth
// ============================================================

// Slide dimensions moved to js/dimensions.js (parameterizable bootstrap)
// After Reveal.initialize(), use Reveal.getConfig().width/height instead.

// Print mode: hide all chrome (used by decktape PDF export)
export const urlParams = new URLSearchParams(window.location.search);
export const IS_PRINT = urlParams.has('print');
export const IS_EMBED = urlParams.has('embed');

export const state = {
  tabs: [],
  activeTabIndex: -1,
  currentMd: '',
  currentFile: '',
  fileDir: '',
  isFullscreen: false,
  gridSelected: 0,
  gridBuilt: false,
  sidebarCollapsed: false,
  measurer: null,
  _restoring: false, // true during session restore — suppresses smartReload
};
