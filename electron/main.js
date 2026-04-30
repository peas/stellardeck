/**
 * StellarDeck — Electron main process
 *
 * Hosts the same viewer.html shell that runs in the browser, but with
 * Node.js-backed file access, native menus, and a real macOS/Windows window.
 *
 * Architecture:
 *   - app://./*    → repo files (HTML/JS/CSS), real origin so ES modules work
 *   - deck://./*   → image/asset files inside the directory of an open deck
 *
 * IPC names mirror the Tauri command names so the renderer code is identical
 * across both shells (see js/desktop.js).
 */

const { app, BrowserWindow, ipcMain, dialog, shell, Menu, protocol, net } = require('electron');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const chokidar = require('chokidar');
const Store = require('electron-store').default || require('electron-store');

const ROOT = path.resolve(__dirname, '..');
const isDev = !!process.env.ELECTRON_DEV;

const store = new Store({
  name: 'stellardeck',
  defaults: { recent: [] },
});

// ----------------------------------------------------------------------------
// Custom protocols
// ----------------------------------------------------------------------------

protocol.registerSchemesAsPrivileged([
  { scheme: 'app',  privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } },
  { scheme: 'deck', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// allowDeckDir is kept as a no-op for now (call sites still invoke it). The
// Tauri shell served any local file the markdown referenced — including
// shared `assets/` directories that sit beside or above the deck's folder —
// and we need the same parity here. If we ever sandbox this, do it via an
// explicit user-toggleable setting, not silently.
function allowDeckDir(_dir) { /* no-op — match Tauri parity */ }

function registerProtocols() {
  // app://./viewer.html — serves repo root, gives renderer a real origin
  protocol.handle('app', async (req) => {
    try {
      const url = new URL(req.url);
      const relPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const fullPath = path.normalize(path.join(ROOT, relPath));
      if (!fullPath.startsWith(ROOT)) {
        return new Response('forbidden', { status: 403 });
      }
      return net.fetch(pathToFileURL(fullPath).toString());
    } catch (err) {
      return new Response(String(err), { status: 500 });
    }
  });

  // deck://./<absolute-path> — serves any local file the open decks reference.
  // Matches Tauri's localfile:// behavior (no allowlist). Decks routinely
  // reference assets in directories outside their own (shared `assets/`,
  // sibling folders), so a path-prefix sandbox would break real decks.
  protocol.handle('deck', async (req) => {
    try {
      const url = new URL(req.url);
      const absPath = path.normalize(decodeURIComponent(url.pathname));
      return net.fetch(pathToFileURL(absPath).toString());
    } catch (err) {
      return new Response(String(err), { status: 500 });
    }
  });
}

// ----------------------------------------------------------------------------
// File watcher (one watcher instance, ref-counted by path)
// ----------------------------------------------------------------------------

const watchers = new Map(); // path → chokidar.FSWatcher

function watchFile(filePath, win) {
  if (watchers.has(filePath)) return;
  const w = chokidar.watch(filePath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
  });
  w.on('change', () => {
    if (!win.isDestroyed()) win.webContents.send('file-changed', { path: filePath });
  });
  w.on('error', () => {});
  watchers.set(filePath, w);
}

function unwatchFile(filePath) {
  const w = watchers.get(filePath);
  if (w) {
    w.close().catch(() => {});
    watchers.delete(filePath);
  }
}

function unwatchAll() {
  for (const w of watchers.values()) w.close().catch(() => {});
  watchers.clear();
}

// ----------------------------------------------------------------------------
// IPC handlers — names match Tauri commands so renderer code is identical
// ----------------------------------------------------------------------------

function registerIPC() {
  ipcMain.handle('read_markdown', async (_evt, { path: p }) => {
    const text = await fs.readFile(p, 'utf8');
    allowDeckDir(path.dirname(p));
    return text;
  });

  ipcMain.handle('read_file', async (_evt, { path: p }) => {
    // ENOENT is expected (e.g. .stellar.json sidecars that don't exist yet).
    // Return null so the renderer's try/catch path is hit cleanly without
    // Electron logging the rejection as an unhandled IPC error.
    try {
      return await fs.readFile(p, 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') return null;
      throw err;
    }
  });

  ipcMain.handle('write_file', async (_evt, { path: p, content }) => {
    await fs.writeFile(p, content, 'utf8');
    return null;
  });

  ipcMain.handle('write_binary_file', async (_evt, { path: p, contents }) => {
    await fs.writeFile(p, Buffer.from(contents));
    return null;
  });

  ipcMain.handle('get_project_root', async () => ROOT);

  ipcMain.handle('open_in_editor', async (_evt, { path: p }) => {
    const err = await shell.openPath(p);
    if (err) throw new Error(err);
    return null;
  });

  ipcMain.handle('reveal_in_finder', async (_evt, { path: p }) => {
    shell.showItemInFolder(p);
    return null;
  });

  ipcMain.handle('get_recent_files', async () => store.get('recent', []));

  ipcMain.handle('add_recent_file', async (_evt, { filePath }) => {
    const recent = store.get('recent', []).filter(p => p !== filePath);
    recent.unshift(filePath);
    while (recent.length > 10) recent.pop();
    store.set('recent', recent);
    allowDeckDir(path.dirname(filePath));
    rebuildMenu();
    return recent;
  });

  ipcMain.handle('toggle_fullscreen', async (evt) => {
    const win = BrowserWindow.fromWebContents(evt.sender);
    if (!win) return null;
    win.setFullScreen(!win.isFullScreen());
    return null;
  });

  ipcMain.handle('open_file_dialog', async (evt, { currentDir } = {}) => {
    const win = BrowserWindow.fromWebContents(evt.sender);
    const result = await dialog.showOpenDialog(win, {
      title: 'Open Markdown deck',
      defaultPath: currentDir || undefined,
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    if (result.canceled || !result.filePaths.length) return null;
    const picked = result.filePaths[0];
    allowDeckDir(path.dirname(picked));
    return picked;
  });

  ipcMain.handle('open_presenter_window', async () => {
    // Phase 3: open separate presenter window. For now, no-op (frontend
    // falls back to window.open which works inside Electron renderers too).
    throw new Error('Presenter window not yet implemented in Electron shell');
  });

  ipcMain.handle('export_pdf', async () => {
    // Phase 3: wire up Playwright export pipeline.
    throw new Error('PDF export not yet implemented in Electron shell');
  });

  ipcMain.handle('watch_file', async (evt, { path: p }) => {
    const win = BrowserWindow.fromWebContents(evt.sender);
    if (win) watchFile(p, win);
    allowDeckDir(path.dirname(p));
    return null;
  });

  ipcMain.handle('unwatch_file', async (_evt, { path: p }) => {
    unwatchFile(p);
    return null;
  });
}

// ----------------------------------------------------------------------------
// Window
// ----------------------------------------------------------------------------

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: 'StellarDeck',
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0b1220',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('closed', () => {
    mainWindow = null;
    unwatchAll();
  });

  // Forward menu events to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  // Launch-time decks: every argv entry that's an existing .md file is opened.
  // First file → ?file=… ; rest → &also=… (mirrors Tauri tauri.conf.json `url`).
  const files = pickFilesFromArgv();
  let url = 'app://./viewer.html';
  if (files.length) {
    files.forEach(f => allowDeckDir(path.dirname(f)));
    const params = new URLSearchParams();
    params.set('file', files[0]);
    files.slice(1).forEach(f => params.append('also', f));
    url += '?' + params.toString();
  }
  mainWindow.loadURL(url);
}

function pickFilesFromArgv() {
  // process.argv = [electron, <app-path>, ...userArgs]. In dev `npm run electron`
  // passes `.` as app-path; packaged apps may include their own resource args.
  // Accept any argv entry that exists on disk and ends in .md/.markdown.
  const out = [];
  for (const arg of process.argv.slice(1)) {
    if (typeof arg !== 'string') continue;
    if (arg.startsWith('-')) continue;
    if (!/\.(md|markdown)$/i.test(arg)) continue;
    try {
      const abs = path.resolve(arg);
      if (fsSync.statSync(abs).isFile()) out.push(abs);
    } catch { /* not a file */ }
  }
  return out;
}

// ----------------------------------------------------------------------------
// Menus
// ----------------------------------------------------------------------------

function sendMenuAction(id) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', id);
  }
}

