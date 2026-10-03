const { wordCount, isPlainText } = require('../lines.js');

// Anti-monotony: consecutive statements change alignment. Short (tier 1)
// statements start centered, so they swing left/right; longer ones swing
// center/right.
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

module.exports = {
  name: 'statement',
  description: 'Short plain-text slides — 1-4 lines, up to 15 words/line. Three tiers prevent the "cliff" where adding one word silently breaks the layout: T1 (≤2 lines, ≤5 words) renders centered + #[fit]; T2 (≤8 words/line) renders #[fit]; T3 (9-15 words/line) drops #[fit] and uses [.autoscale: true] so the whole slide scales as a block instead of each line shrinking independently.',
  example: 'You are not paid\nto write code.',
  priority: 60,
  match(info, ctx) {
    if (info.contentLines.length < 1 || info.contentLines.length > info.config.statementMaxLines) return false;
    if (!info.contentLines.every(l => isPlainText(l))) return false;
    const maxW = Math.max(...info.contentLines.map(l => wordCount(l)));
    return maxW <= info.config.statementDenseMaxWords;
  },
  transform(info, ctx) {
    const maxW = Math.max(...info.contentLines.map(l => wordCount(l)));
    const numLines = info.contentLines.length;
    // Tier 1: short impact (≤2 lines, ≤5 words/line). Centered + fit.
    const tier1 = numLines <= 2 && maxW <= 5;
    // Tier 2: standard statement (≤8 words/line). Plain fit per line.
    const tier2 = !tier1 && maxW <= info.config.statementMaxWords;
    // Tier 3: dense statement (9-15 words/line). #[fit] would scale each
    // line independently and produce inconsistent sizes; instead, render
    // as plain h1 lines and let [.autoscale: true] shrink the whole
    // slide as a single block so the typography stays even.
    const tier3 = !tier1 && !tier2;
    const tier = tier1 ? 1 : tier2 ? 2 : 3;

    const contentSet = new Set(info.contentLines.map(l => l.trim()));
    const transformedLines = info.rawLines.map(l => {
      const t = l.trim();
      if (!contentSet.has(t) || t === '') return l;
      return tier3 ? `# ${t}` : `#[fit] ${t}`;
    });

    const directives = [];
    if (tier1) directives.push('[.heading-align: center]');
    if (tier3) directives.push('[.autoscale: true]');

    const lines = directives.length ? [...directives, ...transformedLines] : transformedLines;
    const tail = tier1 ? ', centered' : tier3 ? ', dense (autoscale)' : '';
    return {
      lines,
      detail: `${numLines} lines, max ${maxW} words${tail}`,
      isShort: tier1,
      tier,
    };
  },
  vary: varyStatement,
};
