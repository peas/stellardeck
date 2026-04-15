#!/usr/bin/env node
/**
 * export.js — StellarDeck Markdown export (PDF, PNG, grid)
 *
 * Uses the same in-browser rendering (StellarSlides + html2canvas) as the
 * Tauri app. Playwright is only the CLI runner — each slide is captured via
 * html2canvas inside headless Chromium, then composed into the chosen format.
 *
 * Run with --help for usage.
 */

const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { CDN, SLIDE, THEMES } = require('../constants.js');

const PROJECT_DIR = path.resolve(__dirname, '..');
const SLIDE_W = SLIDE.WIDTH;
const SLIDE_H = SLIDE.HEIGHT;

// ── Help ─────────────────────────────────────────────────────

const HELP = `
  stellardeck — Markdown presentation CLI (export, preview, serve)

  Usage:
    node scripts/export.js [options] <input.md> [output]
    node scripts/export.js --preview <input.md>
    node scripts/export.js --serve [--port <n>]
    node scripts/export.js --validate <input.md>
    node scripts/export.js --list-themes
    node scripts/export.js --list-schemes <theme>
    node scripts/export.js --input-dir <dir> --output <dir> [options]
    cat deck.md | node scripts/export.js [options] - [output]
    npm run export -- [options] <input.md> [output]

  Arguments:
    input.md      Path to Deckset markdown file (or "-" to read stdin)
    output        Output path (default: <input-basename>.<ext> in current dir)

  Live modes:
    --preview          Open deck in browser for live viewing. Starts a temp
                       server, opens the default browser, and waits. Ctrl+C stops.
    --serve            Start dev server and open viewer in browser.
                       Watches for file changes. Ctrl+C stops.

  Format (pick one; default is --pdf):
    --pdf              Export to PDF (default)
    --png              Export one PNG per slide to a directory
    --grid             Export single image with all slides in a grid
    --grid-cols <n>    Columns for grid layout (default: 4)

  Validation & introspection:
    --validate         Render deck and collect warnings without exporting.
                       Returns {ok, slides, totalSlides, warnings} as JSON.
    --list-themes      Print available themes (JSON array). No browser needed.
    --list-schemes <theme>  Print color schemes for a theme (JSON array).

  Batch mode:
    --input-dir <dir>  Process all .md files recursively in <dir>
    --output <dir>     Output directory (required with --input-dir)

  Slide selection:
    --slides <range>   Export subset only. Examples:
                         --slides 1-5      slides 1 through 5
                         --slides 1,3,5    slides 1, 3, and 5
                         --slides 1-3,7,9  mixed ranges

  Rendering:
    --scale <n>        DPI scale factor (default: 2 = 144dpi, 1 = 72dpi, 3 = 216dpi)
    --theme <name>     Override deck theme
    --scheme <n>       Override color scheme number
    --autoflow         Enable autoflow layout inference

  Output:
    --json             Machine-readable JSON output (implicit for --validate/--list-*)
    --port <n>         Dev server port (default: 3032)
    -h, --help         Show this help

  Examples:
    node scripts/export.js --preview talk.md                 # live preview in browser
    node scripts/export.js --serve                           # start dev server
    node scripts/export.js talk.md                           # → talk.pdf
    node scripts/export.js --png talk.md                     # → talk-slides/001.png...
    node scripts/export.js --grid talk.md                    # → talk-grid.png
    node scripts/export.js --validate talk.md                # warnings only, no export
    node scripts/export.js --list-themes                     # available themes as JSON
    node scripts/export.js --list-schemes nordic             # schemes for a theme
    node scripts/export.js --slides 1-3 talk.md intro.pdf    # first 3 slides
    node scripts/export.js --input-dir decks --output dist   # batch
    cat deck.md | node scripts/export.js --pdf - deck.pdf    # stdin
`.trimStart();

