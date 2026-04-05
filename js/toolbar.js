import { state, IS_PRINT } from './state.js';
import { IS_TAURI, tauriInvoke } from './tauri.js';
import { showToast } from './toast.js';
import { THEMES, applySchemeColors, propagateThemeVars, syncThemeDropdown } from './themes.js';
import { syncMeasurer, fitText } from './fittext.js';
import { toggleGrid, isGridOpen, buildGrid } from './grid.js';
import { enterFullscreen, exitFullscreen, updatePlayState, updateChromeHeight, toggleSidebar } from './fullscreen.js';
import { persistThemeToSidecar, persistAutoflowToSidecar } from './sidecar.js';
import { resolveImageSrcs, setupBrokenImageHandlers } from './images.js';
import { renderDeck } from './render.js';

export { updateChromeHeight };

export function syncAutoflowButton(enabled) {
  const btn = document.getElementById('btn-autoflow');
  if (btn) btn.classList.toggle('active', !!enabled);
}

/**
 * Centralized UI refresh — updates ALL chrome state after any re-render.
 * Fixes stale counter, autoflow button desync, status bar, and document title.
 * Only depends on state.js + DOM — no imports from other modules (avoids circular deps).
 */
export function refreshUI() {
  // Guard: skip during intermediate states (e.g. session restore with activeTabIndex = -1)
  const tab = state.tabs[state.activeTabIndex];
  if (!tab) return;

  // 1. Slide counter
  if (typeof Reveal !== 'undefined' && typeof Reveal.getState === 'function') {
    try {
      const s = Reveal.getState();
      const total = Reveal.getTotalSlides();
      const counterEl = document.getElementById('slide-counter');
      if (counterEl) counterEl.textContent = `${(s.indexh || 0) + 1} / ${total}`;
    } catch { /* Reveal not ready yet */ }
  }

  // 2. Autoflow button
  syncAutoflowButton(tab?.autoflow);

  // 3. Status bar
  updateStatusBar();

  // 4. Document title
  if (state.currentFile) {
    const parts = state.currentFile.split('/');
    const name = parts.pop();
    const dir = parts.pop() || '';
    const label = dir ? `${dir}/${name}` : name;
    document.title = label + ' — StellarDeck';
  }
}

export function updateStatusBar() {
  const fileEl = document.getElementById('status-file');
  const autoflowEl = document.getElementById('status-autoflow');
  if (!fileEl || !autoflowEl) return;

  // File path (left side)
  if (state.currentFile) {
    const parts = state.currentFile.split('/');
    const name = parts.pop();
    const dir = parts.join('/');
    fileEl.innerHTML = `<span class="status-dir">${dir}/</span><span class="status-name">${name}</span>`;
    fileEl.title = state.currentFile;
    fileEl.onclick = () => {
      if (IS_TAURI) {
        tauriInvoke('reveal_in_finder', { path: state.currentFile }).catch(() => {});
      }
    };
  }

  // Autoflow info (right side) — check data-attributes directly (works for both frontmatter and toolbar autoflow)
  const idx = (typeof Reveal !== 'undefined' && typeof Reveal.getState === 'function') ? (Reveal.getState().indexh || 0) : 0;
  const section = document.querySelectorAll('.reveal .slides > section')[idx];
  const rule = section?.getAttribute('data-autoflow');
  const detail = section?.getAttribute('data-autoflow-detail');
  if (rule) {
    const label = rule === 'explicit' ? 'autoflow skipped'
      : rule === 'code' ? 'autoflow skipped'
      : rule === 'default' ? 'autoflow'
      : 'autoflow';
    const ruleText = rule === 'explicit' ? detail || 'has explicit directives'
      : rule === 'code' ? 'code block'
      : rule === 'default' ? `no rule matched (${detail})`
      : `${rule} (${detail})`;
    autoflowEl.innerHTML = `<span class="status-label">${label}: </span><span class="status-rule">${ruleText}</span>`;
  } else {
    autoflowEl.textContent = '';
  }
}

export function showToolbar() {
  if (IS_PRINT) return; // no toolbar in print mode
  document.getElementById('toolbar').classList.add('visible');
  updateChromeHeight();
}

