// ============================================================
// Tauri integration (desktop app mode)
// ============================================================
export const IS_TAURI = !!(window.__TAURI_INTERNALS__?.invoke || window.isTauri);

export function tauriInvoke(cmd, args) {
  return window.__TAURI_INTERNALS__.invoke(cmd, args);
}
