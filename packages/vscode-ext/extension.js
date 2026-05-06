/**
 * StellarDeck VS Code extension — host (Node) entry point.
 *
 * Architecture:
 *   - One webview panel per .md file (reused if reopened).
 *   - Markdown is pushed from the host on activation, then on every
 *     debounced onDidChangeTextDocument.
 *   - Diagnostics flow the other way: webview runs the engine's deck-health
 *     rules after each render and posts a `diagnostics` message back; the
 *     host translates each warning to a vscode.Diagnostic, mapping `slide`
 *     index to the line of the Nth `---` separator in the source.
 *   - Engine bundle (`@stellardeck/core/dist/browser-globals.global.js`),
 *     renderer (`slides2.js/css`) and themes CSS are loaded into the
 *     webview as static assets via webview.asWebviewUri().
 */
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { computeSlideStartLines } = require('./lib/slide-lines');

const DEBOUNCE_MS = 120;
const DIAG_COLLECTION = 'stellardeck';

/** Map<vscode.Uri.toString(), vscode.WebviewPanel> */
const panels = new Map();
/** Map<vscode.Uri.toString(), NodeJS.Timeout> */
const debouncers = new Map();
/** vscode.DiagnosticCollection */
let diagnostics;

function activate(context) {
  diagnostics = vscode.languages.createDiagnosticCollection(DIAG_COLLECTION);
  context.subscriptions.push(diagnostics);

  context.subscriptions.push(
    vscode.commands.registerCommand('stellardeck.openPreview', () =>
      openPreview(context, vscode.ViewColumn.Beside)
    ),
    vscode.commands.registerCommand('stellardeck.openPreviewActive', () =>
      openPreview(context, vscode.ViewColumn.Active)
    ),
    vscode.workspace.onDidChangeTextDocument(onTextChange),
    vscode.workspace.onDidCloseTextDocument(doc => closePanelFor(doc.uri))
  );
}

function deactivate() {
  for (const t of debouncers.values()) clearTimeout(t);
  debouncers.clear();
  for (const p of panels.values()) p.dispose();
  panels.clear();
  if (diagnostics) diagnostics.dispose();
}

function openPreview(context, column) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !isMarkdown(editor.document)) {
    vscode.window.showInformationMessage('StellarDeck: open a Markdown (.md) file first.');
    return;
  }
  const uri = editor.document.uri;
  const key = uri.toString();

  let panel = panels.get(key);
  if (panel) {
    panel.reveal(column, true);
  } else {
    panel = vscode.window.createWebviewPanel(
      'stellardeck.preview',
      `Preview: ${path.basename(uri.fsPath)}`,
      { viewColumn: column, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: webviewRoots(context),
      }
    );
    panel.webview.html = renderShell(panel.webview, context);
    panel.webview.onDidReceiveMessage(msg => onWebviewMessage(uri, msg));
    panel.onDidDispose(() => {
      panels.delete(key);
      diagnostics.delete(uri);
    });
    panels.set(key, panel);
  }

  pushMarkdown(uri, editor.document.getText());
}

function onTextChange(event) {
  const uri = event.document.uri;
  if (!panels.has(uri.toString())) return;
  if (!isMarkdown(event.document)) return;

  // Debounce: editor text events fire per keystroke; webview re-renders
  // a full deck so coalescing matters even at small intervals.
  const key = uri.toString();
  clearTimeout(debouncers.get(key));
  const timer = setTimeout(() => {
    debouncers.delete(key);
    pushMarkdown(uri, event.document.getText());
  }, DEBOUNCE_MS);
  debouncers.set(key, timer);
}

function pushMarkdown(uri, text) {
  const panel = panels.get(uri.toString());
  if (!panel) return;
  panel.webview.postMessage({ type: 'setMarkdown', text });
}

function onWebviewMessage(uri, msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'diagnostics') {
    applyDiagnostics(uri, Array.isArray(msg.warnings) ? msg.warnings : []);
  } else if (msg.type === 'log') {
    // Surfaced for dev — webview can't write to extension output otherwise.
    console.log('[stellardeck webview]', msg.message);
  }
}

