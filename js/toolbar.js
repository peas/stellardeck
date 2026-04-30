import { state, IS_PRINT } from './state.js';
import { IS_DESKTOP, IS_TAURI, desktopInvoke } from './desktop.js';
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
      if (IS_DESKTOP) {
        desktopInvoke('reveal_in_finder', { path: state.currentFile }).catch(() => {});
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
  if (IS_DESKTOP) {
    desktopInvoke('open_in_editor', { path: state.currentFile }).catch(e => {
      showToast('Failed to open editor: ' + e, 4000);
    });
  } else {
    showToast('Open this file in your editor: ' + state.currentFile, 4000);
  }
}

/**
 * setupToolbar (Phase 3 leftover): the legacy top toolbar was removed in
 * checkpoint 9. This function now only:
 *   - registers fullscreenchange listeners
 *   - hooks Reveal events to refreshUI (counter, status bar, doc title)
 * All button-specific wiring moved to chrome buttons in main.js, the
 * sidebar (theme picker), and the command palette / context menu.
 */
export function setupToolbar() {
  document.addEventListener('fullscreenchange', updatePlayState);
  document.addEventListener('webkitfullscreenchange', updatePlayState);

  if (typeof Reveal !== 'undefined') {
    Reveal.on('ready', refreshUI);
    Reveal.on('slidechanged', refreshUI);
  }
}

/**
 * Standalone PDF export — kicked off by the command palette
 * (`Export PDF`), the native menu (File → Export PDF), and Cmd+Shift+E.
 * Uses the same #export-progress overlay the old toolbar button drove.
 */
export async function runPdfExport() {
  if (!state.currentFile) return;
  const progressEl = document.getElementById('export-progress');
  const progressBar = document.getElementById('export-progress-bar');
  if (progressEl) progressEl.classList.add('active', 'indeterminate');
  if (progressBar) progressBar.style.width = '0%';

  let unlisten;
  if (IS_TAURI && window.__TAURI__?.event?.listen) {
    unlisten = await window.__TAURI__.event.listen('pdf-progress', (event) => {
      const payload = event.payload;
      if (payload.startsWith('prep:')) return;
      const [current, total] = payload.split('/');
      const pct = Math.round(current / total * 100);
      progressEl?.classList.remove('indeterminate');
      if (progressBar) progressBar.style.width = pct + '%';
    });
  }
  try {
    const pdfModule = await import('./pdf-export.js');
    const mdName = (state.currentFile || 'slides').split('/').pop().replace(/\.md$/, '');
    const filename = mdName + '.pdf';
    progressEl?.classList.remove('indeterminate');

    const progressCb = {
      scale: 2,
      onProgress: (i, total) => {
        const pct = Math.round(((i + 1) / total) * 100);
        if (progressBar) progressBar.style.width = pct + '%';
      },
    };

    await pdfModule.exportAndDownload(filename, progressCb);
    if (progressBar) progressBar.style.width = '100%';

    if (IS_DESKTOP) {
      const homedir = state.currentFile.match(/^(\/Users\/[^/]+)/)?.[1] || '';
      const downloadPath = homedir + '/Downloads/' + filename;
      showToast('PDF exported — click to open in Finder', true);
      const toast = document.getElementById('toast');
      if (toast) {
        toast.style.cursor = 'pointer';
        const span = toast.querySelector('span');
        if (span) span.onclick = () => {
          desktopInvoke('reveal_in_finder', { path: downloadPath });
          toast.classList.remove('show');
        };
      }
    } else {
      showToast('PDF downloaded: ' + filename);
    }
  } catch (e) {
    showToast('Export failed: ' + e, true);
  } finally {
    setTimeout(() => {
      progressEl?.classList.remove('active', 'indeterminate');
      if (progressBar) progressBar.style.width = '0%';
    }, 1500);
    if (unlisten) unlisten();
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