function buildMenu() {
  const recent = store.get('recent', []);
  const recentSubmenu = recent.length === 0
    ? [{ label: 'No Recent Files', enabled: false }]
    : recent.map(p => ({
        label: path.basename(p),
        toolTip: p,
        click: () => sendMenuAction(`recent:${p}`),
      })).concat([
        { type: 'separator' },
        { label: 'Clear Recent', click: () => { store.set('recent', []); rebuildMenu(); } },
      ]);

  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open') },
        { label: 'Open Recent', submenu: recentSubmenu },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => sendMenuAction('close-tab') },
        { type: 'separator' },
        { label: 'Export PDF…', accelerator: 'CmdOrCtrl+Shift+E', click: () => sendMenuAction('export-pdf') },
        ...(!isMac ? [{ type: 'separator' }, { role: 'quit' }] : []),
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Grid Overview', accelerator: 'CmdOrCtrl+G', click: () => sendMenuAction('grid') },
        { label: 'Presenter Mode', accelerator: 'CmdOrCtrl+P', click: () => sendMenuAction('presenter') },
        { type: 'separator' },
        { label: 'Fullscreen', accelerator: 'F', click: () => sendMenuAction('fullscreen') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
  ];

  return Menu.buildFromTemplate(template);
}

function rebuildMenu() {
  Menu.setApplicationMenu(buildMenu());
}

// ----------------------------------------------------------------------------
// Lifecycle
// ----------------------------------------------------------------------------

app.whenReady().then(() => {
  registerProtocols();
  registerIPC();
  rebuildMenu();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', unwatchAll);
