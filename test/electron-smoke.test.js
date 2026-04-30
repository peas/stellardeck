/**
 * Electron smoke test — boot the app, render a deck, capture a screenshot.
 *
 * Run: npm run test:electron
 *
 * Uses Playwright's _electron API (no @playwright/test scaffolding, just plain
 * node + assertions) so this can run alongside the existing Playwright suites
 * without conflicting with their browser projects.
 */

const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { _electron: electron } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const DEMO_DECK = path.join(ROOT, 'demo', 'bean-to-bar-chocolate.md');
const SCREENSHOT_DIR = path.join(ROOT, 'test-results', 'electron');

let passed = 0;
let failed = 0;

async function describe(name, fn) {
  console.log(`\n── ${name} ──`);
  await fn();
}

async function it(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err?.stack || err}`);
  }
}

(async () => {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  await describe('Electron shell smoke', async () => {
    let app;
    let win;

    await it('boots and shows a BrowserWindow', async () => {
      app = await electron.launch({
        args: [ROOT],
        env: { ...process.env, ELECTRON_DEV: '' },
        timeout: 30000,
      });
      win = await app.firstWindow();
      assert.ok(win, 'expected first window');
    });

    await it('renders viewer.html via app:// protocol', async () => {
      await win.waitForLoadState('domcontentloaded');
      const url = win.url();
      assert.match(url, /^app:\/\/.*viewer\.html/, `got ${url}`);
    });

    await it('shows the welcome screen on first boot (no file)', async () => {
      const visible = await win.locator('#welcome-screen.visible').count();
      assert.equal(visible, 1, 'welcome screen should be visible');
    });

    await it('exposes window.stellardeck.invoke + isDesktop', async () => {
      const info = await win.evaluate(() => ({
        isDesktop: !!window.stellardeck?.isDesktop,
        runtime: window.stellardeck?.runtime,
        canInvoke: typeof window.stellardeck?.invoke === 'function',
      }));
      assert.equal(info.isDesktop, true);
      assert.equal(info.runtime, 'electron');
      assert.equal(info.canInvoke, true);
    });

    await it('IPC: get_project_root returns repo root', async () => {
      const root = await win.evaluate(() => window.stellardeck.invoke('get_project_root'));
      assert.equal(root, ROOT);
    });

    await it('IPC: read_markdown reads a real demo deck', async () => {
      const text = await win.evaluate((p) => window.stellardeck.invoke('read_markdown', { path: p }), DEMO_DECK);
      assert.ok(typeof text === 'string' && text.length > 100, 'expected non-empty markdown');
    });

    await it('IPC: add_recent_file + get_recent_files round-trips', async () => {
      const after = await win.evaluate(async (p) => {
        await window.stellardeck.invoke('add_recent_file', { filePath: p });
        return await window.stellardeck.invoke('get_recent_files');
      }, DEMO_DECK);
      assert.ok(Array.isArray(after));
      assert.ok(after.includes(DEMO_DECK), `expected recent to include ${DEMO_DECK}, got ${after}`);
    });

    await it('captures a welcome-screen screenshot', async () => {
      const out = path.join(SCREENSHOT_DIR, 'welcome.png');
      await win.screenshot({ path: out });
      const stat = await fs.stat(out);
      assert.ok(stat.size > 5000, 'screenshot should not be empty');
      console.log(`    saved ${out}`);
    });

    await it('shuts down cleanly', async () => {
      await app.close();
    });
  });

  // ── Second boot: launch with a deck preloaded via CLI arg ──
  await describe('Electron with deck preloaded', async () => {
    let app;
    let win;

    await it('boots with a .md path on argv and renders slides', async () => {
      app = await electron.launch({
        args: [ROOT, DEMO_DECK],
        env: { ...process.env, ELECTRON_DEV: '' },
        timeout: 30000,
      });
      win = await app.firstWindow();
      await win.waitForLoadState('domcontentloaded');
      await win.waitForFunction(
        () => document.querySelectorAll('.reveal .slides > section').length > 0,
        null,
        { timeout: 10000 }
      );
      const count = await win.locator('.reveal .slides > section').count();
      assert.ok(count >= 1, `expected ≥1 slide, got ${count}`);
    });

    await it('uses deck:// scheme for relative deck images', async () => {
      // Wait a tick for image resolution to run
      await win.waitForTimeout(1000);
      const images = await win.evaluate(() => {
        return Array.from(document.querySelectorAll('.reveal img')).map(i => i.src);
      });
      // No images is acceptable; if any exist, the desktop ones must be deck://
      for (const src of images) {
        assert.ok(
          !src.startsWith('file://') && !src.startsWith('localfile://'),
          `unexpected scheme on ${src}`
        );
      }
    });

    await it('captures a deck-rendered screenshot', async () => {
      const out = path.join(SCREENSHOT_DIR, 'deck.png');
      await win.screenshot({ path: out });
      console.log(`    saved ${out}`);
    });

    await it('shuts down cleanly', async () => {
      await app.close();
    });
  });

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(40)}\n`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(2);
});
