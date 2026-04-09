import { state, IS_PRINT, IS_EMBED, urlParams } from './state.js';
import { getSlideWidth, getSlideHeight, setDimensions, parseAspect, applyDimensionVars } from './dimensions.js';
import { IS_TAURI, tauriInvoke } from './tauri.js';
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

// ============================================================
// Initialize print mode
// ============================================================
if (IS_PRINT) document.documentElement.classList.add('print-mode');
if (IS_EMBED) document.documentElement.classList.add('embed-mode');
if (IS_TAURI) {
  document.body.classList.add('tauri-app');
  // Traffic light padding only on macOS (not Windows/Linux)
  if (navigator.platform.startsWith('Mac') || navigator.userAgent.includes('Macintosh')) {
    document.body.classList.add('tauri-overlay');
  }
}

// ============================================================
// Initialize off-screen measurer
// ============================================================
const _measurer = document.createElement('div');
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
  if (IS_TAURI) tauriInvoke('add_recent_file', { filePath: file }).catch(() => {});
}

// Expose loadFile for keyboard handler (Cmd+O) and native menu (Open Recent)
window._loadFile = loadFile;
window._loadFileFromMenu = async (path) => {
  const welcome = document.getElementById('welcome-screen');
  const wasWelcomeVisible = welcome?.classList.contains('visible');
  const reveal = document.querySelector('.reveal');
  const prevRevealDisplay = reveal.style.display;

  welcome?.classList.remove('visible');
  reveal.style.display = '';

  try {
    await loadFile(path);
    await renderDeck();
  } catch (err) {
    // Show the error as a toast + restore the previous visual state so the
    // user isn't left staring at a blank screen.
    const msg = err?.message || String(err);
    const shortPath = path.split('/').pop();
    showToast(`Could not open ${shortPath}: ${msg}`, 6000);
    console.error('_loadFileFromMenu failed:', err);
    // If the user had nothing open before, bring the welcome screen back.
    if (wasWelcomeVisible || state.tabs.length === 0) {
      welcome?.classList.add('visible');
      reveal.style.display = prevRevealDisplay || 'none';
    }
  }
};

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
      <p style="color:#94a3b8;margin-top:1rem">Try launching StellarDeck with <code>cargo tauri dev</code> (or <code>npm run tauri</code>) from the project directory.</p>
    `;
    errorDiv.style.display = 'block';
  }
  const reveal = document.querySelector('.reveal');
  if (reveal) reveal.style.display = 'none';
  const welcome = document.getElementById('welcome-screen');
  if (welcome) welcome.classList.remove('visible');
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  let file = params.get('file');

  // Tauri mode: resolve relative path to absolute, or show file dialog
  if (IS_TAURI) {
    if (file && !file.startsWith('/')) {
      try {
        const cwd = await tauriInvoke('get_project_root');
        file = cwd + '/' + file;
      } catch (err) {
        // Happens when the binary is launched directly (via `open`) instead
        // of `cargo tauri dev` — cwd is wrong and the walker can't find
        // viewer.html. Fall back to the welcome screen instead of hanging.
        console.warn('[StellarDeck] get_project_root failed, falling back to welcome screen:', err);
        file = null;
      }
    }
    // Note: we no longer auto-open a file picker on launch — if there's no
    // file in the URL and no session, fall through to the welcome screen.
    // Users can open files via Cmd+O or the welcome screen buttons.
  }

  // Restore previous session if available (Tauri mode)
  // Session takes priority over URL params (which are static in tauri.conf.json)
  if (IS_TAURI) {
    try {
      const saved = JSON.parse(localStorage.getItem('stellardeck-session') || 'null');
      if (saved?.tabs?.length) {
        file = saved.tabs[0].file;
        state._pendingSession = saved;
      }
    } catch {}
  }

  if (!file) {
    if (IS_TAURI) {
      // Show welcome screen with recent files
      const welcome = document.getElementById('welcome-screen');
      welcome.classList.add('visible');
      document.querySelector('.reveal').style.display = 'none';
      document.getElementById('welcome-open').addEventListener('click', async () => {
        const f = await tauriInvoke('open_file_dialog', { currentDir: null });
        if (f) { welcome.classList.remove('visible'); document.querySelector('.reveal').style.display = ''; await loadFile(f); location.reload(); }
      });
      try {
        const recent = await tauriInvoke('get_recent_files');
        if (recent.length) {
          const list = document.getElementById('recent-list');
          list.innerHTML = '<div style="color:#475569;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;padding:0 14px">Recent</div>';
          recent.forEach(f => {
            const name = f.split('/').pop();
            const dir = f.substring(0, f.lastIndexOf('/'));
            const el = document.createElement('div');
            el.className = 'recent-item';
            el.innerHTML = `<div><div class="recent-name">${name}</div><div class="recent-path">${dir}</div></div>`;
            el.addEventListener('click', async () => { welcome.classList.remove('visible'); document.querySelector('.reveal').style.display = ''; await loadFile(f); location.reload(); });
            list.appendChild(el);
          });
        }
      } catch {}
    } else {
      document.getElementById('error').style.display = 'block';
      document.querySelector('.reveal').style.display = 'none';
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

    // fitText: wait for fonts, then fit all slides
    const runFit = () => requestAnimationFrame(() => fitText());
    window.fitText = fitText; // expose for iframe embed editing
    Reveal.on('ready', () => document.fonts.ready.then(runFit));

    // Diagnostics: check each slide as user navigates (progressive discovery)
    if (!IS_EMBED) {
      Reveal.on('slidechanged', () => {
        // Wait a tick for layout to settle after navigation
        requestAnimationFrame(() => updateDiagnosticsForCurrentSlide());
      });
    }
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
      if (IS_TAURI) {
        tauriInvoke('open_presenter_window').catch(e => {
          showToast('Presenter: ' + (e?.message || String(e)), 4000);
        });
      } else {
        window.open('presenter.html', 'stellardeck-presenter', 'width=1100,height=700');
      }
      // Send state after a short delay for the window to load
      setTimeout(sendSlideUpdate, 500);
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
          if (IS_TAURI && !extraPath.startsWith('/')) {
            const root = await tauriInvoke('get_project_root');
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

    // Auto-reload: native file watcher in Tauri, polling in browser
    // Started AFTER session restore to avoid race conditions
    if (IS_TAURI) {
      // Rust watcher calls smartReload() via webview.eval on file change
      tauriInvoke('watch_file', { path: state.currentFile }).catch(() => {
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
