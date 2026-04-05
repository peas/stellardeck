/**
 * autoflow.js — Convention-over-configuration layout inference for StellarDeck
 *
 * Analyzes raw slide markdown and injects directives the parser already handles.
 * Runs BEFORE the parser pipeline.
 *
 * Architecture: skip checks → rule pipeline (first match wins) → default.
 * Each rule is a { name, detect, guard?, vary? } object in the RULES array.
 * Adding a new rule = adding one object to RULES.
 *
 * Usage:
 *   const result = applyAutoflow(slideLines, slideIndex, options, prevRules);
 *   // result = { rule: string, lines: string[], detail: string }
 */

// ============================================================
// Configuration defaults
// ============================================================

const AUTOFLOW_DEFAULTS = {
  statementMaxWords: 8,
  statementMaxLines: 4,
  dividerMaxWords: 2,
  autoscaleMinLines: 9,
  autoscaleMinWords: 80,
};

// ============================================================
// Line classification helpers
// ============================================================

function isNote(line) { return /^\^/.test(line.trim()); }
function isDirectiveLine(line) { return /^\[\.([a-z-]+)(?::\s*([^\]]*))?\]$/i.test(line.trim()); }
function isHeading(line) { return /^#{1,6}[\s\[]/.test(line.trim()); }
function hasImage(line) { return /!\[[^\]]*\]\([^)]+\)/.test(line); }
function isListItem(line) { return /^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line); }
function isBlockquote(line) { return /^>/.test(line.trim()); }
function isPlainText(line) { return !isHeading(line) && !hasImage(line) && !isListItem(line) && !isBlockquote(line); }

function wordCount(line) { return line.trim().split(/\s+/).filter(Boolean).length; }

function getContentLines(lines) {
  return lines.filter(l => {
    const t = l.trim();
    return t !== '' && !isNote(l) && !isDirectiveLine(l);
  });
}

// ============================================================
// Shared helpers
// ============================================================

/**
 * Parse lines into paragraphs (groups separated by blank lines).
 * Skips notes and directives.
 */
