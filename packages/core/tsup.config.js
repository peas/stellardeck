// tsup build for @stellardeck/core.
//
// Single entry: a single <script>-loadable bundle that registers
// window.applyAutoflow / parseDecksetMarkdown / StellarConstants /
// StellarDiagnostics / StellarPrintMode (plus createAutoflowContext).
// Used by viewer.html and embed/* in step 5 to drop the per-module
// script tags.
//
// Why no Node/ESM build? The source modules use the dual-export
// idiom (`module.exports = X` AND `window.X = X`), which esbuild's
// CJS-to-ESM wrapper collapses into a single default export — named
// imports like `import { THEMES } from '@stellardeck/core'` would
// silently break. Instead, src/index.js is consumed directly as CJS
// (no build), and src/index.mjs is a hand-written ESM barrel that
// re-exports each named key explicitly.
//
// Source files are plain JS using IIFE + conditional CommonJS exports.
// esbuild treats them as CommonJS; bundling via the IIFE format
// preserves the side-effect of assigning each module's API to window.

const { defineConfig } = require('tsup');

module.exports = defineConfig({
  entry: { 'browser-globals': 'src/browser-globals.js' },
  format: ['iife'],
  globalName: 'StellarCore',
  outDir: 'dist',
  target: 'es2022',
  platform: 'browser',
  sourcemap: false,
  clean: true,
  splitting: false,
  minify: false,
  dts: false,
});