// ── Arg parser ───────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    mode: 'export',  // 'export' | 'validate' | 'list-themes' | 'list-schemes' | 'preview' | 'serve'
    format: 'pdf',
    gridCols: 4,
    scale: 2, port: 3032,
    theme: null, scheme: null, autoflow: false,
    slides: null,
    json: false,
    inputDir: null,
    listSchemesTheme: null,
  };
  const positional = [];
  let outputFlag = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-h' || a === '--help') throw new HelpRequested();
    else if (a === '--pdf') opts.format = 'pdf';
    else if (a === '--png') opts.format = 'png';
    else if (a === '--grid') opts.format = 'grid';
    else if (a === '--json') opts.json = true;
    else if (a === '--autoflow') opts.autoflow = true;
    else if (a === '--validate') opts.mode = 'validate';
    else if (a === '--preview') opts.mode = 'preview';
    else if (a === '--serve') opts.mode = 'serve';
    else if (a === '--list-themes') opts.mode = 'list-themes';
    else if (a === '--list-schemes') {
      opts.mode = 'list-schemes';
      opts.listSchemesTheme = requireValue(args[++i], '--list-schemes');
    }
    else if (a === '--grid-cols') opts.gridCols = requireInt(args[++i], '--grid-cols');
    else if (a === '--scale') opts.scale = requireInt(args[++i], '--scale');
    else if (a === '--port') opts.port = requireInt(args[++i], '--port');
    else if (a === '--scheme') opts.scheme = requireInt(args[++i], '--scheme');
    else if (a === '--theme') opts.theme = requireValue(args[++i], '--theme');
    else if (a === '--slides') opts.slides = parseSlideRange(requireValue(args[++i], '--slides'));
    else if (a === '--input-dir') opts.inputDir = requireValue(args[++i], '--input-dir');
    else if (a === '--output') outputFlag = requireValue(args[++i], '--output');
    else if (a === '-') positional.push('-');
    else if (a.startsWith('-')) errorExit(`unknown option "${a}". Run with --help for usage.`);
    else positional.push(a);
  }

  // Introspection modes — no input file needed
  if (opts.mode === 'list-themes' || opts.mode === 'list-schemes') {
    opts.json = true;
    return opts;
  }

  // Serve mode — no input file needed
  if (opts.mode === 'serve') {
    if (opts.port === 3032) opts.port = 3031; // serve uses 3031 by default
    return opts;
  }

  // Preview mode — needs input but no output
  if (opts.mode === 'preview') {
    if (positional.length === 0) throw new CLIError('--preview requires an input file');
    opts.input = positional[0];
    return opts;
  }

  // Validate mode — needs input but no output
  if (opts.mode === 'validate') {
    opts.json = true;
    if (positional.length === 0) throw new CLIError('--validate requires an input file');
    opts.input = positional[0];
    return opts;
  }

  // Batch mode
  if (opts.inputDir) {
    opts.output = outputFlag || positional[0];
    if (!opts.output) errorExit('--input-dir requires --output <dir>');
    return opts;
  }

  // Single-file mode
  if (positional.length === 0) throw new CLIError('missing input file (see --help)');

  opts.input = positional[0];
  const ext = opts.format === 'pdf' ? '.pdf' : opts.format === 'grid' ? '-grid.png' : '-slides';
  const baseName = opts.input === '-'
    ? 'stdin'
    : path.basename(opts.input).replace(/\.md$/, '');
  opts.output = outputFlag || positional[1] || `${baseName}${ext}`;

  return opts;
}

class CLIError extends Error { constructor(msg) { super(msg); this.name = 'CLIError'; } }
class HelpRequested extends Error { constructor() { super('help requested'); this.name = 'HelpRequested'; } }

function requireInt(v, flag) {
  if (v == null || isNaN(v)) errorExit(`${flag} requires a number`);
  return parseInt(v, 10);
}
function requireValue(v, flag) {
  if (!v) errorExit(`${flag} requires a value`);
  return v;
}
function errorExit(msg) { throw new CLIError(msg); }

/**
 * Parse "1-5" or "1,3,5" or "1-3,7,9" → Set<number> (1-indexed).
 * Exported for testing.
 */
function parseSlideRange(str) {
  const set = new Set();
  for (const part of str.split(',')) {
    const trimmed = part.trim();
    const range = trimmed.match(/^(\d+)-(\d+)$/);
    if (range) {
      const [a, b] = [parseInt(range[1], 10), parseInt(range[2], 10)];
      if (a > b || a < 1) errorExit(`invalid slide range "${trimmed}"`);
      for (let i = a; i <= b; i++) set.add(i);
    } else if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (n < 1) errorExit(`slide number must be >= 1 (got ${n})`);
      set.add(n);
    } else {
      errorExit(`invalid slide selector "${trimmed}"`);
    }
  }
  return set;
}

// ── Server management ────────────────────────────────────────

