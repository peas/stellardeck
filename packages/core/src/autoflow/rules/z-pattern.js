const { isShortPlainParagraph } = require('../lines.js');

module.exports = {
  name: 'z-pattern',
  description: 'Exactly 4 short paragraphs (≤8 words, ≤2 lines each). Places them at the four corners: top-left, top-right, bottom-left, bottom-right. Uses h1 for short text (≤3 words), h2 for longer.',
  example: 'TXT\n\nMarkdown\n\nYAML\n\nJSONL',
  priority: 40,
  skipIfDirective: ['split-image'], // Corner placement needs the whole slide; a split leaves half.
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
        const level = (t.split(/\s+/).length <= 3) ? '#' : '##';
        return `${level}[${pos}] ${t}`;
      }
      return l;
    });
    return { lines: newLines, detail: '4 paragraphs, Z-pattern' };
  },
};
