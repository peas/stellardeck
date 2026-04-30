import { state } from './state.js';
import { IS_DESKTOP, desktopInvoke } from './desktop.js';

// ============================================================
// Fullscreen state machine (shared by toolbar + keyboard)
// ============================================================

export function exitFullscreen() {
  if (IS_DESKTOP) {
    desktopInvoke('toggle_fullscreen');
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  }
  state.isFullscreen = false;
  updatePlayState();
}

export function enterFullscreen() {
  if (IS_DESKTOP) {
    desktopInvoke('toggle_fullscreen');
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
  const tabBar = document.getElementById('tab-bar');
  const titlebar = document.getElementById('titlebar-drag');
  if (tabBar) tabBar.classList.toggle('visible', !isFS && (IS_DESKTOP || state.tabs.length > 1));
  // Hide the chrome titlebar (with traffic-light overlay) in fullscreen.
  if (titlebar) titlebar.style.display = isFS ? 'none' : '';
  updateChromeHeight();
}

export function updateChromeHeight() {
  const tabBar = document.getElementById('tab-bar');
  const hasSidebar = tabBar.classList.contains('visible') && !state.sidebarCollapsed;
  // 36px chrome bar in desktop overlay mode, otherwise 0
  const isOverlay = document.body.classList.contains('desktop-overlay');
  const isFS = state.isFullscreen || !!(document.fullscreenElement || document.webkitFullscreenElement);
  const chromeH = (isOverlay && !isFS) ? 36 : 0;
  document.body.style.setProperty('--chrome-height', chromeH + 'px');
  document.body.style.setProperty('--sidebar-width', hasSidebar ? '220px' : '0px');
  if (tabBar) tabBar.style.display = hasSidebar ? 'flex' : (tabBar.classList.contains('visible') ? 'none' : '');
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
