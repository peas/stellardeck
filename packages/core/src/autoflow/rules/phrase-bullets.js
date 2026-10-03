/**
 * phrase-bullets (anti-monotony palette)
 *
 * The "1 short headline + 2-3 short bullets" shape is everywhere in real
 * decks and renders flat as title + bulleted list. This rule detects that
 * shape and picks a layout from a 4-variant palette, cycling across the
 * deck so two consecutive matches don't pick the same one.
 *
 * Palette (cycled via ctx.state.lastPhraseBulletsLayout):
 *   1. cards       — bullets become horizontal cards side by side
 *   2. pills       — bullets become inline tag-pills below the headline
 *   3. alternating — bullets alternate heading color and accent color
 *   4. staggered   — bullets each indented differently for visual rhythm
 *
 * The autoflow injects [.bullets-layout: <variant>] which the parser
 * converts to data-bullets-layout="..." on the section. CSS in
 * css/layout.css renders each variant.
 *
 * Match conditions:
 *   - Exactly 1 heading line (h1/h2/h3)
 *   - 2-3 bullet items, each ≤6 words
 *   - The headline ≤8 words
 *   - No images, no other content
 */
const { isHeading, isListItem, wordCount } = require('../lines.js');

const PHRASE_BULLETS_PALETTE = ['cards', 'pills', 'alternating', 'staggered'];

module.exports = {
  description: 'Bullet list where items are short phrases (≤12 words, 3-8 items). Applies a visual bullet style (pills, staggered, or alternating) that varies across the deck.',
  example: '- Teamwork\n- Orchestrating the build\n- Understanding the full scope',
  name: 'phrase-bullets',
  priority: 75,  // after bare-image-position-variation (70), before autoscale (80)
  match(info, ctx) {
    if (info.headingLines !== 1) return false;
    if (info.bulletLines < 2 || info.bulletLines > 3) return false;
    if (info.images.length > 0) return false;
    // The slide should be ONLY a heading and bullets — no extra paragraphs
    const headingsAndBullets = info.headingLines + info.bulletLines;
    if (info.contentLines.length !== headingsAndBullets) return false;
    // Headline ≤8 words
    const heading = info.contentLines.find(isHeading);
    if (!heading) return false;
    if (wordCount(heading.replace(/^#{1,6}\s*/, '')) > 8) return false;
    // Each bullet ≤6 words
    const bullets = info.contentLines.filter(isListItem);
    return bullets.every(b => wordCount(b.replace(/^\s*[-*+]\s*/, '')) <= 6);
  },
  transform(info, ctx) {
    const last = ctx.state.lastPhraseBulletsLayout;
    const lastIdx = PHRASE_BULLETS_PALETTE.indexOf(last);
    const next = PHRASE_BULLETS_PALETTE[(lastIdx + 1) % PHRASE_BULLETS_PALETTE.length];
    ctx.state.lastPhraseBulletsLayout = next;

    // For 'pills' variant, also #[fit] the headline so it dominates
    let lines = [`[.bullets-layout: ${next}]`, ...info.rawLines];
    if (next === 'pills') {
      const heading = info.contentLines.find(isHeading);
      if (heading) {
        const stripped = heading.replace(/^(#{1,6})\s*/, '$1[fit] ');
        lines = lines.map(l => l === heading ? stripped : l);
      }
    }
    return {
      lines,
      detail: `headline + ${info.bulletLines} bullets → ${next}`,
    };
  },
};
