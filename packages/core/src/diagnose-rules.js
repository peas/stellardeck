/**
 * diagnose-rules.js — pure deck-health rules.
 *
 * Each rule is a pure function: takes a {SlideSnapshot} (a plain serializable
 * object collected from the DOM by the renderer) and returns an array of
 * Diagnostic warnings. No `document`, no `window`, no `getBoundingClientRect`.
 *
 * Why split: the legacy `diagnoseSlide` in `diagnostics.js` is DOM-bound
 * because some rules (overflow, text-too-small) genuinely need pixel
 * measurements. The rules in this file work off attributes / text and
 * are testable in plain Node — which is what `test/diagnose-rules.test.js`
 * exercises.
 *
 * SlideSnapshot shape:
 *   {
 *     slideIndex: number,
 *     attrs: { autoflowTier?: string, autoflowDetail?: string },
 *     visibleText: string,        // section.textContent minus speaker notes
 *     hasBgImage: boolean,
 *     hasBgVideo: boolean,
 *     hasBgColor: boolean,
 *     hasBgBroken: boolean,
 *     hasInlineImg: boolean,
 *     codeBlocks: Array<{ hasLanguage: boolean, contentLength: number }>,
 *   }
 */
(function () {
  'use strict';

  const DENSE_WORD_COUNT = 120;
  const SHORT_CODE_BLOCK_CHARS = 20;

  function statementDegradedRule(snap) {
    const tier = snap.attrs && snap.attrs.autoflowTier;
    if (tier !== '3') return [];
    const detail = (snap.attrs && snap.attrs.autoflowDetail) || '';
    return [{
      type: 'statement-degraded',
      severity: 'info',
      slide: snap.slideIndex,
      detail,
      message: `slide rendered as a dense statement (${detail}) — split for stronger impact`,
    }];
  }

  function densitySlideRule(snap) {
    const text = (snap.visibleText || '').trim();
    if (!text) return [];
    const wordCount = text.split(/\s+/).length;
    if (wordCount <= DENSE_WORD_COUNT) return [];
    return [{
      type: 'slide-too-dense',
      severity: 'warn',
      slide: snap.slideIndex,
      wordCount,
      message: `slide has ${wordCount} words (> ${DENSE_WORD_COUNT}) — consider splitting`,
    }];
  }

  function emptySlideRule(snap) {
    const text = (snap.visibleText || '').trim();
    const hasBg = !!(snap.hasBgImage || snap.hasBgVideo || snap.hasBgColor || snap.hasBgBroken);
    if (text || hasBg || snap.hasInlineImg) return [];
    return [{
      type: 'empty-slide',
      severity: 'warn',
      slide: snap.slideIndex,
      message: 'slide has no visible content',
    }];
  }

  function codeNoLangRule(snap) {
    const blocks = snap.codeBlocks || [];
    for (const b of blocks) {
      if (!b.hasLanguage && b.contentLength > SHORT_CODE_BLOCK_CHARS) {
        return [{
          type: 'code-no-lang',
          severity: 'info',
          slide: snap.slideIndex,
          message: 'code block has no language — add ```js, ```py, etc. for syntax highlighting',
        }];
      }
    }
    return [];
  }

  /**
   * Run every pure rule against a snapshot, returning the concatenated
   * warnings. Order matches the rule list — keep stable for snapshot tests.
   */
  function runPureRules(snap) {
    return [
      ...statementDegradedRule(snap),
      ...densitySlideRule(snap),
      ...emptySlideRule(snap),
      ...codeNoLangRule(snap),
    ];
  }

  const API = {
    runPureRules,
    statementDegradedRule,
    densitySlideRule,
    emptySlideRule,
    codeNoLangRule,
    DENSE_WORD_COUNT,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.StellarDiagnoseRules = API;
})();
