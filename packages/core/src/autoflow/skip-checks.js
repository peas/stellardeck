/**
 * Skip checks — slides autoflow leaves untouched. First match wins and the
 * slide goes out exactly as written.
 */

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
  { name: 'explicit',
    description: 'Slide has user-authored layout directives: `#[fit]`, `#[top-left]`/`#[bottom-right]`/etc., `![left]`/`![right]`/`![fit]`/`![filtered]`, `[.autoscale: true]`, or `[.alternating-colors: true]`. Autoflow respects explicit intent.',
    match: (info) => hasExplicitLayout(info.rawLines), detail: 'has explicit directives' },
  { name: 'code',
    description: 'Slide contains a fenced code block (`` ``` ``). Code blocks have fixed formatting that autoflow should not alter.',
    match: (info) => hasCodeFence(info.rawLines), detail: 'has code block' },
  { name: 'custom-block',
    description: 'Slide uses a block directive: `:::columns`, `:::diagram`, `:::steps`, `:::center`, or `:::math`. These are custom layouts that autoflow should not override.',
    match: (info) => hasCustomBlock(info.rawLines), detail: 'has :::block layout' },
];

module.exports = { SKIP_CHECKS, hasExplicitLayout, hasCodeFence, hasCustomBlock };
