const { isShortPlainParagraph } = require('../lines.js');

module.exports = {
  name: 'alternating',
  description: '3+ short paragraphs (≤10 words, ≤2 lines each). Applies alternating accent colors for visual rhythm.',
  example: 'Speed\n\nCost\n\nBarrier to entry\n\nDisposable software',
  priority: 50,
  skipIfDirective: ['split-image'], // The split renderer doesn't apply alternating colors.
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
