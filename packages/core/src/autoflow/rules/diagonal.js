const { isShortPlainParagraph } = require('../lines.js');

// Anti-monotony: every other consecutive diagonal mirrors its corners.
function varyDiagonal(result, rep) {
  if (rep % 2 === 0) return { lines: result.lines, detail: '' };
  const newLines = result.lines.map(l => {
    if (l.includes('#[top-left]')) return l.replace('#[top-left]', '#[top-right]');
    if (l.includes('#[bottom-right]')) return l.replace('#[bottom-right]', '#[bottom-left]');
    return l;
  });
  return { lines: newLines, detail: ', varied → mirrored' };
}

module.exports = {
  name: 'diagonal',
  description: 'Two short paragraphs where at least one ends with "?". Places them at opposing corners (top-left + bottom-right) for dramatic tension. Anti-monotony mirrors corners.',
  example: 'What language are you\nwriting code in?\n\nThe answer has changed.',
  priority: 30,
  skipIfDirective: ['split-image'], // Corner placement needs the whole slide; a split leaves half.
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
