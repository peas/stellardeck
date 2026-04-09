/**
 * Tests for autoflow.js
 *
 * Run: node test/autoflow.test.js
 */

const assert = require('assert');
const { test, summary } = require('./helpers/harness');
const {
  applyAutoflow,
  detectTitleSlide,
  detectDivider,
  detectStatement,
  detectDiagonal,
  detectZPattern,
  detectAlternating,
  detectSplit,
  detectAutoscale,
  hasExplicitLayout,
  getContentLines,
  wordCount,
  AUTOFLOW_DEFAULTS,
} = require('../autoflow.js');

const config = { ...AUTOFLOW_DEFAULTS };

// ============================================================
// Helper: line splitting
// ============================================================

function lines(str) {
  return str.split('\n');
}

// ============================================================
// Unit tests: wordCount
// ============================================================
console.log('\n── wordCount ──');

test('counts single word', () => {
  assert.equal(wordCount('hello'), 1);
});

test('counts multiple words', () => {
  assert.equal(wordCount('Software is not solved'), 4);
});

test('handles extra spaces', () => {
  assert.equal(wordCount('  hello   world  '), 2);
});

test('empty string returns 0', () => {
  assert.equal(wordCount(''), 0);
});

// ============================================================
// Unit tests: getContentLines
// ============================================================
console.log('\n── getContentLines ──');

test('filters blanks and notes', () => {
  const result = getContentLines(['hello', '', '^ note', 'world']);
  assert.deepEqual(result, ['hello', 'world']);
});

test('filters directives', () => {
  const result = getContentLines(['[.background-color: #000]', 'hello']);
  assert.deepEqual(result, ['hello']);
});

// ============================================================
// Unit tests: hasExplicitLayout
// ============================================================
console.log('\n── hasExplicitLayout ──');

test('detects #[fit] heading', () => {
  assert.ok(hasExplicitLayout(['#[fit] Hello']));
});

test('detects ![right] image', () => {
  assert.ok(hasExplicitLayout(['![right](photo.jpg)']));
});

test('detects ![filtered] image', () => {
  assert.ok(hasExplicitLayout(['![filtered](photo.jpg)']));
});

test('detects position modifiers', () => {
  assert.ok(hasExplicitLayout(['#[top-left] Title']));
  assert.ok(hasExplicitLayout(['#[bottom-right] Title']));
});

test('detects autoscale directive', () => {
  assert.ok(hasExplicitLayout(['[.autoscale: true]']));
});

test('plain text has no explicit layout', () => {
  assert.ok(!hasExplicitLayout(['Hello world']));
});

test('bare image has no explicit layout', () => {
  assert.ok(!hasExplicitLayout(['![](photo.jpg)']));
});

// ============================================================
// Unit tests: Title slide (first slide)
// ============================================================
console.log('\n── Title slide ──');

test('first slide with title + subtitle → title rule', () => {
  const input = lines('My Talk\n\nA subtitle about things.\n\nBy Paulo Silveira');
  const result = applyAutoflow(input, 0, { totalSlides: 10 });
  assert.equal(result.rule, 'title');
  assert.ok(result.lines.some(l => l.includes('#[fit] My Talk')));
  assert.ok(result.lines.some(l => l.includes('[.heading-align: center]')));
  // Subtitle lines should NOT be #[fit]
  assert.ok(!result.lines.some(l => l.includes('#[fit] A subtitle')));
});

test('first slide with long title → not title rule (goes to statement)', () => {
  const input = lines('This is a very long title that is too wordy\n\nSubtitle');
  const result = applyAutoflow(input, 0, { totalSlides: 10 });
  assert.notEqual(result.rule, 'title');
});

test('second slide does NOT get title treatment', () => {
  const input = lines('Short Title\n\nSubtitle text here.');
  const result = applyAutoflow(input, 1, { totalSlides: 10 });
  assert.notEqual(result.rule, 'title');
});

test('first slide with 1 line → divider, not title', () => {
  const result = applyAutoflow(lines('2026'), 0, { totalSlides: 5 });
  assert.equal(result.rule, 'divider');
});

// ============================================================
// Unit tests: Rule 1 — Section Divider
// ============================================================
console.log('\n── Rule 1: Section Divider ──');

test('single number becomes #[fit] centered', () => {
  const result = applyAutoflow(lines('2026'), 0);
  assert.equal(result.rule, 'divider');
  assert.deepEqual(result.lines, ['[.heading-align: center]', '#[fit] 2026']);
});

