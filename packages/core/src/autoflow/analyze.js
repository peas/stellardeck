/**
 * analyzeSlide — derive the info object every skip check and rule reads.
 */

const {
  isHeading, isListItem, isPlainText, wordCount,
  stripHtmlComments, getContentLines, parseParagraphs,
} = require('./lines.js');

const AUTOFLOW_DEFAULTS = {
  statementMaxWords: 8,        // tier 2 ceiling — last word count where #[fit] still reads as a clean statement
  statementDenseMaxWords: 15,  // tier 3 ceiling — beyond this, fall through to autoscale/plain
  statementMaxLines: 4,
  dividerMaxWords: 2,
  autoscaleMinLines: 9,
  autoscaleMinWords: 80,
};

// Modifiers that give an image an explicit role; anything else is "bare".
const LAYOUT_MODIFIERS = ['right', 'left', 'inline', 'fit', 'filtered', 'bg', 'qr', 'bordered'];

function findSlideImages(rawLines) {
  const images = [];
  rawLines.forEach((line, lineIndex) => {
    const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const rawMods = m[1] || '';
      const mods = rawMods.split(/[\s,]+/).filter(Boolean).map(s => s.toLowerCase());
      images.push({
        full: m[0],
        src: m[2].trim(),
        modifiers: mods,
        rawMods,
        lineIndex,
      });
    }
  });
  return images;
}

function isBareImage(img) {
  return !img.modifiers.some(m => LAYOUT_MODIFIERS.includes(m));
}

/**
 * What an explicitly placed image (`![left]`, `![right]`, `![fit]`,
 * `![filtered]`) leaves for the text, mirroring how the parser lays it out:
 *
 *   'split'      — ![left]/![right]: text gets the other half
 *   'background' — ![fit]/![filtered] alone on the first content line: the
 *                  parser makes it the slide background, text renders on top
 *   'other'      — anything else (several images, background image mid-slide)
 *   null         — no explicit image
 */
function explicitImageLayout(images, contentLines) {
  const explicit = images.filter(img => img.modifiers.some(m => ['left', 'right', 'fit', 'filtered'].includes(m)));
  if (explicit.length === 0) return null;
  if (images.length !== 1) return 'other';
  const img = images[0];
  if (img.modifiers.includes('left') || img.modifiers.includes('right')) return 'split';
  // Parser's background case: alone on the first line, not inline/qr, not video
  const inFlow = img.modifiers.includes('inline') || img.modifiers.includes('qr');
  const video = /\.(mp4|mov|webm|m4v|ogg|ogv)$|youtube\.com|youtu\.be/i.test(img.src);
  const firstLine = contentLines[0] && contentLines[0].trim() === img.full;
  return firstLine && !inFlow && !video ? 'background' : 'other';
}

/**
 * Build a slide info object that every rule can read.
 * Pure derivation from raw markdown lines.
 *
 * @param {string[]} rawLines
 * @param {number} slideIndex
 * @param {number} totalSlides
 * @param {Object} options — config overrides
 * @returns {Object} slide info
 */
function analyzeSlide(rawLines, slideIndex, totalSlides, options) {
  const config = { ...AUTOFLOW_DEFAULTS, ...(options || {}) };

  // Strip HTML comments ONCE — every downstream analysis sees the cleaned
  // lines so we don't accidentally pick up `![]()` examples or `# heading`
  // mentions inside documentation comments as real content.
  const cleanedLines = stripHtmlComments(rawLines);

  const contentLines = getContentLines(cleanedLines);
  const paragraphs = parseParagraphs(cleanedLines);
  const totalWords = contentLines.reduce((s, l) => s + wordCount(l), 0);
  const images = findSlideImages(cleanedLines);
  const bareImages = images.filter(isBareImage);

  const imageLayout = explicitImageLayout(images, contentLines);

  const headingLines = contentLines.filter(isHeading).length;
  const bulletLines = contentLines.filter(isListItem).length;
  const plainLines = contentLines.filter(l => isPlainText(l)).length;

  return {
    // Note: rawLines preserves the original (comments included) so transforms
    // can rewrite within the original line set without dropping doc context.
    rawLines,
    cleanedLines,
    contentLines,
    paragraphs,
    index: slideIndex,
    total: totalSlides || 0,
    totalWords,
    totalNonEmptyLines: contentLines.length,
    images,
    bareImages,
    headingLines,
    bulletLines,
    plainLines,
    explicitImageLayout: imageLayout,
    // Layout facts preprocessors establish (e.g. 'split-image',
    // 'background-image'); rules opt out via skipIfDirective.
    directives: new Set(),
    config,
  };
}

module.exports = {
  AUTOFLOW_DEFAULTS,
  LAYOUT_MODIFIERS,
  findSlideImages,
  isBareImage,
  explicitImageLayout,
  analyzeSlide,
};
