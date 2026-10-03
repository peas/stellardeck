/**
 * bare-image-position-variation
 *
 * Whenever a slide has exactly ONE bare image (no right/left/inline/qr/fit/
 * filtered/bg/bordered modifier) AND has text alongside, pick a position for
 * the image by cycling through positions across the deck:
 *
 *   1st bare image in deck → inline  (image in flow, text above)
 *   2nd bare image in deck → left    (split, image left + text right)
 *   3rd bare image in deck → right   (split, image right + text left)
 *   4th → inline, 5th → left, 6th → right, ...
 *
 * State persists in ctx.state.lastBareImagePosition across the deck. The
 * `observe` hook also runs on EVERY slide (skipped ones included) and records
 * EXPLICIT layout images (`![left]`, `![right]`, `![inline]`), so the
 * variation never repeats the position the previous slide used.
 *
 * All three positions are existing parser primitives:
 *   ![inline](src) → centered inline image (deckset-inline-single)
 *   ![left](src)   → split, image left
 *   ![right](src)  → split, image right
 */
const { hasImage } = require('../lines.js');

const POSITIONS = ['inline', 'left', 'right'];

/**
 * Record explicit positioned images as if the variation had picked them.
 * A slide with several updates state to the LAST one, so the next slide
 * sees the most recent commitment. fit/filtered/bg/qr don't count.
 */
function observeImagePositions(info, ctx) {
  for (const img of info.images) {
    if (img.modifiers.includes('left')) ctx.state.lastBareImagePosition = 'left';
    else if (img.modifiers.includes('right')) ctx.state.lastBareImagePosition = 'right';
    else if (img.modifiers.includes('inline')) ctx.state.lastBareImagePosition = 'inline';
  }
}

module.exports = {
  name: 'bare-image-position-variation',
  description: 'Bare image without text — cycles position across the deck (inline → left → right) for visual variety. NOTE: bare image WITH text is handled by pre-processing (→ ![filtered] background + text rules).',
  example: '![](scaffold-construction.webp)',
  priority: 70,
  observe: observeImagePositions,
  match(info, ctx) {
    if (info.bareImages.length !== 1) return false;
    // Need at least one non-image content line
    const nonImageContent = info.contentLines.filter(l => !hasImage(l));
    return nonImageContent.length > 0;
  },
  transform(info, ctx) {
    const last = ctx.state.lastBareImagePosition;
    const lastIdx = POSITIONS.indexOf(last);
    const next = POSITIONS[(lastIdx + 1) % POSITIONS.length];
    ctx.state.lastBareImagePosition = next;

    const img = info.bareImages[0];
    const newImgMd = `![${next}](${img.src})`;
    return {
      lines: info.rawLines.map(l => l.includes(img.full) ? l.replace(img.full, newImgMd) : l),
      detail: `bare image → ${next}`,
    };
  },
  POSITIONS,
};
