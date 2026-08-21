/**
 * style-lint.test.js — pure unit tests for @stellardeck/core/style-lint.
 *
 * classifySlide + computeStyle work on plain SlideMeta objects (no DOM),
 * so the corpus-benchmark warnings are testable in plain Node.
 */

const { test, summary } = require('./helpers/harness');
const assert = require('assert');
const { classifySlide, computeStyle, STYLE_BENCHMARKS } = require('@stellardeck/core/style-lint');

function meta(overrides) {
  return {
    slide: 1,
    wordCount: 8,
    autoflowRule: null,
    autoflowTier: null,
    images: 0,
    bgImage: false,
    split: false,
    splitSide: null,
    columns: false,
    bullets: 0,
    fit: false,
    code: false,
    diagram: false,
    headingLevels: [],
    ...overrides,
  };
}

// ── classifySlide ────────────────────────────────────────────

console.log('\n── classifySlide ──');

test('diagram wins over everything', () => {
  assert.strictEqual(classifySlide(meta({ diagram: true, code: true, split: true })), 'diagram');
});

test('split beats image counts', () => {
  assert.strictEqual(classifySlide(meta({ split: true, images: 1 })), 'split');
});

test('bg image + few words → image-hero', () => {
  assert.strictEqual(classifySlide(meta({ bgImage: true, wordCount: 3 })), 'image-hero');
});

test('bg image + prose → image-text', () => {
  assert.strictEqual(classifySlide(meta({ bgImage: true, wordCount: 20 })), 'image-text');
});

test('bullets → list', () => {
  assert.strictEqual(classifySlide(meta({ bullets: 4 })), 'list');
});

test('fit without bullets/images → statement', () => {
  assert.strictEqual(classifySlide(meta({ fit: true })), 'statement');
});

test('short bare slide → divider', () => {
  assert.strictEqual(classifySlide(meta({ wordCount: 2 })), 'divider');
});

test('fallback → text', () => {
  assert.strictEqual(classifySlide(meta({ wordCount: 25 })), 'text');
});

// ── computeStyle ─────────────────────────────────────────────

console.log('\n── computeStyle ──');

test('empty deck → no crash, no warnings', () => {
  const r = computeStyle([]);
  assert.strictEqual(r.slides, 0);
  assert.deepStrictEqual(r.warnings, []);
});

test('corpus-conformant deck → zero warnings', () => {
  const metas = [
    meta({ slide: 1, fit: true }),                                  // statement
    meta({ slide: 2, split: true, splitSide: 'right' }),            // split
    meta({ slide: 3, bullets: 3 }),                                 // list
    meta({ slide: 4, bgImage: true, wordCount: 2 }),                // image-hero
    meta({ slide: 5, split: true, splitSide: 'left' }),             // split
    meta({ slide: 6, wordCount: 25 }),                              // text
  ];
  const r = computeStyle(metas);
  assert.deepStrictEqual(r.warnings, [], r.warnings.join('; '));
  assert.strictEqual(r.slides, 6);
});

test('median words computed over all slides', () => {
  const metas = [meta({ wordCount: 4 }), meta({ wordCount: 8 }), meta({ wordCount: 30 })];
  assert.strictEqual(computeStyle(metas).medianWords, 8);
});

test('high median words warns', () => {
  const metas = Array.from({ length: 4 }, (_, i) => meta({ slide: i + 1, wordCount: 30, images: 1 }));
  const r = computeStyle(metas);
  assert.ok(r.warnings.some(w => w.includes('median')), r.warnings.join('; '));
});

test('single 50+ word slide flagged by number', () => {
  const metas = [meta({ slide: 1 }), meta({ slide: 2, wordCount: 80 })];
  const r = computeStyle(metas);
  assert.ok(r.warnings.some(w => w.includes('slide 2')), r.warnings.join('; '));
});

test('three consecutive same-type slides warn with the range', () => {
  const metas = [
    meta({ slide: 1, fit: true }),
    meta({ slide: 2, bullets: 2, images: 1 }),
    meta({ slide: 3, bullets: 2, images: 1 }),
    meta({ slide: 4, bullets: 2, images: 1 }),
    meta({ slide: 5, fit: true }),
    meta({ slide: 6, split: true, splitSide: 'left' }),
  ];
  const r = computeStyle(metas);
  const w = r.warnings.find(w => w.includes('consecutive'));
  assert.ok(w, r.warnings.join('; '));
  assert.ok(w.includes('2-4'), w);
  assert.strictEqual(r.maxConsecutiveSameType, 3);
});

test('low image density warns on decks of 5+', () => {
  const metas = Array.from({ length: 6 }, (_, i) => meta({ slide: i + 1, wordCount: 10 + (i % 3) }));
  const r = computeStyle(metas);
  assert.ok(r.warnings.some(w => w.includes('image density')), r.warnings.join('; '));
});

test('one-sided splits warn only at 3+ splits', () => {
  const twoSplits = [
    meta({ slide: 1, split: true, splitSide: 'right' }),
    meta({ slide: 2, fit: true }),
    meta({ slide: 3, split: true, splitSide: 'right' }),
  ];
  assert.ok(!computeStyle(twoSplits).warnings.some(w => w.includes('splits')));
  const threeSplits = [
    meta({ slide: 1, split: true, splitSide: 'right' }),
    meta({ slide: 2, fit: true }),
    meta({ slide: 3, split: true, splitSide: 'right' }),
    meta({ slide: 4, bullets: 2 }),
    meta({ slide: 5, split: true, splitSide: 'right' }),
  ];
  const r = computeStyle(threeSplits);
  assert.ok(r.warnings.some(w => w.includes('all 3 splits are right')), r.warnings.join('; '));
});

test('custom benchmarks override defaults', () => {
  const metas = [meta({ wordCount: 12, images: 1 }), meta({ wordCount: 12, images: 1 })];
  const strict = computeStyle(metas, { medianWordsMax: 10 });
  assert.ok(strict.warnings.some(w => w.includes('median')));
  const loose = computeStyle(metas);
  assert.ok(!loose.warnings.some(w => w.includes('median')));
});

test('type distribution sums to ~1', () => {
  const metas = [meta({ fit: true }), meta({ bullets: 1 }), meta({ split: true })];
  const dist = computeStyle(metas).typeDistribution;
  const sum = Object.values(dist).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 0.05, String(sum));
});

test('benchmarks are exported for tuning', () => {
  assert.ok(STYLE_BENCHMARKS.medianWordsMax > 0);
  assert.ok(STYLE_BENCHMARKS.maxConsecutiveSameType >= 2);
});

summary();
