import { state } from './state.js';
import { IS_TAURI, tauriInvoke } from './tauri.js';
import { switchTab, closeTab, tabName } from './tabs.js';
import { toggleGrid, isGridOpen, selectGridSlide, getGridColumns, openSlideFromGrid } from './grid.js';
import { enterFullscreen, exitFullscreen, toggleSidebar } from './fullscreen.js';
import { openInExternalEditor } from './toolbar.js';
import { syncMeasurer, fitText } from './fittext.js';
import { setupBrokenImageHandlers } from './images.js';
import { showToast } from './toast.js';

export function setupKeyboard() {
  // ALL keyboard handling — engine's built-in keyboard is disabled
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl shortcuts (work in all states)
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'r') { e.preventDefault(); window.location.reload(); return; }
      if (IS_TAURI && e.key === 'o') {
        e.preventDefault();
        const dir = state.currentFile ? state.currentFile.substring(0, state.currentFile.lastIndexOf('/')) : null;
        tauriInvoke('open_file_dialog', { currentDir: dir }).then(async (newFile) => {
          if (!newFile) return;
          if (state.isFullscreen) exitFullscreen();
          // loadFile is on window (set by main.js)
          await window._loadFile(newFile);
          Reveal.sync(); syncMeasurer(); setupBrokenImageHandlers();
          requestAnimationFrame(() => fitText());
          state.gridBuilt = false;
          showToast(tabName(newFile));
        });
      }
      if (e.key === 'e') { e.preventDefault(); openInExternalEditor(); }
      if (e.key === 'b') { e.preventDefault(); toggleSidebar(); }
      if (e.key === 'w' && state.tabs.length > 1) { e.preventDefault(); closeTab(state.activeTabIndex); }
      return;
    }

    // Grid mode: navigate grid
    if (isGridOpen()) {
      const cols = getGridColumns();
      const total = document.querySelectorAll('.grid-slide').length;
      switch (e.key) {
        case 'Escape': toggleGrid(); break; // close grid (stays fullscreen if was fullscreen)
        case 'ArrowRight': selectGridSlide(Math.min(state.gridSelected + 1, total - 1)); break;
        case 'ArrowLeft': selectGridSlide(Math.max(state.gridSelected - 1, 0)); break;
        case 'ArrowDown': selectGridSlide(Math.min(state.gridSelected + cols, total - 1)); break;
        case 'ArrowUp': selectGridSlide(Math.max(state.gridSelected - cols, 0)); break;
        case 'Enter': openSlideFromGrid(state.gridSelected); break;
        default: return;
      }
      e.preventDefault();
      return;
    }

    // Slide mode
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        // Fullscreen? Exit fullscreen. Otherwise? Open grid.
        if (state.isFullscreen) exitFullscreen();
        else toggleGrid();
        break;
      case 'g': case 'G':
        e.preventDefault();
        toggleGrid();
        break;
      case 'f': case 'F':
        e.preventDefault();
        if (state.isFullscreen) exitFullscreen();
        else enterFullscreen();
        break;
      case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown':
        e.preventDefault(); Reveal.next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        e.preventDefault(); Reveal.prev(); break;
      case 'Home': e.preventDefault(); Reveal.slide(0); break;
      case 'End': e.preventDefault(); Reveal.slide(Reveal.getTotalSlides() - 1); break;
      case 'p': case 'P':
        e.preventDefault();
        if (window._openPresenter) window._openPresenter();
        break;
    }
  }, true);
}
