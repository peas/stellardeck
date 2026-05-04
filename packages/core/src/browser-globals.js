/**
 * browser-globals.js — script-tag entry for @stellardeck/core.
 *
 * Loaded by viewer.html and embed/*.html as a single bundle. Registers the
 * same window.* globals the per-module script tags used to set:
 *
 *   window.applyAutoflow             ← autoflow.js
 *   window.createAutoflowContext     ← autoflow.js
 *   window.parseDecksetMarkdown      ← deckset-parser.js
 *   window.StellarConstants          ← constants.js (CDN, SLIDE, THEMES)
 *   window.StellarDiagnostics        ← diagnostics.js
 *   window.StellarPrintMode          ← print-mode.js
 *
 * Each source module also assigns its own globals when loaded — requiring
 * them here is enough to wire them up. This entry just guarantees order
 * and keeps the bundle in one file.
 */

require('./constants.js');
require('./autoflow.js');
require('./deckset-parser.js');
require('./diagnostics.js');
require('./print-mode.js');
