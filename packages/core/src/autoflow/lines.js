/**
 * Line classification helpers shared by the analyzer, skip checks and rules.
 * Pure string functions — no slide state.
 */

function isNote(line) { return /^\^/.test(line.trim()); }
function isDirectiveLine(line) { return /^\[\.([a-z-]+)(?::\s*([^\]]*))?\]$/i.test(line.trim()); }
// Deckset (and the parser) don't require a space: `#Title` is a heading.
function isHeading(line) { return /^#{1,6}\s*\S/.test(line.trim()); }
function hasImage(line) { return /!\[[^\]]*\]\([^)]+\)/.test(line); }
function isListItem(line) { return /^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line); }
function isBlockquote(line) { return /^>/.test(line.trim()); }
function isPlainText(line) { return !isHeading(line) && !hasImage(line) && !isListItem(line) && !isBlockquote(line); }

// Count actual words. Pure-symbol tokens like → / | + & · are separators
// (not "words"), so "Servidor próprio → AWS / OCI / Azure / GCP" counts as
// 7 words, not 11. Without this filter, decks that use arrow- or slash-
// separated lists hit statement-rule cliffs every time the user adds one
// item — autoflow silently falls through to plain rendering.
function wordCount(line) {
  return line
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter(t => /[\p{L}\p{N}]/u.test(t))
    .length;
}

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

/** How many of the most recent slides in a row used `rule` (anti-monotony). */
function consecutiveCount(rule, prevRules) {
  let count = 0;
  for (let i = prevRules.length - 1; i >= 0; i--) {
    if (prevRules[i] === rule) count++;
    else break;
  }
  return count;
}

module.exports = {
  isNote,
  isDirectiveLine,
  isHeading,
  hasImage,
  isListItem,
  isBlockquote,
  isPlainText,
  wordCount,
  stripHtmlComments,
  getContentLines,
  parseParagraphs,
  isShortPlainParagraph,
  consecutiveCount,
};
