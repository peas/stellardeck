/**
 * Tests that walk every fixture in test/autoflow-fixtures/ and verify the
 * rules they document actually fire on the slides they describe.
 *
 * Each fixture is the SINGLE SOURCE OF TRUTH:
 *   - it's read here in tests
 *   - it's embedded by the docs page (site/src/content/docs/guide/autoflow/<rule>.md)
 *
 * If you break a fixture in the engine, both the test and the doc page
 * stop working at the same time. That's intentional.
 *
 * Run: node test/autoflow-fixtures.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test, summary } = require('./helpers/harness');
const { applyAutoflow, createContext } = require('../autoflow.js');

const FIXTURES_DIR = path.join(__dirname, 'autoflow-fixtures');

// ============================================================
// Helpers
// ============================================================

/**
 * Read a fixture .md, strip its frontmatter, split into raw slides at `---`,
 * and run autoflow on each slide with a SHARED ctx so cross-slide history
 * works (matching the parser's real behavior).
 *
 * Returns { rules: string[], details: string[] }
 */
function runFixture(filename) {
  const md = fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf8');

  // Strip Deckset-style frontmatter: leading `key: value` lines (no --- delimiters).
  // Frontmatter ends at the first line that's NOT a `key: value` and NOT blank.
  const lines = md.split('\n');
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '') continue;  // skip blanks within frontmatter
    if (/^[a-z][a-z0-9_-]*\s*:/i.test(t)) continue;  // looks like key: value
    bodyStart = i;
    break;
  }
  const body = lines.slice(bodyStart).join('\n');

  // Split body into slides at standalone `---` separator lines
  const rawSlides = body.split(/\n---\n/).map(s => s.trim()).filter(Boolean);

  const ctx = createContext();
  const results = rawSlides.map((slideMd, i) => {
    const slideLines = slideMd.split('\n');
    const prevRules = ctx.history.map(h => h.ruleApplied);
    return applyAutoflow(slideLines, i, undefined, prevRules, ctx);
  });

  return {
    slideCount: results.length,
    rules: results.map(r => r.rule),
    details: results.map(r => r.detail),
    ctx,
  };
}

// ============================================================
// Fixture: 00-skip-checks
// ============================================================
console.log('\n── Fixture: 00-skip-checks ──');

test('00-skip-checks: 4 slides, all skip autoflow for known reasons', () => {
  const r = runFixture('00-skip-checks.deck.md');
  assert.equal(r.slideCount, 4);
  // slide 0: cover (regular content) — likely 'default' or 'title' depending
  // slides 1-3: explicit, code, custom-block
  assert.equal(r.rules[1], 'explicit', 'slide 1 should hit `explicit` skip');
  assert.equal(r.rules[2], 'code', 'slide 2 should hit `code` skip');
  assert.equal(r.rules[3], 'custom-block', 'slide 3 should hit `custom-block` skip');
});

// ============================================================
// Fixture: 01-title
// ============================================================
console.log('\n── Fixture: 01-title ──');

test('01-title: slide 0 fires the title rule', () => {
  const r = runFixture('01-title.deck.md');
  assert.equal(r.slideCount, 2);
  assert.equal(r.rules[0], 'title', 'slide 0 should fire title');
  assert.notEqual(r.rules[1], 'title', 'slide 1 should NOT fire title (guard: index === 0)');
});

// ============================================================
// Fixture: 02-divider
// ============================================================
console.log('\n── Fixture: 02-divider ──');

test('02-divider: 3 short single-line slides all fire divider', () => {
  const r = runFixture('02-divider.deck.md');
  assert.equal(r.slideCount, 4);  // cover + 3 dividers
  assert.equal(r.rules[1], 'divider', 'slide 1 should be divider');
  assert.equal(r.rules[2], 'divider', 'slide 2 should be divider');
  assert.equal(r.rules[3], 'divider', 'slide 3 should be divider');
});

// ============================================================
// Fixture: 03-diagonal
// ============================================================
console.log('\n── Fixture: 03-diagonal ──');

test('03-diagonal: 2 question-answer pairs both fire diagonal', () => {
  const r = runFixture('03-diagonal.deck.md');
  assert.equal(r.slideCount, 3);  // cover + 2 diagonals
  assert.equal(r.rules[1], 'diagonal');
  assert.equal(r.rules[2], 'diagonal');
});

// ============================================================
// Fixture: 04-z-pattern
// ============================================================
console.log('\n── Fixture: 04-z-pattern ──');

test('04-z-pattern: 4 short standalone words fire z-pattern', () => {
  const r = runFixture('04-z-pattern.deck.md');
  assert.equal(r.slideCount, 2);  // cover + z-pattern
  assert.equal(r.rules[1], 'z-pattern');
});

// ============================================================
// Fixture: 05-alternating
// ============================================================
console.log('\n── Fixture: 05-alternating ──');

test('05-alternating: 4 short paragraphs fire alternating', () => {
  const r = runFixture('05-alternating.deck.md');
  assert.equal(r.slideCount, 2);  // cover + alternating
  assert.equal(r.rules[1], 'alternating');
});

// ============================================================
// Fixture: 06-statement
// ============================================================
console.log('\n── Fixture: 06-statement ──');

test('06-statement: 3 short statement slides all fire statement', () => {
  const r = runFixture('06-statement.deck.md');
  assert.equal(r.slideCount, 4);  // cover + 3 statements
  assert.equal(r.rules[1], 'statement');
  assert.equal(r.rules[2], 'statement');
  assert.equal(r.rules[3], 'statement');
});

// ============================================================
// Fixture: 07-bare-image-position-variation (the history-based one)
// ============================================================
console.log('\n── Fixture: 07-bare-image-position-variation ──');

test('07-bare-image-position-variation: bare images with text get filtered + text rules', () => {
  const r = runFixture('07-bare-image-position-variation.deck.md');
  assert.equal(r.slideCount, 5);  // cover + 4 bare-image slides
  // Bare images with text now get filtered background + text rules (not position rotation)
  for (let i = 1; i <= 4; i++) {
    assert.notEqual(r.rules[i], 'bare-image-position-variation',
      `slide ${i}: bare image + text should use filtered + text rule, not position variation`);
  }
});

// ============================================================
// Fixture: 08-autoscale
// ============================================================
console.log('\n── Fixture: 08-autoscale ──');

test('08-autoscale: long-text slide fires autoscale', () => {
  const r = runFixture('08-autoscale.deck.md');
  assert.equal(r.slideCount, 2);  // cover + long autoscale
  assert.equal(r.rules[1], 'autoscale');
});

// ============================================================
// Fixture: 09-phrase-bullets (palette anti-monotony)
// ============================================================
console.log('\n── Fixture: 09-phrase-bullets ──');

test('09-phrase-bullets: 4 slides cycle through cards → pills → alternating → staggered', () => {
  const r = runFixture('09-phrase-bullets.deck.md');
  assert.equal(r.slideCount, 5);  // cover + 4 phrase-bullets
  for (let i = 1; i <= 4; i++) {
    assert.equal(r.rules[i], 'phrase-bullets', `slide ${i} should fire phrase-bullets`);
  }
  assert.ok(r.details[1].includes('cards'), '1st: cards');
  assert.ok(r.details[2].includes('pills'), '2nd: pills');
  assert.ok(r.details[3].includes('alternating'), '3rd: alternating');
  assert.ok(r.details[4].includes('staggered'), '4th: staggered');
});

// ============================================================

summary();