test('single word becomes #[fit] centered', () => {
  const result = applyAutoflow(lines('1'), 0);
  assert.equal(result.rule, 'divider');
  assert.deepEqual(result.lines, ['[.heading-align: center]', '#[fit] 1']);
});

test('two words becomes divider centered', () => {
  const result = applyAutoflow(lines('Part 1'), 0);
  assert.equal(result.rule, 'divider');
  assert.deepEqual(result.lines, ['[.heading-align: center]', '#[fit] Part 1']);
});

test('three words is NOT a divider (goes to statement)', () => {
  const result = applyAutoflow(lines('Hello dear world'), 0);
  assert.notEqual(result.rule, 'divider');
});

test('heading is not a divider', () => {
  const result = applyAutoflow(lines('# Title'), 0);
  assert.notEqual(result.rule, 'divider'); // headings skip divider/statement rules
});

test('preserves notes alongside divider', () => {
  const result = applyAutoflow(lines('2026\n^ speaker note'), 0);
  assert.equal(result.rule, 'divider');
  assert.deepEqual(result.lines, ['[.heading-align: center]', '#[fit] 2026', '^ speaker note']);
});

test('preserves directives alongside divider', () => {
  const input = ['[.background-color: #000]', '2026'];
  const result = applyAutoflow(input, 0);
  assert.equal(result.rule, 'divider');
  assert.deepEqual(result.lines, ['[.heading-align: center]', '[.background-color: #000]', '#[fit] 2026']);
});

// ============================================================
// Unit tests: Rule 2 — Statement / Punch
// ============================================================
console.log('\n── Rule 2: Statement ──');

test('single short line becomes statement', () => {
  const result = applyAutoflow(lines('Software is not solved.'), 0);
  assert.equal(result.rule, 'statement');
  assert.ok(result.lines.some(l => l.includes('#[fit] Software is not solved.')));
});

test('two lines become statement', () => {
  const result = applyAutoflow(lines('Software\nis not solved.'), 0);
  assert.equal(result.rule, 'statement');
  assert.ok(result.lines.some(l => l === '#[fit] Software'));
  assert.ok(result.lines.some(l => l === '#[fit] is not solved.'));
});

test('three lines become statement', () => {
  const result = applyAutoflow(lines('Line 1\nLine 2\nLine 3'), 0);
  assert.equal(result.rule, 'statement');
  assert.deepEqual(result.lines, ['#[fit] Line 1', '#[fit] Line 2', '#[fit] Line 3']);
});

test('four short lines become statement', () => {
  const result = applyAutoflow(lines('Line A\nLine B\nLine C\nLine D'), 0);
  assert.equal(result.rule, 'statement');
});

test('blank lines between content are preserved', () => {
  // 2 paragraphs without "?" → not diagonal → statement (use index 2 to avoid title rule)
  const result = applyAutoflow(lines('Software\n\nis not solved.'), 2);
  assert.ok(result.lines.some(l => l === '#[fit] Software'));
  assert.ok(result.lines.includes('')); // blank line preserved
  assert.ok(result.lines.some(l => l === '#[fit] is not solved.'));
});

test('five short lines is NOT a statement', () => {
  const result = applyAutoflow(lines('A\nB\nC\nD\nE'), 0);
  assert.notEqual(result.rule, 'statement');
});

test('line with >8 words is NOT a statement', () => {
  const result = applyAutoflow(lines('This is a very long line that has too many words'), 0);
  assert.notEqual(result.rule, 'statement');
});

test('list items are NOT statements', () => {
  const result = applyAutoflow(lines('- item 1\n- item 2'), 0);
  assert.equal(result.rule, 'default');
});

test('blockquotes are NOT statements', () => {
  const result = applyAutoflow(lines('> A wise quote'), 0);
  assert.equal(result.rule, 'default');
});

// ============================================================
// Unit tests: Rule 3 — Diagonal (Question/Answer)
// ============================================================
console.log('\n── Rule 3: Diagonal ──');

test('two paragraphs → diagonal positioning', () => {
  const input = lines('What is distraction?\n\nArrogance or procrastination?');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'diagonal');
  assert.ok(result.lines.some(l => l.includes('#[top-left]')));
  assert.ok(result.lines.some(l => l.includes('#[bottom-right]')));
});