export function openInExternalEditor() {
  if (!state.currentFile) return;
  if (IS_TAURI) {
    tauriInvoke('open_in_editor', { path: state.currentFile }).catch(e => {
      showToast('Failed to open editor: ' + e, 4000);
    });
  } else {
    showToast('Open this file in your editor: ' + state.currentFile, 4000);
  }
}

export function setupToolbar() {
  showToolbar();

  document.getElementById('btn-play').addEventListener('click', () => {
    if (state.isFullscreen) exitFullscreen();
    else enterFullscreen();
  });

  document.getElementById('btn-presenter').addEventListener('click', () => {
    if (window._openPresenter) window._openPresenter();
  });

  // Fullscreen change events
  document.addEventListener('fullscreenchange', updatePlayState);
  document.addEventListener('webkitfullscreenchange', updatePlayState);

  document.getElementById('btn-grid').addEventListener('click', () => {
    toggleGrid();
    document.getElementById('btn-grid').classList.toggle('active', isGridOpen());
  });

  document.getElementById('btn-export').addEventListener('click', async () => {
    if (!state.currentFile) return;
    const btn = document.getElementById('btn-export');
    const progressEl = document.getElementById('export-progress');
    const progressBar = document.getElementById('export-progress-bar');
    btn.textContent = '\u23F3 Preparing...';
    btn.disabled = true;
    progressEl.classList.add('active', 'indeterminate');
    progressBar.style.width = '0%';
    // Listen for real-time progress events from Rust
    let unlisten;
    if (IS_TAURI && window.__TAURI__?.event?.listen) {
      unlisten = await window.__TAURI__.event.listen('pdf-progress', (event) => {
        const payload = event.payload;
        if (payload.startsWith('prep:')) {
          btn.textContent = `\u23F3 Preparing ${payload.slice(5)}`;
          return;
        }
        const [current, total] = payload.split('/');
        const pct = Math.round(current / total * 100);
        progressEl.classList.remove('indeterminate');
        btn.textContent = `\u23F3 Slide ${current}/${total}`;
        progressBar.style.width = pct + '%';
      });
    }
    try {
      const pdfModule = await import('./pdf-export.js');
      const mdName = (state.currentFile || 'slides').split('/').pop().replace(/\.md$/, '');
      const filename = mdName + '.pdf';
      progressEl.classList.remove('indeterminate');

      const progressCb = {
        scale: 2,
        onProgress: (i, total) => {
          const pct = Math.round(((i + 1) / total) * 100);
          btn.textContent = `\u23F3 ${i + 1}/${total}`;
          progressBar.style.width = pct + '%';
        },
      };

      await pdfModule.exportAndDownload(filename, progressCb);
      progressBar.style.width = '100%';

      if (IS_TAURI) {
        // WKWebView saves downloads to ~/Downloads/
        const homedir = state.currentFile.match(/^(\/Users\/[^/]+)/)?.[1] || '';
        const downloadPath = homedir + '/Downloads/' + filename;
        showToast('PDF exported — click to open in Finder', true);
        const toast = document.getElementById('toast');
        toast.style.cursor = 'pointer';
        const span = toast.querySelector('span');
        if (span) span.onclick = () => {
          tauriInvoke('reveal_in_finder', { path: downloadPath });
          toast.classList.remove('show');
        };
      } else {
        showToast('PDF downloaded: ' + filename);
      }
    } catch (e) {
      showToast('Export failed: ' + e, true);
    } finally {
      btn.textContent = '\u21E9 PDF';
      btn.disabled = false;
      setTimeout(() => { progressEl.classList.remove('active', 'indeterminate'); progressBar.style.width = '0%'; }, 1500);
      if (unlisten) unlisten();
    }
  });

  // Theme dropdown
  const themeSelect = document.getElementById('theme-select');
  Object.entries(THEMES).forEach(([key, theme]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = theme.label;
    themeSelect.appendChild(opt);
  });
  // Set initial value from current theme class
  const currentTheme = Array.from(document.querySelector('.reveal').classList)
    .find(c => c.startsWith('theme-'));
  themeSelect.value = currentTheme ? currentTheme.replace('theme-', '') : '';

  themeSelect.addEventListener('change', () => {
    const reveal = document.querySelector('.reveal');
    reveal.className = reveal.className.replace(/theme-\S+|scheme-\S+/g, '').trim();
    if (!reveal.classList.contains('reveal')) reveal.classList.add('reveal');
    if (themeSelect.value) reveal.classList.add('theme-' + themeSelect.value);
    // Apply first scheme of the new theme
    const schemes = THEMES[themeSelect.value]?.schemes;
    if (schemes?.length) reveal.classList.add('scheme-' + schemes[0].id);
    propagateThemeVars();
    applySchemeColors();
    syncMeasurer();
    document.fonts.ready.then(() => requestAnimationFrame(() => fitText()));
    persistThemeToSidecar();
    showToast(THEMES[themeSelect.value]?.label || 'Default');
  });

  document.getElementById('btn-colors').addEventListener('click', (e) => {
    toggleSchemePopover(e.target);
  });

  // About dialog
  const aboutDialog = document.getElementById('about-dialog');
  const aboutBackdrop = document.getElementById('about-backdrop');
  document.getElementById('btn-about').addEventListener('click', () => {
    aboutDialog.classList.add('open');
    aboutBackdrop.classList.add('open');
  });
  const closeAbout = () => { aboutDialog.classList.remove('open'); aboutBackdrop.classList.remove('open'); };
  document.getElementById('close-about').addEventListener('click', closeAbout);
  aboutBackdrop.addEventListener('click', closeAbout);

  // Autoflow toggle
  const autoflowBtn = document.getElementById('btn-autoflow');
  // Sync initial state from active tab
  const initTab = state.tabs[state.activeTabIndex];
  if (initTab) autoflowBtn.classList.toggle('active', !!initTab.autoflow);
  autoflowBtn.addEventListener('click', async () => {
    const tab = state.tabs[state.activeTabIndex];
    if (!tab) return;
    tab.autoflow = !tab.autoflow;
    await renderDeck({ toast: tab.autoflow ? 'Autoflow on' : 'Autoflow off' });
    persistAutoflowToSidecar();
  });

  // Open in external editor (Cmd+E or toolbar button)
  document.getElementById('btn-editor').addEventListener('click', openInExternalEditor);

  const sidebarBtn = document.getElementById('btn-sidebar');
  sidebarBtn.addEventListener('click', toggleSidebar);
  sidebarBtn.classList.add('active'); // sidebar starts visible

  // Update all chrome on navigation (counter, status bar, autoflow, title)
  if (typeof Reveal !== 'undefined') {
    Reveal.on('ready', refreshUI);
    Reveal.on('slidechanged', refreshUI);
  }
}

