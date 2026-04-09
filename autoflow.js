/**
 * autoflow.js — Convention-over-configuration layout inference for StellarDeck
 *
 * Analyzes raw slide markdown and injects directives the parser already handles.
 * Runs BEFORE the parser pipeline.
 *
 * ARCHITECTURE (declarative data-as-code):
 *
 *   raw slide → analyzeSlide() → info object
 *                                    ↓
 *                       skip checks (info, ctx) → bypass
 *                                    ↓
 *                       RULES (sorted by priority)
 *                         each: { match(info, ctx), transform(info, ctx), vary?, guard? }
 *                         first match wins
 *                                    ↓
 *                       result { rule, lines, detail }
 *
 *   ctx carries:
 *     - state: mutable across slides (lastBareImageSide, lastSplitSide, ...)
 *     - history: [{slideIndex, ruleApplied, info}, ...]
 *
 *   Adding a rule = adding one object to RULES. No imperative if/else trees.
 *
 * USAGE:
 *   const ctx = createContext(options);
 *   for (let i = 0; i < slides.length; i++) {
 *     const result = applyAutoflow(slides[i], i, options, ctx.history.map(h => h.ruleApplied), ctx);
 *     // result = { rule, lines, detail }
 *   }
 *
 *   For backward compat, applyAutoflow can be called without ctx — a fresh
 *   one is created. State doesn't persist across calls in that case.
 */

// ============================================================
// 1. Configuration defaults
// ============================================================

const AUTOFLOW_DEFAULTS = {
  statementMaxWords: 8,
  statementMaxLines: 4,
  dividerMaxWords: 2,
  autoscaleMinLines: 9,
  autoscaleMinWords: 80,
};

// ============================================================
// 2. Line classification helpers (kept identical for backward compat)
// ============================================================

function isNote(line) { return /^\^/.test(line.trim()); }
function isDirectiveLine(line) { return /^\[\.([a-z-]+)(?::\s*([^\]]*))?\]$/i.test(line.trim()); }
function isHeading(line) { return /^#{1,6}[\s\[]/.test(line.trim()); }
function hasImage(line) { return /!\[[^\]]*\]\([^)]+\)/.test(line); }
function isListItem(line) { return /^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line); }
function isBlockquote(line) { return /^>/.test(line.trim()); }
function isPlainText(line) { return !isHeading(line) && !hasImage(line) && !isListItem(line) && !isBlockquote(line); }

function wordCount(line) { return line.trim().split(/\s+/).filter(Boolean).length; }

/**
 * Remove HTML comments (single- and multi-line). Used by getContentLines and
 * parseParagraphs to ignore documentation comments inside fixture/example decks.
 */
function stripHtmlComments(lines) {
  const out = [];
  let inComment = false;
  for (const l of lines) {
    const t = l.trim();
    if (inComment) {
      if (t.includes('-->')) inComment = false;
      continue;
    }
    if (t.startsWith('<!--')) {
      if (!t.includes('-->')) inComment = true;
      continue;
    }
    out.push(l);
  }
  return out;
}

function getContentLines(lines) {
  return stripHtmlComments(lines).filter(l => {
    const t = l.trim();
    return t !== '' && !isNote(l) && !isDirectiveLine(l);
  });
}

