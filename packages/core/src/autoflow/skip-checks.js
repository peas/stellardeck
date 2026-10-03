/**
 * Skip checks — slides autoflow leaves untouched. First match wins and the
 * slide goes out exactly as written.
 */

const { hasImage } = require('./lines.js');

// The user laid out the TEXT (fit, positions, autoscale, alternating colors).
function hasExplicitTextLayout(lines) {
  for (const line of lines) {
    const t = line.trim();
    if (/^#{1,6}\[fit\]/i.test(t)) return true;
    if (/^#{1,6}\[(top-left|top-right|bottom-left|bottom-right|top|bottom)\]/i.test(t)) return true;
    if (/^\[\.autoscale/i.test(t)) return true;
    if (/^\[\.alternating-colors/i.test(t)) return true;
  }
  return false;
}

// The user placed an IMAGE (left/right split, fit/filtered background).
function hasExplicitImage(lines) {
  return lines.some(line => {
    const mods = line.trim().match(/!\[([^\]]*)\]\(/)?.[1]?.trim();
    return !!mods && /\b(left|right|fit|filtered)\b/i.test(mods);
  });
}

function hasExplicitLayout(lines) {
  return hasExplicitTextLayout(lines) || hasExplicitImage(lines);
}

/**
 * An explicit image is about the image, not an opt-out of layout inference:
 * when it's a split or a background and there's text beside it, the
 * `explicit-image` preprocessor sets the image aside and text rules still
 * run. Any other explicit-image slide is left as written.
 */
function explicitImageBlocksAutoflow(info) {
  if (!hasExplicitImage(info.rawLines)) return false;
  const layout = info.explicitImageLayout;
  if (layout !== 'split' && layout !== 'background') return true;
  return !info.contentLines.some(l => !hasImage(l));
}

function hasCodeFence(lines) { return lines.some(l => l.trim().startsWith('```')); }
function hasCustomBlock(lines) { return lines.some(l => /^:::(?:columns|diagram|steps|center|math)/.test(l.trim())); }

const SKIP_CHECKS = [
  { name: 'explicit',
    description: 'Slide has user-authored text layout: `#[fit]`, `#[top-left]`/`#[bottom-right]`/etc., `[.autoscale: true]`, or `[.alternating-colors: true]`. Also an explicit image (`![left]`/`![right]`/`![fit]`/`![filtered]`) with no text beside it, or one autoflow can\'t lay text around (several images, a background image mid-slide). An explicit split or background image WITH text is not skipped: the image stays as written and the text still gets autoflow.',
    match: (info) => hasExplicitTextLayout(info.rawLines) || explicitImageBlocksAutoflow(info),
    detail: 'has explicit directives' },
  { name: 'code',
    description: 'Slide contains a fenced code block (`` ``` ``). Code blocks have fixed formatting that autoflow should not alter.',
    match: (info) => hasCodeFence(info.rawLines), detail: 'has code block' },
  { name: 'custom-block',
    description: 'Slide uses a block directive: `:::columns`, `:::diagram`, `:::steps`, `:::center`, or `:::math`. These are custom layouts that autoflow should not override.',
    match: (info) => hasCustomBlock(info.rawLines), detail: 'has :::block layout' },
];

module.exports = { SKIP_CHECKS, hasExplicitLayout, hasExplicitTextLayout, hasExplicitImage, hasCodeFence, hasCustomBlock };