export function toggleSchemePopover(anchor) {
  const popover = document.getElementById('scheme-popover');
  if (popover.classList.contains('open')) {
    popover.classList.remove('open');
    return;
  }

  // Detect current theme
  const reveal = document.querySelector('.reveal');
  const themeClass = Array.from(reveal.classList).find(c => c.startsWith('theme-'));
  const themeName = themeClass ? themeClass.replace('theme-', '') : '';
  const schemes = THEMES[themeName]?.schemes || [];

  if (!schemes.length) {
    showToast('No color schemes for this theme');
    return;
  }

  const currentScheme = Array.from(reveal.classList).find(c => c.startsWith('scheme-'));

  popover.innerHTML = '';
  schemes.forEach(s => {
    const swatch = document.createElement('div');
    swatch.className = 'scheme-swatch' + (currentScheme === 'scheme-' + s.id ? ' active' : '');
    swatch.style.background = s.bg;
    swatch.style.boxShadow = `inset 0 0 0 3px ${s.bg}, inset 0 -8px 0 ${s.fg}`;
    swatch.title = `Scheme ${s.id}`;
    swatch.addEventListener('click', () => {
      reveal.className = reveal.className.replace(/scheme-\S+/g, '').trim();
      reveal.classList.add('scheme-' + s.id);
      popover.classList.remove('open');
      applySchemeColors();
      persistThemeToSidecar();
      showToast(`Scheme ${s.id}`);
    });
    popover.appendChild(swatch);
  });

  // Position popover below the button
  const rect = anchor.getBoundingClientRect();
  popover.style.top = (rect.bottom + 4) + 'px';
  popover.style.left = rect.left + 'px';
  popover.classList.add('open');

  // Close on click outside
  const close = (e) => {
    if (!popover.contains(e.target) && e.target !== anchor) {
      popover.classList.remove('open');
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}
