#!/usr/bin/env node
/**
 * Build + run the packaged StellarDeck.app so the macOS menu bar shows
 * "StellarDeck" instead of "Electron". Plain `electron .` always shows
 * "Electron" because macOS reads the name from the running binary's
 * Info.plist, and `app.setName()` cannot rewrite it at runtime.
 *
 * Skips the package step if `out/StellarDeck-<platform>-<arch>/...` is
 * newer than the source tree (rough mtime check on electron/, js/, css/,
 * viewer.html, package.json). Pass `--rebuild` to force.
 *
 * Args after `--` are forwarded to the app (deck file paths).
 *
 *   npm run app                       # opens to welcome screen
 *   npm run app -- demo/foo.md        # opens deck
 *   npm run app -- --rebuild deck.md  # force re-package then open
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync, spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PLATFORM = process.platform;
const ARCH = process.arch;
const APP_DIR = path.join(ROOT, 'out', `StellarDeck-${PLATFORM}-${ARCH}`);
const APP_NAME = PLATFORM === 'darwin' ? 'StellarDeck.app' : 'StellarDeck';
const APP_PATH = path.join(APP_DIR, APP_NAME);

const args = process.argv.slice(2);
const rebuildIdx = args.indexOf('--rebuild');
const force = rebuildIdx >= 0;
if (force) args.splice(rebuildIdx, 1);

function appIsFresh() {
  if (!fs.existsSync(APP_PATH)) return false;
  const appMtime = fs.statSync(APP_PATH).mtimeMs;
  const sourceFiles = [
    'electron', 'js', 'css', 'viewer.html', 'preload.js',
    'packages/core/src',
    'slides2.js', 'slides2.css', 'package.json', 'forge.config.js',
  ];
  for (const f of sourceFiles) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      // shallow check — most-recent file in dir
      const newest = Math.max(...fs.readdirSync(p)
        .map(n => fs.statSync(path.join(p, n)).mtimeMs));
      if (newest > appMtime) return false;
    } else if (st.mtimeMs > appMtime) {
      return false;
    }
  }
  return true;
}

function runForgePackage() {
  console.log('› Packaging StellarDeck...');
  const r = spawnSync('npx', ['electron-forge', 'package'], {
    cwd: ROOT, stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

function launch() {
  if (PLATFORM === 'darwin') {
    // `open -n -a foo --args ...` opens a fresh instance and forwards args.
    // Without --args, paths after `-a appPath` are also passed but using
    // --args makes the boundary explicit.
    const cliArgs = ['-n', '-a', APP_PATH];
    if (args.length) cliArgs.push('--args', ...args);
    const child = spawn('open', cliArgs, { stdio: 'inherit' });
    child.on('exit', (code) => process.exit(code ?? 0));
  } else {
    const child = spawn(APP_PATH, args, { stdio: 'inherit' });
    child.on('exit', (code) => process.exit(code ?? 0));
  }
}

if (force || !appIsFresh()) runForgePackage();
else console.log(`✓ ${APP_NAME} up to date — skipping package step`);
launch();
