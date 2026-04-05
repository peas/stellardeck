/**
 * export.test.js — CLI export tests (unit + integration).
 *
 * Run: node test/export.test.js
 *
 * Unit tests (fast, no browser): parseSlideRange, walkMarkdownFiles,
 *   buildBatchOutputPath.
 * Integration tests (slow, requires browser + dev server on port 3032):
 *   PDF/PNG/grid formats, slide ranges, JSON mode, batch mode.
 *
 * Set EXPORT_SKIP_INTEGRATION=1 to run only unit tests.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  parseSlideRange,
  walkMarkdownFiles,
  buildBatchOutputPath,
  captureSlides,
  run,
  runBatch,
  startSession,
  stopSession,
  captureInSession,
  exportPDF,
  exportPNG,
  exportGrid,
} = require('../scripts/export.js');

const PROJECT_DIR = path.resolve(__dirname, '..');
const SMOKE = 'test/smoke-test.md';
const FIXTURE_DIR = path.join(PROJECT_DIR, 'test/batch-fixture');
const TMP = path.join(PROJECT_DIR, '.test-export-output');

let passed = 0, failed = 0;
const tests = [];

function test(name, fn) { tests.push({ name, fn }); }

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      const result = fn();
      if (result && typeof result.then === 'function') await result;
      passed++;
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } catch (e) {
      failed++;
      console.log(`  \x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${e.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Unit tests — parseSlideRange
// ─────────────────────────────────────────────────────────────

console.log('\n── parseSlideRange ──');

test('single number → set of one', () => {
  const s = parseSlideRange('5');
  assert.strictEqual(s.size, 1);
  assert.ok(s.has(5));
});

test('comma list → each number', () => {
  const s = parseSlideRange('1,3,5');
  assert.strictEqual(s.size, 3);
  assert.ok(s.has(1) && s.has(3) && s.has(5));
  assert.ok(!s.has(2) && !s.has(4));
});

test('range "1-5" → inclusive range', () => {
  const s = parseSlideRange('1-5');
  assert.strictEqual(s.size, 5);
  for (let i = 1; i <= 5; i++) assert.ok(s.has(i));
});

test('mixed "1-3,7,9-11"', () => {
  const s = parseSlideRange('1-3,7,9-11');
  assert.deepStrictEqual([...s].sort((a, b) => a - b), [1, 2, 3, 7, 9, 10, 11]);
});

test('duplicates collapsed', () => {
  const s = parseSlideRange('1,1,2,2-3');
  assert.deepStrictEqual([...s].sort((a, b) => a - b), [1, 2, 3]);
});

test('whitespace is trimmed', () => {
  const s = parseSlideRange('1, 3 , 5');
  assert.strictEqual(s.size, 3);
});

// Invalid input: these call process.exit, so we spy on console.error instead
test('range "10-100" produces 91 slides', () => {
  const s = parseSlideRange('10-100');
  assert.strictEqual(s.size, 91);
});

// ─────────────────────────────────────────────────────────────
// Unit tests — walkMarkdownFiles
// ─────────────────────────────────────────────────────────────

console.log('\n── walkMarkdownFiles ──');

test('finds .md files in fixture tree', () => {
  const files = walkMarkdownFiles(FIXTURE_DIR);
  assert.ok(files.length >= 2, `expected ≥2 files, got ${files.length}`);
  assert.ok(files.every(f => f.endsWith('.md')));
});

test('includes nested directories', () => {
  const files = walkMarkdownFiles(FIXTURE_DIR);
  const hasNested = files.some(f => f.includes('cat-a'));
  assert.ok(hasNested, 'should traverse nested directories');
});

test('returns sorted paths', () => {
  const files = walkMarkdownFiles(FIXTURE_DIR);
  const sorted = [...files].sort();
  assert.deepStrictEqual(files, sorted);
});

test('skips node_modules, .git, old/, reveal.js', () => {
  // Top-level test/ has these decks but also many others; we only check the fixture
  const files = walkMarkdownFiles(FIXTURE_DIR);
  assert.ok(!files.some(f => f.includes('node_modules')));
  assert.ok(!files.some(f => f.includes('.git')));
});

test('empty or non-existent directory returns []', () => {
  const tmpEmpty = path.join(PROJECT_DIR, '.test-empty-dir');
  fs.mkdirSync(tmpEmpty, { recursive: true });
  try {
    assert.deepStrictEqual(walkMarkdownFiles(tmpEmpty), []);
    assert.deepStrictEqual(walkMarkdownFiles('/nonexistent/path/xyz'), []);
  } finally {
    fs.rmSync(tmpEmpty, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────────────────────
// Unit tests — buildBatchOutputPath
// ─────────────────────────────────────────────────────────────

console.log('\n── buildBatchOutputPath ──');

test('PDF: talk.md → dist/talk.pdf', () => {
  assert.strictEqual(
    buildBatchOutputPath('dist', 'talk.md', 'pdf'),
    path.join('dist', 'talk.pdf')
  );
});

test('PNG: talk.md → dist/talk-slides', () => {
  assert.strictEqual(
    buildBatchOutputPath('dist', 'talk.md', 'png'),
    path.join('dist', 'talk-slides')
  );
});

test('Grid: talk.md → dist/talk-grid.png', () => {
  assert.strictEqual(
    buildBatchOutputPath('dist', 'talk.md', 'grid'),
    path.join('dist', 'talk-grid.png')
  );
});

test('Nested: cat/talk.md preserves subdir', () => {
  assert.strictEqual(
    buildBatchOutputPath('dist', 'cat/talk.md', 'pdf'),
    path.join('dist', 'cat', 'talk.pdf')
  );
});

test('Deep nesting preserved', () => {
  assert.strictEqual(
    buildBatchOutputPath('dist', 'a/b/c/talk.md', 'pdf'),
    path.join('dist', 'a', 'b', 'c', 'talk.pdf')
  );
});

// ─────────────────────────────────────────────────────────────
// Integration tests — requires browser + dev server
// ─────────────────────────────────────────────────────────────

const SKIP_INTEGRATION = process.env.EXPORT_SKIP_INTEGRATION === '1';

if (!SKIP_INTEGRATION) {
  console.log('\n── PDF export (integration) ──');

  const pdfOut = path.join(TMP, 'smoke.pdf');
  let pdfResult;

  test('PDF export writes file', async () => {
    fs.mkdirSync(TMP, { recursive: true });
    pdfResult = await run({
      input: SMOKE, output: pdfOut, format: 'pdf',
      port: 3032, scale: 2, slides: parseSlideRange('1-3'),
      theme: null, scheme: null, autoflow: false,
    });
    assert.ok(fs.existsSync(pdfOut), 'PDF not created');
  });

  test('PDF has %PDF- header', () => {
    const header = fs.readFileSync(pdfOut).subarray(0, 5).toString();
    assert.strictEqual(header, '%PDF-');
  });

  test('PDF exported 3 slides (from range 1-3)', () => {
    assert.strictEqual(pdfResult.slides, 3);
  });

  test('PDF reports total slide count', () => {
    assert.ok(pdfResult.totalSlides >= 3, `totalSlides=${pdfResult.totalSlides}`);
  });

  test('PDF result has format=pdf', () => {
    assert.strictEqual(pdfResult.format, 'pdf');
  });

  test('PDF bytes > 10KB', () => {
    assert.ok(pdfResult.bytes > 10000, `bytes=${pdfResult.bytes}`);
  });

  console.log('\n── PNG export (integration) ──');

  const pngDir = path.join(TMP, 'smoke-png');
  let pngResult;

  test('PNG export creates directory with files', async () => {
    pngResult = await run({
      input: SMOKE, output: pngDir, format: 'png',
      port: 3032, scale: 1, slides: parseSlideRange('1,3'),
      theme: null, scheme: null, autoflow: false,
    });
    assert.ok(fs.existsSync(pngDir));
    assert.ok(fs.statSync(pngDir).isDirectory());
  });

  test('PNG files use 3-digit zero-padded index', () => {
    const files = fs.readdirSync(pngDir).sort();
    assert.deepStrictEqual(files, ['001.png', '003.png']);
  });

  test('PNG result.files is array of paths', () => {
    assert.ok(Array.isArray(pngResult.files));
    assert.strictEqual(pngResult.files.length, 2);
    assert.ok(pngResult.files.every(f => f.endsWith('.png')));
  });

  test('PNG result.slides counts exported files', () => {
    assert.strictEqual(pngResult.slides, 2);
  });

  console.log('\n── Grid export (integration) ──');

  const gridOut = path.join(TMP, 'smoke-grid.png');
  let gridResult;

  test('Grid export writes single PNG', async () => {
    gridResult = await run({
      input: SMOKE, output: gridOut, format: 'grid', gridCols: 2,
      port: 3032, scale: 1, slides: parseSlideRange('1-4'),
      theme: null, scheme: null, autoflow: false,
    });
    assert.ok(fs.existsSync(gridOut));
  });

  test('Grid rows/cols reflect layout (4 slides, 2 cols → 2×2)', () => {
    assert.strictEqual(gridResult.rows, 2);
    assert.strictEqual(gridResult.cols, 2);
  });

  test('Grid is a valid PNG', () => {
    const magic = fs.readFileSync(gridOut).subarray(0, 8);
    assert.deepStrictEqual(Array.from(magic), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  console.log('\n── Slide range warnings (integration) ──');

  test('out-of-range slide produces warning, not error', async () => {
    const result = await run({
      input: SMOKE, output: path.join(TMP, 'partial.pdf'), format: 'pdf',
      port: 3032, scale: 1, slides: parseSlideRange('1-2,999'),
      theme: null, scheme: null, autoflow: false,
    });
    assert.strictEqual(result.slides, 2);
    const outOfRange = result.warnings.filter(w => w.type === 'slide-out-of-range');
    assert.strictEqual(outOfRange.length, 1);
    assert.strictEqual(outOfRange[0].slide, 999);
  });

  test('warnings have structured schema', async () => {
    const result = await run({
      input: 'test/batch-fixture/overflow-test.md',
      output: path.join(TMP, 'schema.pdf'), format: 'pdf',
      port: 3032, scale: 1, slides: null,
      theme: null, scheme: null, autoflow: false,
    });
    const w = result.warnings[0];
    assert.ok(w, 'expected at least one warning');
    assert.strictEqual(typeof w, 'object');
    assert.ok('type' in w);
    assert.ok('severity' in w);
    assert.ok('message' in w);
    assert.ok('slide' in w);
    assert.ok(['warn', 'error', 'info'].includes(w.severity));
  });

  console.log('\n── Batch mode (integration) ──');

  const batchOut = path.join(TMP, 'batch');
  let batchResults;

  test('batch exports all fixture decks', async () => {
    batchResults = await runBatch({
      inputDir: 'test/batch-fixture', output: batchOut, format: 'pdf',
      port: 3032, scale: 1, slides: parseSlideRange('1-2'),
      theme: null, scheme: null, autoflow: false,
    });
    assert.ok(batchResults.length >= 2);
    assert.ok(batchResults.every(r => !r.error), JSON.stringify(batchResults));
  });

  test('batch preserves directory structure', () => {
    assert.ok(fs.existsSync(path.join(batchOut, 'smoke.pdf')));
    assert.ok(fs.existsSync(path.join(batchOut, 'cat-a', 'accent-mini.pdf')));
  });

  test('batch result has output paths', () => {
    batchResults.forEach(r => {
      assert.ok(r.output, 'missing output path');
      assert.ok(fs.existsSync(r.output));
    });
  });

  console.log('\n── Warnings: overflow + missing images (integration) ──');

  test('overflow detected on long-content slide', async () => {
    const result = await run({
      input: 'test/batch-fixture/overflow-test.md',
      output: path.join(TMP, 'overflow.pdf'), format: 'pdf',
      port: 3032, scale: 1, slides: null,
      theme: null, scheme: null, autoflow: false,
    });
    const overflows = result.warnings.filter(w => w.type === 'overflow');
    assert.ok(overflows.length > 0, 'expected overflow warning');
    assert.ok(overflows.some(w => w.slide === 2), 'expected slide 2 to overflow');
  });

  test('no overflow warning on well-formed smoke-test', async () => {
    const result = await run({
      input: SMOKE, output: path.join(TMP, 'smoke5.pdf'), format: 'pdf',
      port: 3032, scale: 1, slides: parseSlideRange('1-5'),
      theme: null, scheme: null, autoflow: false,
    });
    const overflows = result.warnings.filter(w => w.type === 'overflow');
    assert.strictEqual(overflows.length, 0,
      `unexpected overflow: ${overflows.map(w => w.message).join('; ')}`);
  });

  test('missing images are reported', async () => {
    const result = await run({
      input: 'test/broken-images-test.md',
      output: path.join(TMP, 'broken.pdf'), format: 'pdf',
      port: 3032, scale: 1, slides: null,
      theme: null, scheme: null, autoflow: false,
    });
    const missing = result.warnings.filter(w => w.type === 'missing-image');
    assert.ok(missing.length >= 2, `expected ≥2 missing-image, got ${missing.length}`);
    assert.ok(missing.some(w => w.url && w.url.includes('nao-existe-xyz.webp')));
  });

  test('chrome assets are not reported as missing', async () => {
    const result = await run({
      input: SMOKE, output: path.join(TMP, 'smoke-clean.pdf'), format: 'pdf',
      port: 3032, scale: 1, slides: parseSlideRange('1'),
      theme: null, scheme: null, autoflow: false,
    });
    const brand = result.warnings.filter(w =>
      w.url && /brand|favicon|stellardeck-simplified/.test(w.url));
    assert.strictEqual(brand.length, 0,
      `chrome assets leaked: ${brand.map(w => w.url).join('; ')}`);
  });

  console.log('\n── Session reuse (integration) ──');

  test('single session captures multiple decks', async () => {
    const session = await startSession({ port: 3032 });
    try {
      const a = await captureInSession(session, SMOKE, {
        scale: 1, theme: null, scheme: null, autoflow: false,
        slides: parseSlideRange('1-2'),
      });
      const b = await captureInSession(session, 'test/batch-fixture/smoke.md', {
        scale: 1, theme: null, scheme: null, autoflow: false,
        slides: parseSlideRange('1'),
      });
      assert.strictEqual(a.slides.length, 2);
      assert.strictEqual(b.slides.length, 1);
    } finally {
      await stopSession(session);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Run + summary
// ─────────────────────────────────────────────────────────────

runTests().then(() => {
  // Cleanup test output
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(40)}\n`);
  if (failed > 0) process.exit(1);
});