function startServer(port) {
  const server = spawn('python3', ['scripts/dev-server.py', String(port)], {
    cwd: PROJECT_DIR, stdio: 'ignore', detached: true,
  });
  server.unref();
  return server;
}

async function waitForServer(port, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { await fetch(`http://127.0.0.1:${port}/viewer.html`); return; }
    catch { await new Promise(r => setTimeout(r, 200)); }
  }
  throw new Error(`Server not ready on port ${port} after ${timeout / 1000}s`);
}

// ── Stdin handling ───────────────────────────────────────────

async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function resolveInput(input) {
  if (input === '-') {
    const content = await readStdin();
    if (!content.trim()) throw new Error('No markdown received on stdin');
    const tmpDir = fs.mkdtempSync(path.join(PROJECT_DIR, '.stellardeck-stdin-'));
    const tmpFile = path.join(tmpDir, 'stdin.md');
    fs.writeFileSync(tmpFile, content);
    return {
      path: tmpFile,
      relative: path.relative(PROJECT_DIR, tmpFile),
      cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
    };
  }
  const resolved = path.isAbsolute(input) ? input : path.resolve(PROJECT_DIR, input);
  if (!fs.existsSync(resolved)) throw new Error(`File not found: ${input}`);
  return { path: resolved, relative: path.relative(PROJECT_DIR, resolved), cleanup: () => {} };
}

// ── Directory walk ───────────────────────────────────────────

/**
 * Recursively collect all .md files in a directory.
 * Skips hidden dirs, node_modules, and `old/` archive.
 * Exported for testing.
 */
function walkMarkdownFiles(dir) {
  const files = [];
  const SKIP = new Set(['node_modules', 'old', '.git', '.claude', 'reveal.js', 'assets']);
  function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (SKIP.has(entry.name)) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) files.push(full);
    }
  }
  walk(dir);
  return files.sort();
}

// ── Session: shared browser + server ─────────────────────────

async function startSession(opts, onProgress) {
  // Ensure server is running on the port
  let server = null;
  try { await fetch(`http://127.0.0.1:${opts.port}/viewer.html`); }
  catch {
    if (onProgress) onProgress('status', `Starting dev server on port ${opts.port}...`);
    server = startServer(opts.port);
    await waitForServer(opts.port);
  }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: SLIDE_W, height: SLIDE_H } });
  page.on('console', msg => {
    const text = msg.text();
    if (text.startsWith('__PROGRESS__:') && onProgress) {
      onProgress('slide', text.replace('__PROGRESS__:', ''));
    }
  });
  return { browser, page, server, port: opts.port };
}

async function stopSession(session) {
  if (session.browser) await session.browser.close();
  if (session.server) { try { process.kill(-session.server.pid); } catch { /* dead */ } }
}

// ── Core: capture slides in an open session ─────────────────

