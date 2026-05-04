/**
 * diagnose-rules.test.js — pure unit tests for @stellardeck/core/diagnose-rules.
 *
 * These rules take a SlideSnapshot (plain serializable object) and return
 * Diagnostic warnings. No DOM, no browser — runs in plain Node so we can
 * iterate fast and cover edge cases that would be tedious to drive through
 * Playwright + the live diagnostics pipeline.
 */

const { test, summary } = require('./helpers/harness');
const {
  runPureRules,
  statementDegradedRule,
  densitySlideRule,
  emptySlideRule,
  codeNoLangRule,
  DENSE_WORD_COUNT,
} = require('@stellardeck/core/diagnose-rules');

function snap(overrides) {
  return {
    slideIndex: 5,
    attrs: {},
    visibleText: 'Some text',
    hasBgImage: false,
    hasBgVideo: false,
    hasBgColor: false,
    hasBgBroken: false,
    hasInlineImg: false,
    codeBlocks: [],
    ...overrides,
  };
}

console.log('\n── statement-degraded rule ──');

test('does not fire when no autoflow tier set', () => {
  const out = statementDegradedRule(snap({ attrs: {} }));
  if (out.length !== 0) throw new Error(`expected no warning, got ${JSON.stringify(out)}`);
});

test('does not fire when tier is 1 or 2', () => {
  if (statementDegradedRule(snap({ attrs: { autoflowTier: '1' } })).length !== 0) throw new Error('tier 1 fired');
  if (statementDegradedRule(snap({ attrs: { autoflowTier: '2' } })).length !== 0) throw new Error('tier 2 fired');
});

test('fires on tier 3 with severity info and detail', () => {
  const out = statementDegradedRule(snap({
    attrs: { autoflowTier: '3', autoflowDetail: 'line 1: 12 words' },
  }));
  if (out.length !== 1) throw new Error('expected 1 warning');
  if (out[0].type !== 'statement-degraded') throw new Error('wrong type');
  if (out[0].severity !== 'info') throw new Error('expected severity info');
  if (out[0].detail !== 'line 1: 12 words') throw new Error('detail not propagated');
  if (out[0].slide !== 5) throw new Error('slide index not propagated');
});

console.log('\n── slide-too-dense rule ──');

test('does not fire below the threshold', () => {
  const text = Array(DENSE_WORD_COUNT).fill('word').join(' ');
  const out = densitySlideRule(snap({ visibleText: text }));
  if (out.length !== 0) throw new Error('fired on exactly DENSE_WORD_COUNT — should be inclusive');
});

test('fires above the threshold', () => {
  const text = Array(DENSE_WORD_COUNT + 5).fill('word').join(' ');
  const out = densitySlideRule(snap({ visibleText: text }));
  if (out.length !== 1) throw new Error('expected 1 warning');
  if (out[0].type !== 'slide-too-dense') throw new Error('wrong type');
  if (out[0].wordCount !== DENSE_WORD_COUNT + 5) throw new Error(`bad wordCount ${out[0].wordCount}`);
});

test('handles empty visibleText', () => {
  if (densitySlideRule(snap({ visibleText: '' })).length !== 0) throw new Error('empty fired');
  if (densitySlideRule(snap({ visibleText: '   ' })).length !== 0) throw new Error('whitespace fired');
});

console.log('\n── empty-slide rule ──');

test('fires when no text, no bg, no inline image', () => {
  const out = emptySlideRule(snap({ visibleText: '' }));
  if (out.length !== 1) throw new Error('expected 1 warning');
  if (out[0].type !== 'empty-slide') throw new Error('wrong type');
});

test('does not fire when text is present', () => {
  if (emptySlideRule(snap({ visibleText: 'hi' })).length !== 0) throw new Error('text fired');
});

test('does not fire when bg image is set', () => {
  if (emptySlideRule(snap({ visibleText: '', hasBgImage: true })).length !== 0) throw new Error('hasBgImage fired');
});

test('does not fire when bg video is set', () => {
  if (emptySlideRule(snap({ visibleText: '', hasBgVideo: true })).length !== 0) throw new Error('hasBgVideo fired');
});

test('does not fire when bg color is set', () => {
  if (emptySlideRule(snap({ visibleText: '', hasBgColor: true })).length !== 0) throw new Error('hasBgColor fired');
});

test('does not fire when broken bg is flagged (it counted as content earlier)', () => {
  if (emptySlideRule(snap({ visibleText: '', hasBgBroken: true })).length !== 0) throw new Error('hasBgBroken fired');
});

test('does not fire when inline image is present', () => {
  if (emptySlideRule(snap({ visibleText: '', hasInlineImg: true })).length !== 0) throw new Error('hasInlineImg fired');
});

console.log('\n── code-no-lang rule ──');

test('does not fire when no code blocks', () => {
  if (codeNoLangRule(snap({ codeBlocks: [] })).length !== 0) throw new Error('empty fired');
});

test('does not fire on short snippet without language', () => {
  const out = codeNoLangRule(snap({ codeBlocks: [{ hasLanguage: false, contentLength: 12 }] }));
  if (out.length !== 0) throw new Error('short fired');
});

test('fires on long snippet without language', () => {
  const out = codeNoLangRule(snap({ codeBlocks: [{ hasLanguage: false, contentLength: 100 }] }));
  if (out.length !== 1) throw new Error('expected 1 warning');
  if (out[0].type !== 'code-no-lang') throw new Error('wrong type');
  if (out[0].severity !== 'info') throw new Error('expected severity info');
});

test('does not fire when language is present', () => {
  const out = codeNoLangRule(snap({ codeBlocks: [{ hasLanguage: true, contentLength: 100 }] }));
  if (out.length !== 0) throw new Error('hasLanguage fired');
});

test('emits at most one warning even with many bad blocks', () => {
  const blocks = Array(5).fill({ hasLanguage: false, contentLength: 200 });
  const out = codeNoLangRule(snap({ codeBlocks: blocks }));
  if (out.length !== 1) throw new Error(`expected 1 warning, got ${out.length}`);
});

console.log('\n── runPureRules: composition + ordering ──');

test('runs all rules in stable order on a quiet snapshot', () => {
  const out = runPureRules(snap());
  if (out.length !== 0) throw new Error('quiet snapshot returned warnings');
});

test('returns warnings in insertion order: statement → density → empty → code', () => {
  // Force every rule to fire at once.
  const huge = Array(DENSE_WORD_COUNT + 10).fill('word').join(' ');
  const s = snap({
    visibleText: huge,
    attrs: { autoflowTier: '3', autoflowDetail: 'd' },
    codeBlocks: [{ hasLanguage: false, contentLength: 100 }],
  });
  const out = runPureRules(s);
  // empty-slide doesn't fire because visibleText is huge — so we expect 3
  const types = out.map(w => w.type);
  const expected = ['statement-degraded', 'slide-too-dense', 'code-no-lang'];
  if (types.join(',') !== expected.join(',')) {
    throw new Error(`expected ${expected.join(',')}, got ${types.join(',')}`);
  }
});

test('aggregated slideIndex is propagated', () => {
  const out = runPureRules(snap({ slideIndex: 42, visibleText: '', attrs: {} }));
  // At minimum, empty-slide should fire on slideIndex 42.
  const empty = out.find(w => w.type === 'empty-slide');
  if (!empty) throw new Error('empty-slide did not fire');
  if (empty.slide !== 42) throw new Error(`bad slide ${empty.slide}`);
});

summary();
