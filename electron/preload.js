/**
 * Preload (sandboxed, CommonJS).
 *
 * Exposes a small typed API on window.stellardeck. The renderer uses this
 * via js/desktop.js (which keeps the same shape as the legacy Tauri shim
 * so callers don't change between shells).
 */

const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_COMMANDS = new Set([
  'read_markdown',
  'read_file',
  'write_file',
  'write_binary_file',
  'get_project_root',
  'open_in_editor',
  'reveal_in_finder',
  'get_recent_files',
  'add_recent_file',
  'toggle_fullscreen',
  'open_file_dialog',
  'open_presenter_window',
  'export_pdf',
  'watch_file',
  'unwatch_file',
]);

contextBridge.exposeInMainWorld('stellardeck', {
  isDesktop: true,
  runtime: 'electron',
  platform: process.platform,

  invoke: (cmd, args) => {
    if (!ALLOWED_COMMANDS.has(cmd)) {
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    }
    return ipcRenderer.invoke(cmd, args);
  },

  // Build a deck:// URL for an absolute filesystem path. Slashes are kept
  // intact, each segment is URI-encoded so spaces and unicode survive.
  fileSrc: (absPath) => {
    const encoded = absPath.split('/').map(s => encodeURIComponent(s)).join('/');
    return `deck://./${encoded.replace(/^\/+/, '')}`;
  },

  onMenuAction: (handler) => {
    const listener = (_evt, id) => handler(id);
    ipcRenderer.on('menu-action', listener);
    return () => ipcRenderer.off('menu-action', listener);
  },

  onFileChanged: (handler) => {
    const listener = (_evt, payload) => handler(payload);
    ipcRenderer.on('file-changed', listener);
    return () => ipcRenderer.off('file-changed', listener);
  },
});