async function captureInSession(session, relativePath, options) {
  const { port, page } = session;
  const { scale, theme, scheme, autoflow, slides: slideFilter, skipCapture = false } = options;
  const warnings = [];

  // Track image loads to detect missing ones. An image is "missing" only if every
  // attempt to load it failed — URLs that succeeded at any point are treated as OK
  // (browsers may retry different paths via viewer's resolution logic).
  // Also exclude viewer's own chrome assets (welcome logo, favicon, etc.).
  const isChromeAsset = (url) => /\/assets\/brand\/|\/favicon|\/icons\//.test(url);
  const succeeded = new Set();
  const failed = new Set();
  const stripHost = (url) => url.replace(/^https?:\/\/[^/]+/, '');
  const requestFailedListener = (req) => {
    if (req.resourceType() === 'image') {
      const url = stripHost(req.url());
      if (!isChromeAsset(url)) failed.add(url);
    }
  };
  const responseListener = (resp) => {
    if (resp.request().resourceType() !== 'image') return;
    const url = stripHost(resp.url());
    if (isChromeAsset(url)) return;
    if (resp.status() >= 400) failed.add(url);
    else succeeded.add(url);
  };
  page.on('requestfailed', requestFailedListener);
  page.on('response', responseListener);

  const params = new URLSearchParams({ file: relativePath });
  if (theme) params.set('theme', theme);
  if (scheme != null) params.set('scheme', String(scheme));
  if (autoflow) params.set('autoflow', 'true');
  const url = `http://127.0.0.1:${port}/viewer.html?${params}`;

  try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => typeof Reveal !== 'undefined' && Reveal.isReady?.(), { timeout: 15000 });
  await page.waitForFunction(() => document.fonts.ready.then(() => true), { timeout: 10000 });
  await page.waitForTimeout(1500);

  // Theme mismatch check is now handled by StellarDiagnostics.diagnoseDeck()
  // (see page.evaluate below).

  // Re-inject html2canvas after each navigation (page context reset).
  // Skip for --validate mode since we don't capture images.
  if (!skipCapture) {
    await page.addScriptTag({ url: CDN.HTML2CANVAS });
    await page.waitForFunction(() => typeof html2canvas !== 'undefined', { timeout: 10000 });
  }

  const totalSlides = await page.evaluate(() => Reveal.getTotalSlides());

  // Validate slide filter
  const indices = [];
  if (slideFilter) {
    for (const n of slideFilter) {
      if (n > totalSlides) {
        warnings.push({
          type: 'slide-out-of-range',
          severity: 'warn',
          slide: n,
          totalSlides,
          message: `slide ${n} out of range (deck has ${totalSlides} slides)`,
        });
      } else {
        indices.push(n);
      }
    }
    if (indices.length === 0) throw new Error(`No valid slides in --slides filter (deck has ${totalSlides} slides)`);
    indices.sort((a, b) => a - b);
  } else {
    for (let i = 1; i <= totalSlides; i++) indices.push(i);
  }

  // Capture each selected slide + collect per-slide diagnostics via StellarDiagnostics
  const captureResult = await page.evaluate(async ({ indices, scale, W, H, theme, skipCapture }) => {
    // Full-hide print mode (CLI: headless browser, hide everything)
    window.StellarPrintMode.enter({ width: W, height: H, full: true });
    await new Promise(r => setTimeout(r, 500));

    const images = [];
    const diagnostics = [...window.StellarDiagnostics.diagnoseDeck({ theme })];
    const total = indices.length;
    for (let i = 0; i < total; i++) {
      const slideNum = indices[i];
      console.log(`__PROGRESS__:${i + 1} of ${total}`);
      Reveal.slide(slideNum - 1);
      await new Promise(r => setTimeout(r, 400));

      // Structured per-slide diagnostics from the shared module
      diagnostics.push(...window.StellarDiagnostics.diagnoseSlide(
        window.StellarDiagnostics.currentSection(), slideNum
      ));

      if (skipCapture) continue; // --validate mode: don't capture pixels

      const canvas = await html2canvas(document.querySelector('.reveal'), {
        width: W, height: H, scale, useCORS: true, backgroundColor: null, logging: false,
      });
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
      images.push(btoa(binary));
    }
    return { images, diagnostics };
  }, { indices, scale, W: SLIDE_W, H: SLIDE_H, theme, skipCapture });

  // Merge DOM warnings with network-level background-image failures.
  // CLI-only: network tracking catches CSS background images (DOM check only sees <img>).
  const domMissingUrls = new Set(
    captureResult.diagnostics.filter(d => d.type === 'missing-image').map(d => d.url)
  );
  const netMissing = [...failed]
    .filter(url => !succeeded.has(url))
    .filter(url => !domMissingUrls.has(url));
  for (const url of netMissing) {
    captureResult.diagnostics.push({
      type: 'missing-image',
      severity: 'warn',
      slide: null,
      url,
      message: `image failed to load: ${url}`,
    });
  }

  warnings.push(...captureResult.diagnostics);

  return {
    slides: skipCapture
      ? indices.map(idx => ({ index: idx, buffer: null }))
      : indices.map((idx, i) => ({ index: idx, buffer: Buffer.from(captureResult.images[i], 'base64') })),
    totalSlides,
    warnings,
  };
  } finally {
    page.off('requestfailed', requestFailedListener);
    page.off('response', responseListener);
  }
}

// One-shot capture (starts + stops its own session)
async function captureSlides(relativePath, options, onProgress = null) {
  const session = await startSession(options, onProgress);
  try { return await captureInSession(session, relativePath, options); }
  finally { await stopSession(session); }
}

// ── Format exporters ────────────────────────────────────────

async function exportPDF(captures, outputPath) {
  const { PDFDocument } = require('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  for (const { buffer } of captures) {
    const img = await pdfDoc.embedPng(buffer);
    const page = pdfDoc.addPage([SLIDE_W, SLIDE_H]);
    page.drawImage(img, { x: 0, y: 0, width: SLIDE_W, height: SLIDE_H });
  }
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return { path: path.resolve(outputPath), bytes: pdfBytes.length };
}

