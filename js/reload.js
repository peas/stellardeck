import { state } from './state.js';
import { IS_DESKTOP, desktopInvoke } from './desktop.js';
import { applyTheme } from './themes.js';
import { resolveImageSrcs, setupBrokenImageHandlers } from './images.js';
import { syncMeasurer, fitText } from './fittext.js';
import { buildGrid, isGridOpen } from './grid.js';
import { showToast } from './toast.js';
import { refreshUI } from './toolbar.js';
import { renderDeck } from './render.js';

// ============================================================
// Auto-reload: watches for markdown changes and does smart diff
// ============================================================

export async function fetchMarkdown(file) {
  if (IS_DESKTOP) {
    // Desktop mode (Tauri/Electron): read file via IPC (absolute path)
    return await desktopInvoke('read_markdown', { path: file });
  }
  // Browser mode: fetch via HTTP server
  const resp = await fetch(file + '?t=' + Date.now());
  if (!resp.ok) throw new Error(`${resp.status}`);
  return await resp.text();
  // NOTE: do NOT mutate `../assets/` here. Image path resolution belongs
  // in js/images.js (resolveImageSrcs), which uses state.fileDir to resolve
  // each `<img src>` against the deck's directory. Mutating the raw markdown
  // here used to cause double-resolution: this stripped `../`, then
  // resolveImageSrcs prepended fileDir on top → wrong path.
}

export async function smartReload() {
  if (state._restoring) return; // suppress during session restore
  try {
    const newMd = await fetchMarkdown(state.currentFile);
    if (newMd === state.currentMd) return; // no change
    // Keep tab state in sync
    if (state.activeTabIndex >= 0 && state.tabs[state.activeTabIndex]) {
      state.tabs[state.activeTabIndex].md = newMd;
    }

    const oldSlides = state.currentMd.split(/\n---[ \t]*\n/);
    const newSlides = newMd.split(/\n---[ \t]*\n/);
    state.currentMd = newMd;

    // If slide count changed or theme changed, full rebuild
    const themeChanged = (newMd.match(/^theme:.+$/im) || [''])[0] !==
                         (state.currentMd.match(/^theme:.+$/im) || [''])[0];

    if (oldSlides.length !== newSlides.length || themeChanged) {
      applyTheme(newMd);
      const now = new Date();
      const ts = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      await renderDeck({ toast: `recarregado ${ts}` });
      return;
    }

    // Smart diff: only update changed slides.
    // Parse the FULL new deck — autoflow needs cross-slide context (anti-monotony,
    // bare-image-side rotation, statement counters). Parsing a single slide in
    // isolation drops that history and produces a different layout than a full
    // render, which previously surfaced as "autoflow disappears, fixed by hard
    // reload" (Paulo, 2026-05-06).
    // Pass `tab.autoflow` directly (not `|| false`) so `undefined` falls through
    // to the frontmatter setting — matching render.js behavior.
    const tab = state.tabs[state.activeTabIndex];
    const fullHtml = parseDecksetMarkdown(newMd, { autoflow: tab?.autoflow });
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = fullHtml;
    const newSections = tempContainer.querySelectorAll('section');

    let changedCount = 0;
    const sections = document.querySelectorAll('.reveal .slides > section');
    for (let i = 0; i < newSlides.length; i++) {
      if (newSlides[i] !== oldSlides[i]) {
        const newSection = newSections[i];
        if (newSection && sections[i]) {
          // Clear old data-background-* attributes (slide type may have changed)
          for (const attr of [...sections[i].attributes]) {
            if (attr.name.startsWith('data-background')) {
              sections[i].removeAttribute(attr.name);
            }
          }
          // Copy new attributes from re-parsed slide
          for (const attr of newSection.attributes) {
            sections[i].setAttribute(attr.name, attr.value);
          }
          sections[i].innerHTML = newSection.innerHTML;
          changedCount++;
        }
      }
    }

    if (changedCount > 0) {
      const currentIdx = Reveal.getState().indexh || 0;
      resolveImageSrcs();
      Reveal.sync();
      // Re-anchor to current slide after sync
      Reveal.slide(Math.min(currentIdx, Reveal.getTotalSlides() - 1));
      refreshUI();
      setupBrokenImageHandlers();
      if (window._renderExtras) window._renderExtras();
      if (window._sendSlideUpdate) window._sendSlideUpdate();
      requestAnimationFrame(() => fitText());
      state.gridBuilt = false;
      if (isGridOpen()) buildGrid();
      if (window._saveSession) window._saveSession();
      const now = new Date();
      showToast(`${changedCount} slide${changedCount > 1 ? 's' : ''} atualizado${changedCount > 1 ? 's' : ''} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`);
    }
  } catch (e) {
    // File might be mid-save, ignore
  }
}
