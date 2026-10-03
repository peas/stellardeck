/**
 * Autoflow engine — runs one slide through the declarative pipeline:
 *
 *   raw lines → analyzeSlide() → info
 *     1. observers      every rule's observe(info, ctx), on EVERY slide
 *     2. skip checks    first match → slide returned untouched
 *     3. empty          no content → untouched
 *     4. preprocessors  rewrite info, keep going
 *     5. rules          by priority; guard → match → transform → vary; first wins
 *     6. default        nothing matched → untouched
 *
 * ctx carries what crosses slides: `state` (mutable, e.g. lastBareImagePosition)
 * and `history` ([{slideIndex, ruleApplied, info}]).
 */
const { analyzeSlide } = require('./analyze.js');
const { consecutiveCount } = require('./lines.js');
const { SKIP_CHECKS } = require('./skip-checks.js');
const PREPROCESSORS = require('./preprocessors.js');
const RULES = require('./rules/index.js');

const RULES_BY_PRIORITY = [...RULES].sort((a, b) => a.priority - b.priority);
const OBSERVERS = RULES.filter(r => r.observe);

/**
 * Create a fresh autoflow context. Pass this to applyAutoflow across slides
 * of the same deck so cross-slide state (lastBareImagePosition, etc) persists.
 */
function createContext(options) {
  return {
    state: {
      lastBareImagePosition: null,
      lastSplitSide: null,
      lastPhraseBulletsLayout: null,
    },
    history: [],          // [{slideIndex, ruleApplied, info}, ...]
    options: options || {},
  };
}

/**
 * Apply autoflow rules to a single slide's raw lines.
 *
 * @param {string[]} slideLines - Raw markdown lines for one slide
 * @param {number} slideIndex - 0-based slide index
 * @param {Object} [options] - Override defaults
 * @param {string[]} [prevRules] - Names of rules applied to previous slides
 * @param {Object} [ctx] - Persistent context across slides; created fresh if omitted
 * @returns {{ rule: string, lines: string[], detail: string }}
 */
function applyAutoflow(slideLines, slideIndex, options, prevRules, ctx) {
  const usedCtx = ctx || createContext(options);
  const prev = prevRules || usedCtx.history.map(h => h.ruleApplied);
  const info = analyzeSlide(slideLines, slideIndex, 0, options);
  const done = (rule, result) => {
    usedCtx.history.push({ slideIndex, ruleApplied: rule, info });
    return { rule, ...result };
  };

  for (const rule of OBSERVERS) rule.observe(info, usedCtx);

  for (const skip of SKIP_CHECKS) {
    if (skip.match(info)) return done(skip.name, { lines: slideLines, detail: skip.detail });
  }

  if (info.contentLines.length === 0) return done('empty', { lines: slideLines, detail: 'no content' });

  for (const pre of PREPROCESSORS) {
    if (pre.match(info, usedCtx)) pre.apply(info, usedCtx);
  }

  for (const rule of RULES_BY_PRIORITY) {
    if (rule.guard && !rule.guard(info, usedCtx)) continue;
    if (!rule.match(info, usedCtx)) continue;

    let result = rule.transform(info, usedCtx);
    if (rule.vary) {
      const varied = rule.vary(result, consecutiveCount(rule.name, prev), usedCtx);
      result = { ...result, lines: varied.lines, detail: result.detail + (varied.detail || '') };
    }
    return done(rule.name, result);
  }

  return done('default', {
    lines: info.rawLines,
    detail: `${info.contentLines.length} lines, ${info.totalWords} words`,
  });
}

module.exports = { createContext, applyAutoflow, RULES, RULES_BY_PRIORITY, PREPROCESSORS, SKIP_CHECKS };