test('preserves blank line in diagonal', () => {
  const input = lines('What is the goal?\n\nTo build something great.');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'diagonal');
  assert.equal(result.lines[1], ''); // blank line preserved
});

test('two paragraphs without question → statement, not diagonal', () => {
  const input = lines('First block\n\nSecond block');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'statement');
});

// ============================================================
// Unit tests: Short statement center-align
// ============================================================
console.log('\n── Short statement center-align ──');

test('short statement (1 line, ≤5 words) gets center-aligned', () => {
  const result = applyAutoflow(lines('Just do it.'), 0);
  assert.equal(result.rule, 'statement');
  assert.ok(result.detail.includes('centered'));
  assert.ok(result.lines.some(l => l.includes('[.heading-align: center]')));
});

test('short statement (2 lines, ≤5 words each) gets center-aligned', () => {
  const result = applyAutoflow(lines('Know more.\nDo more.'), 0);
  assert.equal(result.rule, 'statement');
  assert.ok(result.detail.includes('centered'));
});

test('longer statement (>5 words) stays left-aligned', () => {
  const result = applyAutoflow(lines('Software is definitely not solved yet.'), 0);
  assert.equal(result.rule, 'statement');
  assert.ok(!result.detail.includes('centered'));
  assert.ok(!result.lines.some(l => l.includes('[.heading-align:')));
});

test('second consecutive short statement varies to left-aligned', () => {
  const result = applyAutoflow(lines('Just do it now.'), 1, undefined, ['statement']);
  assert.equal(result.rule, 'statement');
  assert.ok(result.detail.includes('left-aligned'));
});

// ============================================================
// Unit tests: Z-pattern (4 paragraphs)
// ============================================================
console.log('\n── Z-pattern ──');

test('4 paragraphs → Z-pattern (TL, TR, BL, BR)', () => {
  const input = lines('First\n\nSecond\n\nThird\n\nFourth');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'z-pattern');
  assert.ok(result.lines.some(l => l.includes('#[top-left]')));
  assert.ok(result.lines.some(l => l.includes('#[top-right]')));
  assert.ok(result.lines.some(l => l.includes('#[bottom-left]')));
  assert.ok(result.lines.some(l => l.includes('#[bottom-right]')));
});

test('4 paragraphs preserves blank lines', () => {
  const input = lines('A block\n\nB block\n\nC block\n\nD block');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'z-pattern');
  assert.ok(result.lines.includes('')); // blank lines preserved
});

test('3 paragraphs is NOT z-pattern', () => {
  const input = lines('One\n\nTwo\n\nThree');
  const result = applyAutoflow(input, 0);
  assert.notEqual(result.rule, 'z-pattern');
});

test('5 paragraphs is NOT z-pattern', () => {
  const input = lines('A\n\nB\n\nC\n\nD\n\nE');
  const result = applyAutoflow(input, 0);
  assert.notEqual(result.rule, 'z-pattern');
});

test('4 paragraphs with long lines is NOT z-pattern', () => {
  const input = lines('This is a very long line that exceeds the limit\n\nB\n\nC\n\nD');
  const result = applyAutoflow(input, 0);
  assert.notEqual(result.rule, 'z-pattern');
});

test('three paragraphs is NOT diagonal', () => {
  const input = lines('A\n\nB\n\nC');
  const result = applyAutoflow(input, 0);
  assert.notEqual(result.rule, 'diagonal');
});

test('single paragraph is NOT diagonal (goes to statement)', () => {
  const input = lines('Just one block');
  const result = applyAutoflow(input, 0);
  assert.notEqual(result.rule, 'diagonal');
});

test('paragraph with >10 words is NOT diagonal', () => {
  const input = lines('Short question?\n\nThis is a very long line that has way too many words in it');
  const result = applyAutoflow(input, 0);
  assert.notEqual(result.rule, 'diagonal');
});

// ============================================================
// Unit tests: Rule — Bare Image Rotate (replaces old `split`)
// ============================================================
console.log('\n── Rule: Bare Image Rotate ──');

const { createContext } = require('../autoflow.js');

test('first bare image + text → center (rotation start)', () => {
  const input = lines('![](photo.jpg)\n\n# Title\n\nSome text');
  const result = applyAutoflow(input, 0);
  assert.equal(result.rule, 'bare-image-rotate');
  // First in cycle = center: emits the position directive, doesn't rewrite the image
  assert.ok(result.lines.some(l => l.trim() === '[.bare-image-position: center]'));
  assert.ok(result.lines.some(l => l.includes('![](photo.jpg)')));
});

