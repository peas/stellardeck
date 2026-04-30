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

test('Tauri runtime — __TAURI_INTERNALS__.invoke present', () => {
  const r = evalShim({ __TAURI_INTERNALS__: { invoke: () => {} } });
  assert.strictEqual(r.IS_TAURI, true);
  assert.strictEqual(r.IS_ELECTRON, false);
  assert.strictEqual(r.IS_DESKTOP, true);
});

test('Tauri runtime — fallback via window.isTauri', () => {
  const r = evalShim({ isTauri: true });
  assert.strictEqual(r.IS_TAURI, true);
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

test('routes to __TAURI_INTERNALS__.invoke when Tauri is active', async () => {
  const calls = [];
  const r = evalShim({
    __TAURI_INTERNALS__: { invoke: (cmd, args) => { calls.push({ cmd, args, runtime: 'tauri' }); return Promise.resolve('ok-tauri'); } },
  });
  const result = await r.desktopInvoke('read_markdown', { path: '/x.md' });
  assert.strictEqual(result, 'ok-tauri');
  assert.deepStrictEqual(calls, [{ cmd: 'read_markdown', args: { path: '/x.md' }, runtime: 'tauri' }]);
});

test('Electron wins when both runtimes look present (defensive)', async () => {
  // Shouldn't happen in practice but guards against a stray polyfill or test
  // harness that injects both globals — we want a deterministic order.
  const r = evalShim({
    stellardeck: { isDesktop: true, invoke: () => Promise.resolve('electron') },
    __TAURI_INTERNALS__: { invoke: () => Promise.resolve('tauri') },
  });
  assert.strictEqual(await r.desktopInvoke('read_markdown', {}), 'electron');
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
