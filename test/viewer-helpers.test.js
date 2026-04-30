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
  const result = resolveRelativePath('/home/user/deck-project/vibe', '../assets/andrew_jpg.webp');
  assert.strictEqual(result, '/home/user/deck-project/assets/andrew_jpg.webp');
});

test('resolves multiple ../ levels', () => {
  const result = resolveRelativePath('/home/user/deck-project/deep/sub', '../../assets/img.webp');
  assert.strictEqual(result, '/home/user/deck-project/assets/img.webp');
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
// Note: as of 2026-04-30 the Tauri-only `localfile://` scheme was removed
// alongside the Tauri shell. In Electron the `deck://` URL is built by
// window.stellardeck.fileSrc (preload-side), not by this Node-side helper.
// In Node tests, convertFileSrc returns a path-encoded relative form —
// the encoding rules below are still asserted because every shell needs
// them (preserve slashes, encode spaces/unicode per segment).

console.log('\n── convertFileSrc (encoding only — scheme is shell-side) ──');

test('does NOT encode slashes as %2F', () => {
  const result = convertFileSrc('/Users/peas/file.webp');
  assert.ok(!result.includes('%2F'), `should not contain %2F: ${result}`);
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

// ── Integration: resolve + convert ──

console.log('\n── resolve + convert (integration) ──');

test('full pipeline: ../assets/ from vibe/ dir keeps slashes intact', () => {
  const baseDir = '/home/user/deck-project/vibe';
  const relative = '../assets/karpathy-vibe.webp';
  const absolute = resolveRelativePath(baseDir, relative);
  const url = convertFileSrc(absolute);
  // The resolved + encoded path has slashes preserved between segments
  assert.ok(url.includes('home/user/deck-project/assets/karpathy-vibe.webp'),
    `expected resolved path in result, got: ${url}`);
  assert.ok(!url.includes('%2F'), `slashes should NOT be encoded: ${url}`);
});

test('full pipeline: ../../assets/ from deep dir', () => {
  const baseDir = '/home/user/deck-project/old/2019';
  const relative = '../../assets/img.webp';
  const absolute = resolveRelativePath(baseDir, relative);
  const url = convertFileSrc(absolute);
  assert.ok(url.includes('home/user/deck-project/assets/img.webp'),
    `expected resolved path in result, got: ${url}`);
});

// ── Summary ──

summary();