test('rotation across 3 slides: center → left → right', () => {
  const ctx = createContext();
  const slides = [
    lines('![](a.jpg)\n\nText A'),
    lines('![](b.jpg)\n\nText B'),
    lines('![](c.jpg)\n\nText C'),
  ];
  const r0 = applyAutoflow(slides[0], 0, undefined, undefined, ctx);
  const r1 = applyAutoflow(slides[1], 1, undefined, undefined, ctx);
  const r2 = applyAutoflow(slides[2], 2, undefined, undefined, ctx);
  assert.equal(r0.rule, 'bare-image-rotate');
  assert.equal(r1.rule, 'bare-image-rotate');
  assert.equal(r2.rule, 'bare-image-rotate');
  assert.ok(r0.lines.some(l => l.trim() === '[.bare-image-position: center]'));
  assert.ok(r1.lines.some(l => l.includes('![left](b.jpg)')));
  assert.ok(r2.lines.some(l => l.includes('![right](c.jpg)')));
});

test('rotation wraps after 3: 4th bare image is center again', () => {
  const ctx = createContext();
  const slides = [
    lines('![](a.jpg)\n\nText A'),
    lines('![](b.jpg)\n\nText B'),
    lines('![](c.jpg)\n\nText C'),
    lines('![](d.jpg)\n\nText D'),
  ];
  slides.forEach((s, i) => applyAutoflow(s, i, undefined, undefined, ctx));
  // Re-run the 4th and check it's center again
  const ctx2 = createContext();
  ctx2.state.lastBareImageSide = 'right'; // simulate after 3 calls
  const r4 = applyAutoflow(slides[3], 3, undefined, undefined, ctx2);
  assert.ok(r4.lines.some(l => l.trim() === '[.bare-image-position: center]'));
});

test('image with modifiers is NOT bare-image-rotate (explicit)', () => {
  const input = lines('![fit](photo.jpg)\n\nSome text');
  const result = applyAutoflow(input, 0);
  assert.equal(result.rule, 'explicit');
});

test('image-only slide is NOT bare-image-rotate (no text)', () => {
  const input = lines('![](photo.jpg)');
  const result = applyAutoflow(input, 0);
  assert.notEqual(result.rule, 'bare-image-rotate');
});

test('two images is NOT bare-image-rotate', () => {
  const input = lines('![](a.jpg)\n![](b.jpg)\nSome text');
  const result = applyAutoflow(input, 0);
  assert.notEqual(result.rule, 'bare-image-rotate');
});

// ============================================================
// Unit tests: Rule 4 — Auto-scale
// ============================================================
console.log('\n── Rule 4: Auto-scale ──');