function parseParagraphs(allLines) {
  const paragraphs = [];
  let current = [];
  for (const line of stripHtmlComments(allLines)) {
    if (isNote(line) || isDirectiveLine(line)) continue;
    if (line.trim() === '') {
      if (current.length > 0) { paragraphs.push([...current]); current = []; }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) paragraphs.push(current);
  return paragraphs;
}

function isShortPlainParagraph(para, maxWords, maxLines) {
  if (para.length < 1 || para.length > maxLines) return false;
  return para.every(line => isPlainText(line) && wordCount(line) <= maxWords);
}

function consecutiveCount(rule, prevRules) {
  let count = 0;
  for (let i = prevRules.length - 1; i >= 0; i--) {
    if (prevRules[i] === rule) count++;
    else break;
  }
  return count;
}

// ============================================================
// 3. Image extraction — used by analyzeSlide and bare-image-rotate
// ============================================================

const LAYOUT_MODIFIERS = ['right', 'left', 'inline', 'fit', 'filtered', 'bg', 'qr'];

function findSlideImages(rawLines) {
  const images = [];
  rawLines.forEach((line, lineIndex) => {
    const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const rawMods = m[1] || '';
      const mods = rawMods.split(/[\s,]+/).filter(Boolean).map(s => s.toLowerCase());
      images.push({
        full: m[0],
        src: m[2].trim(),
        modifiers: mods,
        rawMods,
        lineIndex,
      });
    }
  });
  return images;
}

function isBareImage(img) {
  return !img.modifiers.some(m => LAYOUT_MODIFIERS.includes(m));
}

// ============================================================
// 4. analyzeSlide — build a rich info object from raw lines
// ============================================================

/**
 * Build a slide info object that every rule can read.
 * Pure derivation from raw markdown lines.
 *
 * @param {string[]} rawLines
 * @param {number} slideIndex
 * @param {number} totalSlides
 * @param {Object} options — config overrides
 * @returns {Object} slide info
 */
function analyzeSlide(rawLines, slideIndex, totalSlides, options) {
  const config = { ...AUTOFLOW_DEFAULTS, ...(options || {}) };

  // Strip HTML comments ONCE — every downstream analysis sees the cleaned
  // lines so we don't accidentally pick up `![]()` examples or `# heading`
  // mentions inside documentation comments as real content.
  const cleanedLines = stripHtmlComments(rawLines);

  const contentLines = getContentLines(cleanedLines);
  const paragraphs = parseParagraphs(cleanedLines);
  const totalWords = contentLines.reduce((s, l) => s + wordCount(l), 0);
  const images = findSlideImages(cleanedLines);
  const bareImages = images.filter(isBareImage);

  const headingLines = contentLines.filter(isHeading).length;
  const bulletLines = contentLines.filter(isListItem).length;
  const plainLines = contentLines.filter(l => isPlainText(l)).length;

  return {
    // Note: rawLines preserves the original (comments included) so transforms
    // can rewrite within the original line set without dropping doc context.
    rawLines,
    cleanedLines,
    contentLines,
    paragraphs,
    index: slideIndex,
    total: totalSlides || 0,
    totalWords,
    totalNonEmptyLines: contentLines.length,
    images,
    bareImages,
    headingLines,
    bulletLines,
    plainLines,
    config,
  };
}

// ============================================================
// 5. Skip checks — bypass autoflow entirely
// ============================================================

