/**
 * unit.test.js — fast unit tests for CLI parsing, file resolution,
 * and diagnostics pure functions. No browser required.
 *
 * Run: node test/unit.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  parseArgs,
  resolveInput,
  listThemes,
  listSchemes,
  CLIError,
  HelpRequested,
} = require('../scripts/export.js');
const { merge, groupWarnings } = require('../diagnostics.js');

const PROJECT_DIR = path.resolve(__dirname, '..');
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(() => { passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); },
                    (e) => { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}\n    ${e.message}`); });
    }
    passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (e) {
    failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}\n    ${e.message}`);
  }
}

// Build a fake argv (prefixed with [node, script.js] like process.argv)
const argv = (...args) => ['/node', '/script.js', ...args];

// ─────────────────────────────────────────────────────────────
// parseArgs — flags, format, validation
// ─────────────────────────────────────────────────────────────

console.log('\n── parseArgs: basic flags ──');

test('positional input → opts.input + default .pdf output', () => {
  const opts = parseArgs(argv('deck.md'));
  assert.strictEqual(opts.input, 'deck.md');
  assert.strictEqual(opts.format, 'pdf');
  assert.strictEqual(opts.output, 'deck.pdf');
});

test('explicit positional output overrides default', () => {
  const opts = parseArgs(argv('deck.md', 'out.pdf'));
  assert.strictEqual(opts.output, 'out.pdf');
});

test('--png format → default output is <name>-slides dir', () => {
  const opts = parseArgs(argv('--png', 'deck.md'));
  assert.strictEqual(opts.format, 'png');
  assert.strictEqual(opts.output, 'deck-slides');
});

test('--grid format → default output is <name>-grid.png', () => {
  const opts = parseArgs(argv('--grid', 'deck.md'));
  assert.strictEqual(opts.format, 'grid');
  assert.strictEqual(opts.output, 'deck-grid.png');
});

test('last format flag wins', () => {
  const opts = parseArgs(argv('--pdf', '--png', '--grid', 'deck.md'));
  assert.strictEqual(opts.format, 'grid');
});

test('defaults: scale=2, port=3032, gridCols=4, json=false, autoflow=false', () => {
  const opts = parseArgs(argv('deck.md'));
  assert.strictEqual(opts.scale, 2);
  assert.strictEqual(opts.port, 3032);
  assert.strictEqual(opts.gridCols, 4);
  assert.strictEqual(opts.json, false);
  assert.strictEqual(opts.autoflow, false);
  assert.strictEqual(opts.theme, null);
  assert.strictEqual(opts.scheme, null);
  assert.strictEqual(opts.slides, null);
});

test('--scale 3 parses as number', () => {
  assert.strictEqual(parseArgs(argv('--scale', '3', 'deck.md')).scale, 3);
});

test('--port 8080 parses', () => {
  assert.strictEqual(parseArgs(argv('--port', '8080', 'deck.md')).port, 8080);
});

test('--grid-cols 5 parses', () => {
  assert.strictEqual(parseArgs(argv('--grid-cols', '5', 'deck.md')).gridCols, 5);
});

test('--theme value captured', () => {
  assert.strictEqual(parseArgs(argv('--theme', 'ostrich', 'deck.md')).theme, 'ostrich');
});

test('--scheme parsed as int', () => {
  assert.strictEqual(parseArgs(argv('--scheme', '3', 'deck.md')).scheme, 3);
});

test('--autoflow sets flag true', () => {
  assert.strictEqual(parseArgs(argv('--autoflow', 'deck.md')).autoflow, true);
});

test('--json sets flag true', () => {
  assert.strictEqual(parseArgs(argv('--json', 'deck.md')).json, true);
});

test('--slides returns a Set', () => {
  const opts = parseArgs(argv('--slides', '1-3', 'deck.md'));
  assert.ok(opts.slides instanceof Set);
  assert.deepStrictEqual([...opts.slides], [1, 2, 3]);
});

test('combining many flags', () => {
  const opts = parseArgs(argv('--theme', 'nordic', '--autoflow', '--scale', '3', '--json', '--slides', '1,5', 'deck.md', 'out.pdf'));
  assert.strictEqual(opts.theme, 'nordic');
  assert.strictEqual(opts.autoflow, true);
  assert.strictEqual(opts.scale, 3);
  assert.strictEqual(opts.json, true);
  assert.strictEqual(opts.output, 'out.pdf');
});

console.log('\n── parseArgs: introspection modes ──');

test('--list-themes sets mode and implies json', () => {
  const opts = parseArgs(argv('--list-themes'));
  assert.strictEqual(opts.mode, 'list-themes');
  assert.strictEqual(opts.json, true);
});

test('--list-schemes <theme> captures theme name', () => {
  const opts = parseArgs(argv('--list-schemes', 'nordic'));
  assert.strictEqual(opts.mode, 'list-schemes');
  assert.strictEqual(opts.listSchemesTheme, 'nordic');
  assert.strictEqual(opts.json, true);
});

test('--list-schemes without theme throws', () => {
  assert.throws(() => parseArgs(argv('--list-schemes')), CLIError);
});

test('--validate <file> sets mode and implies json', () => {
  const opts = parseArgs(argv('--validate', 'deck.md'));
  assert.strictEqual(opts.mode, 'validate');
  assert.strictEqual(opts.input, 'deck.md');
  assert.strictEqual(opts.json, true);
});

test('--validate without input throws', () => {
  assert.throws(() => parseArgs(argv('--validate')), CLIError);
});

console.log('\n── parseArgs: live modes ──');

test('--preview <file> sets mode', () => {
  const opts = parseArgs(argv('--preview', 'talk.md'));
  assert.strictEqual(opts.mode, 'preview');
  assert.strictEqual(opts.input, 'talk.md');
});

test('--preview without input throws', () => {
  assert.throws(() => parseArgs(argv('--preview')), CLIError);
});

test('--preview with --theme and --scheme passes overrides', () => {
  const opts = parseArgs(argv('--preview', '--theme', 'alun', '--scheme', '2', 'talk.md'));
  assert.strictEqual(opts.mode, 'preview');
  assert.strictEqual(opts.theme, 'alun');
  assert.strictEqual(opts.scheme, 2);
});

test('--preview with --autoflow passes autoflow', () => {
  const opts = parseArgs(argv('--preview', '--autoflow', 'talk.md'));
  assert.strictEqual(opts.mode, 'preview');
  assert.strictEqual(opts.autoflow, true);
});

test('--serve sets mode and uses port 3031 by default', () => {
  const opts = parseArgs(argv('--serve'));
  assert.strictEqual(opts.mode, 'serve');
  assert.strictEqual(opts.port, 3031);
});

test('--serve with --port overrides', () => {
  const opts = parseArgs(argv('--serve', '--port', '8080'));
  assert.strictEqual(opts.mode, 'serve');
  assert.strictEqual(opts.port, 8080);
});

console.log('\n── parseArgs: batch mode ──');

test('--input-dir + --output (flag form)', () => {
  const opts = parseArgs(argv('--input-dir', 'decks', '--output', 'dist'));
  assert.strictEqual(opts.inputDir, 'decks');
  assert.strictEqual(opts.output, 'dist');
  assert.strictEqual(opts.input, undefined);
});

test('--input-dir + positional output', () => {
  const opts = parseArgs(argv('--input-dir', 'decks', 'dist'));
  assert.strictEqual(opts.inputDir, 'decks');
  assert.strictEqual(opts.output, 'dist');
});

test('--input-dir without --output throws', () => {
  assert.throws(() => parseArgs(argv('--input-dir', 'decks')), CLIError);
});

console.log('\n── parseArgs: errors & help ──');

test('no positional args throws CLIError', () => {
  assert.throws(() => parseArgs(argv()), CLIError);
});

test('unknown flag throws CLIError', () => {
  assert.throws(() => parseArgs(argv('--nope', 'deck.md')), CLIError);
});

test('--scale without value throws CLIError', () => {
  assert.throws(() => parseArgs(argv('--scale', 'deck.md')), CLIError);
});

test('--scale with non-number throws CLIError', () => {
  assert.throws(() => parseArgs(argv('--scale', 'abc', 'deck.md')), CLIError);
});

test('--theme without value throws CLIError', () => {
  assert.throws(() => parseArgs(argv('--theme')), CLIError);
});

test('--help throws HelpRequested', () => {
  assert.throws(() => parseArgs(argv('--help')), HelpRequested);
});

test('-h throws HelpRequested', () => {
  assert.throws(() => parseArgs(argv('-h')), HelpRequested);
});

test('--help precedence: throws even with other args', () => {
  assert.throws(() => parseArgs(argv('--pdf', 'deck.md', '--help')), HelpRequested);
});

test('--slides with invalid range throws CLIError', () => {
  assert.throws(() => parseArgs(argv('--slides', '5-1', 'deck.md')), CLIError);
  assert.throws(() => parseArgs(argv('--slides', 'abc', 'deck.md')), CLIError);
  assert.throws(() => parseArgs(argv('--slides', '0', 'deck.md')), CLIError);
});

// ─────────────────────────────────────────────────────────────
// resolveInput — file path resolution
// ─────────────────────────────────────────────────────────────

console.log('\n── resolveInput: file paths ──');

test('absolute path to existing file', async () => {
  const abs = path.join(PROJECT_DIR, 'test/smoke-test.md');
  const info = await resolveInput(abs);
  assert.strictEqual(info.path, abs);
  assert.strictEqual(info.relative, 'test/smoke-test.md');
});

test('relative path to existing file', async () => {
  const info = await resolveInput('test/smoke-test.md');
  assert.strictEqual(info.path, path.join(PROJECT_DIR, 'test/smoke-test.md'));
  assert.strictEqual(info.relative, 'test/smoke-test.md');
});

test('cleanup is a function (noop for regular files)', async () => {
  const info = await resolveInput('test/smoke-test.md');
  assert.strictEqual(typeof info.cleanup, 'function');
  info.cleanup(); // should not throw
});

test('nonexistent file rejects', async () => {
  await assert.rejects(() => resolveInput('nonexistent-xyz.md'), /File not found/);
});

test('nonexistent absolute path rejects', async () => {
  await assert.rejects(() => resolveInput('/tmp/definitely-not-here-xyz.md'), /File not found/);
});

// ─────────────────────────────────────────────────────────────
// diagnostics: merge + groupWarnings (pure functions)
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// listThemes / listSchemes — pure functions over constants.js
// ─────────────────────────────────────────────────────────────

console.log('\n── listThemes / listSchemes ──');

test('listThemes returns array with at least 10 themes', () => {
  const themes = listThemes();
  assert.ok(Array.isArray(themes));
  assert.ok(themes.length >= 10);
});

test('listThemes entries have name, label, schemeCount', () => {
  const [first] = listThemes();
  assert.ok('name' in first);
  assert.ok('label' in first);
  assert.ok('schemeCount' in first);
  assert.ok(typeof first.schemeCount === 'number');
});

test('listThemes includes "default" (renamed from empty string)', () => {
  const names = listThemes().map(t => t.name);
  assert.ok(names.includes('default'));
});

test('listSchemes("nordic") returns schemes with bg/fg', () => {
  const result = listSchemes('nordic');
  assert.strictEqual(result.theme, 'nordic');
  assert.ok(Array.isArray(result.schemes));
  assert.ok(result.schemes.length >= 3);
  assert.ok('bg' in result.schemes[0]);
  assert.ok('fg' in result.schemes[0]);
});

test('listSchemes("default") works with renamed default theme', () => {
  const result = listSchemes('default');
  assert.strictEqual(result.theme, 'default');
  assert.ok(result.schemes.length >= 1);
});

test('listSchemes unknown theme throws CLIError with available list', () => {
  assert.throws(
    () => listSchemes('nonexistent'),
    (err) => err instanceof CLIError && err.message.includes('Available:')
  );
});

console.log('\n── diagnostics.merge ──');

test('merges new warnings into empty target', () => {
  const target = [];
  merge(target, [{ type: 'overflow', slide: 1 }, { type: 'missing-image', slide: 2, url: 'a.jpg' }]);
  assert.strictEqual(target.length, 2);
});

test('dedupes by type|slide|url', () => {
  const target = [{ type: 'overflow', slide: 1 }];
  merge(target, [{ type: 'overflow', slide: 1 }]);
  assert.strictEqual(target.length, 1);
});

test('same type, different slide → keeps both', () => {
  const target = [{ type: 'overflow', slide: 1 }];
  merge(target, [{ type: 'overflow', slide: 2 }]);
  assert.strictEqual(target.length, 2);
});

test('same slide, different url → keeps both', () => {
  const target = [{ type: 'missing-image', slide: 1, url: 'a.jpg' }];
  merge(target, [{ type: 'missing-image', slide: 1, url: 'b.jpg' }]);
  assert.strictEqual(target.length, 2);
});

test('null slide (deck-level) dedupes correctly', () => {
  const target = [{ type: 'theme-mismatch', slide: null }];
  merge(target, [{ type: 'theme-mismatch', slide: null }]);
  assert.strictEqual(target.length, 1);
});

test('mutates target in place AND returns it', () => {
  const target = [];
  const result = merge(target, [{ type: 'a', slide: 1 }]);
  assert.strictEqual(result, target);
});

test('incremental merges accumulate', () => {
  const target = [];
  merge(target, [{ type: 'overflow', slide: 1 }]);
  merge(target, [{ type: 'overflow', slide: 1 }, { type: 'overflow', slide: 2 }]);
  merge(target, [{ type: 'missing-image', slide: 1, url: 'x' }]);
  assert.strictEqual(target.length, 3);
});

console.log('\n── diagnostics.groupWarnings ──');

test('counts by type', () => {
  const result = groupWarnings([
    { type: 'overflow', slide: 1 },
    { type: 'overflow', slide: 2 },
    { type: 'missing-image', slide: 3 },
  ]);
  assert.strictEqual(result.byType.overflow, 2);
  assert.strictEqual(result.byType['missing-image'], 1);
  assert.strictEqual(result.count, 3);
});

test('groups by slide', () => {
  const result = groupWarnings([
    { type: 'overflow', slide: 1 },
    { type: 'missing-image', slide: 1, url: 'x' },
    { type: 'overflow', slide: 2 },
  ]);
  assert.strictEqual(result.bySlide[1].length, 2);
  assert.strictEqual(result.bySlide[2].length, 1);
});

test('deck-level warnings (slide: null) grouped as "deck"', () => {
  const result = groupWarnings([
    { type: 'theme-mismatch', slide: null },
  ]);
  assert.strictEqual(result.bySlide.deck.length, 1);
});

test('empty input → empty groups', () => {
  const result = groupWarnings([]);
  assert.strictEqual(result.count, 0);
  assert.deepStrictEqual(result.byType, {});
  assert.deepStrictEqual(result.bySlide, {});
});

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log(`\n${'═'.repeat(40)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(40)}\n`);
  if (failed > 0) process.exit(1);
}, 100);
