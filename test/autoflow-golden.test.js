/**
 * Golden snapshot of autoflow over every deck in the repo.
 *
 * Runs each deck through the real parser path (scripts/autoflow-snapshot.js)
 * and compares rule + rewritten lines per slide against
 * test/autoflow-golden.json. A refactor must leave it untouched; an
 * intentional behavior change regenerates it, and the JSON diff in the
 * commit is the review of what changed on which slide.
 *
 * Run:              node test/autoflow-golden.test.js
 * Regenerate:       UPDATE_GOLDEN=1 node test/autoflow-golden.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test, summary } = require('./helpers/harness');
const { snapshotPaths } = require('../scripts/autoflow-snapshot.js');

const ROOT = path.join(__dirname, '..');
const GOLDEN = path.join(__dirname, 'autoflow-golden.json');
const CORPUS = [
  'demo',
  'test/autoflow-fixtures',
  'test/batch-fixture',
  ...fs.readdirSync(__dirname).filter(f => f.endsWith('.md')).map(f => path.join('test', f)),
].map(p => path.join(ROOT, p));

console.log('\n── autoflow golden snapshot ──');

const actual = snapshotPaths(CORPUS, ROOT);

if (process.env.UPDATE_GOLDEN) {
  fs.writeFileSync(GOLDEN, JSON.stringify(actual, null, 1) + '\n');
  const n = Object.values(actual).reduce((s, d) => s + d.length, 0);
  console.log(`  wrote ${path.relative(ROOT, GOLDEN)}: ${Object.keys(actual).length} decks, ${n} slides`);
} else {
  const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));

  test('corpus covers the same decks as the golden file', () => {
    assert.deepStrictEqual(Object.keys(actual).sort(), Object.keys(golden).sort());
  });

  for (const deck of Object.keys(golden)) {
    test(`${deck} (${golden[deck].length} slides)`, () => {
      const got = actual[deck] || [];
      const want = golden[deck];
      for (let i = 0; i < Math.max(got.length, want.length); i++) {
        assert.deepStrictEqual(got[i], want[i], `slide ${i + 1} differs`);
      }
    });
  }
}

summary();
