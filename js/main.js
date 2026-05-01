import { state, IS_PRINT, IS_EMBED, urlParams } from './state.js';
import { getSlideWidth, getSlideHeight, setDimensions, parseAspect, applyDimensionVars } from './dimensions.js';
import { IS_DESKTOP, IS_ELECTRON, desktopInvoke } from './desktop.js';
import { showToast } from './toast.js';
import { resolveImageSrcs, setupBrokenImageHandlers } from './images.js';
import { syncMeasurer, fitText } from './fittext.js';
import { applySchemeColors, restoreTabTheme, THEME_VARS } from './themes.js';
import { buildGrid, isGridOpen } from './grid.js';
import { loadSidecar } from './sidecar.js';
import { addTab, switchTab, renderTabs } from './tabs.js';
import { fetchMarkdown, smartReload } from './reload.js';
import { setupToolbar, updateChromeHeight, refreshUI } from './toolbar.js';
import { setupDiagnosticsPanel } from './diagnostics-panel.js';
import { updateDiagnosticsForCurrentSlide } from './render.js';
import { setupKeyboard } from './keyboard.js';
import { renderQRCodes } from './qr.js';
import { renderMath } from './math.js';
import { renderDiagrams } from './diagrams.js';
import { renderDeck } from './render.js';
import { setupActivityRail, updateDiagnosticsBadge } from './sidebar.js';
import { rebuildThumbnails } from './tabs.js';
import { setupCommandPaletteShortcut } from './command-palette.js';
import { setupQuickOpenShortcut } from './quick-open.js';
import { registerBaseCommands } from './commands.js';

// ============================================================
// Initialize print mode
// ============================================================
if (IS_PRINT) document.documentElement.classList.add('print-mode');
if (IS_EMBED) document.documentElement.classList.add('embed-mode');
if (IS_DESKTOP) document.body.classList.add('desktop-app');
// Initialize the activity rail on every boot path. setupActivityRail no-ops
// in browser mode; doing it before main() means the rail is visible behind
// the welcome screen so the layout doesn't shift after a deck is opened.
setupActivityRail();
registerBaseCommands();
setupCommandPaletteShortcut();
setupQuickOpenShortcut();

// Chrome buttons in the titlebar zone (Play / Presenter).
if (IS_DESKTOP) {
  document.getElementById('btn-chrome-play')?.addEventListener('click', async () => {
    const { enterFullscreen, exitFullscreen } = await import('./fullscreen.js');
    if (state.isFullscreen) exitFullscreen(); else enterFullscreen();
  });
  document.getElementById('btn-chrome-presenter')?.addEventListener('click', () => {
    if (window._openPresenter) window._openPresenter();
  });
  document.getElementById('btn-chrome-grid')?.addEventListener('click', async () => {
    const { toggleGrid } = await import('./grid.js');
    toggleGrid();
  });
}
if (IS_ELECTRON) {
  document.body.classList.add('electron-app');
  // hiddenInset on macOS overlays the traffic lights into the app — pad for
  // them. Win/Linux: titleBarOverlay draws controls into a 36px strip.
  document.body.classList.add('desktop-overlay');
}

// ============================================================
// Initialize off-screen measurer
// ============================================================
const _measurer = document.createElement('div');
_measurer.className = 'sd-slide';
_measurer.style.cssText = `
  position: fixed; top: -9999px; left: -9999px;
  visibility: hidden; white-space: nowrap;
  line-height: 1.1;
`;
document.body.appendChild(_measurer);
state.measurer = _measurer;

// ============================================================
// Expose globals on window (E2E tests + Rust watcher use them)
// ============================================================
Object.defineProperty(window, '_tabs', { get: () => state.tabs });
Object.defineProperty(window, '_activeTabIndex', {
  get: () => state.activeTabIndex,
  set: v => { state.activeTabIndex = v; },
});
window.switchTab = switchTab;
window.applySchemeColors = applySchemeColors;
window.smartReload = smartReload;

