/**
 * Tests for path utility functions (path resolution, URL conversion)
 *
 * Run: node test/viewer-helpers.test.js
 *
 * Covers bugs found during StellarDeck Tauri integration:
 * - Project root detection (cwd was src-tauri/, not project root)
 * - convertFileSrc encoding slashes (broke image loading)
 * - resolveRelativePath for ../assets/ patterns
 */

const assert = require('assert');
const { test, summary } = require('./helpers/harness');
const { resolveRelativePath, convertFileSrc } = require('../js/path-utils');

// ── resolveRelativePath ──

console.log('\n── resolveRelativePath ──');

test('resolves ../assets/ from subdirectory', () => {
  const result = resolveRelativePath('/Users/peas/presentations-paulo/vibe', '../assets/andrew_jpg.webp');
  assert.strictEqual(result, '/Users/peas/presentations-paulo/assets/andrew_jpg.webp');
});

test('resolves multiple ../ levels', () => {
  const result = resolveRelativePath('/Users/peas/presentations-paulo/deep/sub', '../../assets/img.webp');
  assert.strictEqual(result, '/Users/peas/presentations-paulo/assets/img.webp');
});

test('resolves ./ prefix', () => {
  const result = resolveRelativePath('/Users/peas/project', './assets/img.webp');
  assert.strictEqual(result, '/Users/peas/project/assets/img.webp');
});

test('resolves plain relative path', () => {
  const result = resolveRelativePath('/Users/peas/project', 'img.webp');
  assert.strictEqual(result, '/Users/peas/project/img.webp');
});

test('handles trailing slash in baseDir', () => {
  const result = resolveRelativePath('/Users/peas/project/', '../assets/img.webp');
  assert.strictEqual(result, '/Users/peas/assets/img.webp');
});

test('handles absolute path (no resolution needed)', () => {
  const result = resolveRelativePath('/anything', '/absolute/path/img.webp');
  // absolute paths start with empty segment after split
  assert.ok(result.includes('absolute/path/img.webp'));
});

// ── convertFileSrc ──

console.log('\n── convertFileSrc ──');

test('preserves slashes in path', () => {
  const result = convertFileSrc('/Users/peas/presentations-paulo/assets/img.webp');
  assert.strictEqual(result, 'localfile://localhost/Users/peas/presentations-paulo/assets/img.webp');
});

test('does NOT encode slashes as %2F', () => {
  const result = convertFileSrc('/Users/peas/file.webp');
  assert.ok(!result.includes('%2F'), `URL should not contain %2F: ${result}`);
});

test('encodes spaces in path segments', () => {
  const result = convertFileSrc('/Users/peas/my folder/img.webp');
  assert.ok(result.includes('my%20folder'), `spaces should be encoded: ${result}`);
  assert.ok(!result.includes('%2F'), `slashes should NOT be encoded: ${result}`);
});

test('encodes special characters in filenames', () => {
  const result = convertFileSrc('/Users/peas/café.webp');
  assert.ok(result.includes('caf%C3%A9'), `special chars should be encoded: ${result}`);
});

test('handles path with no special chars', () => {
  const result = convertFileSrc('/simple/path/img.png');
  assert.strictEqual(result, 'localfile://localhost/simple/path/img.png');
});

// ── Integration: resolve + convert ──

console.log('\n── resolve + convert (integration) ──');

test('full pipeline: ../assets/ from vibe/ dir', () => {
  const baseDir = '/Users/peas/presentations-paulo/vibe';
  const relative = '../assets/karpathy-vibe.webp';
  const absolute = resolveRelativePath(baseDir, relative);
  const url = convertFileSrc(absolute);
  assert.strictEqual(url, 'localfile://localhost/Users/peas/presentations-paulo/assets/karpathy-vibe.webp');
});

test('full pipeline: ../../assets/ from deep dir', () => {
  const baseDir = '/Users/peas/presentations-paulo/old/2019';
  const relative = '../../assets/img.webp';
  const absolute = resolveRelativePath(baseDir, relative);
  const url = convertFileSrc(absolute);
  assert.strictEqual(url, 'localfile://localhost/Users/peas/presentations-paulo/assets/img.webp');
});

// ── Summary ──

summary();
