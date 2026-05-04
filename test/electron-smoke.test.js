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

    await it('shows the empty Decks panel on first boot (no file)', async () => {
      // Welcome screen was replaced by an in-sidebar empty state on
      // 2026-05-01. The chrome (activity rail + sidebar) stays put;
      // the Decks panel renders an "Open deck…" button + recents +
      // drop hint, and the slide area shows a quiet placeholder.
      const noDeckClass = await win.evaluate(() => document.body.classList.contains('no-deck'));
      assert.equal(noDeckClass, true, 'expected body.no-deck class on first boot');
      const openBtn = await win.locator('.sb-empty-decks .sb-empty-btn').count();
      assert.equal(openBtn, 1, 'expected an Open deck button in empty Decks panel');
      const placeholder = await win.locator('#empty-slide-placeholder .esp-card').count();
      assert.equal(placeholder, 1, 'expected the slide-area placeholder card');
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

    await it('sidebar decks mode: shows OPEN DECKS list + THIS DECK thumbnails', async () => {
      // Wait for thumbnails to render after the deck loads
      await win.waitForFunction(
        () => document.querySelectorAll('#sb-thumbs .sb-thumb').length > 0,
        null,
        { timeout: 5000 }
      );
      const info = await win.evaluate(() => {
        const headers = Array.from(document.querySelectorAll('.sb-section-header'))
          .map(h => h.textContent.trim());
        const tabs = document.querySelectorAll('#tab-bar .tab');
        const thumbs = document.querySelectorAll('#sb-thumbs .sb-thumb');
        const activeThumb = document.querySelector('#sb-thumbs .sb-thumb.active');
        const totalSlides = (typeof Reveal !== 'undefined') ? Reveal.getTotalSlides() : 0;
        return {
          headerTexts: headers,
          tabCount: tabs.length,
          thumbCount: thumbs.length,
          totalSlides,
          activeThumbIndex: activeThumb ? Number(activeThumb.dataset.index) : -1,
        };
      });
      assert.ok(info.headerTexts.some(t => t.startsWith('OPEN DECKS')),
        `expected "OPEN DECKS" header, got ${info.headerTexts}`);
      assert.ok(info.headerTexts.some(t => t.startsWith('THIS DECK')),
        `expected "THIS DECK" header, got ${info.headerTexts}`);
      assert.equal(info.tabCount, 1, 'one open deck');
      assert.equal(info.thumbCount, info.totalSlides,
        `thumb count ${info.thumbCount} should match slide count ${info.totalSlides}`);
      assert.equal(info.activeThumbIndex, 0, 'first thumb should be active at boot');
    });

    await it('sidebar thumbnail #[fit] mirrors live slide nowrap (no wrap mismatch)', async () => {
      // Regression for the 2026-05-04 bug: thumbs were rebuilt before
      // fitText set white-space:nowrap on .deckset-fit, so the cloned
      // <h1> wrapped where the live slide didn't. Lock the parity.
      // Demo deck slides 0-2 have #[fit] headings on title slides.
      const parity = await win.evaluate(async () => {
        // Find a slide whose .deckset-fit fitText has actually styled.
        const sections = document.querySelectorAll('.reveal .slides > section');
        let targetIdx = -1;
        for (let i = 0; i < sections.length; i++) {
          const fit = sections[i].querySelector('.deckset-fit');
          if (fit && fit.style.whiteSpace === 'nowrap' && fit.style.fontSize) {
            targetIdx = i; break;
          }
        }
        if (targetIdx < 0) return { skip: 'no styled .deckset-fit found' };
        const liveFit = sections[targetIdx].querySelector('.deckset-fit');
        const thumb = document.querySelector(`#sb-thumbs .sb-thumb[data-index="${targetIdx}"] .sb-thumb-content .deckset-fit`);
        return {
          targetIdx,
          live: { ws: liveFit.style.whiteSpace, fs: liveFit.style.fontSize },
          thumb: thumb ? { ws: thumb.style.whiteSpace, fs: thumb.style.fontSize } : null,
        };
      });
      if (parity.skip) {
        console.log(`    (skipped: ${parity.skip})`);
      } else {
        assert.ok(parity.thumb, `expected thumb at index ${parity.targetIdx}, got none`);
        assert.equal(parity.thumb.ws, parity.live.ws, 'whiteSpace mismatch between live slide and thumb');
        assert.equal(parity.thumb.fs, parity.live.fs, 'fontSize mismatch between live slide and thumb');
      }
    });

    await it('sidebar thumbnails: clicking thumb navigates to that slide', async () => {
      const after = await win.evaluate(async () => {
        const target = document.querySelector('#sb-thumbs .sb-thumb[data-index="2"]');
        target?.click();
        await new Promise(r => requestAnimationFrame(r));
        return {
          idx: Reveal.getState().indexh || 0,
          activeIdx: Number(document.querySelector('#sb-thumbs .sb-thumb.active')?.dataset.index ?? -1),
        };
      });
      assert.equal(after.idx, 2);
      assert.equal(after.activeIdx, 2);
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
    });

    await it('sidebar diagnostics mode: renders PROBLEMS header + grouped items', async () => {
      // Diagnostics mode is active from the previous test. Bean-to-bar has at
      // least one diagnostic (see toolbar badge ⚠1 in screenshots).
      const info = await win.evaluate(() => {
        const headerText = document.querySelector('.sb-section-header')?.textContent.trim() || '';
        const groups = document.querySelectorAll('.sb-diag-group').length;
        const items = document.querySelectorAll('.sb-diag-item').length;
        const empty = document.querySelector('.sb-empty');
        return { headerText, groups, items, hasEmpty: !!empty };
      });
      assert.ok(info.headerText.startsWith('PROBLEMS'),
        `expected PROBLEMS header, got "${info.headerText}"`);
      // Either the deck has problems (groups > 0) or shows the empty state.
      // Both are valid outcomes for this smoke; the contract is just "renders".
      if (info.items > 0) {
        assert.ok(info.groups >= 1, 'items present should have at least one group');
      } else {
        assert.ok(info.hasEmpty, 'no items → empty state should be shown');
      }
    });

    await it('sidebar diagnostics: clicking item navigates to the slide', async () => {
      // Skip cleanly if the demo deck has no clickable warnings to test against.
      const itemInfo = await win.evaluate(() => {
        const item = document.querySelector('.sb-diag-item');
        if (!item) return null;
        const slideText = item.querySelector('.sb-diag-slide')?.textContent || '';
        const m = slideText.match(/Slide (\d+)/);
        return m ? { slideNum: Number(m[1]) } : null;
      });
      if (!itemInfo) {
        console.log('    (no per-slide diagnostics to click — passing trivially)');
        return;
      }
      const navigated = await win.evaluate(() => {
        document.querySelector('.sb-diag-item').click();
        return new Promise(r => setTimeout(() => r(Reveal.getState().indexh || 0), 200));
      });
      assert.equal(navigated, itemInfo.slideNum - 1,
        `clicking diag for slide ${itemInfo.slideNum} should navigate to indexh ${itemInfo.slideNum - 1}, got ${navigated}`);
    });

    await it('command palette (Cmd+K) opens, fuzzy-matches, runs the selected command', async () => {
      // Open the palette
      await win.evaluate(async () => {
        const cp = await import('./js/command-palette.js');
        cp.open();
      });
      await win.waitForSelector('#command-palette:not([hidden])', { timeout: 2000 });

      // Filter "exp" — should rank Export commands at top
      const matches = await win.evaluate(() => {
        const input = document.querySelector('.cp-input');
        input.value = 'exp';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return Array.from(document.querySelectorAll('.cp-item .cp-label'))
          .map(el => el.textContent.trim()).slice(0, 5);
      });
      assert.ok(matches.length > 0, 'expected at least one match for "exp"');
      assert.ok(matches[0].toLowerCase().includes('export'),
        `top match for "exp" should be an Export command, got "${matches[0]}"`);

      // Pressing Esc should close
      const closed = await win.evaluate(() => {
        document.querySelector('.cp-input').dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
        return document.getElementById('command-palette').hidden;
      });
      assert.equal(closed, true, 'Escape should close the palette');
    });

    await it('command palette: empty query lists all eligible commands', async () => {
      const count = await win.evaluate(async () => {
        const cp = await import('./js/command-palette.js');
        cp.open();
        return new Promise(r => {
          requestAnimationFrame(() => r(document.querySelectorAll('.cp-item').length));
        });
      });
      // Sanity: we registered a dozen+ commands. Allow some to be hidden by `when` guards.
      assert.ok(count >= 8, `expected ≥8 commands at boot, got ${count}`);
      await win.evaluate(async () => {
        const cp = await import('./js/command-palette.js');
        cp.close();
      });
    });

    await it('right-click on deck row opens context menu with expected items', async () => {
      // Ensure we're in "decks" mode — earlier tests may have left
      // diagnostics or theme mode active.
      await win.evaluate(() => {
        document.querySelector('#activity-rail .rail-btn[data-mode="decks"]').click();
      });
      // Use Playwright's right-click simulation (more reliable than
      // dispatchEvent — MouseEvent('contextmenu') doesn't always trigger
      // browser-attached listeners in Electron's renderer).
      await win.locator('#tab-bar .tab').first().click({ button: 'right' });
      await win.waitForSelector('.ctx-menu', { timeout: 2000 });
      const labels = await win.evaluate(() => {
        const menu = document.querySelector('.ctx-menu');
        return Array.from(menu.querySelectorAll('.ctx-item > .ctx-label'))
          .map(el => el.textContent.trim());
      });
      assert.ok(labels.includes('Reveal in Finder'), `expected Reveal in Finder, got ${labels}`);
      assert.ok(labels.includes('Open in Editor'), `expected Open in Editor in ${labels}`);
      assert.ok(labels.some(l => l === 'Enable Autoflow' || l === 'Disable Autoflow'),
        `expected Autoflow toggle in ${labels}`);
      assert.ok(labels.includes('Embed…'), `expected Embed… in ${labels}`);
      assert.ok(labels.includes('Export to PDF…'), `expected Export to PDF… in ${labels}`);
      assert.ok(labels.includes('Open Assets Folder'), `expected Open Assets Folder in ${labels}`);
      assert.ok(labels.includes('Close Tab'), `expected Close Tab in ${labels}`);
      // Close the menu so it doesn't bleed into next tests
      await win.evaluate(() => document.querySelector('.ctx-menu')?.remove());
    });

    await it('sidebar theme mode: lists themes + schemes, clicking applies', async () => {
      // IMPORTANT: clicking a theme persists to a `.stellar.json` sidecar
      // next to the deck file — i.e. it MUTATES the user's repo. We delete
      // the sidecar at the end of this test so the deck reverts to its
      // frontmatter-defined theme on the next launch.
      const before = await win.evaluate(() => {
        document.querySelector('#activity-rail .rail-btn[data-mode="theme"]').click();
        const items = Array.from(document.querySelectorAll('.sb-theme-item'))
          .map(el => ({ name: el.querySelector('.sb-theme-name').textContent.trim(), active: el.classList.contains('active') }));
        const swatchCount = document.querySelectorAll('.sb-scheme-swatch').length;
        return { itemCount: items.length, items, swatchCount };
      });
      assert.ok(before.itemCount >= 3, `expected ≥3 themes, got ${before.itemCount}`);
      assert.ok(before.swatchCount >= 1, 'active theme should expose at least 1 scheme swatch');

      const switched = await win.evaluate(() => {
        const items = document.querySelectorAll('.sb-theme-item');
        const target = items[1];
        const targetName = target.querySelector('.sb-theme-name').textContent.trim();
        target.click();
        const newActive = document.querySelector('.sb-theme-item.active');
        return {
          targetName,
          activeName: newActive?.querySelector('.sb-theme-name')?.textContent?.trim(),
          revealClass: document.querySelector('.reveal').className,
        };
      });
      assert.equal(switched.activeName, switched.targetName, 'clicked theme should become active');
      assert.match(switched.revealClass, /theme-/);

      // Teardown: restore the deck's pristine state by deleting the sidecar
      // we just wrote. Sidecars are gitignored but deleting keeps the
      // developer's actual workspace from drifting between test runs.
      const sidecarPath = DEMO_DECK.replace(/\.md$/, '.stellar.json');
      await fs.rm(sidecarPath, { force: true });

      await win.evaluate(() => {
        document.querySelector('#activity-rail .rail-btn[data-mode="decks"]').click();
      });
    });

    await it('chrome: Play + Presenter buttons render in titlebar drag region', async () => {
      const info = await win.evaluate(() => {
        const drag = document.getElementById('titlebar-drag');
        const play = document.getElementById('btn-chrome-play');
        const presenter = document.getElementById('btn-chrome-presenter');
        const counter = document.getElementById('titlebar-counter');
        return {
          dragHasButtons: drag?.contains(play) && drag?.contains(presenter),
          playLabel: play?.querySelector('span')?.textContent.trim(),
          presenterLabel: presenter?.querySelector('span')?.textContent.trim(),
          counterText: counter?.textContent.trim() || '',
          // Buttons must opt out of the drag region so they're clickable
          playDrag: play && getComputedStyle(play).webkitAppRegion,
        };
      });
      assert.equal(info.dragHasButtons, true, 'Play+Presenter buttons should be inside #titlebar-drag');
      assert.equal(info.playLabel, 'Play');
      assert.equal(info.presenterLabel, 'Presenter');
      assert.match(info.counterText, /\d+ \/ \d+/, `expected counter like "1 / 19", got "${info.counterText}"`);
    });

    await it('chrome: titleBarStyle hiddenInset (macOS) → draggable region present', async () => {
      // After step 9 the legacy toolbar is gone; the 78px traffic-light pad
      // now lives on #titlebar-drag itself.
      const info = await win.evaluate(() => {
        const dragRegion = document.getElementById('titlebar-drag');
        return {
          hasOverlayClass: document.body.classList.contains('desktop-overlay'),
          hasElectronClass: document.body.classList.contains('electron-app'),
          dragRegionDisplay: dragRegion ? getComputedStyle(dragRegion).display : 'no-element',
          dragRegionPaddingLeft: dragRegion ? getComputedStyle(dragRegion).paddingLeft : 'no-region',
        };
      });
      assert.equal(info.hasOverlayClass, true, 'body needs .desktop-overlay class');
      assert.equal(info.hasElectronClass, true, 'body needs .electron-app class');
      assert.equal(info.dragRegionDisplay, 'flex', `#titlebar-drag should render as flex (counter + actions), got display:${info.dragRegionDisplay}`);
      assert.equal(info.dragRegionPaddingLeft, '78px', `traffic-light pad should be on #titlebar-drag now, got ${info.dragRegionPaddingLeft}`);
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

  // ── Presenter window (Phase 3 step 10) ──
  await describe('Presenter window (Electron BrowserWindow)', async () => {
    let app;
    let mainWin;

    await it('open_presenter_window IPC opens a 2nd BrowserWindow on presenter.html', async () => {
      app = await electron.launch({
        args: [ROOT, DEMO_DECK, `--user-data-dir=${isolatedUserData}`],
        env: { ...process.env, ELECTRON_DEV: '' },
        timeout: 30000,
      });
      mainWin = await app.firstWindow();
      await mainWin.waitForLoadState('domcontentloaded');
      await mainWin.waitForFunction(
        () => document.querySelectorAll('.reveal .slides > section').length > 0,
        null, { timeout: 10000 }
      );
      // Trigger via the IPC the renderer would call from Cmd+P / chrome btn
      const presenterPromise = app.waitForEvent('window');
      await mainWin.evaluate(() => window.stellardeck.invoke('open_presenter_window'));
      const presenterWin = await presenterPromise;
      await presenterWin.waitForLoadState('domcontentloaded');
      assert.match(presenterWin.url(), /presenter\.html/, `expected presenter.html url, got ${presenterWin.url()}`);
      // Stash for the next test
      app._presenterWin = presenterWin;
    });

    await it('presenter receives slide-update via BroadcastChannel after navigation', async () => {
      const presenterWin = app._presenterWin;
      // Navigate the main window to slide 4 (index 3) and wait for the
      // presenter's #counter element to reflect "4 / N".
      await mainWin.evaluate(() => Reveal.slide(3));
      await presenterWin.waitForFunction(() => {
        const t = document.getElementById('counter')?.textContent || '';
        return /^4\s*\/\s*\d+/.test(t);
      }, null, { timeout: 5000 });
      const text = await presenterWin.locator('#counter').textContent();
      assert.match(text, /^4\s*\/\s*\d+/, `presenter counter should be "4 / N", got "${text}"`);
    });

    await it('shuts down cleanly', async () => {
      await app.close();
    });
  });

  // ── Native export pipeline (Phase 3 step 11) ──
  await describe('Native export via IPC (PDF/PNG/grid)', async () => {
    let app;
    let win;
    const exportDir = path.join(SCREENSHOT_DIR, 'exports');

    await it('boots fresh for export tests', async () => {
      await fs.rm(exportDir, { recursive: true, force: true });
      await fs.mkdir(exportDir, { recursive: true });
      app = await electron.launch({
        args: [ROOT, DEMO_DECK, `--user-data-dir=${isolatedUserData}`],
        env: { ...process.env, ELECTRON_DEV: '' },
        timeout: 30000,
      });
      win = await app.firstWindow();
      await win.waitForLoadState('domcontentloaded');
      await win.waitForFunction(
        () => document.querySelectorAll('.reveal .slides > section').length > 0,
        null, { timeout: 10000 }
      );
    });

    await it('export_pdf IPC writes a valid PDF (%PDF- magic, >5KB)', async () => {
      const out = path.join(exportDir, 'bean.pdf');
      const result = await win.evaluate(({ input, output }) =>
        window.stellardeck.invoke('export_pdf', { input, output })
      , { input: DEMO_DECK, output: out });
      assert.equal(result.outputPath, out);
      const buf = await fs.readFile(out);
      assert.ok(buf.length > 5000, `expected PDF >5KB, got ${buf.length}`);
      assert.equal(buf.slice(0, 5).toString(), '%PDF-', `expected %PDF- prefix, got ${buf.slice(0, 5).toString()}`);
    });

    await it('export_png IPC writes one PNG per slide', async () => {
      const out = path.join(exportDir, 'bean-pngs');
      await win.evaluate(({ input, output }) =>
        window.stellardeck.invoke('export_png', { input, output })
      , { input: DEMO_DECK, output: out });
      const files = (await fs.readdir(out)).filter(f => f.endsWith('.png'));
      assert.ok(files.length >= 15, `expected ≥15 PNGs from a 19-slide deck, got ${files.length}`);
      // Verify first file is actually a PNG
      const head = await fs.readFile(path.join(out, files.sort()[0]));
      assert.equal(head.slice(1, 4).toString(), 'PNG', `expected PNG header, got ${head.slice(0, 8).toString('hex')}`);
    });

    await it('shuts down cleanly', async () => {
      await app.close();
    });
  });

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`  ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`);
  console.log(`${'═'.repeat(40)}\n`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(2);
});
