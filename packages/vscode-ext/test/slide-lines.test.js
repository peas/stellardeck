// Pure unit tests for the slide-line offset helper used by diagnostics
// mapping. Runs with plain Node — no vscode dependency, no DOM.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeSlideStartLines } = require('../lib/slide-lines');

test('empty input yields one slide starting at line 0', () => {
  assert.deepEqual(computeSlideStartLines(''), [0]);
});

test('single slide with no separator', () => {
  const md = '# Hello\n\nbody';
  assert.deepEqual(computeSlideStartLines(md), [0]);
});

test('two slides separated by --- ', () => {
  const md = ['# One', '', '---', '# Two', ''].join('\n');
  // Slide 0 starts at line 0, slide 1 starts on the line after `---` (line 3).
  assert.deepEqual(computeSlideStartLines(md), [0, 3]);
});

test('frontmatter is treated as part of slide 0 — first start is 0', () => {
  const md = [
    'theme: Alun, 1',
    'autoflow: true',
    '',
    '# First',
    '---',
    '# Second',
  ].join('\n');
  assert.deepEqual(computeSlideStartLines(md), [0, 5]);
});

test('--- inside fenced code block is NOT a separator', () => {
  const md = [
    '# Code',                         // 0
    '',                               // 1
    '```yaml',                        // 2
    'foo: bar',                       // 3
    '---',                            // 4 — inside fence, ignored
    'baz: qux',                       // 5
    '```',                            // 6
    '---',                            // 7 — real separator
    '# Next',                         // 8
  ].join('\n');
  assert.deepEqual(computeSlideStartLines(md), [0, 8]);
});

test('separator on the very last line is ignored (no slide follows)', () => {
  const md = ['# Only', '---'].join('\n');
  assert.deepEqual(computeSlideStartLines(md), [0]);
});

test('trailing whitespace on --- still counts as separator', () => {
  const md = ['# A', '---  ', '# B'].join('\n');
  assert.deepEqual(computeSlideStartLines(md), [0, 2]);
});

test('many slides — index N maps to start of slide N', () => {
  const md = ['a', '---', 'b', '---', 'c', '---', 'd'].join('\n');
  // line indexes:        0   1     2   3     4   5     6
  const starts = computeSlideStartLines(md);
  assert.deepEqual(starts, [0, 2, 4, 6]);
  // sanity: a warning on slide 2 should map to line 4
  assert.equal(starts[2], 4);
});
