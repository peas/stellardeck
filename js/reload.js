import { state } from './state.js';
import { IS_TAURI, tauriInvoke } from './tauri.js';
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
  if (IS_TAURI) {
    // Tauri mode: read file via Rust command (absolute path)
    return await tauriInvoke('read_markdown', { path: file });
  }
  // Browser mode: fetch via HTTP server
  const resp = await fetch(file + '?t=' + Date.now());
  if (!resp.ok) throw new Error(`${resp.status}`);
  let md = await resp.text();
  md = md.replace(/(?:\.\.\/)+assets\//g, 'assets/');
  md = md.replace(/\.\/assets\//g, 'assets/');
  return md;
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

    // Smart diff: only update changed slides
    let changedCount = 0;
    const sections = document.querySelectorAll('.reveal .slides > section');
    for (let i = 0; i < newSlides.length; i++) {
      if (newSlides[i] !== oldSlides[i]) {
        // Re-parse just this slide
        const tab = state.tabs[state.activeTabIndex];
        const tempHtml = parseDecksetMarkdown(newSlides[i], { autoflow: tab?.autoflow || false, slideIndexOffset: i });
        const temp = document.createElement('div');
        temp.innerHTML = tempHtml;
        const newSection = temp.querySelector('section');
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
