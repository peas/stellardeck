/**
 * Minimal test harness for Node.js unit tests.
 *
 * Usage:
 *   const { test, summary } = require('./helpers/harness');
 *   test('does something', () => { assert.strictEqual(1, 1); });
 *   summary();  // prints results and exits with correct code
 */

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m\u2713\x1b[0m ${name}`);
  } catch (e) {
    failed++;
    console.log(`  \x1b[31m\u2717\x1b[0m ${name}`);
    console.log(`    ${e.message}`);
  }
}

function summary() {
  console.log(`\n${'═'.repeat(40)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(40)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

module.exports = { test, get passed() { return passed; }, get failed() { return failed; }, summary };
