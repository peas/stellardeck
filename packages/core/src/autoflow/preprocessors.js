/**
 * Preprocessors — rewrite the slide BEFORE the rule pipeline and keep going
 * (unlike rules, which end the pipeline). They run after skip checks, so
 * user-authored directives are never touched.
 *
 * Shape: { name, description, match(info, ctx), apply(info, ctx) }
 *   apply mutates `info` (rawLines + the derived fields rules read).
 */
const { hasImage, wordCount } = require('./lines.js');

const bareImageBackground = {
  name: 'bare-image-background',
  description: 'One bare image plus text: the image becomes a ![filtered] background (dark overlay) and leaves the text analysis, so text rules (statement, diagonal, …) still apply on top.',
  match(info, ctx) {
    return info.bareImages.length === 1 && info.contentLines.some(l => !hasImage(l));
  },
  apply(info, ctx) {
    const img = info.bareImages[0];
    info.rawLines = info.rawLines.map(l => l.includes(img.full) ? l.replace(img.full, `![filtered](${img.src})`) : l);
    info.bareImages = []; // no longer bare — the bare-image rule must not fire
    // Background decoration, not content: text rules should see only text.
    info.contentLines = info.contentLines.filter(l => !l.includes(img.src));
    info.paragraphs = info.paragraphs.filter(p => !p.some(l => l.includes(img.src)));
    info.totalNonEmptyLines = info.contentLines.length;
    info.totalWords = info.contentLines.reduce((s, l) => s + wordCount(l), 0);
  },
};

module.exports = [bareImageBackground];
