/**
 * style-lint.js — deck-level style metrics vs. the real-deck corpus.
 *
 * Pure functions over per-slide metadata (no DOM): the CLI extracts a
 * SlideMeta array in the browser, this module turns it into deterministic
 * metrics + warnings. Benchmarks come from the 331-deck corpus analysis
 * that also calibrated the authoring skill (median 9 words/slide, 40-60%
 * image density, #[fit] on ~a third, right:left ≈ 2.4:1, no 3 consecutive
 * slides of one type, no type above ~1/3 of the deck).
 *
 * SlideMeta shape (built by scripts/export.js in-page):
 *   {
 *     slide: number,            // 1-based
 *     wordCount: number,        // visible prose (no notes, no block code)
 *     autoflowRule: string|null,
 *     autoflowTier: string|null,
 *     images: number,           // inline <img> count
 *     bgImage: boolean,
 *     split: boolean, splitSide: 'left'|'right'|null,
 *     columns: boolean, bullets: number, fit: boolean,
 *     code: boolean, diagram: boolean,
 *     headingLevels: number[],  // e.g. [1, 2]
 *   }
 */
'use strict';

const STYLE_BENCHMARKS = {
  medianWordsMax: 15,        // corpus median is 9; ≤15 still reads as slides
  wordySlideWords: 50,       // corpus: only 3.6% of slides exceed this
  imageDensityMin: 0.3,
  imageDensityMax: 0.6,
  fitRatioMin: 0.2,
  fitRatioMax: 0.4,
  maxConsecutiveSameType: 2, // corpus: never 3 in a row
  maxTypeShare: 0.35,
  minSplitsForSideCheck: 3,  // one-sided splits only flagged with ≥3 splits
};

// Deterministic slide-type classifier. Order matters: first match wins.
function classifySlide(m) {
  if (m.diagram) return 'diagram';
  if (m.code) return 'code';
  if (m.columns) return 'columns';
  if (m.split) return 'split';
  if (m.bgImage && m.wordCount <= 8) return 'image-hero';
  if (m.bgImage) return 'image-text';
  if (m.images > 0) return 'image-inline';
  if (m.bullets > 0) return 'list';
  if (m.fit) return 'statement';
  if (m.wordCount <= 3) return 'divider';
  return 'text';
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function computeStyle(metas, benchmarks) {
  const B = { ...STYLE_BENCHMARKS, ...(benchmarks || {}) };
  const n = metas.length;
  if (!n) return { slides: 0, warnings: [] };

  const types = metas.map(classifySlide);
  const wordCounts = metas.map(m => m.wordCount);
  const withImage = metas.filter(m => m.images > 0 || m.bgImage || m.split).length;
  const withFit = metas.filter(m => m.fit).length;
  const splits = metas.filter(m => m.split);
  const rights = splits.filter(m => m.splitSide === 'right').length;
  const lefts = splits.filter(m => m.splitSide === 'left').length;

  const typeDistribution = {};
  types.forEach(t => { typeDistribution[t] = (typeDistribution[t] || 0) + 1; });
  Object.keys(typeDistribution).forEach(t => {
    typeDistribution[t] = Math.round((typeDistribution[t] / n) * 100) / 100;
  });

  // Longest run of one type, with its position for the warning message.
  let maxRun = 1, maxRunType = types[0], maxRunEnd = 1, run = 1;
  for (let i = 1; i < n; i++) {
    run = types[i] === types[i - 1] ? run + 1 : 1;
    if (run > maxRun) { maxRun = run; maxRunType = types[i]; maxRunEnd = i + 1; }
  }

  const metrics = {
    slides: n,
    medianWords: median(wordCounts),
    wordySlides: metas.filter(m => m.wordCount > B.wordySlideWords).map(m => m.slide),
    imageDensity: Math.round((withImage / n) * 100) / 100,
    fitRatio: Math.round((withFit / n) * 100) / 100,
    splitCount: splits.length,
    rightLeftRatio: lefts > 0 ? Math.round((rights / lefts) * 10) / 10 : (rights > 0 ? null : 0),
    maxConsecutiveSameType: maxRun,
    typeDistribution,
    typeSequence: types,
  };

  const warnings = [];
  if (metrics.medianWords > B.medianWordsMax) {
    warnings.push(`median ${metrics.medianWords} words/slide — corpus median is 9, target ≤${B.medianWordsMax}`);
  }
  for (const s of metrics.wordySlides) {
    warnings.push(`slide ${s}: over ${B.wordySlideWords} words — corpus has 3.6% of slides this dense`);
  }
  if (n >= 5 && metrics.imageDensity < B.imageDensityMin) {
    warnings.push(`image density ${Math.round(metrics.imageDensity * 100)}% — corpus target is ${B.imageDensityMin * 100}-${B.imageDensityMax * 100}%`);
  }
  if (metrics.imageDensity > B.imageDensityMax + 0.15) {
    warnings.push(`image density ${Math.round(metrics.imageDensity * 100)}% — almost every slide has an image; text slides give rhythm`);
  }
  if (maxRun > B.maxConsecutiveSameType) {
    warnings.push(`slides ${maxRunEnd - maxRun + 1}-${maxRunEnd}: ${maxRun} consecutive ${maxRunType} slides — vary the layout`);
  }
  for (const [t, share] of Object.entries(typeDistribution)) {
    if (share > B.maxTypeShare && n >= 6) {
      warnings.push(`${Math.round(share * 100)}% of the deck is ${t} slides — corpus keeps every type under ${Math.round(B.maxTypeShare * 100)}%`);
    }
  }
  if (splits.length >= B.minSplitsForSideCheck && (lefts === 0 || rights === 0)) {
    warnings.push(`all ${splits.length} splits are ${lefts === 0 ? 'right' : 'left'} — corpus alternates (right:left ≈ 2.4:1)`);
  }

  return { ...metrics, warnings };
}

// Browser global + CommonJS (same dual pattern as the other core modules)
if (typeof window !== 'undefined') {
  window.StellarStyleLint = { classifySlide, computeStyle, STYLE_BENCHMARKS };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { classifySlide, computeStyle, STYLE_BENCHMARKS };
}