function parseParagraphs(allLines) {
  const paragraphs = [];
  let current = [];
  for (const line of allLines) {
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

/**
 * Check if all lines in a paragraph are plain short text.
 */
function isShortPlainParagraph(para, maxWords, maxLines) {
  if (para.length < 1 || para.length > maxLines) return false;
  return para.every(line => isPlainText(line) && wordCount(line) <= maxWords);
}

/**
 * Count consecutive previous slides with the same rule name.
 */
function consecutiveCount(rule, prevRules) {
  let count = 0;
  for (let i = prevRules.length - 1; i >= 0; i--) {
    if (prevRules[i] === rule) count++;
    else break;
  }
  return count;
}

// ============================================================
// Skip checks — bypass autoflow entirely for these slides
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
  { name: 'explicit', check: hasExplicitLayout, detail: 'has explicit directives' },
  { name: 'code', check: hasCodeFence, detail: 'has code block' },
  { name: 'custom-block', check: hasCustomBlock, detail: 'has :::block layout' },
];

// ============================================================
// Rule detectors — each returns { lines, detail, ...extra } or null
// ============================================================

function detectTitleSlide(contentLines, allLines, _config) {
  const paragraphs = parseParagraphs(allLines);
  if (paragraphs.length < 2) return null;

  const titlePara = paragraphs[0];
  if (titlePara.length > 1) return null;
  const titleLine = titlePara[0];
  if (wordCount(titleLine) > 6 || !isPlainText(titleLine)) return null;

  // Title needs subtitle to be LONGER than the title (otherwise it's a statement, not title+subtitle)
  const titleWords = wordCount(titleLine);
  const subtitleWords = paragraphs.slice(1).flat().reduce((s, l) => s + wordCount(l), 0);
  if (subtitleWords <= titleWords) return null;

  const titleTrimmed = titleLine.trim();
  return {
    lines: ['[.heading-align: center]', ...allLines.map(l =>
      l.trim() === titleTrimmed ? `#[fit] ${titleTrimmed}` : l
    )],
    detail: `title slide, ${paragraphs.length} sections`,
  };
}

function detectDivider(contentLines, allLines, config) {
  if (contentLines.length !== 1) return null;
  const trimmed = contentLines[0].trim();
  if (!isPlainText(contentLines[0]) || wordCount(trimmed) > config.dividerMaxWords) return null;

  const wc = wordCount(trimmed);
  return {
    lines: ['[.heading-align: center]', ...allLines.map(l => l.trim() === trimmed ? `#[fit] ${trimmed}` : l)],
    detail: `${wc} word${wc > 1 ? 's' : ''}`,
  };
}

function detectDiagonal(contentLines, allLines, _config) {
  const paragraphs = parseParagraphs(allLines);
  if (paragraphs.length !== 2) return null;
  if (!paragraphs.every(p => isShortPlainParagraph(p, 10, 3))) return null;

  const hasQuestion = paragraphs.some(p => p.some(l => l.trim().endsWith('?')));
  if (!hasQuestion) return null;

  const p1Set = new Set(paragraphs[0].map(l => l.trim()));
  const p2Set = new Set(paragraphs[1].map(l => l.trim()));
  let firstDone = false, secondDone = false;

  const newLines = allLines.map(l => {
    const t = l.trim();
    if (p1Set.has(t) && !firstDone) {
      p1Set.delete(t); if (p1Set.size === 0) firstDone = true;
      return `#[top-left] ${t}`;
    }
    if (p2Set.has(t) && firstDone && !secondDone) {
      p2Set.delete(t); if (p2Set.size === 0) secondDone = true;
      return `#[bottom-right] ${t}`;
    }
    return l;
  });

  return { lines: newLines, detail: '2 paragraphs, question pattern' };
}

function detectZPattern(contentLines, allLines, _config) {
  const paragraphs = parseParagraphs(allLines);
  if (paragraphs.length !== 4) return null;
  if (!paragraphs.every(p => isShortPlainParagraph(p, 8, 2))) return null;

  const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const paraSets = paragraphs.map(p => new Set(p.map(l => l.trim())));
  let paraIdx = 0;

  const newLines = allLines.map(l => {
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
}

function detectStatement(contentLines, allLines, config) {
  if (contentLines.length < 1 || contentLines.length > config.statementMaxLines) return null;
  if (!contentLines.every(l => isPlainText(l) && wordCount(l) <= config.statementMaxWords)) return null;

  const maxW = Math.max(...contentLines.map(l => wordCount(l)));
  const isShort = contentLines.length <= 2 && maxW <= 5;
  const contentSet = new Set(contentLines.map(l => l.trim()));
  const fitLines = allLines.map(l => {
    const t = l.trim();
    return (contentSet.has(t) && t !== '') ? `#[fit] ${t}` : l;
  });

  const lines = isShort ? ['[.heading-align: center]', ...fitLines] : fitLines;
  return {
    lines,
    detail: `${contentLines.length} lines, max ${maxW} words${isShort ? ', centered' : ''}`,
    isShort,
  };
}

function detectAlternating(contentLines, allLines, _config) {
  const paragraphs = parseParagraphs(allLines);
  if (paragraphs.length < 3) return null;
  // Each paragraph: 1-2 lines of plain short text
  if (!paragraphs.every(p => isShortPlainParagraph(p, 10, 2))) return null;

  return {
    lines: ['[.alternating-colors: true]', ...allLines],
    detail: `${paragraphs.length} paragraphs, alternating accent`,
  };
}

function detectSplit(contentLines, allLines, config, ctx) {
  let bareImageLine = null;
  let textCount = 0;

  for (const line of contentLines) {
    if (hasImage(line)) {
      const mods = line.match(/!\[([^\]]*)\]\(/)?.[1]?.trim();
      if (mods) return null;
      if (bareImageLine) return null;
      bareImageLine = line.trim();
    } else {
      textCount++;
    }
  }

  if (!bareImageLine || textCount === 0) return null;

  const side = ctx.slideIndex % 2 === 0 ? 'right' : 'left';
  return {
    lines: allLines.map(l => l.trim() === bareImageLine ? l.replace('![](', `![${side}](`) : l),
    detail: `image ${side}, ${textCount} text lines`,
  };
}

function detectAutoscale(contentLines, allLines, config) {
  const totalWords = contentLines.reduce((sum, l) => sum + wordCount(l), 0);
  if (contentLines.length < config.autoscaleMinLines && totalWords < config.autoscaleMinWords) return null;

  return {
    lines: [`[.autoscale-lines: ${contentLines.length}]`, '[.autoscale: true]', ...allLines],
    detail: `${contentLines.length} lines, ${totalWords} words`,
  };
}

// ============================================================
// Anti-monotony variations
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
// Rule pipeline — order = precedence, first match wins
// ============================================================

const RULES = [
  {
    name: 'title',
    detect: detectTitleSlide,
    guard: (ctx) => ctx.slideIndex === 0,
  },
  { name: 'divider',   detect: detectDivider,  vary: varyDivider },
  { name: 'diagonal',  detect: detectDiagonal,  vary: varyDiagonal },
  { name: 'z-pattern', detect: detectZPattern },
  { name: 'alternating', detect: detectAlternating },
  { name: 'statement', detect: detectStatement,  vary: varyStatement },
  { name: 'split',     detect: detectSplit },
  { name: 'autoscale', detect: detectAutoscale },
];

// ============================================================
// Main entry point
// ============================================================

/**
 * Apply autoflow rules to a single slide's raw lines.
 *
 * @param {string[]} slideLines - Raw markdown lines for one slide
 * @param {number} slideIndex - 0-based slide index
 * @param {Object} [options] - Override defaults (statementMaxWords, etc.)
 * @param {string[]} [prevRules] - Rules applied to previous slides (for anti-monotony)
 * @returns {{ rule: string, lines: string[], detail: string }}
 */
function applyAutoflow(slideLines, slideIndex, options, prevRules) {
  const config = { ...AUTOFLOW_DEFAULTS, ...(options || {}) };
  const prev = prevRules || [];
  const ctx = { slideIndex, config, prev };

  // Skip checks — bypass pipeline entirely
  for (const skip of SKIP_CHECKS) {
    if (skip.check(slideLines)) {
      return { rule: skip.name, lines: slideLines, detail: skip.detail };
    }
  }

  const contentLines = getContentLines(slideLines);
  if (contentLines.length === 0) {
    return { rule: 'empty', lines: slideLines, detail: 'no content' };
  }

  // Rule pipeline — first match wins
  for (const rule of RULES) {
    if (rule.guard && !rule.guard(ctx)) continue;

    const result = rule.detect(contentLines, slideLines, config, ctx);
    if (!result) continue;

    if (rule.vary) {
      const rep = consecutiveCount(rule.name, prev);
      const varied = rule.vary(result, rep);
      return { rule: rule.name, lines: varied.lines, detail: result.detail + (varied.detail || '') };
    }

    return { rule: rule.name, ...result };
  }

  // Default — no rule matched
  const totalWords = contentLines.reduce((sum, l) => sum + wordCount(l), 0);
  return { rule: 'default', lines: slideLines, detail: `${contentLines.length} lines, ${totalWords} words` };
}

// ============================================================
// Exports (works as CommonJS and browser global)
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    applyAutoflow,
    detectTitleSlide,
    detectDivider,
    detectStatement,
    detectDiagonal,
    detectZPattern,
    detectAlternating,
    detectSplit,
    detectAutoscale,
    hasExplicitLayout,
    getContentLines,
    wordCount,
    parseParagraphs,
    AUTOFLOW_DEFAULTS,
    RULES,
  };
} else if (typeof window !== 'undefined') {
  window.applyAutoflow = applyAutoflow;
}