test('many lines trigger autoscale', () => {
  const manyLines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1} with some words`);
  const result = applyAutoflow(manyLines, 0);
  assert.equal(result.rule, 'autoscale');
  assert.equal(result.lines[0], '[.autoscale-lines: 10]');
  assert.equal(result.lines[1], '[.autoscale: true]');
});

test('many words trigger autoscale', () => {
  // 5 lines, each ~17 words = ~85 total (> 80 threshold)
  const longLines = [
    'This is a very long paragraph with many words that keeps going and going and going still',
    'And another paragraph that also has a lot of words to pad the total word count higher',
    'Third line with even more words and more words and more content to fill up the count',
    'Fourth paragraph continues adding words upon words upon words to push past the limit',
    'Fifth and final line that should definitely push us over the eighty word threshold now',
  ];
  const result = applyAutoflow(longLines, 0);
  assert.equal(result.rule, 'autoscale');
});

test('few lines and few words does NOT trigger autoscale', () => {
  const result = applyAutoflow(lines('Short\nSlide'), 0);
  assert.notEqual(result.rule, 'autoscale');
});

test('code blocks skip autoflow entirely', () => {
  const input = lines('```js\nconsole.log("hi")\n```\nMore text\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10');
  const result = applyAutoflow(input, 0);
  assert.equal(result.rule, 'code');
});

test('autoscale injects line count directive', () => {
  const manyLines = Array.from({ length: 15 }, (_, i) => `Content line ${i + 1}`);
  const result = applyAutoflow(manyLines, 0);
  assert.equal(result.rule, 'autoscale');
  assert.equal(result.lines[0], '[.autoscale-lines: 15]');
  assert.equal(result.lines[1], '[.autoscale: true]');
  assert.equal(result.lines[2], manyLines[0]);
});

test('autoscale line count reflects content lines only (excludes notes/directives)', () => {
  const input = [
    '^speaker note here',
    ...Array.from({ length: 10 }, (_, i) => `Content line ${i + 1}`),
    '^another note',
  ];
  const result = applyAutoflow(input, 0);
  assert.equal(result.rule, 'autoscale');
  assert.equal(result.lines[0], '[.autoscale-lines: 10]');
});

test('many-words autoscale injects correct line count', () => {
  // 5 content lines with many words (> 80 total)
  const longLines = [
    'This is a very long paragraph with many words that keeps going and going and going still',
    'And another paragraph that also has a lot of words to pad the total word count higher',
    'Third line with even more words and more words and more content to fill up the count',
    'Fourth paragraph continues adding words upon words upon words to push past the limit',
    'Fifth and final line that should definitely push us over the eighty word threshold now',
  ];
  const result = applyAutoflow(longLines, 0);
  assert.equal(result.rule, 'autoscale');
  assert.equal(result.lines[0], '[.autoscale-lines: 5]');
});

// ============================================================
// Unit tests: Override behavior
// ============================================================
console.log('\n── Override behavior ──');

test('explicit #[fit] skips autoflow', () => {
  const result = applyAutoflow(lines('#[fit] My title'), 0);
  assert.equal(result.rule, 'explicit');
  assert.deepEqual(result.lines, ['#[fit] My title']);
});

test('explicit ![right] skips autoflow', () => {
  const input = lines('![right](photo.jpg)\n\nText here');
  const result = applyAutoflow(input, 0);
  assert.equal(result.rule, 'explicit');
});

test('[.autoscale: true] already present skips autoflow', () => {
  const input = ['[.autoscale: true]', ...Array.from({ length: 10 }, (_, i) => `Line ${i}`)];
  const result = applyAutoflow(input, 0);
  assert.equal(result.rule, 'explicit');
});

test('empty slide returns empty rule', () => {
  const result = applyAutoflow(lines(''), 0);
  assert.equal(result.rule, 'empty');
});

// ============================================================
// Unit tests: Anti-monotony
// ============================================================
console.log('\n── Anti-monotony ──');

test('first statement has no variation', () => {
  const result = applyAutoflow(lines('Software is not solved.'), 0, undefined, []);
  assert.equal(result.rule, 'statement');
  assert.ok(!result.detail.includes('varied'));
});

test('second consecutive long statement gets center-aligned variation', () => {
  const result = applyAutoflow(lines('The future belongs to the curious ones.'), 1, undefined, ['statement']);
  assert.equal(result.rule, 'statement');
  assert.ok(result.detail.includes('center-aligned'));
  assert.ok(result.lines.some(l => l.includes('[.heading-align: center]')));
});

test('third consecutive long statement gets right-aligned variation', () => {
  const result = applyAutoflow(lines('The future belongs to the curious ones.'), 2, undefined, ['statement', 'statement']);
  assert.equal(result.rule, 'statement');
  assert.ok(result.lines.some(l => l.includes('[.heading-align: right]')));
});

test('non-consecutive statement resets variation', () => {
  const result = applyAutoflow(lines('Software is not solved.'), 3, undefined, ['statement', 'diagonal', 'statement']);
  assert.equal(result.rule, 'statement');
  assert.ok(result.detail.includes('varied'));
});

test('second consecutive diagonal gets mirrored', () => {
  const input = lines('What is it?\n\nThe answer.');
  const result = applyAutoflow(input, 1, undefined, ['diagonal']);
  assert.equal(result.rule, 'diagonal');
  assert.ok(result.detail.includes('mirrored'));
  assert.ok(result.lines.some(l => l.includes('#[top-right]')));
  assert.ok(result.lines.some(l => l.includes('#[bottom-left]')));
});

test('third consecutive diagonal reverts to original', () => {
  const input = lines('Another Q?\n\nAnother A.');
  const result = applyAutoflow(input, 2, undefined, ['diagonal', 'diagonal']);
  assert.equal(result.rule, 'diagonal');
  assert.ok(!result.detail.includes('mirrored'));
});

test('first divider is centered (default)', () => {
  const result = applyAutoflow(lines('Go'), 1, undefined, []);
  assert.equal(result.rule, 'divider');
  assert.ok(result.lines.some(l => l === '[.heading-align: center]'));
  assert.ok(!result.detail.includes('varied'));
});

test('second consecutive divider varies to left-aligned', () => {
  const result = applyAutoflow(lines('Go'), 2, undefined, ['divider']);
  assert.equal(result.rule, 'divider');
  assert.ok(result.lines.some(l => l === '[.heading-align: left]'));
  assert.ok(result.detail.includes('left-aligned'));
});

test('third consecutive divider varies to right-aligned', () => {
  const result = applyAutoflow(lines('Go'), 3, undefined, ['divider', 'divider']);
  assert.equal(result.rule, 'divider');
  assert.ok(result.lines.some(l => l === '[.heading-align: right]'));
  assert.ok(result.detail.includes('right-aligned'));
});

test('non-consecutive divider resets to centered', () => {
  const result = applyAutoflow(lines('Go'), 4, undefined, ['divider', 'divider', 'statement']);
  assert.equal(result.rule, 'divider');
  assert.ok(result.lines.some(l => l === '[.heading-align: center]'));
  assert.ok(!result.detail.includes('varied'));
});

// ============================================================
// Unit tests: Alternating colors
// ============================================================
console.log('\n── Alternating colors ──');

test('3 paragraphs → alternating colors', () => {
  const input = lines('First point\n\nSecond point\n\nThird point');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'alternating');
  assert.ok(result.lines.some(l => l.includes('[.alternating-colors: true]')));
});

test('5 paragraphs → alternating colors', () => {
  const input = lines('A\n\nB\n\nC\n\nD\n\nE');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'alternating');
});

test('3 paragraphs with questions → alternating (not diagonal)', () => {
  // 3 paragraphs = not diagonal (needs 2), goes to alternating
  const input = lines('Are we ready?\n\nAre we sure?\n\nAre we brave?');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'alternating');
});

test('2 paragraphs is NOT alternating (goes to diagonal or statement)', () => {
  const input = lines('First\n\nSecond');
  const result = applyAutoflow(input, 2);
  assert.notEqual(result.rule, 'alternating');
});

test('paragraphs with long lines are NOT alternating', () => {
  const input = lines('This is a very long line that exceeds ten words limit easily\n\nB\n\nC');
  const result = applyAutoflow(input, 2);
  assert.notEqual(result.rule, 'alternating');
});

test('paragraphs with headings are NOT alternating', () => {
  const input = lines('# Title\n\nSecond\n\nThird');
  const result = applyAutoflow(input, 2);
  assert.notEqual(result.rule, 'alternating');
});

// ============================================================
// Unit tests: Custom block skip
// ============================================================
console.log('\n── Custom block skip ──');

test(':::columns slide skips autoflow', () => {
  const input = lines('# Title\n\n:::columns\n## Col 1\nText\n---\n## Col 2\nText\n:::');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'custom-block');
  assert.ok(result.detail.includes(':::block'));
});

test(':::diagram slide skips autoflow', () => {
  const input = lines('# Chart\n\n:::diagram\ngraph LR\nA --> B\n:::');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'custom-block');
});

test(':::steps slide skips autoflow', () => {
  const input = lines(':::steps\nStep 1\n\nStep 2\n:::');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'custom-block');
});

test(':::center slide skips autoflow', () => {
  const input = lines(':::center\nCentered content\n:::');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'custom-block');
});

test('slide without ::: is NOT skipped', () => {
  const input = lines('Just some text here');
  const result = applyAutoflow(input, 2);
  assert.notEqual(result.rule, 'custom-block');
});

// ============================================================
// Real deck regression tests
// ============================================================
console.log('\n── Real deck regressions ──');

test('heading + bullets slide stays default (not mutated to statement)', () => {
  // From hand-balancing slide 2: heading + paragraph + bullets → autoflow leaves as-is
  const input = lines('# What is Hand Balancing?\n\nThe art of supporting your body.\n\n- Circus tradition\n- Modern revival');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'default'); // headings/lists prevent statement/diagonal/z-pattern
  assert.deepEqual(result.lines, input); // lines unchanged
});

test('heading + columns should not get autoscale', () => {
  // From chocolate slide 5: heading + :::columns
  const input = lines('# Industrial vs Craft\n\n:::columns\n## Industrial\n- Bulk cacao\n---\n## Craft\n- Single origin\n:::');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'custom-block'); // skipped by custom block rule
});

test('heading + diagram should not get autoscale', () => {
  // From hand-balancing slide 17: heading + :::diagram
  const input = lines('# Training Progression\n\n:::diagram\ngraph TD\nA --> B --> C\n:::');
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'custom-block');
});

test('many lines of text get autoscale only if no custom blocks', () => {
  const input = Array.from({ length: 10 }, (_, i) => `Line ${i + 1} with some words`);
  const result = applyAutoflow(input, 2);
  assert.equal(result.rule, 'autoscale');
});

// ============================================================
// Integration: parseDecksetMarkdown with autoflow
// ============================================================
console.log('\n── Parser integration ──');

// Load autoflow globally so parseDecksetMarkdown can find it
global.applyAutoflow = require('../autoflow.js').applyAutoflow;
const { parseDecksetMarkdown } = require('../deckset-parser.js');

test('autoflow: true in frontmatter enables autoflow', () => {
  const md = 'autoflow: true\n\n2026';
  const html = parseDecksetMarkdown(md);
  assert.ok(html.includes('deckset-fit'), 'Expected #[fit] heading from autoflow divider');
});

test('autoflow via options enables autoflow', () => {
  const md = '2026';
  const html = parseDecksetMarkdown(md, { autoflow: true });
  assert.ok(html.includes('deckset-fit'), 'Expected #[fit] heading from autoflow divider');
});

test('without autoflow, plain text stays plain', () => {
  const md = '2026';
  const html = parseDecksetMarkdown(md);
  assert.ok(!html.includes('deckset-fit'), 'Should not have #[fit] without autoflow');
});

test('options autoflow:false overrides frontmatter autoflow:true', () => {
  const md = 'autoflow: true\n\n2026';
  const html = parseDecksetMarkdown(md, { autoflow: false });
  assert.ok(!html.includes('deckset-fit'), 'Options false should override frontmatter true');
});

test('autoflow injects autoscale data attribute', () => {
  const manyLines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1} with some text`).join('\n');
  const html = parseDecksetMarkdown(manyLines, { autoflow: true });
  assert.ok(html.includes('data-autoscale="true"'), 'Expected autoscale attribute');
});

