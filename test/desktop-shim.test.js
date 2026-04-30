/**
 * Tests for js/desktop.js — the Tauri/Electron/browser runtime shim.
 *
 * Run: node test/desktop-shim.test.js
 *
 * The shim is an ES module loaded by the renderer; it reads `window` to
 * decide which runtime is active. We can't `require()` it directly from
 * Node, so we simulate the renderer by extracting and evaluating the small
 * detection block against fake `window` objects.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, summary } = require('./helpers/harness');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'desktop.js'), 'utf8');

// Extract the runtime expressions from the source so the test stays in lockstep
// with the actual shim. Each expression is evaluated in a fresh sandbox
// where `window` is whatever the test sets.
function evalShim(fakeWindow) {
  const sandbox = { window: fakeWindow };
  const sourceForNode = SRC
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')
    .replace(/export \{[^}]+\};?/g, '')
    + '\nreturn { IS_TAURI, IS_ELECTRON, IS_DESKTOP, desktopInvoke, tauriInvoke };';
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', sourceForNode);
  return factory(fakeWindow);
}

console.log('\n── desktop.js runtime detection ──');

test('browser only — IS_TAURI/IS_ELECTRON/IS_DESKTOP all false', () => {
  const r = evalShim({});
  assert.strictEqual(r.IS_TAURI, false);
  assert.strictEqual(r.IS_ELECTRON, false);
  assert.strictEqual(r.IS_DESKTOP, false);
});

// Tauri shell removed 2026-04-30 (Phase 3 step 13). IS_TAURI is now a
// permanent `false` export so any straggling caller still imports it
// without crashing — but stale Tauri globals on `window` no longer
// flip it to `true`.
test('Tauri globals on window do NOT flip IS_TAURI back on (shell removed)', () => {
  const r = evalShim({ __TAURI_INTERNALS__: { invoke: () => {} }, isTauri: true });
  assert.strictEqual(r.IS_TAURI, false);
  assert.strictEqual(r.IS_ELECTRON, false);
  assert.strictEqual(r.IS_DESKTOP, false);
});

test('Electron runtime — window.stellardeck.isDesktop', () => {
  const r = evalShim({ stellardeck: { isDesktop: true, invoke: () => {} } });
  assert.strictEqual(r.IS_TAURI, false);
  assert.strictEqual(r.IS_ELECTRON, true);
  assert.strictEqual(r.IS_DESKTOP, true);
});

console.log('\n── desktopInvoke routing ──');

test('routes to window.stellardeck.invoke when Electron is active', async () => {
  const calls = [];
  const r = evalShim({
    stellardeck: { isDesktop: true, invoke: (cmd, args) => { calls.push({ cmd, args, runtime: 'electron' }); return Promise.resolve('ok-electron'); } },
  });
  const result = await r.desktopInvoke('read_markdown', { path: '/x.md' });
  assert.strictEqual(result, 'ok-electron');
  assert.deepStrictEqual(calls, [{ cmd: 'read_markdown', args: { path: '/x.md' }, runtime: 'electron' }]);
});

test('rejects even with __TAURI_INTERNALS__ on window (shell removed)', async () => {
  const r = evalShim({
    __TAURI_INTERNALS__: { invoke: () => Promise.resolve('tauri') },
  });
  await assert.rejects(() => r.desktopInvoke('read_markdown', {}), /No desktop runtime/);
});

test('rejects in pure browser mode', async () => {
  const r = evalShim({});
  await assert.rejects(() => r.desktopInvoke('read_markdown', {}), /No desktop runtime/);
});

test('tauriInvoke alias still works (legacy callers)', async () => {
  const r = evalShim({
    stellardeck: { isDesktop: true, invoke: () => Promise.resolve('aliased') },
  });
  assert.strictEqual(typeof r.tauriInvoke, 'function');
  assert.strictEqual(await r.tauriInvoke('x', {}), 'aliased');
});

summary();
