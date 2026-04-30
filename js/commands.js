// ============================================================
// Command registry — registers every action that goes in Cmd+K.
//
// Lives in one module instead of being scattered so Cmd+K opens with
// the same set of commands every time. Modules that own state (toolbar,
// theme, sidebar) can re-register their commands later if labels change.
// ============================================================

import { state, IS_PRINT, IS_EMBED } from './state.js';
import { IS_DESKTOP, IS_ELECTRON, desktopInvoke } from './desktop.js';
import { registerCommand } from './command-palette.js';
import { showToast } from './toast.js';
import { THEMES } from './themes.js';
import { setActiveMode } from './sidebar.js';
import { closeTab } from './tabs.js';

export function registerBaseCommands() {
  // ── File ───────────────────────────────────────────────────────
  registerCommand({
    id: 'file.open',
    group: 'File',
    label: 'Open File…',
    shortcut: 'Cmd+O',
    when: () => IS_DESKTOP,
    run: async () => {
      const dir = state.currentFile ? state.currentFile.substring(0, state.currentFile.lastIndexOf('/')) : null;
      try {
        const f = await desktopInvoke('open_file_dialog', { currentDir: dir });
        if (f && window._loadFileFromMenu) await window._loadFileFromMenu(f);
      } catch (e) {
        showToast('Open failed: ' + (e?.message || e), 4000);
      }
    },
  });

  registerCommand({
    id: 'file.close-tab',
    group: 'File',
    label: 'Close Tab',
    shortcut: 'Cmd+W',
    when: () => state.tabs.length > 1,
    run: () => closeTab(state.activeTabIndex),
  });

  // ── View ───────────────────────────────────────────────────────
  registerCommand({
    id: 'view.fullscreen',
    group: 'View',
    label: 'Toggle Fullscreen',
    shortcut: 'F',
    run: async () => {
      const { enterFullscreen, exitFullscreen } = await import('./fullscreen.js');
      if (state.isFullscreen) exitFullscreen(); else enterFullscreen();
    },
  });

  registerCommand({
    id: 'view.grid',
    group: 'View',
    label: 'Toggle Grid Overview',
    shortcut: 'G',
    run: async () => {
      const { toggleGrid } = await import('./grid.js');
      toggleGrid();
    },
  });

  registerCommand({
    id: 'view.presenter',
    group: 'View',
    label: 'Open Presenter Window',
    shortcut: 'P',
    run: () => {
      if (window._openPresenter) window._openPresenter();
    },
  });

  registerCommand({
    id: 'view.sidebar',
    group: 'View',
    label: 'Toggle Sidebar',
    shortcut: 'Cmd+B',
    run: async () => {
      const { toggleSidebar } = await import('./fullscreen.js');
      toggleSidebar();
    },
  });

  // ── Sidebar mode jumps ─────────────────────────────────────────
  registerCommand({
    id: 'sidebar.decks',
    group: 'View',
    label: 'Show Decks Sidebar',
    shortcut: 'Cmd+1',
    when: () => IS_DESKTOP,
    run: () => setActiveMode('decks'),
  });
  registerCommand({
    id: 'sidebar.diagnostics',
    group: 'View',
    label: 'Show Diagnostics Sidebar',
    shortcut: 'Cmd+2',
    when: () => IS_DESKTOP,
    run: () => setActiveMode('diagnostics'),
  });
  registerCommand({
    id: 'sidebar.theme',
    group: 'View',
    label: 'Show Theme Sidebar',
    shortcut: 'Cmd+3',
    when: () => IS_DESKTOP,
    run: () => setActiveMode('theme'),
  });

  // ── Deck actions ───────────────────────────────────────────────
  registerCommand({
    id: 'deck.edit',
    group: 'Deck',
    label: 'Open in Editor',
    shortcut: 'Cmd+E',
    when: () => IS_DESKTOP && !!state.currentFile,
    run: async () => {
      const { openInExternalEditor } = await import('./toolbar.js');
      openInExternalEditor();
    },
  });

  registerCommand({
    id: 'deck.reveal',
    group: 'Deck',
    label: 'Reveal in Finder',
    when: () => IS_DESKTOP && !!state.currentFile,
    run: () => desktopInvoke('reveal_in_finder', { path: state.currentFile }).catch(() => {}),
  });

  registerCommand({
    id: 'deck.autoflow',
    group: 'Deck',
    label: 'Toggle Autoflow',
    shortcut: 'A',
    run: async () => {
      const tab = state.tabs[state.activeTabIndex];
      if (!tab) return;
      tab.autoflow = !tab.autoflow;
      const { renderDeck } = await import('./render.js');
      await renderDeck({ toast: tab.autoflow ? 'Autoflow on' : 'Autoflow off' });
      const { persistAutoflowToSidecar } = await import('./sidecar.js');
      persistAutoflowToSidecar();
    },
  });

  // ── Export ─────────────────────────────────────────────────────
  registerCommand({
    id: 'export.pdf',
    group: 'Export',
    label: 'Export PDF',
    shortcut: 'Cmd+Shift+E',
    when: () => !!state.currentFile,
    run: () => {
      // Reuse the existing toolbar export flow until we wire native export
      // in checkpoint 11.
      document.getElementById('btn-export')?.click();
    },
  });

  registerCommand({
    id: 'export.png',
    group: 'Export',
    label: 'Export PNG (one per slide)',
    when: () => !!state.currentFile,
    run: () => showToast('PNG export from app coming in next checkpoint', 3000),
  });

  registerCommand({
    id: 'export.grid',
    group: 'Export',
    label: 'Export Grid Composite PNG',
    when: () => !!state.currentFile,
    run: () => showToast('Grid export from app coming in next checkpoint', 3000),
  });

  // ── Theme ──────────────────────────────────────────────────────
  Object.entries(THEMES).forEach(([key, theme]) => {
    registerCommand({
      id: `theme.${key}`,
      group: 'Theme',
      label: `Theme: ${theme.label}`,
      run: async () => {
        const { default: m } = await import('./sidebar-theme.js').then(mod => ({ default: mod }));
        // Apply via the same path the sidebar uses
        const reveal = document.querySelector('.reveal');
        reveal.className = reveal.className.replace(/theme-\S+|scheme-\S+/g, '').trim();
        if (!reveal.classList.contains('reveal')) reveal.classList.add('reveal');
        if (key) reveal.classList.add('theme-' + key);
        const schemes = THEMES[key]?.schemes;
        if (schemes?.length) reveal.classList.add('scheme-' + schemes[0].id);
        const { propagateThemeVars, applySchemeColors } = await import('./themes.js');
        propagateThemeVars();
        applySchemeColors();
        const { persistThemeToSidecar } = await import('./sidecar.js');
        persistThemeToSidecar();
        showToast(theme.label);
      },
    });
  });
}
