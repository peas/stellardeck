const { wordCount, isPlainText } = require('../lines.js');

// Anti-monotony: back-to-back dividers swing left/right instead of all centered.
function varyDivider(result, rep) {
  if (rep === 0) return { lines: result.lines, detail: '' };
  const cycle = ['left', 'right'];
  const align = cycle[(rep - 1) % cycle.length];
  const newLines = result.lines.map(l =>
    l === '[.heading-align: center]' ? `[.heading-align: ${align}]` : l
  );
  return { lines: newLines, detail: `, varied → ${align}-aligned` };
}

module.exports = {
  name: 'divider',
  description: 'Single line of plain text (≤2 words). Becomes a full-screen #[fit] heading. Great for section breaks.',
  example: 'BUILDERS',
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
