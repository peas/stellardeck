/**
 * autoflow.js — Convention-over-configuration layout inference for StellarDeck
 *
 * Analyzes raw slide markdown and injects directives the parser already
 * handles. Runs BEFORE the parser pipeline.
 *
 * This file is the stable entry point (`@stellardeck/core/autoflow`, the
 * browser bundle, the parser's require fallback). The engine is declarative
 * and lives in ./autoflow/:
 *
 *   lines.js          line classification helpers (wordCount, isPlainText, …)
 *   analyze.js        analyzeSlide() → info object; AUTOFLOW_DEFAULTS
 *   skip-checks.js    slides autoflow leaves alone (explicit, code, :::blocks)
 *   preprocessors.js  rewrites that keep the pipeline going (bare image → bg)
 *   rules/<name>.js   one rule per file: {name, priority, match, transform, …}
 *   rules/index.js    the rule list
 *   engine.js         createContext() + applyAutoflow(): the pipeline
 *
 * Adding a rule = one file in rules/ + one line in rules/index.js.
 *
 * USAGE:
 *   const ctx = createContext(options);
 *   for (let i = 0; i < slides.length; i++) {
 *     const result = applyAutoflow(slides[i], i, options, undefined, ctx);
 *     // result = { rule, lines, detail }
 *   }
 *
 *   applyAutoflow can be called without ctx — a fresh one is created, so
 *   state doesn't persist across calls in that case.
 */

const engine = require('./autoflow/engine.js');
const { AUTOFLOW_DEFAULTS, LAYOUT_MODIFIERS, analyzeSlide, findSlideImages, isBareImage } = require('./autoflow/analyze.js');
const { wordCount, getContentLines, parseParagraphs } = require('./autoflow/lines.js');
const { SKIP_CHECKS, hasExplicitLayout } = require('./autoflow/skip-checks.js');
const RULES = require('./autoflow/rules/index.js');

const ruleNamed = name => RULES.find(r => r.name === name);
const titleRule = ruleNamed('title');
const dividerRule = ruleNamed('divider');
const diagonalRule = ruleNamed('diagonal');
const zPatternRule = ruleNamed('z-pattern');
const alternatingRule = ruleNamed('alternating');
const statementRule = ruleNamed('statement');
const bareImagePositionVariationRule = ruleNamed('bare-image-position-variation');
const phraseBulletsRule = ruleNamed('phrase-bullets');
const autoscaleRule = ruleNamed('autoscale');

// ============================================================
// Legacy adapters — tests that call one rule in isolation on a fresh ctx
// (slide index 0). Return the rule's transform result, or null.
// ============================================================

function legacyDetect(rule) {
  return (contentLines, allLines, config) => {
    const info = analyzeSlide(allLines, 0, 0, config);
    const ctx = engine.createContext(config);
    if (rule.guard && !rule.guard(info, ctx)) return null;
    if (!rule.match(info, ctx)) return null;
    return rule.transform(info, ctx);
  };
}

const detectTitleSlide = legacyDetect(titleRule);
const detectDivider = legacyDetect(dividerRule);
const detectStatement = legacyDetect(statementRule);
const detectDiagonal = legacyDetect(diagonalRule);
const detectZPattern = legacyDetect(zPatternRule);
const detectAlternating = legacyDetect(alternatingRule);
// detectSplit predates bare-image-position-variation; on a fresh ctx the
// position is always the first one ('inline').
const detectSplit = legacyDetect(bareImagePositionVariationRule);
const detectAutoscale = legacyDetect(autoscaleRule);

module.exports = {
  // Main entry
  applyAutoflow: engine.applyAutoflow,
  createContext: engine.createContext,
  analyzeSlide,

  // Legacy adapters (backward compat)
  detectTitleSlide,
  detectDivider,
  detectStatement,
  detectDiagonal,
  detectZPattern,
  detectAlternating,
  detectSplit,
  detectAutoscale,

  // Helpers
  hasExplicitLayout,
  getContentLines,
  wordCount,
  parseParagraphs,
  findSlideImages,
  isBareImage,

  // Constants
  AUTOFLOW_DEFAULTS,
  LAYOUT_MODIFIERS,
  POSITIONS: bareImagePositionVariationRule.POSITIONS,
  RULES,
  SKIP_CHECKS,
  PREPROCESSORS: engine.PREPROCESSORS,

  // Rule objects (for tests + introspection)
  titleRule,
  dividerRule,
  diagonalRule,
  zPatternRule,
  alternatingRule,
  statementRule,
  bareImagePositionVariationRule,
  phraseBulletsRule,
  autoscaleRule,
};

if (typeof window !== 'undefined') {
  window.applyAutoflow = engine.applyAutoflow;
  window.createAutoflowContext = engine.createContext;
}
