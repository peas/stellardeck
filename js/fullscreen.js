import { state } from './state.js';
import { IS_TAURI, tauriInvoke } from './tauri.js';

// ============================================================
// Fullscreen state machine (shared by toolbar + keyboard)
// ============================================================

export function exitFullscreen() {
  if (IS_TAURI) {
    tauriInvoke('toggle_fullscreen');
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  }
  state.isFullscreen = false;
  updatePlayState();
}

export function enterFullscreen() {
  if (IS_TAURI) {
    tauriInvoke('toggle_fullscreen');
  } else {
    const el = document.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  }
  state.isFullscreen = true;
  if (isGridOpen()) {
    // Import toggleGrid inline to avoid circular dependency
    const overlay = document.getElementById('grid-overlay');
    overlay.classList.remove('active');
    Reveal.slide(state.gridSelected);
    const btn = document.getElementById('btn-grid');
    if (btn) btn.classList.toggle('active', false);
  }
  updatePlayState();
}

export function updatePlayState() {
  const isFS = state.isFullscreen || !!(document.fullscreenElement || document.webkitFullscreenElement);
  const toolbar = document.getElementById('toolbar');
  const tabBar = document.getElementById('tab-bar');
  if (toolbar) toolbar.classList.toggle('visible', !isFS);
  if (tabBar) tabBar.classList.toggle('visible', !isFS && (IS_TAURI || state.tabs.length > 1));
  updateChromeHeight();
}

export function updateChromeHeight() {
  const tabBar = document.getElementById('tab-bar');
  const hasSidebar = tabBar.classList.contains('visible') && !state.sidebarCollapsed;
  const toolH = document.getElementById('toolbar').classList.contains('visible') ? 44 : 0;
  document.body.style.setProperty('--chrome-height', toolH + 'px');
  document.body.style.setProperty('--sidebar-width', hasSidebar ? '220px' : '0px');
  if (tabBar) tabBar.style.display = hasSidebar ? 'flex' : (tabBar.classList.contains('visible') ? 'none' : '');
  // Recalculate StellarSlides layout after chrome changes
  if (Reveal.isReady?.()) requestAnimationFrame(() => Reveal.layout());
}

export function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  updateChromeHeight();
  const btn = document.getElementById('btn-sidebar');
  if (btn) btn.classList.toggle('active', !state.sidebarCollapsed);
}

function isGridOpen() {
  return document.getElementById('grid-overlay').classList.contains('active');
}