async function exportPNG(captures, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const files = [];
  let totalBytes = 0;
  for (const { index, buffer } of captures) {
    const filePath = path.join(outputDir, `${String(index).padStart(3, '0')}.png`);
    fs.writeFileSync(filePath, buffer);
    files.push(filePath);
    totalBytes += buffer.length;
  }
  return { path: path.resolve(outputDir), files: files.map(f => path.resolve(f)), bytes: totalBytes };
}

async function exportGrid(captures, outputPath, cols) {
  const sharp = require('sharp');
  const rows = Math.ceil(captures.length / cols);
  const thumbW = 480, thumbH = 270;
  const composites = await Promise.all(captures.map(async ({ buffer }, i) => {
    const resized = await sharp(buffer).resize(thumbW, thumbH).png().toBuffer();
    return {
      input: resized,
      left: (i % cols) * thumbW,
      top: Math.floor(i / cols) * thumbH,
    };
  }));
  const gridBuffer = await sharp({
    create: {
      width: thumbW * cols,
      height: thumbH * rows,
      channels: 4,
      background: { r: 20, g: 20, b: 25, alpha: 1 },
    },
  }).composite(composites).png().toBuffer();
  fs.writeFileSync(outputPath, gridBuffer);
  return { path: path.resolve(outputPath), bytes: gridBuffer.length, cols, rows };
}

async function exportByFormat(slides, outputPath, opts) {
  if (opts.format === 'pdf') return { ...await exportPDF(slides, outputPath), format: 'pdf' };
  if (opts.format === 'png') return { ...await exportPNG(slides, outputPath), format: 'png' };
  if (opts.format === 'grid') return { ...await exportGrid(slides, outputPath, opts.gridCols), format: 'grid' };
  throw new Error(`Unknown format: ${opts.format}`);
}

/**
 * Build output path for a file in batch mode.
 * Exported for testing.
 */
function buildBatchOutputPath(outputDir, relativeToBase, format) {
  const baseName = relativeToBase.replace(/\.md$/, '');
  const ext = format === 'pdf' ? '.pdf' : format === 'grid' ? '-grid.png' : '-slides';
  return path.join(outputDir, `${baseName}${ext}`);
}

// ── Main run functions ──────────────────────────────────────

async function run(opts, onProgress = null) {
  const inputInfo = await resolveInput(opts.input);
  try {
    const { slides, totalSlides, warnings } = await captureSlides(inputInfo.relative, opts, onProgress);
    const result = await exportByFormat(slides, opts.output, opts);
    result.slides = slides.length;
    result.totalSlides = totalSlides;
    result.warnings = warnings;
    return result;
  } finally {
    inputInfo.cleanup();
  }
}

/**
 * Validate a deck: render, collect diagnostics, skip capture. Much faster
 * than a full export — agents use this as a pre-flight check before export.
 */
async function runValidate(opts, onProgress = null) {
  const inputInfo = await resolveInput(opts.input);
  try {
    const { totalSlides, warnings } = await captureSlides(
      inputInfo.relative,
      { ...opts, skipCapture: true },
      onProgress
    );
    return {
      ok: !warnings.some(w => w.severity === 'error'),
      mode: 'validate',
      input: inputInfo.relative,
      totalSlides,
      warnings,
    };
  } finally {
    inputInfo.cleanup();
  }
}

/**
 * List available themes (no browser needed — reads from constants.js).
 * Returns a JSON array of { name, label, schemeCount }.
 */
function listThemes() {
  return Object.entries(THEMES).map(([name, meta]) => ({
    name: name || 'default',
    label: meta.label,
    schemeCount: meta.schemes.length,
  }));
}

/**
 * List color schemes for a given theme. Throws if theme doesn't exist.
 */
function listSchemes(themeName) {
  const key = themeName === 'default' ? '' : themeName;
  if (!(key in THEMES)) {
    const available = Object.keys(THEMES).map(k => k || 'default').join(', ');
    throw new CLIError(`unknown theme "${themeName}". Available: ${available}`);
  }
  const meta = THEMES[key];
  return {
    theme: themeName,
    label: meta.label,
    schemes: meta.schemes.map(s => ({ id: s.id, bg: s.bg, fg: s.fg })),
  };
}

