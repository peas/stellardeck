import { state } from './state.js';
import { IS_TAURI, tauriInvoke } from './tauri.js';
import { saveTabThemeOverride } from './themes.js';

// Sidecar .stellar.json — persist theme/scheme per deck alongside the .md file
export function sidecarPath(mdPath) {
  return mdPath.replace(/\.md$/, '.stellar.json');
}

export async function loadSidecar(mdPath) {
  if (!IS_TAURI) return null;
  try {
    const json = await tauriInvoke('read_file', { path: sidecarPath(mdPath) });
    return JSON.parse(json);
  } catch { return null; }
}

export async function saveSidecar(mdPath, data) {
  if (!IS_TAURI) return;
  try {
    await tauriInvoke('write_file', {
      path: sidecarPath(mdPath),
      content: JSON.stringify(data, null, 2),
    });
  } catch { /* ignore write errors */ }
}

// Build sidecar data from current tab state
function buildSidecarData(tab) {
  const data = {};
  if (tab.themeOverride != null) data.theme = tab.themeOverride;
  if (tab.schemeOverride != null) data.scheme = tab.schemeOverride;
  if (tab.autoflow) data.autoflow = true;
  data.lastSlide = (typeof Reveal !== 'undefined' ? Reveal.getState().indexh : 0) || 0;
  return data;
}

// Save theme override to sidecar when user changes theme/scheme
export function persistThemeToSidecar() {
  if (!IS_TAURI || state.activeTabIndex < 0) return;
  const tab = state.tabs[state.activeTabIndex];
  saveTabThemeOverride(state.activeTabIndex);
  saveSidecar(tab.file, buildSidecarData(tab));
}

// Save autoflow state to sidecar
export function persistAutoflowToSidecar() {
  if (!IS_TAURI || state.activeTabIndex < 0) return;
  const tab = state.tabs[state.activeTabIndex];
  saveSidecar(tab.file, buildSidecarData(tab));
}
