/**
 * slide-lines.js — pure helper, no vscode dependency.
 *
 * Maps a slide index (0-based) to the line number where that slide starts
 * in the source markdown. Slides are separated by `---` lines outside
 * fenced code blocks. The first slide starts at line 0; subsequent slides
 * start at the line AFTER each `---` separator.
 *
 * Used by the extension host to translate engine warnings (which carry a
 * `slide` index) into vscode.Range positions for the Problems panel.
 */

function computeSlideStartLines(text) {
  if (typeof text !== 'string' || text.length === 0) return [0];
  const lines = text.split('\n');
  const starts = [0];
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trimStart();
    if (t.startsWith('```')) inCode = !inCode;
    if (!inCode && /^---[ \t]*$/.test(lines[i])) {
      if (i + 1 < lines.length) starts.push(i + 1);
    }
  }
  return starts;
}

module.exports = { computeSlideStartLines };
