/**
 * @stellardeck/core — public API barrel.
 *
 * Re-exports the engine surface that hosts (Electron app, browser viewer,
 * embed, CLI, future VS Code extension) consume. Pure-JS, no DOM, no
 * Node-only modules — runs in Node 20+, browsers, and Web Workers.
 *
 * The DOM-bound entry points (rendering, fitText, print mode) live alongside
 * but are intentionally NOT loaded here at the top level — import them
 * directly via `@stellardeck/core/print-mode` if you have a window.
 */

const autoflow = require('./autoflow.js');
const parser = require('./deckset-parser.js');
const diagnostics = require('./diagnostics.js');
const constants = require('./constants.js');

module.exports = {
  // Autoflow
  applyAutoflow: autoflow.applyAutoflow,
  createAutoflowContext: autoflow.createContext,
  AUTOFLOW_DEFAULTS: autoflow.AUTOFLOW_DEFAULTS,
  RULES: autoflow.RULES,
  SKIP_CHECKS: autoflow.SKIP_CHECKS,
  LAYOUT_MODIFIERS: autoflow.LAYOUT_MODIFIERS,
  POSITIONS: autoflow.POSITIONS,

  // Parser
  parseDecksetMarkdown: parser.parseDecksetMarkdown,
  parseSlide: parser.parseSlide,
  findMedia: parser.findMedia,
  isMediaOnly: parser.isMediaOnly,
  isVideo: parser.isVideo,
  isAudio: parser.isAudio,
  parseYouTube: parser.parseYouTube,
  extractDirectives: parser.extractDirectives,
  extractNotes: parser.extractNotes,
  DIRECTIVE_REGISTRY: parser.DIRECTIVE_REGISTRY,
  FRONTMATTER_NAMES: parser.FRONTMATTER_NAMES,
  isFrontmatterLine: parser.isFrontmatterLine,
  sectionAttrsFromDirectives: parser.sectionAttrsFromDirectives,

  // Diagnostics (DOM-pure parts: merge, groupWarnings)
  mergeDiagnostics: diagnostics.merge,
  groupDiagnostics: diagnostics.groupWarnings,

  // Constants
  CDN: constants.CDN,
  SLIDE: constants.SLIDE,
  THEMES: constants.THEMES,
};
