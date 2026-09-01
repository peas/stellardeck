/**
 * Tests for js/qr.js — QR code SVG generation.
 *
 * Run: node test/qr.test.js
 *
 * Regression guard for the 2026-09-01 scanning bug: the SVG was generated
 * with zero quiet zone, so the CSS border-radius on .deckset-qr svg clipped
 * the corners of the finder patterns and cameras could not lock on.
 * buildQRSvg is a pure function (no DOM), imported here via dynamic import
 * since js/qr.js is an ES module.
 */

const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { test, summary } = require('./helpers/harness');

const QUIET_ZONE = 4;

// Minimal stand-in for a qrcode-generator instance: 21×21 (version 1),
// every module dark. Corner positions are what matter for the quiet zone.
function fakeQR(modules, isDark = () => true) {
  return { getModuleCount: () => modules, isDark };
}

async function main() {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'qr.js')).href);
  const { buildQRSvg } = mod;

  test('viewBox includes a 4-module quiet zone on every side', () => {
    const svg = buildQRSvg(fakeQR(21));
    assert.ok(svg.includes(`viewBox="0 0 ${21 + QUIET_ZONE * 2} ${21 + QUIET_ZONE * 2}"`), svg.slice(0, 120));
  });

  test('white background covers the full SVG including the quiet zone', () => {
    const svg = buildQRSvg(fakeQR(21));
    assert.ok(svg.includes(`<rect width="29" height="29" fill="white"/>`));
  });

  test('dark modules are offset by the quiet zone (none touch the SVG edge)', () => {
    const svg = buildQRSvg(fakeQR(21));
    const coords = [...svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="1"/g)]
      .map(m => [Number(m[1]), Number(m[2])]);
    assert.ok(coords.length === 21 * 21, `expected 441 dark modules, got ${coords.length}`);
    for (const [x, y] of coords) {
      assert.ok(x >= QUIET_ZONE && x <= 24, `module at x=${x} inside quiet zone`);
      assert.ok(y >= QUIET_ZONE && y <= 24, `module at y=${y} inside quiet zone`);
    }
  });

  test('module grid maps 1:1 — top-left dark module lands at (4,4)', () => {
    const svg = buildQRSvg(fakeQR(21, (row, col) => row === 0 && col === 0));
    assert.ok(svg.includes('<rect x="4" y="4" width="1" height="1"'));
    assert.strictEqual([...svg.matchAll(/width="1" height="1"/g)].length, 1);
  });

  test('size parameter only affects max-width/max-height, not the grid', () => {
    const svg = buildQRSvg(fakeQR(21), 512);
    assert.ok(svg.includes('max-width:512px;max-height:512px'));
    assert.ok(svg.includes('viewBox="0 0 29 29"'));
  });

  summary();
}

main().catch(e => { console.error(e); process.exit(1); });
