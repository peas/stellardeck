// tsup build for @stellardeck/core.
//
// Two <script>-loadable IIFE bundles:
//
//   dist/browser-globals.global.js — the whole engine. Registers
//     window.applyAutoflow / createAutoflowContext / parseDecksetMarkdown /
//     StellarConstants / StellarDiagnostics / StellarPrintMode. Loaded by
//     viewer.html, embed/*.html and the VS Code webview.
//   dist/autoflow.global.js — autoflow alone (window.applyAutoflow +
//     createAutoflowContext). Autoflow is a directory of CommonJS modules
//     now, so it can't be dropped in as a single source file; the docs site
//     publishes this bundle as /engine/stellar-autoflow.js for embedders.
//
// Why no Node/ESM build? The source modules use the dual-export
// idiom (`module.exports = X` AND `window.X = X`), which esbuild's
// CJS-to-ESM wrapper collapses into a single default export — named
// imports like `import { THEMES } from '@stellardeck/core'` would
// silently break. Instead, src/index.js is consumed directly as CJS
// (no build), and src/index.mjs is a hand-written ESM barrel that
// re-exports each named key explicitly.

const { defineConfig } = require('tsup');

const iife = (entry, globalName) => ({
  entry,
  format: ['iife'],
  globalName,
  outDir: 'dist',
  target: 'es2022',
  platform: 'browser',
  sourcemap: false,
  clean: false, // two configs share dist/ and build in parallel
  splitting: false,
  minify: false,
  dts: false,
});

module.exports = defineConfig([
  iife({ 'browser-globals': 'src/browser-globals.js' }, 'StellarCore'),
  iife({ autoflow: 'src/autoflow.js' }, 'StellarAutoflow'),
]);
