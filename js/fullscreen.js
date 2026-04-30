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
  // body.is-fullscreen is the single CSS hook that hides every chrome
  // element (titlebar, activity rail, sidebar, status bar) when the
  // user is "playing" the deck. Toggling individual element styles got
  // unwieldy with N panes; one class drives them all from chrome.css.
  document.body.classList.toggle('is-fullscreen', isFS);
  if (tabBar) tabBar.classList.toggle('visible', !isFS && (IS_DESKTOP || state.tabs.length > 1));
  updateChromeHeight();
}

export function updateChromeHeight() {
  const tabBar = document.getElementById('tab-bar');
  const hasSidebar = tabBar.classList.contains('visible') && !state.sidebarCollapsed;
  const isOverlay = document.body.classList.contains('desktop-overlay');
  const isFS = state.isFullscreen || !!(document.fullscreenElement || document.webkitFullscreenElement);
  const isDesktopApp = document.body.classList.contains('desktop-app');
  const chromeH = (isOverlay && !isFS) ? 36 : 0;
  // --sidebar-width is the horizontal real estate the slide must skip on
  // the left. In desktop mode that's the 48px activity rail PLUS the 220px
  // sidebar pane (when expanded). Forgetting the rail's 48px caused the
  // slide to start under the rail with no breathing room — visible asymmetry
  // vs the right edge.
  const railW = (isDesktopApp && !isFS) ? 48 : 0;
  const sidebarPaneW = hasSidebar ? 220 : 0;
  document.body.style.setProperty('--chrome-height', chromeH + 'px');
  document.body.style.setProperty('--sidebar-width', (railW + sidebarPaneW) + 'px');
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
