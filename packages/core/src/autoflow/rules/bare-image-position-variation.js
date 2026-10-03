/**
 * bare-image-position-variation
 *
 * Whenever a slide has exactly ONE bare image (no right/left/inline/qr/fit/
 * filtered/bg/bordered modifier) AND more text than a hero slide
 * (bare-image-background preprocessor, ≤ heroMaxWords → filtered bg), pick a
 * position for the image by cycling through positions across the deck:
 *
 *   1st bare image in deck → inline  (image in flow, source order)
 *   2nd bare image in deck → left    (split, image left + text right)
 *   3rd bare image in deck → right   (split, image right + text left)
 *   4th → inline, 5th → left, 6th → right, ...
 *
 * Inline is skipped when the text has more than 2 lines (title + one line):
 * stacked in one column, more text pushes the image off the slide.
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
const INLINE_MAX_TEXT_LINES = 2;

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
  description: 'One bare image beside more text than a hero slide holds (> heroMaxWords). The image position cycles across the deck — inline → left → right, inline only with ≤2 text lines — and explicit ![left]/![right]/![inline] images on other slides count, so neighbors never repeat a side. A few words over a bare image is a hero instead (filtered background, see the bare-image-background preprocessor).',
  example: '![](scaffold-construction.webp)\n\n# Scaffolding\n\nTemporary structure that lets you build the permanent one.',
  priority: 70,
  observe: observeImagePositions,
  match(info, ctx) {
    if (info.bareImages.length !== 1) return false;
    // Need at least one non-image content line
    const nonImageContent = info.contentLines.filter(l => !hasImage(l));
    return nonImageContent.length > 0;
  },
  transform(info, ctx) {
    // Inline stacks image and text in one column: only a title + one line
    // fit beside it. More text alternates the split sides instead.
    const textLines = info.contentLines.filter(l => !hasImage(l)).length;
    const allowed = textLines <= INLINE_MAX_TEXT_LINES ? POSITIONS : POSITIONS.filter(p => p !== 'inline');
    const lastIdx = POSITIONS.indexOf(ctx.state.lastBareImagePosition);
    let next = null;
    for (let k = 1; k <= POSITIONS.length && !next; k++) {
      const candidate = POSITIONS[(lastIdx + k) % POSITIONS.length];
      if (allowed.includes(candidate)) next = candidate;
    }
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
