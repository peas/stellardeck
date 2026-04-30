// ============================================================
// Desktop runtime shim
//
// Detects whether the app is running inside the Electron desktop shell
// and exposes desktopInvoke() to call IPC. Browser mode falls through.
//
// IS_TAURI is kept as a permanent `false` export so any straggling caller
// that still imports it compiles without ifdef'ing — the Tauri shell was
// removed in Phase 3 (src-tauri/ deleted on 2026-04-30).
// ============================================================

export const IS_TAURI = false;
export const IS_ELECTRON = !!window.stellardeck?.isDesktop;
export const IS_DESKTOP = IS_ELECTRON;

export function desktopInvoke(cmd, args) {
  if (IS_ELECTRON) return window.stellardeck.invoke(cmd, args);
  return Promise.reject(new Error('No desktop runtime available'));
}

// Legacy alias — kept until every caller migrates to desktopInvoke.
export const tauriInvoke = desktopInvoke;
