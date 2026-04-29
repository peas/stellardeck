// ============================================================
// Welcome screen — drag & drop, file picker, recent files
// ============================================================
// Browser mode: reads .md files via FileReader (no server needed).
// Tauri mode: uses the existing native file dialog; this module
// only adds drag-and-drop and localStorage recent files.

import { state } from './state.js';
import { IS_TAURI } from './tauri.js';
import { getSlideWidth, getSlideHeight, applyDimensionVars } from './dimensions.js';
import { resolveImageSrcs, setupBrokenImageHandlers } from './images.js';
import { syncMeasurer, fitText } from './fittext.js';
import { setupToolbar, updateChromeHeight, refreshUI } from './toolbar.js';
import { setupDiagnosticsPanel } from './diagnostics-panel.js';
import { setupKeyboard } from './keyboard.js';
import { renderQRCodes } from './qr.js';
import { renderMath } from './math.js';
import { renderDiagrams } from './diagrams.js';
import { updateDiagnosticsForCurrentSlide } from './render.js';
import { showToast } from './toast.js';

const RECENT_KEY = 'stellardeck-recent-files';
const MAX_RECENT = 5;

let revealInitialized = false;

// ---- Recent files (localStorage, browser-only) ----

function getRecentFiles() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

function addRecentFile(name) {
  const recent = getRecentFiles().filter(r => r.name !== name);
  recent.unshift({ name, timestamp: Date.now() });
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch {}
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'yesterday';
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

// ---- Render a deck from raw markdown text (browser cold-boot) ----

async function renderFromText(md, fileName) {
  const welcome = document.getElementById('welcome-screen');
  const reveal = document.querySelector('.reveal');

  welcome.classList.remove('visible');
  reveal.style.display = '';

  // Set state as if a file was loaded
  state.currentFile = fileName || 'untitled.md';
  state.fileDir = '';
  state.currentMd = md;

  // Add tab via the exposed addTab from main.js
  if (window._addTab) {
    window._addTab(state.currentFile, md);
  } else {
    state.tabs.push({ file: state.currentFile, md, slideIndex: 0, autoflow: true });
    state.activeTabIndex = 0;
  }

  const tab = state.tabs[state.activeTabIndex];
  const autoflow = tab?.autoflow !== undefined ? tab.autoflow : true;

  document.getElementById('slides').innerHTML =
    parseDecksetMarkdown(md, { autoflow });

  resolveImageSrcs();

  if (!revealInitialized) {
    // First file: full Reveal.js init + all post-init setup
    Reveal.initialize({
      hash: false,
      width: getSlideWidth(),
      height: getSlideHeight(),
      margin: 0.06,
      transition: 'none',
      backgroundTransition: 'none',
      slideNumber: 'c/t',
      progress: true,
      overview: false,
      touch: true,
      keyboard: false, // StellarDeck manages its own keyboard
      controls: false,
      help: true,
      center: true,
      preloadIframes: true,
    });
    revealInitialized = true;

    applyDimensionVars();
    syncMeasurer();
    setupBrokenImageHandlers();
    setupToolbar();
    updateChromeHeight();
    setupDiagnosticsPanel(() => {
      const t = state.tabs[state.activeTabIndex];
      return t?.diagnostics || [];
    });

    // Code highlighting (lazy-loaded from CDN)
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

    const renderExtras = () => {
      highlightCode();
      renderQRCodes();
      renderMath();
      renderDiagrams();
    };
    window._renderExtras = renderExtras;
    Reveal.on('ready', renderExtras);

    const runFit = () => requestAnimationFrame(() => fitText());
    window.fitText = fitText;
    Reveal.on('ready', () => document.fonts.ready.then(runFit));
    Reveal.on('resize', runFit);
    Reveal.on('slidechanged', runFit);
    Reveal.on('slidechanged', () => {
      requestAnimationFrame(() => updateDiagnosticsForCurrentSlide());
    });

    setupKeyboard();
  } else {
    // Subsequent file: Reveal already initialized, just sync
    Reveal.sync();
    Reveal.slide(0);
    await new Promise(r => requestAnimationFrame(r));
    syncMeasurer();
    setupBrokenImageHandlers();
    if (window._renderExtras) window._renderExtras();
    requestAnimationFrame(() => fitText());
  }

  refreshUI();

  // Add to recent files (browser mode only)
  if (!IS_TAURI) {
    addRecentFile(fileName);
  }
}

// ---- Setup welcome screen interactions ----

export function setupWelcomeScreen() {
  const welcome = document.getElementById('welcome-screen');
  const dropzone = document.getElementById('welcome-dropzone');
  const openBtn = document.getElementById('welcome-open');
  const fileInput = document.getElementById('welcome-file-input');
  const recentList = document.getElementById('recent-list');

  if (!welcome || !dropzone) return;

  // File picker button
  openBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    readAndRender(file);
  });

  // Drag & drop on the dropzone
  const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      prevent(e);
      dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      prevent(e);
      dropzone.classList.remove('drag-over');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    readAndRender(file);
  });

  // Also accept drag & drop anywhere on the welcome screen
  ['dragenter', 'dragover'].forEach(evt => {
    welcome.addEventListener(evt, (e) => {
      prevent(e);
      dropzone.classList.add('drag-over');
    });
  });
  welcome.addEventListener('dragleave', (e) => {
    prevent(e);
    if (!welcome.contains(e.relatedTarget)) {
      dropzone.classList.remove('drag-over');
    }
  });
  welcome.addEventListener('drop', (e) => {
    prevent(e);
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    readAndRender(file);
  });

  // Render recent files (browser mode — Tauri has its own recent list via IPC)
  if (!IS_TAURI) {
    renderRecentFiles(recentList);
  }
}

function readAndRender(file) {
  const reader = new FileReader();
  reader.onload = () => {
    renderFromText(reader.result, file.name);
  };
  reader.onerror = () => {
    showToast(`Could not read ${file.name}`, 4000);
  };
  reader.readAsText(file);
}

function renderRecentFiles(container) {
  const recent = getRecentFiles();
  if (!recent.length) return;

  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'welcome-recent-header';
  header.textContent = 'Recent';
  container.appendChild(header);

  recent.forEach(r => {
    const el = document.createElement('div');
    el.className = 'recent-item';
    el.innerHTML = `
      <div>
        <div class="recent-name">${escapeHtml(r.name)}</div>
        <div class="recent-path">Drag or open this file again</div>
      </div>
      <div class="recent-time">${formatTime(r.timestamp)}</div>
    `;
    el.title = 'Drag or use the file picker to open this file again';
    container.appendChild(el);
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