// ============================================================
// Boot
// ============================================================
async function loadFile(file) {
  state.currentFile = file;
  state.fileDir = file.substring(0, file.lastIndexOf('/'));
  state.currentMd = await fetchMarkdown(file);
  addTab(file, state.currentMd);
  // Load sidecar for initial tab (switchTab won't run for first tab)
  const tab = state.tabs[state.activeTabIndex];
  const sidecar = await loadSidecar(file);
  if (sidecar) {
    tab.themeOverride = sidecar.theme || null;
    tab.schemeOverride = sidecar.scheme || null;
    tab.autoflow = sidecar.autoflow || false;
    if (sidecar.lastSlide != null) tab.slideIndex = sidecar.lastSlide;
    tab._sidecarLoaded = true;
  }
  restoreTabTheme(tab);
  document.getElementById('slides').innerHTML = parseDecksetMarkdown(state.currentMd, { autoflow: tab.autoflow });
  resolveImageSrcs();
  refreshUI();
  if (IS_DESKTOP) desktopInvoke('add_recent_file', { filePath: file }).catch(() => {});
}

// Expose loadFile for keyboard handler (Cmd+O) and native menu (Open Recent)
window._loadFile = loadFile;
window._addTab = addTab;

// Electron native menus dispatch through window.stellardeck.onMenuAction.
// IDs match the Tauri menu IDs so the same JS handlers fire either way.
if (IS_ELECTRON && window.stellardeck?.onMenuAction) {
  window.stellardeck.onMenuAction(async (id) => {
    if (id === 'open') {
      const dir = state.currentFile ? state.currentFile.substring(0, state.currentFile.lastIndexOf('/')) : null;
      try {
        const f = await desktopInvoke('open_file_dialog', { currentDir: dir });
        if (f) await window._loadFileFromMenu(f);
      } catch (err) { console.error('menu:open', err); }
    } else if (id === 'close-tab') {
      if (window.closeCurrentTab) window.closeCurrentTab();
    } else if (id === 'export-pdf') {
      const { runPdfExport } = await import('./toolbar.js');
      await runPdfExport();
    } else if (id === 'grid') {
      const { toggleGrid } = await import('./grid.js');
      toggleGrid();
    } else if (id === 'presenter') {
      if (window._openPresenter) window._openPresenter();
    } else if (id === 'fullscreen') {
      const { enterFullscreen, exitFullscreen } = await import('./fullscreen.js');
      if (state.isFullscreen) exitFullscreen(); else enterFullscreen();
    } else if (id.startsWith('recent:')) {
      const path = id.slice('recent:'.length);
      if (window._loadFileFromMenu) await window._loadFileFromMenu(path);
    }
  });
}
window._loadFileFromMenu = async (path) => {
  const wasEmpty = document.body.classList.contains('no-deck');
  document.body.classList.remove('no-deck');

  try {
    await loadFile(path);
    await renderDeck();
  } catch (err) {
    const msg = err?.message || String(err);
    const shortPath = path.split('/').pop();
    showToast(`Could not open ${shortPath}: ${msg}`, 6000);
    console.error('_loadFileFromMenu failed:', err);
    // If we came from the empty state, stay there (don't strand the user
    // on a blank deck after a failed load).
    if (wasEmpty || state.tabs.length === 0) {
      document.body.classList.add('no-deck');
      const { renderTabs } = await import('./tabs.js');
      renderTabs();
    }
  }
};

// Wire window-wide drag-drop so a .md file dropped anywhere in the app
// opens it. Replaces the per-welcome-screen drop zone — the user no
// longer needs to aim at a specific target.
function setupGlobalDropTarget() {
  ['dragenter', 'dragover'].forEach(evt => {
    document.body.addEventListener(evt, (e) => {
      // Only react when files are being dragged (not text selection, etc.).
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        document.body.classList.add('dropping');
      }
    });
  });
  document.body.addEventListener('dragleave', (e) => {
    if (e.relatedTarget == null) document.body.classList.remove('dropping');
  });
  document.body.addEventListener('drop', async (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    document.body.classList.remove('dropping');
    for (const f of e.dataTransfer.files) {
      if (!/\.(md|markdown|txt)$/i.test(f.name)) continue;
      if (IS_DESKTOP && f.path) {
        if (window._loadFileFromMenu) await window._loadFileFromMenu(f.path);
      } else {
        readBrowserFile(f);
      }
    }
  });
}

function readBrowserFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    document.body.classList.remove('no-deck');
    state.currentMd = String(reader.result);
    state.currentFile = file.name;
    state.fileDir = '';
    addTab(file.name, state.currentMd);
    document.getElementById('slides').innerHTML = parseDecksetMarkdown(state.currentMd, {});
    if (window.Reveal?.sync) window.Reveal.sync();
  };
  reader.onerror = () => showToast(`Could not read ${file.name}`, 4000);
  reader.readAsText(file);
}
window._setupGlobalDropTarget = setupGlobalDropTarget;

// Fail-loud helper: shows the error screen and returns. Used for any
// unrecoverable boot error so the user never sees a blank screen.
function showBootError(context, err) {
  const msg = err?.message || String(err);
  console.error(`[StellarDeck] ${context} failed:`, msg);
  const errorDiv = document.getElementById('error');
  if (errorDiv) {
    errorDiv.innerHTML = `
      <h1>Could not start</h1>
      <p><strong>${context}:</strong> <code>${msg}</code></p>
      <p style="color:#94a3b8;margin-top:1rem">Try launching StellarDeck with <code>npm run electron</code> from the project directory.</p>
    `;
    errorDiv.style.display = 'block';
  }
  const reveal = document.querySelector('.reveal');
  if (reveal) reveal.style.display = 'none';
  document.body.classList.remove('no-deck');
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  let file = params.get('file');

  // Desktop mode: resolve relative path to absolute, or show file dialog
  if (IS_DESKTOP) {
    if (file && !file.startsWith('/')) {
      try {
        const cwd = await desktopInvoke('get_project_root');
        file = cwd + '/' + file;
      } catch (err) {
        // Happens when the binary is launched without project context.
        // Fall back to the empty Decks panel instead of hanging.
        console.warn('[StellarDeck] get_project_root failed, falling back to empty state:', err);
        file = null;
      }
    }
    // Note: we no longer auto-open a file picker on launch — if there's no
    // file in the URL and no session, fall through to the empty Decks panel.
    // Users can open files via Cmd+O or the sidebar's Open button.
  }

  // Restore previous session if available (desktop mode).
  // Explicit URL params (file/also) win over session — that way launching
  // the app with `electron . a.md b.md` always opens those decks, even if
  // a previous session had different tabs saved.
  if (IS_DESKTOP && !params.has('file')) {
    try {
      const saved = JSON.parse(localStorage.getItem('stellardeck-session') || 'null');
      if (saved?.tabs?.length) {
        file = saved.tabs[0].file;
        state._pendingSession = saved;
      }
    } catch {}
  }

  if (!file) {
    // Empty state: no deck open. Sidebar's Decks panel will render the
    // recents + drop hint + Open button (see js/tabs.js::renderTabs +
    // renderEmptyDecksPanel). The slide area shows a minimal placeholder.
    // Activity rail + sidebar stay visible so the chrome is identical
    // whether or not a deck is open.
    document.body.classList.add('no-deck');
    const { renderTabs } = await import('./tabs.js');
    renderTabs();
    setupGlobalDropTarget();
    if (!IS_DESKTOP) {
      // Browser mode: hidden file input the empty-decks "Open deck…"
      // button can trigger. Same single code path as desktop.
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.markdown,.txt';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const f = input.files?.[0];
        if (f) readBrowserFile(f);
      });
      window._showBrowserPicker = () => input.click();
    }
    return;
  }

  try {
    // Ensure .reveal is visible (may have been hidden by previous welcome screen or error)
    document.querySelector('.reveal').style.display = '';
    await loadFile(file);

    Reveal.initialize({
      hash: !IS_EMBED,
      width: getSlideWidth(),
      height: getSlideHeight(),
      margin: 0.06,
      transition: 'none',
      backgroundTransition: 'none',
      slideNumber: IS_EMBED ? false : 'c/t',
      progress: !IS_EMBED,
      overview: false,
      touch: true,
      keyboard: IS_EMBED,  // in embed: Reveal handles keys (no custom handler needed)
      controls: IS_EMBED,  // show arrow controls in embed
      help: !IS_EMBED,
      center: true,
      preloadIframes: true,
      postMessage: true,
      postMessageEvents: IS_EMBED,  // broadcast events to parent in embed mode
    });

    applyDimensionVars();
    syncMeasurer();
    setupBrokenImageHandlers();
    if (!IS_EMBED) {
      setupToolbar();
      updateChromeHeight();
      setupDiagnosticsPanel(() => {
        const tab = state.tabs[state.activeTabIndex];
        return tab?.diagnostics || [];
      });
    }

    // Highlight code blocks — lazy-load hljs from CDN on first use
    let _hljsLoading = null;
    const highlightCode = async () => {
      const blocks = document.querySelectorAll('pre code:not(.hljs)');
      if (blocks.length === 0) return;
      if (typeof hljs === 'undefined') {
        if (!_hljsLoading) {
          _hljsLoading = new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/monokai.min.css';
            document.head.appendChild(link);
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        try { await _hljsLoading; } catch { return; }
      }
      blocks.forEach(b => hljs.highlightElement(b));
    };

    // Render QR codes, math, diagrams, and code highlighting
    // Runs once at boot (ready) and after smartReload replaces HTML.
    // NOT on slidechanged — extras are pre-rendered on all slides at boot,
    // re-running on every navigation causes visible flicker (async DOM writes).
    const renderExtras = () => {
      highlightCode();
      renderQRCodes();
      renderMath();
      renderDiagrams();
    };
    window._renderExtras = renderExtras;
    Reveal.on('ready', renderExtras);

    // Sidebar thumbnail strip: rebuild on ready + after smart-reload changes
    // the slide DOM, and on slidechanged just toggle the .active class so we
    // don't re-snapshot every navigation (cheap path matters for big decks).
    // Note: imported statically at top — a dynamic import would yield to the
    // event loop and miss Reveal's setTimeout(0)-scheduled 'ready' event.
    Reveal.on('ready', rebuildThumbnails);
    const updateChromeCounter = () => {
      const idx = Reveal.getState().indexh || 0;
      const total = Reveal.getTotalSlides();
      const tbCounter = document.getElementById('titlebar-counter');
      if (tbCounter) tbCounter.textContent = `${idx + 1} / ${total}`;
    };
    Reveal.on('ready', updateChromeCounter);
    Reveal.on('slidechanged', () => {
      const idx = Reveal.getState().indexh || 0;
      document.querySelectorAll('#sb-thumbs .sb-thumb').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
      });
      // Update slide counter in section header
      const meta = document.querySelector('.sb-section-header .sb-section-meta');
      if (meta) meta.textContent = `${idx + 1} / ${Reveal.getTotalSlides()}`;
      updateChromeCounter();
      // Scroll active thumb into view
      const active = document.querySelector('#sb-thumbs .sb-thumb.active');
      if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    window._rebuildThumbnails = rebuildThumbnails;

    // fitText: wait for fonts, then fit all slides + run diagnostics AFTER
    // fit settles. Previously diagnostics raced fit and sometimes flagged
    // overflow on `<code>`/`<h1>` elements that fitText was about to shrink
    // into the frame on the next rAF — false positive.
    const runFit = () => requestAnimationFrame(() => {
      fitText();
      // One more frame so the layout reflects the fit before measuring.
      if (!IS_EMBED) requestAnimationFrame(() => updateDiagnosticsForCurrentSlide());
    });
    window.fitText = fitText;
    Reveal.on('ready', () => document.fonts.ready.then(runFit));
    Reveal.on('resize', runFit);
    Reveal.on('slidechanged', runFit);

    // Keyboard handling
    if (!IS_EMBED) setupKeyboard();

    // ============================================================
    // Presenter mode — BroadcastChannel sync
    // ============================================================
    const presenterChannel = new BroadcastChannel('stellardeck-presenter');

    function sendSlideUpdate() {
      const sections = document.querySelectorAll('.reveal .slides > section');
      const idx = Reveal.getState().indexh || 0;
      const current = sections[idx];
      const next = sections[idx + 1] || null;
      const notesEl = current?.querySelector('aside.notes');
      // Snapshot CSS vars for presenter window
      const cs = getComputedStyle(document.documentElement);
      const cssVars = {};
      THEME_VARS.forEach(prop => { cssVars[prop] = cs.getPropertyValue(prop).trim(); });

      // Extract per-slide CSS vars (e.g. --r-heading-color from [.header] directive)
      const getSlideVars = (section) => {
        if (!section) return null;
        const style = section.getAttribute('style');
        if (!style) return null;
        const vars = {};
        style.split(';').forEach(rule => {
          const [prop, val] = rule.split(':').map(s => s.trim());
          if (prop?.startsWith('--')) vars[prop] = val;
        });
        return Object.keys(vars).length ? vars : null;
      };

      presenterChannel.postMessage({
        type: 'slide-update',
        indexh: idx,
        total: Reveal.getTotalSlides(),
        currentHTML: current?.innerHTML || '',
        nextHTML: next?.innerHTML || null,
        currentSlideVars: getSlideVars(current),
        nextSlideVars: getSlideVars(next),
        notes: notesEl?.innerHTML || '',
        currentBg: current?.getAttribute('data-background-color') || null,
        nextBg: next?.getAttribute('data-background-color') || null,
        currentBgImage: current?.getAttribute('data-background-image') || null,
        nextBgImage: next?.getAttribute('data-background-image') || null,
        cssVars,
        slideWidth: Reveal.getConfig().width,
        slideHeight: Reveal.getConfig().height,
      });
    }
    window._sendSlideUpdate = sendSlideUpdate;

    Reveal.on('ready', sendSlideUpdate);
    Reveal.on('slidechanged', sendSlideUpdate);
    Reveal.on('fragmentshown', sendSlideUpdate);
    Reveal.on('fragmenthidden', sendSlideUpdate);

    // Listen for commands from presenter window
    presenterChannel.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'navigate-relative') {
        if (d.direction === 'next') Reveal.next(); else Reveal.prev();
      } else if (d.type === 'navigate') {
        Reveal.slide(Math.min(d.indexh, Reveal.getTotalSlides() - 1));
      } else if (d.type === 'request-state') {
        sendSlideUpdate();
      }
    };

    // Open presenter window
    function openPresenter() {
      if (IS_DESKTOP) {
        desktopInvoke('open_presenter_window').catch(e => {
          showToast('Presenter: ' + (e?.message || String(e)), 4000);
        });
      } else {
        // Browser mode: window.open is the only option (no IPC).
        window.open('presenter.html', 'stellardeck-presenter', 'width=1100,height=700');
      }
      // Send state after a short delay for the window to load + connect to
      // the BroadcastChannel.
      setTimeout(sendSlideUpdate, 700);
    }
    window._openPresenter = openPresenter;

    // ============================================================
    // Session save/restore
    // ============================================================
    window._saveSession = saveSession;
    function saveSession() {
      try {
        const session = {
          tabs: state.tabs.map(t => ({ file: t.file, slideIndex: t.slideIndex })),
          activeTabIndex: state.activeTabIndex,
          currentSlide: Reveal.getState().indexh || 0,
        };
        // Update active tab's slide index
        if (session.tabs[session.activeTabIndex]) {
          session.tabs[session.activeTabIndex].slideIndex = session.currentSlide;
        }
        localStorage.setItem('stellardeck-session', JSON.stringify(session));
      } catch {}
    }
    // Save session on navigation and before unload
    Reveal.on('slidechanged', saveSession);
    window.addEventListener('beforeunload', saveSession);

    // Open extra tabs from &also= params (skip if session restore will handle it)
    if (!state._pendingSession) {
      const alsoFiles = params.getAll('also');
      for (const extra of alsoFiles) {
        try {
          let extraPath = extra;
          if (IS_DESKTOP && !extraPath.startsWith('/')) {
            const root = await desktopInvoke('get_project_root');
            extraPath = root + '/' + extra;
          }
          const extraMd = await fetchMarkdown(extraPath);
          addTab(extraPath, extraMd);
        } catch (e) { /* skip files that fail to load */ }
      }
      if (alsoFiles.length) switchTab(0);
    }

    // Restore extra tabs from saved session (Tauri only)
    if (state._pendingSession) {
      state._restoring = true; // suppress smartReload during restore
      const session = state._pendingSession;
      delete state._pendingSession;
      // Open remaining tabs (first tab already loaded as the main file)
      // Use _restoring flag to prevent addTab from changing activeTabIndex
      for (let i = 1; i < session.tabs.length; i++) {
        try {
          const md = await fetchMarkdown(session.tabs[i].file);
          addTab(session.tabs[i].file, md);
          // Restore slide position (addTab may have been skipped if duplicate)
          const tab = state.tabs.find(t => t.file === session.tabs[i].file);
          if (tab) tab.slideIndex = session.tabs[i].slideIndex || 0;
        } catch { /* skip missing files */ }
      }
      // Restore active tab — force re-render even if index matches
      const activeIdx = Math.min(session.activeTabIndex || 0, state.tabs.length - 1);
      // Temporarily set activeTabIndex to -1 so switchTab doesn't early-return
      state.activeTabIndex = -1;
      await switchTab(activeIdx);
      const slideIdx = session.tabs[activeIdx]?.slideIndex || 0;
      if (slideIdx > 0) Reveal.slide(slideIdx);
      await new Promise(r => requestAnimationFrame(r));
      refreshUI();
      state._restoring = false;
    }

    // Auto-reload: native file watcher in Tauri/Electron, polling in browser
    // Started AFTER session restore to avoid race conditions
    if (IS_DESKTOP) {
      // Tauri Rust watcher calls smartReload() via webview.eval on file change.
      // Electron preload subscribes to 'file-changed' and we trigger smartReload
      // here once.
      if (IS_ELECTRON && window.stellardeck?.onFileChanged) {
        window.stellardeck.onFileChanged(() => smartReload());
      }
      desktopInvoke('watch_file', { path: state.currentFile }).catch(() => {
        // Fallback to polling if watcher fails
        setInterval(smartReload, 1000);
      });
    } else {
      setInterval(smartReload, 1000);
    }

  } catch (err) {
    const msg = err?.message || String(err);
    console.error('[StellarDeck] Boot failed:', msg);
    document.getElementById('error').style.display = 'block';
    document.getElementById('error').innerHTML += `<p style="color:#94a3b8">Error: <code>${msg}</code></p>`;
    document.querySelector('.reveal').style.display = 'none';
  }
}

// Top-level safety net: any boot error that escapes main() should show an
// error screen, not leave the user with a blank window.
main().catch(err => showBootError('Boot', err));

// Global unhandled rejection handler — same safety net for stray promises.
window.addEventListener('unhandledrejection', (e) => {
  console.error('[StellarDeck] unhandled rejection:', e.reason);
  // Only show the error screen if nothing has rendered yet
  if (!state.tabs.length && !document.querySelector('.reveal .slides section')) {
    showBootError('Unhandled error', e.reason);
  }
});
