/**
 * Parser HTML structure tests — verify CSS-relevant DOM structure.
 *
 * These tests ensure parseDecksetMarkdown() produces the correct
 * CSS classes, data attributes, and DOM nesting that layout.css depends on.
 */

const assert = require('assert');
const { test, summary } = require('./helpers/harness');
const { parseDecksetMarkdown } = require('../deckset-parser.js');

// Load autoflow globally so parser can find it (same pattern as autoflow.test.js)
global.applyAutoflow = require('../autoflow.js').applyAutoflow;

// ── #[fit] headings ──

console.log('\n── #[fit] headings ──');

test('#[fit] heading gets deckset-fit class', () => {
  const html = parseDecksetMarkdown('#[fit] Big Title');
  assert.ok(html.includes('class="deckset-fit"'), 'missing deckset-fit class');
});

test('multiple #[fit] headings each get deckset-fit', () => {
  const html = parseDecksetMarkdown('#[fit] Line 1\n#[fit] Line 2');
  const count = (html.match(/class="deckset-fit"/g) || []).length;
  assert.strictEqual(count, 2, `expected 2 deckset-fit, got ${count}`);
});

test('#[fit] with h2 level gets deckset-fit', () => {
  const html = parseDecksetMarkdown('##[fit] Subtitle');
  assert.ok(html.includes('deckset-fit'), 'h2 fit missing class');
  assert.ok(html.includes('<h2'), 'should be h2 element');
});

// ── Position modifiers ──

console.log('\n── Position modifiers ──');

test('#[top-left] gets deckset-pos-top-left class', () => {
  const html = parseDecksetMarkdown('#[top-left] Hello');
  assert.ok(html.includes('deckset-pos-top-left'), 'missing deckset-pos-top-left');
});

test('#[bottom-right] gets deckset-pos-bottom-right class', () => {
  const html = parseDecksetMarkdown('#[bottom-right] Bye');
  assert.ok(html.includes('deckset-pos-bottom-right'), 'missing deckset-pos-bottom-right');
});

test('#[center] gets deckset-pos-center class', () => {
  const html = parseDecksetMarkdown('#[center] Middle');
  assert.ok(html.includes('deckset-pos-center'), 'missing deckset-pos-center');
});

test('#[top] gets deckset-pos-top class', () => {
  const html = parseDecksetMarkdown('#[top] Top text');
  assert.ok(html.includes('deckset-pos-top'), 'missing deckset-pos-top');
});

test('#[bottom] gets deckset-pos-bottom class', () => {
  const html = parseDecksetMarkdown('#[bottom] Bottom text');
  assert.ok(html.includes('deckset-pos-bottom'), 'missing deckset-pos-bottom');
});

test('#[left] gets deckset-pos-left class', () => {
  const html = parseDecksetMarkdown('#[left] Left side');
  assert.ok(html.includes('deckset-pos-left'), 'missing deckset-pos-left');
});

test('#[right] gets deckset-pos-right class', () => {
  const html = parseDecksetMarkdown('#[right] Right side');
  assert.ok(html.includes('deckset-pos-right'), 'missing deckset-pos-right');
});

test('multiple positioned headings get deckset-pos-group wrapper', () => {
  const html = parseDecksetMarkdown('#[top-left] A\n#[bottom-right] B');
  assert.ok(html.includes('deckset-pos-group'), 'missing deckset-pos-group wrapper');
  assert.ok(html.includes('deckset-pos-top-left'), 'missing top-left');
  assert.ok(html.includes('deckset-pos-bottom-right'), 'missing bottom-right');
});

// ── Split layout ──

console.log('\n── Split layout ──');

test('![right] with text creates deckset-split wrapper', () => {
  const html = parseDecksetMarkdown('![right](img.jpg)\n\n# Title\n\nText');
  assert.ok(html.includes('deckset-split'), 'missing deckset-split');
});

test('![left] with text creates deckset-split wrapper', () => {
  const html = parseDecksetMarkdown('![left](img.jpg)\n\n# Title');
  assert.ok(html.includes('deckset-split'), 'missing deckset-split');
});

test('![right] without text creates deckset-split-bg wrapper', () => {
  const html = parseDecksetMarkdown('![right](img.jpg)');
  assert.ok(html.includes('deckset-split-bg'), 'missing deckset-split-bg');
});

// ── Columns ──

console.log('\n── Columns ──');

test(':::columns produces deckset-columns class', () => {
  const md = ':::columns\n## Left\nText\n\n:::\n## Right\nMore\n:::';
  const html = parseDecksetMarkdown(md);
  assert.ok(html.includes('deckset-columns'), 'missing deckset-columns');
});

test('2-column layout has repeat(2, 1fr)', () => {
  const md = ':::columns\n## A\n:::\n## B\n:::';
  const html = parseDecksetMarkdown(md);
  assert.ok(html.includes('repeat(2, 1fr)'), 'should have 2 columns');
});

test('3-column layout has repeat(3, 1fr)', () => {
  const md = ':::columns\n## A\n:::\n## B\n:::\n## C\n:::';
  const html = parseDecksetMarkdown(md);
  assert.ok(html.includes('repeat(3, 1fr)'), 'should have 3 columns');
});