async function runBatch(opts, onProgress = null) {
  const inputDir = path.isAbsolute(opts.inputDir) ? opts.inputDir : path.resolve(PROJECT_DIR, opts.inputDir);
  if (!fs.existsSync(inputDir)) throw new Error(`Input directory not found: ${opts.inputDir}`);
  if (!fs.statSync(inputDir).isDirectory()) throw new Error(`Not a directory: ${opts.inputDir}`);

  const files = walkMarkdownFiles(inputDir);
  if (files.length === 0) throw new Error(`No .md files found in ${opts.inputDir}`);

  const session = await startSession(opts, onProgress);
  const results = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relInput = path.relative(PROJECT_DIR, file);
      const relToBase = path.relative(inputDir, file);
      const outputPath = buildBatchOutputPath(opts.output, relToBase, opts.format);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      if (onProgress) onProgress('file', `[${i + 1}/${files.length}] ${relInput}`);
      try {
        const { slides, totalSlides, warnings } = await captureInSession(session, relInput, opts);
        const result = await exportByFormat(slides, outputPath, opts);
        results.push({
          input: file, output: result.path, slides: slides.length,
          totalSlides, warnings, bytes: result.bytes,
        });
      } catch (err) {
        results.push({ input: file, error: err.message });
      }
    }
  } finally {
    await stopSession(session);
  }
  return results;
}

// ── Output formatting ───────────────────────────────────────

function humanResult(result) {
  const sizeMB = (result.bytes / 1024 / 1024).toFixed(2);
  if (result.format === 'pdf') return `\u2713 Exported ${result.slides} slides to ${result.path} (${sizeMB} MB)`;
  if (result.format === 'png') return `\u2713 Exported ${result.slides} PNG files to ${result.path}/ (${sizeMB} MB total)`;
  if (result.format === 'grid') return `\u2713 Exported ${result.rows}×${result.cols} grid of ${result.slides} slides to ${result.path} (${sizeMB} MB)`;
}

function humanBatchSummary(results) {
  const ok = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  const totalBytes = ok.reduce((sum, r) => sum + (r.bytes || 0), 0);
  const totalSlides = ok.reduce((sum, r) => sum + (r.slides || 0), 0);
  const sizeMB = (totalBytes / 1024 / 1024).toFixed(2);
  const lines = [`\u2713 Batch: ${ok.length}/${results.length} decks, ${totalSlides} slides total (${sizeMB} MB)`];
  if (failed.length) {
    lines.push(`✗ ${failed.length} failed:`);
    failed.forEach(f => lines.push(`    ${path.relative(PROJECT_DIR, f.input)}: ${f.error}`));
  }
  return lines.join('\n');
}

// ── CLI entry point ──────────────────────────────────────────

function mkProgress(json) {
  if (json) return null;
  return (type, msg) => {
    if (type === 'status') console.log(msg);
    if (type === 'file') { process.stdout.write('\r' + ' '.repeat(80) + '\r'); console.log(msg); }
    if (type === 'slide') process.stdout.write(`\rCapturing slide ${msg}...`);
  };
}

// ── Live modes: preview & serve ─────────────────────────────

function openBrowser(url) {
  const { execSync } = require('child_process');
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start' : 'xdg-open';
  execSync(`${cmd} "${url}"`, { stdio: 'ignore' });
}

async function runPreview(opts) {
  const { input, port, theme, scheme, autoflow } = opts;
  const resolved = path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);
  if (!fs.existsSync(resolved)) throw new CLIError(`File not found: ${input}`);
  const relative = path.relative(PROJECT_DIR, resolved);

  // Start server
  let server = null;
  try { await fetch(`http://127.0.0.1:${port}/viewer.html`); }
  catch {
    server = startServer(port);
    await waitForServer(port);
  }

  // Build URL with optional overrides
  const params = [`file=${encodeURIComponent(relative)}`];
  if (theme) params.push(`theme=${encodeURIComponent(theme)}`);
  if (scheme != null) params.push(`scheme=${scheme}`);
  if (autoflow) params.push('autoflow=true');
  const url = `http://127.0.0.1:${port}/viewer.html?${params.join('&')}`;

  console.log(`Preview: ${url}`);
  console.log('Press Ctrl+C to stop.');
  openBrowser(url);

  // Keep alive until Ctrl+C
  await new Promise((resolve) => {
    process.on('SIGINT', () => {
      if (server) { try { process.kill(-server.pid); } catch {} }
      resolve();
    });
    process.on('SIGTERM', () => {
      if (server) { try { process.kill(-server.pid); } catch {} }
      resolve();
    });
  });
}