function hasExplicitLayout(lines) {
  for (const line of lines) {
    const t = line.trim();
    if (/^#{1,6}\[fit\]/i.test(t)) return true;
    if (/^#{1,6}\[(top-left|top-right|bottom-left|bottom-right|top|bottom)\]/i.test(t)) return true;
    if (/!\[([^\]]*)\]\(/i.test(t)) {
      const mods = t.match(/!\[([^\]]*)\]\(/)?.[1]?.trim();
      if (mods && /\b(left|right|fit|filtered)\b/i.test(mods)) return true;
    }
    if (/^\[\.autoscale/i.test(t)) return true;
    if (/^\[\.alternating-colors/i.test(t)) return true;
  }
  return false;
}

function hasCodeFence(lines) { return lines.some(l => l.trim().startsWith('```')); }
function hasCustomBlock(lines) { return lines.some(l => /^:::(?:columns|diagram|steps|center|math)/.test(l.trim())); }

const SKIP_CHECKS = [
  { name: 'explicit', match: (info) => hasExplicitLayout(info.rawLines), detail: 'has explicit directives' },
  { name: 'code', match: (info) => hasCodeFence(info.rawLines), detail: 'has code block' },
  { name: 'custom-block', match: (info) => hasCustomBlock(info.rawLines), detail: 'has :::block layout' },
];

// ============================================================
// 6. Anti-monotony variation helpers (kept from old impl)
// ============================================================

function varyDiagonal(result, rep) {
  if (rep % 2 === 0) return { lines: result.lines, detail: '' };
  const newLines = result.lines.map(l => {
    if (l.includes('#[top-left]')) return l.replace('#[top-left]', '#[top-right]');
    if (l.includes('#[bottom-right]')) return l.replace('#[bottom-right]', '#[bottom-left]');
    return l;
  });
  return { lines: newLines, detail: ', varied → mirrored' };
}

function varyDivider(result, rep) {
  if (rep === 0) return { lines: result.lines, detail: '' };
  const cycle = ['left', 'right'];
  const align = cycle[(rep - 1) % cycle.length];
  const newLines = result.lines.map(l =>
    l === '[.heading-align: center]' ? `[.heading-align: ${align}]` : l
  );
  return { lines: newLines, detail: `, varied → ${align}-aligned` };
}

function varyStatement(result, rep) {
  if (rep === 0) return { lines: result.lines, detail: '' };
  const shortCycle = ['left', 'right'];
  const longCycle = ['center', 'right'];
  const cycle = result.isShort ? shortCycle : longCycle;
  const align = cycle[(rep - 1) % cycle.length];
  return {
    lines: [`[.heading-align: ${align}]`, ...result.lines],
    detail: `, varied → ${align}-aligned`,
  };
}

// ============================================================
// 7. RULES — each one is a {name, priority, guard?, match, transform, vary?} object
//    Lower priority number = tried first.
// ============================================================

const titleRule = {
  name: 'title',
  priority: 10,
  guard: (info, ctx) => info.index === 0,
  match(info, ctx) {
    if (info.paragraphs.length < 2) return false;
    const titlePara = info.paragraphs[0];
    if (titlePara.length > 1) return false;
    const titleLine = titlePara[0];
    if (wordCount(titleLine) > 6 || !isPlainText(titleLine)) return false;
    const titleWords = wordCount(titleLine);
    const subtitleWords = info.paragraphs.slice(1).flat().reduce((s, l) => s + wordCount(l), 0);
    if (subtitleWords <= titleWords) return false;
    return true;
  },
  transform(info, ctx) {
    const titleTrimmed = info.paragraphs[0][0].trim();
    return {
      lines: ['[.heading-align: center]', ...info.rawLines.map(l =>
        l.trim() === titleTrimmed ? `#[fit] ${titleTrimmed}` : l
      )],
      detail: `title slide, ${info.paragraphs.length} sections`,
    };
  },
};

const dividerRule = {
  name: 'divider',
  priority: 20,
  match(info, ctx) {
    if (info.contentLines.length !== 1) return false;
    if (!isPlainText(info.contentLines[0])) return false;
    if (wordCount(info.contentLines[0].trim()) > info.config.dividerMaxWords) return false;
    return true;
  },
  transform(info, ctx) {
    const trimmed = info.contentLines[0].trim();
    const wc = wordCount(trimmed);
    return {
      lines: ['[.heading-align: center]', ...info.rawLines.map(l =>
        l.trim() === trimmed ? `#[fit] ${trimmed}` : l
      )],
      detail: `${wc} word${wc > 1 ? 's' : ''}`,
    };
  },
  vary: varyDivider,
};

const diagonalRule = {
  name: 'diagonal',
  priority: 30,
  match(info, ctx) {
    if (info.paragraphs.length !== 2) return false;
    if (!info.paragraphs.every(p => isShortPlainParagraph(p, 10, 3))) return false;
    return info.paragraphs.some(p => p.some(l => l.trim().endsWith('?')));
  },
  transform(info, ctx) {
    const p1Set = new Set(info.paragraphs[0].map(l => l.trim()));
    const p2Set = new Set(info.paragraphs[1].map(l => l.trim()));
    let firstDone = false, secondDone = false;
    const newLines = info.rawLines.map(l => {
      const t = l.trim();
      if (p1Set.has(t) && !firstDone) {
        p1Set.delete(t);
        if (p1Set.size === 0) firstDone = true;
        return `#[top-left] ${t}`;
      }
      if (p2Set.has(t) && firstDone && !secondDone) {
        p2Set.delete(t);
        if (p2Set.size === 0) secondDone = true;
        return `#[bottom-right] ${t}`;
      }
      return l;
    });
    return { lines: newLines, detail: '2 paragraphs, question pattern' };
  },
  vary: varyDiagonal,
};

const zPatternRule = {
  name: 'z-pattern',
  priority: 40,
  match(info, ctx) {
    if (info.paragraphs.length !== 4) return false;
    return info.paragraphs.every(p => isShortPlainParagraph(p, 8, 2));
  },
  transform(info, ctx) {
    const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const paraSets = info.paragraphs.map(p => new Set(p.map(l => l.trim())));
    let paraIdx = 0;
    const newLines = info.rawLines.map(l => {
      const t = l.trim();
      if (paraIdx < 4 && paraSets[paraIdx].has(t)) {
        const pos = positions[paraIdx];
        paraSets[paraIdx].delete(t);
        if (paraSets[paraIdx].size === 0) paraIdx++;
        return `##[${pos}] ${t}`;
      }
      return l;
    });
    return { lines: newLines, detail: '4 paragraphs, Z-pattern' };
  },
};

const alternatingRule = {
  name: 'alternating',
  priority: 50,
  match(info, ctx) {
    if (info.paragraphs.length < 3) return false;
    return info.paragraphs.every(p => isShortPlainParagraph(p, 10, 2));
  },
  transform(info, ctx) {
    return {
      lines: ['[.alternating-colors: true]', ...info.rawLines],
      detail: `${info.paragraphs.length} paragraphs, alternating accent`,
    };
  },
};

const statementRule = {
  name: 'statement',
  priority: 60,
  match(info, ctx) {
    if (info.contentLines.length < 1 || info.contentLines.length > info.config.statementMaxLines) return false;
    return info.contentLines.every(l => isPlainText(l) && wordCount(l) <= info.config.statementMaxWords);
  },
  transform(info, ctx) {
    const maxW = Math.max(...info.contentLines.map(l => wordCount(l)));
    const isShort = info.contentLines.length <= 2 && maxW <= 5;
    const contentSet = new Set(info.contentLines.map(l => l.trim()));
    const fitLines = info.rawLines.map(l => {
      const t = l.trim();
      return (contentSet.has(t) && t !== '') ? `#[fit] ${t}` : l;
    });
    const lines = isShort ? ['[.heading-align: center]', ...fitLines] : fitLines;
    return {
      lines,
      detail: `${info.contentLines.length} lines, max ${maxW} words${isShort ? ', centered' : ''}`,
      isShort,
    };
  },
  vary: varyStatement,
};

/**
 * NEW: bare-image-rotate
 *
 * Replaces the old `split` rule. Whenever a slide has exactly ONE bare image
 * (no right/left/inline/qr/fit/filtered/bg modifier) AND has text alongside,
 * pick a position for the image based on rotation history:
 *
 *   1st bare image in deck → inline  (image in flow, text above)
 *   2nd bare image in deck → left    (split, image left + text right)
 *   3rd bare image in deck → right   (split, image right + text left)
 *   4th → inline, 5th → left, 6th → right, ...
 *
 * State persists in ctx.state.lastBareImageSide across the deck. The state
 * is also updated by `observeImageSides()` whenever the autoflow sees an
 * EXPLICIT layout image (`![left]`, `![right]`, `![inline]`) — even on
 * slides where autoflow itself is skipped — so the rotation never repeats
 * the same side as the previous slide.
 *
 * All three positions are existing parser primitives:
 *   ![inline](src) → centered inline image (deckset-inline-single)
 *   ![left](src)   → split, image left
 *   ![right](src)  → split, image right
 */
const SIDES = ['inline', 'left', 'right'];

const bareImageRotateRule = {
  name: 'bare-image-rotate',
  priority: 70,
  match(info, ctx) {
    if (info.bareImages.length !== 1) return false;
    // Need at least one non-image content line
    const nonImageContent = info.contentLines.filter(l => !hasImage(l));
    return nonImageContent.length > 0;
  },
  transform(info, ctx) {
    const last = ctx.state.lastBareImageSide;
    const lastIdx = SIDES.indexOf(last);
    const next = SIDES[(lastIdx + 1) % SIDES.length];
    ctx.state.lastBareImageSide = next;

    const img = info.bareImages[0];
    const newImgMd = `![${next}](${img.src})`;
    return {
      lines: info.rawLines.map(l => l.includes(img.full) ? l.replace(img.full, newImgMd) : l),
      detail: `bare image → ${next}`,
    };
  },
};

/**
 * Observe explicit layout-positioned images on a slide and update the
 * rotation state accordingly. Runs on EVERY slide (including skipped ones)
 * so that a manually-placed `![left]` or `![right]` is treated as if the
 * rotation had picked it — preventing two consecutive slides from landing
 * on the same side when one is bare and the other is explicit.
 *
 * Order matters: a single slide with multiple images updates state to the
 * LAST one seen (so the next slide sees the most recent commitment).
 *
 * Modifiers checked: left, right, inline. Other modifiers (fit, filtered,
 * bg, qr) don't affect bare-image rotation.
 */
function observeImageSides(info, ctx) {
  for (const img of info.images) {
    if (img.modifiers.includes('left')) ctx.state.lastBareImageSide = 'left';
    else if (img.modifiers.includes('right')) ctx.state.lastBareImageSide = 'right';
    else if (img.modifiers.includes('inline')) ctx.state.lastBareImageSide = 'inline';
  }
}

const autoscaleRule = {
  name: 'autoscale',
  priority: 80,
  match(info, ctx) {
    return info.contentLines.length >= info.config.autoscaleMinLines ||
           info.totalWords >= info.config.autoscaleMinWords;
  },
  transform(info, ctx) {
    return {
      lines: [`[.autoscale-lines: ${info.contentLines.length}]`, '[.autoscale: true]', ...info.rawLines],
      detail: `${info.contentLines.length} lines, ${info.totalWords} words`,
    };
  },
};

const RULES = [
  titleRule,
  dividerRule,
  diagonalRule,
  zPatternRule,
  alternatingRule,
  statementRule,
  bareImageRotateRule,
  autoscaleRule,
];

const RULES_BY_PRIORITY = [...RULES].sort((a, b) => a.priority - b.priority);

// ============================================================
// 8. Engine — context + main entry point
// ============================================================

/**
 * Create a fresh autoflow context. Pass this to applyAutoflow across slides
 * of the same deck so cross-slide state (lastBareImageSide, etc) persists.
 */
function createContext(options) {
  return {
    state: {
      lastBareImageSide: null,
      lastSplitSide: null,
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

  // Observe explicit image sides on EVERY slide (even ones we'll skip)
  // so cross-slide rotation state stays accurate when the user mixes
  // bare ![](src) and explicit ![left]/![right]/![inline] images.
  observeImageSides(info, usedCtx);

  // Skip checks — bypass pipeline entirely
  for (const skip of SKIP_CHECKS) {
    if (skip.match(info)) {
      usedCtx.history.push({ slideIndex, ruleApplied: skip.name, info });
      return { rule: skip.name, lines: slideLines, detail: skip.detail };
    }
  }

  if (info.contentLines.length === 0) {
    usedCtx.history.push({ slideIndex, ruleApplied: 'empty', info });
    return { rule: 'empty', lines: slideLines, detail: 'no content' };
  }

  // Rule pipeline — first match wins
  for (const rule of RULES_BY_PRIORITY) {
    if (rule.guard && !rule.guard(info, usedCtx)) continue;
    if (!rule.match(info, usedCtx)) continue;

    let result = rule.transform(info, usedCtx);

    if (rule.vary) {
      const rep = consecutiveCount(rule.name, prev);
      const varied = rule.vary(result, rep, usedCtx);
      result = {
        ...result,
        lines: varied.lines,
        detail: result.detail + (varied.detail || ''),
      };
    }

    usedCtx.history.push({ slideIndex, ruleApplied: rule.name, info });
    return { rule: rule.name, ...result };
  }

  // Default — no rule matched
  usedCtx.history.push({ slideIndex, ruleApplied: 'default', info });
  return {
    rule: 'default',
    lines: slideLines,
    detail: `${info.contentLines.length} lines, ${info.totalWords} words`,
  };
}

// ============================================================
// 9. Legacy adapters — backward compat for tests that import detect* directly
// ============================================================

function makeLegacyInfo(contentLines, allLines, config, slideIndex) {
  return analyzeSlide(allLines, slideIndex || 0, 0, config);
}

function detectTitleSlide(contentLines, allLines, config) {
  const info = makeLegacyInfo(contentLines, allLines, config, 0);
  const ctx = createContext(config);
  if (titleRule.guard && !titleRule.guard(info, ctx)) return null;
  if (!titleRule.match(info, ctx)) return null;
  return titleRule.transform(info, ctx);
}

function detectDivider(contentLines, allLines, config) {
  const info = makeLegacyInfo(contentLines, allLines, config);
  const ctx = createContext(config);
  if (!dividerRule.match(info, ctx)) return null;
  return dividerRule.transform(info, ctx);
}

function detectStatement(contentLines, allLines, config) {
  const info = makeLegacyInfo(contentLines, allLines, config);
  const ctx = createContext(config);
  if (!statementRule.match(info, ctx)) return null;
  return statementRule.transform(info, ctx);
}

function detectDiagonal(contentLines, allLines, config) {
  const info = makeLegacyInfo(contentLines, allLines, config);
  const ctx = createContext(config);
  if (!diagonalRule.match(info, ctx)) return null;
  return diagonalRule.transform(info, ctx);
}

function detectZPattern(contentLines, allLines, config) {
  const info = makeLegacyInfo(contentLines, allLines, config);
  const ctx = createContext(config);
  if (!zPatternRule.match(info, ctx)) return null;
  return zPatternRule.transform(info, ctx);
}

function detectAlternating(contentLines, allLines, config) {
  const info = makeLegacyInfo(contentLines, allLines, config);
  const ctx = createContext(config);
  if (!alternatingRule.match(info, ctx)) return null;
  return alternatingRule.transform(info, ctx);
}

// detectSplit is gone — replaced by bare-image-rotate. Provide an adapter
// that calls bareImageRotateRule against a fresh ctx so the rule still
// reachable for tests that import it directly. The output side will always
// be 'center' on a fresh ctx (rotation index 0).
function detectSplit(contentLines, allLines, config) {
  const info = makeLegacyInfo(contentLines, allLines, config);
  const ctx = createContext(config);
  if (!bareImageRotateRule.match(info, ctx)) return null;
  return bareImageRotateRule.transform(info, ctx);
}

function detectAutoscale(contentLines, allLines, config) {
  const info = makeLegacyInfo(contentLines, allLines, config);
  const ctx = createContext(config);
  if (!autoscaleRule.match(info, ctx)) return null;
  return autoscaleRule.transform(info, ctx);
}

// ============================================================
// 10. Exports (CommonJS + browser global)
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Main entry
    applyAutoflow,
    createContext,
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
    SIDES,
    RULES,

    // Rule objects (for tests + introspection)
    titleRule,
    dividerRule,
    diagonalRule,
    zPatternRule,
    alternatingRule,
    statementRule,
    bareImageRotateRule,
    autoscaleRule,
  };
} else if (typeof window !== 'undefined') {
  window.applyAutoflow = applyAutoflow;
  window.createAutoflowContext = createContext;
}
