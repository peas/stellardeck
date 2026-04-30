import { state } from './state.js';
import { IS_DESKTOP, desktopInvoke } from './desktop.js';
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
  bar.classList.toggle('visible', IS_DESKTOP || state.tabs.length > 1);

  // Section: Open Decks ──────────────────────────────────────────────
  const decksHeader = document.createElement('div');
  decksHeader.className = 'sb-section-header';
  decksHeader.textContent = 'OPEN DECKS';
  bar.appendChild(decksHeader);

  state.tabs.forEach((tab, i) => {
    const el = document.createElement('div');
    el.className = 'tab' + (i === state.activeTabIndex ? ' active' : '');
    el.dataset.tabIndex = i;
    const name = tab.file.split('/').pop();
    const slides = tabSlideCount(tab.md);
    const parts = tab.file.split('/');
    parts.pop(); // remove filename
    const dir = parts.pop() || '';
    const dirLabel = dir ? dir + '/' : '';
    const warnCount = (tab.diagnostics || []).length;
    const warnBadge = warnCount > 0 ? `<span class="tab-warn-badge">⚠ ${warnCount}</span>` : '';
    el.innerHTML = `<div class="tab-info">
        <div class="tab-name">${name}</div>
        ${dirLabel ? `<div class="tab-meta">${dirLabel}</div>` : ''}
        <div class="tab-meta">${slides} slides ${warnBadge}</div>
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

  // Section: This Deck — slide thumbnails (always-on, Paulo confirmed) ─
  const activeTab = state.tabs[state.activeTabIndex];
  if (activeTab) {
    const total = tabSlideCount(activeTab.md);
    const idx = (typeof Reveal !== 'undefined' && typeof Reveal.getState === 'function')
      ? (Reveal.getState().indexh || 0) : 0;

    const thumbsHeader = document.createElement('div');
    thumbsHeader.className = 'sb-section-header';
    thumbsHeader.innerHTML = `THIS DECK <span class="sb-section-meta">${idx + 1} / ${total}</span>`;
    bar.appendChild(thumbsHeader);

    const thumbs = document.createElement('div');
    thumbs.className = 'sb-thumbs';
    thumbs.id = 'sb-thumbs';
    bar.appendChild(thumbs);

    // Defer the actual slide-element snapshotting to render.js cycle so we
    // don't fight a half-built #slides DOM. The renderer fires sb-thumbs:rebuild
    // events; we listen here.
    requestAnimationFrame(() => rebuildThumbnails());
  }

  updateChromeHeight();
}

export function rebuildThumbnails() {
  const thumbs = document.getElementById('sb-thumbs');
  if (!thumbs) return;
  thumbs.innerHTML = '';
  const sections = document.querySelectorAll('.reveal .slides > section');
  const idx = (typeof Reveal !== 'undefined' && typeof Reveal.getState === 'function')
    ? (Reveal.getState().indexh || 0) : 0;

  sections.forEach((section, i) => {
    const card = document.createElement('div');
    card.className = 'sb-thumb' + (i === idx ? ' active' : '');
    card.dataset.index = i;

    // Tiny 16:9 preview of the slide
    const inner = document.createElement('div');
    inner.className = 'sb-thumb-inner sd-slide';
    const bgImage = section.getAttribute('data-background-image');
    const bgColor = section.getAttribute('data-background-color');
    if (bgImage) {
      inner.style.backgroundImage = `url('${bgImage}')`;
      inner.style.backgroundSize = section.getAttribute('data-background-size') || 'cover';
      inner.style.backgroundPosition = 'center';
    }
    if (bgColor) inner.style.backgroundColor = bgColor;
    inner.innerHTML = section.innerHTML;
    inner.querySelectorAll('aside.notes').forEach(n => n.remove());
    card.appendChild(inner);

    const num = document.createElement('span');
    num.className = 'sb-thumb-num';
    num.textContent = i + 1;
    card.appendChild(num);

    card.addEventListener('click', () => {
      if (typeof Reveal !== 'undefined' && Reveal.slide) Reveal.slide(i);
    });

    thumbs.appendChild(card);

    requestAnimationFrame(() => {
      const slideW = (typeof Reveal !== 'undefined' && Reveal.getConfig)
        ? Reveal.getConfig().width : 1280;
      const scale = inner.parentElement.clientWidth / slideW;
      inner.style.transform = `scale(${scale})`;
    });
  });
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
  if (IS_DESKTOP) desktopInvoke('watch_file', { path: tab.file }).catch(() => {});
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
  if (IS_DESKTOP) desktopInvoke('watch_file', { path: tab.file }).catch(() => {});
}