test('columns have deckset-column class', () => {
  const md = ':::columns\n## A\n:::\n## B\n:::';
  const html = parseDecksetMarkdown(md);
  const count = (html.match(/deckset-column"/g) || []).length;
  assert.strictEqual(count, 2, `expected 2 deckset-column, got ${count}`);
});

// ── Data attributes ──

console.log('\n── Data attributes ──');

test('[.background-color: #1e3a5f] sets data-background-color', () => {
  const html = parseDecksetMarkdown('[.background-color: #1e3a5f]\n\n# Title');
  assert.ok(html.includes('data-background-color="#1e3a5f"'), 'missing data-background-color');
});

test('[.autoscale: true] sets data-autoscale="true"', () => {
  const html = parseDecksetMarkdown('[.autoscale: true]\n\n# Title\n\n' + 'Long line of text. '.repeat(15));
  assert.ok(html.includes('data-autoscale="true"'), 'missing data-autoscale');
});

test('autoflow-injected autoscale sets tier attribute', () => {
  // Tier is only set when autoflow injects autoscale (not manual [.autoscale: true])
  // Use \n (not \n\n) so all lines stay in ONE slide, plus a heading to avoid title rule
  const lines = '# Dense Slide\n\n' + Array.from({ length: 20 }, (_, i) => `- Item ${i + 1}`).join('\n');
  const md = '# First\n\n---\n\n' + lines; // slide 2 has the dense content
  const html = parseDecksetMarkdown(md, { autoflow: true });
  assert.ok(html.includes('data-autoscale="true"'), 'missing data-autoscale');
  assert.ok(html.includes('data-autoscale-tier='), 'missing data-autoscale-tier from autoflow');
});

test('[.header: #ff0000] sets heading color CSS variable', () => {
  const html = parseDecksetMarkdown('[.header: #ff0000]\n\n# Red heading');
  assert.ok(html.includes('--r-heading-color: #ff0000'), 'missing --r-heading-color');
});

test('[.text: #00ff00] sets main color CSS variable', () => {
  const html = parseDecksetMarkdown('[.text: #00ff00]\n\nGreen text');
  assert.ok(html.includes('--r-main-color: #00ff00'), 'missing --r-main-color');
});

// ── Fragments ──

console.log('\n── Fragments ──');

test('[.build-lists: true] adds fragment class to li elements', () => {
  const html = parseDecksetMarkdown('[.build-lists: true]\n\n# Title\n\n- A\n- B\n- C');
  const count = (html.match(/class="fragment"/g) || []).length;
  assert.strictEqual(count, 3, `expected 3 fragments, got ${count}`);
});

test('[.build-lists: true] works with ordered lists', () => {
  const html = parseDecksetMarkdown('[.build-lists: true]\n\n1. First\n2. Second\n3. Third');
  const count = (html.match(/class="fragment"/g) || []).length;
  assert.strictEqual(count, 3, `expected 3 fragments, got ${count}`);
});

// ── Alternating colors ──

console.log('\n── Alternating colors ──');

test('[.alternating-colors: true] wraps content in deckset-alternating', () => {
  const html = parseDecksetMarkdown('[.alternating-colors: true]\n\nLine 1\n\nLine 2\n\nLine 3');
  assert.ok(html.includes('deckset-alternating'), 'missing deckset-alternating wrapper');
});

// ── Background images ──

console.log('\n── Background images ──');

test('bare image becomes data-background-image', () => {
  const html = parseDecksetMarkdown('![](photo.jpg)');
  assert.ok(html.includes('data-background-image'), 'missing data-background-image');
});

test('![fit] image sets data-background-size="contain"', () => {
  const html = parseDecksetMarkdown('![fit](photo.jpg)');
  assert.ok(html.includes('data-background-size="contain"'), 'missing contain');
});

test('![filtered] image sets data-background-opacity', () => {
  const html = parseDecksetMarkdown('![filtered](photo.jpg)');
  assert.ok(html.includes('data-background-opacity'), 'missing data-background-opacity');
});

// ── Section structure ──

console.log('\n── Section structure ──');

test('each slide produces one <section>', () => {
  const html = parseDecksetMarkdown('# Slide 1\n\n---\n\n# Slide 2\n\n---\n\n# Slide 3');
  const count = (html.match(/<section/g) || []).length;
  assert.strictEqual(count, 3, `expected 3 sections, got ${count}`);
});

test('slide separator --- creates separate sections', () => {
  const html = parseDecksetMarkdown('A\n\n---\n\nB');
  const count = (html.match(/<\/section>/g) || []).length;
  assert.strictEqual(count, 2, `expected 2 closing sections, got ${count}`);
});

// ── Autoflow data attribute ──

console.log('\n── Autoflow integration ──');

test('autoflow option triggers layout rule (divider for single word)', () => {
  // data-autoflow is set by the autoflow pipeline when a rule applies
  const html = parseDecksetMarkdown('2026', { autoflow: true });
  // Single word "2026" → divider rule → #[fit] heading
  assert.ok(html.includes('deckset-fit'), 'autoflow should apply divider rule → deckset-fit');
});

summary();
