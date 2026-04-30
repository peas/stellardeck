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

let skipped = 0;
function skip(name, _fn, reason) {
  skipped++;
  console.log(`  ⊘ ${name}  [skip: ${reason || 'pending'}]`);
}

(async () => {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  // Use an isolated userData directory so previous runs (or a developer's
  // real recent files / saved session) don't leak into the test app and
  // change which screen renders at boot.
  const isolatedUserData = path.join(SCREENSHOT_DIR, 'userData');
  await fs.rm(isolatedUserData, { recursive: true, force: true });
  await fs.mkdir(isolatedUserData, { recursive: true });

  await describe('Electron shell smoke', async () => {
    let app;
    let win;

    await it('boots and shows a BrowserWindow', async () => {
      app = await electron.launch({
        args: [ROOT, `--user-data-dir=${isolatedUserData}`],
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

    await it('IPC: read_file on missing path resolves to null (no throw)', async () => {
      const result = await win.evaluate(() =>
        window.stellardeck.invoke('read_file', { path: '/nonexistent/path/no-such-sidecar.json' })
      );
      assert.equal(result, null, 'ENOENT should yield null so renderer try/catch is clean');
    });

    await it('IPC: write_file → read_file round-trip in temp dir', async () => {
      const tmpFile = path.join(SCREENSHOT_DIR, 'roundtrip.txt');
      await win.evaluate(async (p) => {
        await window.stellardeck.invoke('write_file', { path: p, content: 'hello-stellardeck\n' });
      }, tmpFile);
      const readBack = await win.evaluate((p) =>
        window.stellardeck.invoke('read_file', { path: p })
      , tmpFile);
      assert.equal(readBack, 'hello-stellardeck\n');
      await fs.unlink(tmpFile).catch(() => {});
    });

    // NOTE: we considered an end-to-end "app:// rejects ../../etc/passwd" test
    // but the WHATWG URL parser normalizes `..` segments before fetch hits the
    // protocol handler, so a renderer can't actually express a traversal here.
    // The defense-in-depth `startsWith(ROOT)` check in main.js stays as a
    // belt-and-suspenders guard. If we ever bypass URL normalization (e.g. via
    // `webContents.loadURL` from main), this becomes worth testing.

    await it('deck:// serves arbitrary local files (Tauri parity, no allowlist)', async () => {
      // Decks reference assets in shared dirs above the deck folder. Confirm
      // we serve any local file rather than enforce a directory whitelist.
      const tmpAsset = path.join(SCREENSHOT_DIR, 'asset.txt');
      await fs.writeFile(tmpAsset, 'asset-payload');
      const url = `deck://./${encodeURI(tmpAsset).replace(/^\/+/, '')}`;
      const body = await win.evaluate((u) => fetch(u).then(r => r.ok ? r.text() : `status:${r.status}`), url);
      assert.equal(body, 'asset-payload');
      await fs.unlink(tmpAsset).catch(() => {});
    });

    await it('IPC: file watcher emits file-changed on mutation', async () => {
      const tmpDeck = path.join(SCREENSHOT_DIR, 'watched.md');
      await fs.writeFile(tmpDeck, '# v1\n');
      // Subscribe in renderer, ask main to watch, then mutate from Node.
      const promise = win.evaluate((p) => new Promise((resolve) => {
        const off = window.stellardeck.onFileChanged((payload) => {
          if (payload.path === p) { off(); resolve(payload); }
        });
        window.stellardeck.invoke('watch_file', { path: p });
      }), tmpDeck);
      // Give chokidar a beat to register the path before we mutate.
      await new Promise(r => setTimeout(r, 250));
      await fs.writeFile(tmpDeck, '# v2\n');
      const payload = await Promise.race([
        promise,
        new Promise((_, rej) => setTimeout(() => rej(new Error('watcher timeout')), 5000)),
      ]);
      assert.equal(payload.path, tmpDeck);
      await win.evaluate((p) => window.stellardeck.invoke('unwatch_file', { path: p }), tmpDeck);
      await fs.unlink(tmpDeck).catch(() => {});
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
        args: [ROOT, DEMO_DECK, `--user-data-dir=${isolatedUserData}`],
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

    await it('uses deck:// scheme for at least one deck image', async () => {
      await win.waitForTimeout(1500);
      const images = await win.evaluate(() =>
        Array.from(document.querySelectorAll('.reveal img'))
          .map(i => i.currentSrc || i.src)
      );
      assert.ok(images.length > 0, 'demo deck should render at least one image');
      const deckScheme = images.filter(s => s.startsWith('deck://'));
      assert.ok(deckScheme.length > 0, `expected ≥1 deck:// image, got ${images.slice(0, 3).join(', ')}`);
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

    await it('activity rail: visible 48px wide, 3 mode buttons, default mode "decks"', async () => {
      const info = await win.evaluate(() => {
        const rail = document.getElementById('activity-rail');
        if (!rail) return { found: false };
        const cs = getComputedStyle(rail);
        const buttons = Array.from(rail.querySelectorAll('.rail-btn'));
        return {
          found: true,
          hidden: rail.hasAttribute('hidden'),
          display: cs.display,
          width: cs.width,
          buttonCount: buttons.length,
          modes: buttons.map(b => b.dataset.mode),
          activeMode: document.body.dataset.sidebarMode,
          activeBtn: buttons.findIndex(b => b.classList.contains('active')),
        };
      });
      assert.equal(info.found, true);
      assert.equal(info.hidden, false, 'rail should be unhidden in desktop mode');
      assert.equal(info.display, 'flex', `rail display should be flex, got ${info.display}`);
      assert.equal(info.width, '48px', `rail width should be 48px, got ${info.width}`);
      assert.equal(info.buttonCount, 3);
      assert.deepEqual(info.modes, ['decks', 'diagnostics', 'theme']);
      assert.equal(info.activeMode, 'decks');
      assert.equal(info.activeBtn, 0, 'first button should be active');
    });

    await it('activity rail: clicking diagnostics button switches mode', async () => {
      const after = await win.evaluate(() => {
        const btn = document.querySelector('#activity-rail .rail-btn[data-mode="diagnostics"]');
        btn.click();
        return {
          activeMode: document.body.dataset.sidebarMode,
          activeBtn: Array.from(document.querySelectorAll('#activity-rail .rail-btn'))
            .findIndex(b => b.classList.contains('active')),
        };
      });
      assert.equal(after.activeMode, 'diagnostics');
      assert.equal(after.activeBtn, 1);
      // Reset so subsequent tests start from "decks"
      await win.evaluate(() => {
        document.querySelector('#activity-rail .rail-btn[data-mode="decks"]').click();
      });
    });

    await it('chrome: titleBarStyle hiddenInset (macOS) → draggable region present', async () => {
      // body.desktop-overlay flips on the always-present #titlebar-drag region
      // and the 78px left-pad on the toolbar (so the traffic lights have room).
      const info = await win.evaluate(() => {
        const dragRegion = document.getElementById('titlebar-drag');
        const toolbar = document.getElementById('toolbar');
        return {
          hasOverlayClass: document.body.classList.contains('desktop-overlay'),
          hasElectronClass: document.body.classList.contains('electron-app'),
          dragRegionDisplay: dragRegion ? getComputedStyle(dragRegion).display : 'no-element',
          toolbarPaddingLeft: toolbar ? getComputedStyle(toolbar).paddingLeft : 'no-toolbar',
        };
      });
      assert.equal(info.hasOverlayClass, true, 'body needs .desktop-overlay class');
      assert.equal(info.hasElectronClass, true, 'body needs .electron-app class');
      assert.equal(info.dragRegionDisplay, 'block', `#titlebar-drag should be visible, got display:${info.dragRegionDisplay}`);
      assert.equal(info.toolbarPaddingLeft, '78px', `toolbar should have 78px left padding for traffic lights, got ${info.toolbarPaddingLeft}`);
    });

    await it('shuts down cleanly', async () => {
      await app.close();
    });
  });

  // ── Third boot: multi-deck precedence regression ──
  // Bug we hit on 2026-04-30: launching `electron . a.md b.md c.md` only
  // showed the deck saved in localStorage from a previous session. URL
  // params (file=… / also=…) must win over restored session.
  await describe('Multi-deck precedence: URL beats session', async () => {
    const HAND = path.join(ROOT, 'demo', 'hand-balancing.md');
    const VIBE = path.join(ROOT, 'demo', 'vibe-coding.md');
    let app;
    let win;

    await it('opens 3 decks via argv even with stale session in localStorage', async () => {
      app = await electron.launch({
        args: [ROOT, DEMO_DECK, HAND, VIBE, `--user-data-dir=${isolatedUserData}`],
        env: { ...process.env, ELECTRON_DEV: '' },
        timeout: 30000,
      });
      win = await app.firstWindow();
      await win.waitForLoadState('domcontentloaded');

      // Plant a stale session that points at a different single deck. If the
      // bug regresses, this would override the URL params and we'd see 1 tab.
      await win.evaluate((stalePath) => {
        localStorage.setItem('stellardeck-session', JSON.stringify({
          tabs: [{ file: stalePath, slideIndex: 0 }],
          activeTabIndex: 0,
          currentSlide: 0,
        }));
      }, '/tmp/does-not-exist.md');

      // Reload so main() runs with both URL params AND the stale session present.
      await win.reload();
      await win.waitForFunction(
        () => document.querySelectorAll('.reveal .slides > section').length > 0,
        null,
        { timeout: 15000 }
      );
      await win.waitForTimeout(500);
      const tabs = await win.evaluate(() => (window._tabs || []).map(t => t.file));
      assert.equal(tabs.length, 3, `expected 3 tabs from URL, got ${tabs.length}: ${tabs}`);
      assert.ok(tabs.includes(DEMO_DECK));
      assert.ok(tabs.includes(HAND));
      assert.ok(tabs.includes(VIBE));
    });

    await it('shuts down cleanly', async () => {
      await app.close();
    });
  });

  // ── Phase 3 prep: contracts written, skipped until implementation lands ──
  await describe('Phase 3 contracts (skipped)', async () => {
    skip('open_presenter_window IPC opens a 2nd BrowserWindow on /presenter.html',
      async () => {/* await app.windows() length === 2; second.url() includes presenter.html */},
      'presenter window not yet implemented in Electron shell (main.js:200)');

    skip('presenter window receives state-update via BroadcastChannel',
      async () => {/* navigate main, assert presenter #counter updates */},
      'depends on open_presenter_window');

    skip('export_pdf IPC writes a valid PDF (%PDF- prefix, >10KB)',
      async () => {/* invoke export_pdf, read bytes, assert magic + size */},
      'PDF export not yet implemented in Electron shell (main.js:205)');

    skip('export_png IPC writes one PNG per slide',
      async () => {/* invoke export_png to dir, count files === slide count */},
      'depends on export_pdf');
  });

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`  ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`);
  console.log(`${'═'.repeat(40)}\n`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(2);
});