async function runServe(opts) {
  const { port } = opts;

  // Start server
  let server = null;
  try { await fetch(`http://127.0.0.1:${port}/viewer.html`); }
  catch {
    server = startServer(port);
    await waitForServer(port);
  }

  const url = `http://127.0.0.1:${port}/viewer.html`;
  console.log(`StellarDeck dev server: ${url}`);
  console.log('Press Ctrl+C to stop.');
  openBrowser(url);

  // Keep alive until Ctrl+C
  await new Promise((resolve) => {
    process.on('SIGINT', () => {
      if (server) { try { process.kill(-server.pid); } catch {} }
      resolve();
    });
    process.on('SIGTERM', () => {
      if (server) { try { process.kill(-server.pid); } catch {} }
      resolve();
    });
  });
}

async function main() {
  let opts;
  try { opts = parseArgs(process.argv); }
  catch (e) {
    if (e instanceof HelpRequested) { process.stdout.write(HELP); process.exit(0); }
    if (e instanceof CLIError) { console.error(`Error: ${e.message}`); process.exit(1); }
    throw e;
  }
  const onProgress = mkProgress(opts.json);

  try {
    // Live modes — no Playwright needed
    if (opts.mode === 'preview') { await runPreview(opts); return; }
    if (opts.mode === 'serve') { await runServe(opts); return; }

    // Introspection modes — no browser, no render
    if (opts.mode === 'list-themes') {
      console.log(JSON.stringify({ ok: true, themes: listThemes() }, null, 2));
      return;
    }
    if (opts.mode === 'list-schemes') {
      console.log(JSON.stringify({ ok: true, ...listSchemes(opts.listSchemesTheme) }, null, 2));
      return;
    }

    // Validation mode — render but skip capture
    if (opts.mode === 'validate') {
      const result = await runValidate(opts, onProgress);
      if (!opts.json) process.stdout.write('\r' + ' '.repeat(40) + '\r');
      console.log(JSON.stringify(result, null, 2));
      if (result.warnings.some(w => w.severity === 'error')) process.exit(1);
      return;
    }

    if (opts.inputDir) {
      const results = await runBatch(opts, onProgress);
      if (!opts.json) process.stdout.write('\r' + ' '.repeat(80) + '\r');
      if (opts.json) {
        console.log(JSON.stringify({
          ok: results.every(r => !r.error),
          mode: 'batch',
          format: opts.format,
          count: results.length,
          results,
        }, null, 2));
      } else {
        console.log(humanBatchSummary(results));
      }
      if (results.some(r => r.error)) process.exit(1);
    } else {
      if (!opts.json) {
        const flags = [
          opts.theme && `theme: ${opts.theme}`,
          opts.scheme != null && `scheme: ${opts.scheme}`,
          opts.autoflow && 'autoflow',
          `scale: ${opts.scale}x`,
          opts.slides && `slides: ${[...opts.slides].sort((a, b) => a - b).join(',')}`,
        ].filter(Boolean).join(', ');
        console.log(`Loading ${opts.input} (${flags})`);
      }
      const result = await run(opts, onProgress);
      if (!opts.json) process.stdout.write('\r' + ' '.repeat(40) + '\r');
      if (opts.json) {
        console.log(JSON.stringify({
          ok: true, format: result.format, output: result.path,
          files: result.files || null, slides: result.slides,
          totalSlides: result.totalSlides, bytes: result.bytes,
          warnings: result.warnings,
        }, null, 2));
      } else {
        if (result.warnings.length) {
          result.warnings.forEach(w => {
            const label = w.slide != null ? `[slide ${w.slide}]` : '[deck]';
            console.warn(`Warning ${label} ${w.type}: ${w.message}`);
          });
        }
        console.log(humanResult(result));
      }
    }
  } catch (err) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: err.message }, null, 2));
    } else {
      process.stdout.write('\n');
      console.error(`Export failed: ${err.message}`);
    }
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  parseSlideRange,
  walkMarkdownFiles,
  buildBatchOutputPath,
  resolveInput,
  captureSlides,
  captureInSession,
  startSession,
  stopSession,
  exportPDF,
  exportPNG,
  exportGrid,
  exportByFormat,
  run,
  runBatch,
  runValidate,
  listThemes,
  listSchemes,
  runPreview,
  runServe,
  openBrowser,
  CLIError,
  HelpRequested,
};
