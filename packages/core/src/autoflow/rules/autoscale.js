module.exports = {
  description: 'Dense slide with >8 lines or >80 words. Applies [.autoscale: true] to shrink text to fit. Three tiers: light (9-12 lines), moderate (13-18), dense (19+).',
  example: '(any slide with >8 lines or >80 words of content)',
  name: 'autoscale',
  priority: 80,
  match(info, ctx) {
    return info.contentLines.length >= info.config.autoscaleMinLines ||
           info.totalWords >= info.config.autoscaleMinWords;
  },
  transform(info, ctx) {
    return {
      lines: [`[.autoscale-lines: ${info.contentLines.length}]`, '[.autoscale: true]', ...info.rawLines],
      detail: `${info.contentLines.length} lines, ${info.totalWords} words`,
    };
  },
};
