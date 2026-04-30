// ============================================================
// Desktop runtime shim
//
// Detects whether the app is running inside a desktop shell (Tauri or
// Electron) and exposes a single `desktopInvoke()` that routes to the
// right runtime. The set of command names is identical across shells.
//
// `IS_TAURI` and `IS_ELECTRON` stay exported for the rare cases where
// behavior really does differ between shells (e.g. Tauri-specific CSS
// hooks for the macOS overlay titlebar). Prefer `IS_DESKTOP` everywhere
// else.
// ============================================================

export const IS_TAURI = !!(window.__TAURI_INTERNALS__?.invoke || window.isTauri);
export const IS_ELECTRON = !!window.stellardeck?.isDesktop;
export const IS_DESKTOP = IS_TAURI || IS_ELECTRON;

export function desktopInvoke(cmd, args) {
  if (IS_ELECTRON) return window.stellardeck.invoke(cmd, args);
  if (IS_TAURI) return window.__TAURI_INTERNALS__.invoke(cmd, args);
  return Promise.reject(new Error('No desktop runtime available'));
}

// Legacy alias — old call sites still import { tauriInvoke }. Kept while
// callers migrate; harmless because it routes through the same shim.
export const tauriInvoke = desktopInvoke;
