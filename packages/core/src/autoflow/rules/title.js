const { wordCount, isPlainText } = require('../lines.js');

module.exports = {
  name: 'title',
  description: 'First slide with a short title (≤6 words) followed by longer subtitle text. Centers and applies #[fit] to the title line.',
  example: 'The Art of Balancing\n\nA journey from wall handstands\nto freestanding practice.',
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
