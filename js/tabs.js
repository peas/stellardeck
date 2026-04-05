import { state } from './state.js';
import { IS_TAURI, tauriInvoke } from './tauri.js';
import { restoreTabTheme, saveTabThemeOverride } from './themes.js';
import { loadSidecar } from './sidecar.js';
import { updateChromeHeight } from './fullscreen.js';
import { renderDeck } from './render.js';

// ============================================================
// Tab management
// ============================================================

export function createTab(file, md) {
  return {
    file,
    md,
    slideIndex: 0,
    fileDir: file.substring(0, file.lastIndexOf('/')),
    themeOverride: null,  // user-selected theme via toolbar (null = use frontmatter)
    schemeOverride: null, // user-selected color scheme via toolbar
    autoflow: undefined,  // undefined = let frontmatter decide; true/false = explicit override
    diagnostics: [],      // structured warnings, cumulative as user navigates
    _sidecarLoaded: false, // lazy-load sidecar on first activation
  };
}

export function tabName(file) {
  const parts = file.split('/');
  const name = parts.pop(); // keep .md extension
  const dir = parts.pop() || '';
  return dir ? `${dir}/${name}` : name;
}

export function tabSlideCount(md) {
  return (md.match(/\n---[ \t]*\n/g) || []).length + 1;
}

export function tabFirstHeading(md) {
  const match = md.match(/^#+\s*(?:\[fit\]\s*)?(.+)$/m);
  return match ? match[1].replace(/[*_#\[\]]/g, '').trim().substring(0, 40) : '';
}

export function renderTabs() {
  const bar = document.getElementById('tab-bar');
  bar.innerHTML = '';
  bar.classList.toggle('visible', IS_TAURI || state.tabs.length > 1);

  state.tabs.forEach((tab, i) => {
    const el = document.createElement('div');
    el.className = 'tab' + (i === state.activeTabIndex ? ' active' : '');
    const name = tab.file.split('/').pop();
    const slides = tabSlideCount(tab.md);
    const parts = tab.file.split('/');
    parts.pop(); // remove filename
    const dir = parts.pop() || '';
    const dirLabel = dir ? dir + '/' : '';
    el.innerHTML = `<div class="tab-info">
        <div class="tab-name">${name}</div>
        ${dirLabel ? `<div class="tab-meta">${dirLabel}</div>` : ''}
        <div class="tab-meta">${slides} slides</div>
      </div>` +
      (state.tabs.length > 1 ? `<span class="close-btn" data-index="${i}">&times;</span>` : '');
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('close-btn')) {
        closeTab(parseInt(e.target.dataset.index));
      } else {
        switchTab(i);
      }
    });
    el.addEventListener('dblclick', (e) => {
      if (e.target.classList.contains('close-btn')) return;
      // Import dynamically to avoid circular deps
      import('./toolbar.js').then(m => m.openInExternalEditor());
    });
    bar.appendChild(el);
  });
  updateChromeHeight();
}

export function addTab(file, md) {
  // Check if already open — update markdown if content changed (e.g. file was edited externally)
  const existing = state.tabs.findIndex(t => t.file === file);
  if (existing >= 0) {
    if (md && md !== state.tabs[existing].md) {
      state.tabs[existing].md = md;
    }
    if (!state._restoring) switchTab(existing);
    return;
  }
  state.tabs.push(createTab(file, md));
  // During session restore, don't switch to the new tab — the restore
  // loop will explicitly switchTab to the correct active tab at the end.
  if (!state._restoring) {
    state.activeTabIndex = state.tabs.length - 1;
  }
  renderTabs();
  // Save session immediately so new tabs survive reload
  if (window._saveSession) window._saveSession();
}

export async function switchTab(index) {
  if (index === state.activeTabIndex || index < 0 || index >= state.tabs.length) return;
  // Save current slide position + theme/scheme override
  if (state.activeTabIndex >= 0 && state.activeTabIndex < state.tabs.length) {
    state.tabs[state.activeTabIndex].slideIndex = Reveal.getState().indexh || 0;
    saveTabThemeOverride(state.activeTabIndex);
  }
  state.activeTabIndex = index;
  const tab = state.tabs[index];
  state.currentFile = tab.file;
  state.currentMd = tab.md;
  state.fileDir = tab.fileDir;
  // Load sidecar theme override on first activation
  if (!tab._sidecarLoaded) {
    tab._sidecarLoaded = true;
    const sidecar = await loadSidecar(tab.file);
    if (sidecar) {
      tab.themeOverride = sidecar.theme || null;
      tab.schemeOverride = sidecar.scheme || null;
      tab.autoflow = sidecar.autoflow || false;
      if (sidecar.lastSlide != null) tab.slideIndex = sidecar.lastSlide;
    }
  }
  restoreTabTheme(tab);
  await renderDeck({ slideIndex: tab.slideIndex });
  renderTabs();
  if (IS_TAURI) tauriInvoke('watch_file', { path: tab.file }).catch(() => {});
}

export async function closeTab(index) {
  if (state.tabs.length <= 1) return; // don't close last tab
  state.tabs.splice(index, 1);
  if (state.activeTabIndex >= state.tabs.length) state.activeTabIndex = state.tabs.length - 1;
  else if (index < state.activeTabIndex) state.activeTabIndex--;
  // Reload the now-active tab
  const tab = state.tabs[state.activeTabIndex];
  state.currentFile = tab.file;
  state.currentMd = tab.md;
  state.fileDir = tab.fileDir;
  restoreTabTheme(tab);
  await renderDeck({ slideIndex: tab.slideIndex });
  renderTabs();
  if (IS_TAURI) tauriInvoke('watch_file', { path: tab.file }).catch(() => {});
}