test('autoscale light tier for 9-12 content lines', () => {
  const md = Array.from({ length: 10 }, (_, i) => `Line ${i + 1} content here`).join('\n');
  const html = parseDecksetMarkdown(md, { autoflow: true });
  assert.ok(html.includes('data-autoscale-tier="light"'), 'Expected light tier for 10 lines');
  assert.ok(html.includes('data-autoscale-lines="10"'), 'Expected line count 10');
});

test('autoscale moderate tier for 13-18 content lines', () => {
  const md = Array.from({ length: 15 }, (_, i) => `Line ${i + 1} content here`).join('\n');
  const html = parseDecksetMarkdown(md, { autoflow: true });
  assert.ok(html.includes('data-autoscale-tier="moderate"'), 'Expected moderate tier for 15 lines');
  assert.ok(html.includes('data-autoscale-lines="15"'), 'Expected line count 15');
});

test('autoscale dense tier for 19+ content lines', () => {
  const md = Array.from({ length: 22 }, (_, i) => `Line ${i + 1} content here`).join('\n');
  const html = parseDecksetMarkdown(md, { autoflow: true });
  assert.ok(html.includes('data-autoscale-tier="dense"'), 'Expected dense tier for 22 lines');
  assert.ok(html.includes('data-autoscale-lines="22"'), 'Expected line count 22');
});

test('manual [.autoscale: true] without autoflow gets no tier', () => {
  const md = '[.autoscale: true]\n' + Array.from({ length: 15 }, (_, i) => `Line ${i + 1}`).join('\n');
  const html = parseDecksetMarkdown(md);
  assert.ok(html.includes('data-autoscale="true"'), 'Expected autoscale attribute');
  assert.ok(!html.includes('data-autoscale-tier'), 'Manual autoscale should have no tier (no line count)');
});

test('autoflow bare-image-rotate produces split for 2nd bare image (left)', () => {
  // Slide 1 = center (position directive only, no split). Slide 2 = left (real split).
  const md = '![](a.jpg)\n\nTitle A\n\n---\n\n![](b.jpg)\n\nTitle B';
  const html = parseDecksetMarkdown(md, { autoflow: true });
  assert.ok(html.includes('deckset-split'), 'Expected split layout from 2nd bare image');
});

// ============================================================

summary();