function applyDiagnostics(uri, warnings) {
  const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
  if (!doc) {
    diagnostics.set(uri, []);
    return;
  }
  const slideStartLines = computeSlideStartLines(doc.getText());
  const out = warnings.map(w => {
    const startLine = slideStartLines[w.slide] || 0;
    const range = new vscode.Range(startLine, 0, startLine, doc.lineAt(startLine).text.length);
    const severity = mapSeverity(w.severity);
    const d = new vscode.Diagnostic(range, w.message || w.type || 'StellarDeck', severity);
    d.source = 'stellardeck';
    if (w.type) d.code = w.type;
    return d;
  });
  diagnostics.set(uri, out);
}

function mapSeverity(s) {
  switch (s) {
    case 'error': return vscode.DiagnosticSeverity.Error;
    case 'warn':
    case 'warning': return vscode.DiagnosticSeverity.Warning;
    case 'info': return vscode.DiagnosticSeverity.Information;
    default: return vscode.DiagnosticSeverity.Hint;
  }
}

function isMarkdown(doc) {
  return doc.languageId === 'markdown' || doc.uri.fsPath.toLowerCase().endsWith('.md');
}

function closePanelFor(uri) {
  const panel = panels.get(uri.toString());
  if (panel) panel.dispose();
}

// ----------------------------------------------------------------------------
// Webview shell construction
// ----------------------------------------------------------------------------

function webviewRoots(context) {
  // Allow the webview to load files from the extension dir AND the workspace
  // root that holds @stellardeck/core (resolved via require.resolve below).
  const roots = [vscode.Uri.file(context.extensionPath)];
  const corePath = resolveCoreDir();
  if (corePath) roots.push(vscode.Uri.file(corePath));
  const stellardeckRoot = path.resolve(context.extensionPath, '..', '..');
  roots.push(vscode.Uri.file(stellardeckRoot));
  return roots;
}

function resolveCoreDir() {
  try {
    // The extension is in packages/vscode-ext/; @stellardeck/core lives in
    // packages/core/ as a workspace symlink. Walk up to find it.
    const here = __dirname;
    const candidates = [
      path.resolve(here, '..', 'core'),
      path.resolve(here, 'node_modules', '@stellardeck', 'core'),
      path.resolve(here, '..', '..', 'node_modules', '@stellardeck', 'core'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'dist', 'browser-globals.global.js'))) return c;
    }
  } catch { /* ignore */ }
  return null;
}

function renderShell(webview, context) {
  const stellardeckRoot = path.resolve(context.extensionPath, '..', '..');
  const coreDir = resolveCoreDir();
  const cspSource = webview.cspSource;

  const asUri = (absPath) => webview.asWebviewUri(vscode.Uri.file(absPath)).toString();

  const engineUri = coreDir
    ? asUri(path.join(coreDir, 'dist', 'browser-globals.global.js'))
    : '';
  const slidesJsUri = asUri(path.join(stellardeckRoot, 'slides2.js'));
  const slidesCssUri = asUri(path.join(stellardeckRoot, 'slides2.css'));
  const themesCssUri = asUri(path.join(stellardeckRoot, 'css', 'themes.css'));
  const layoutCssUri = asUri(path.join(stellardeckRoot, 'css', 'layout.css'));
  const previewJsUri = asUri(path.join(context.extensionPath, 'media', 'preview.js'));

  // CSP: scripts only from webview/extension origin, styles inline allowed
  // (slides2 sets style="..." per slide for backgrounds).
  const csp = [
    `default-src 'none'`,
    `img-src ${cspSource} data: https:`,
    `media-src ${cspSource} data: https:`,
    `script-src ${cspSource}`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `font-src ${cspSource} https: data:`,
    `connect-src ${cspSource} https:`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="stylesheet" href="${slidesCssUri}">
  <link rel="stylesheet" href="${themesCssUri}">
  <link rel="stylesheet" href="${layoutCssUri}">
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
    #slide-area { position: absolute; inset: 0; }
    .reveal, .slides { width: 100%; height: 100%; }
    #empty {
      color: #888; font: 14px/1.4 -apple-system, system-ui, sans-serif;
      display: grid; place-items: center; height: 100%;
    }
  </style>
</head>
<body>
  <div id="slide-area">
    <div class="reveal">
      <div class="slides" id="slides"></div>
    </div>
    <div id="empty">waiting for markdown…</div>
  </div>
  ${engineUri ? `<script src="${engineUri}"></script>` : ''}
  <script src="${slidesJsUri}"></script>
  <script src="${previewJsUri}"></script>
</body>
</html>`;
}

module.exports = { activate, deactivate };
