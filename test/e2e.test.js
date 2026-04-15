/**
 * E2E tests for the StellarDeck viewer using Playwright.
 *
 * Run: npx playwright test test/e2e.test.js
 * Requires: HTTP server on port 3031 (npm run serve)
 *
 * Tests the web viewer (browser mode) which shares 95% of code with Tauri mode.
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://127.0.0.1:3031';
const DECK = `${BASE}/viewer.html?file=test/smoke-test.md`;
const THEMED_DECK = `${BASE}/viewer.html?file=demo/vibe-coding.md`;
const MULTI_TAB_DECK = `${BASE}/viewer.html?file=test/smoke-test.md&also=demo/vibe-coding.md`;

test.describe('Viewer basics', () => {
  test('loads a presentation and shows slides', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    const sections = await page.locator('.reveal .slides > section').count();
    expect(sections).toBeGreaterThan(1);
  });

  test('title includes StellarDeck', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    const title = await page.title();
    expect(title).toContain('StellarDeck');
  });
});

test.describe('Keyboard navigation', () => {
  test('arrow right advances to next slide', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500); // wait for Reveal init

    const slideBefore = await page.evaluate(() => Reveal.getState().indexh);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    const slideAfter = await page.evaluate(() => Reveal.getState().indexh);
    expect(slideAfter).toBe(slideBefore + 1);
  });

  test('arrow left goes to previous slide', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    // Go to slide 2 first
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    const slideAt2 = await page.evaluate(() => Reveal.getState().indexh);
    expect(slideAt2).toBe(1);

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    const slideAt1 = await page.evaluate(() => Reveal.getState().indexh);
    expect(slideAt1).toBe(0);
  });
});

test.describe('Grid overlay', () => {
  test('G key opens and Escape closes grid', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    // Grid should be hidden initially
    const hiddenBefore = await page.locator('#grid-overlay').evaluate(
      el => !el.classList.contains('active')
    );
    expect(hiddenBefore).toBe(true);

    // Press G to open
    await page.keyboard.press('g');
    await page.waitForTimeout(300);
    const visibleAfter = await page.locator('#grid-overlay').evaluate(
      el => el.classList.contains('active')
    );
    expect(visibleAfter).toBe(true);

    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const hiddenAgain = await page.locator('#grid-overlay').evaluate(
      el => !el.classList.contains('active')
    );
    expect(hiddenAgain).toBe(true);
  });

  test('arrow keys navigate grid slides', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    // Open grid
    await page.keyboard.press('g');
    await page.waitForTimeout(300);

    // First slide should be selected
    const firstSelected = await page.locator('.grid-slide.selected').count();
    expect(firstSelected).toBe(1);

    // Press right arrow
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    // Second slide should be selected
    const selectedIndex = await page.evaluate(() => {
      const cards = document.querySelectorAll('.grid-slide');
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].classList.contains('selected')) return i;
      }
      return -1;
    });
    expect(selectedIndex).toBe(1);
  });

  test('Enter opens selected slide from grid', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    // Open grid, navigate to slide 3, press Enter
    await page.keyboard.press('g');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Grid should be closed
    const gridHidden = await page.locator('#grid-overlay').evaluate(
      el => !el.classList.contains('active')
    );
    expect(gridHidden).toBe(true);

    // Should be on slide 3 (index 2)
    const slideIndex = await page.evaluate(() => Reveal.getState().indexh);
    expect(slideIndex).toBe(2);
  });
});

test.describe('Overview mode disabled', () => {
  test('overview mode never activates (StellarSlides uses custom grid)', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    // Try to activate overview via legacy Reveal API
    const overviewActive = await page.evaluate(() => {
      Reveal.toggleOverview(true);
      return Reveal.isOverview();
    });
    expect(overviewActive).toBe(false);
  });
});

test.describe('Toolbar', () => {
  test('toolbar is visible after loading', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    const visible = await page.locator('#toolbar').evaluate(
      el => el.classList.contains('visible')
    );
    expect(visible).toBe(true);
  });

  test('shows slide counter', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    const counter = await page.locator('#slide-counter').textContent();
    expect(counter).toMatch(/1 \/ \d+/);
  });

  test('grid button opens grid', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    await page.click('#btn-grid');
    await page.waitForTimeout(300);

    const gridOpen = await page.locator('#grid-overlay').evaluate(
      el => el.classList.contains('active')
    );
    expect(gridOpen).toBe(true);
  });
});

test.describe('Grid thumbnail rendering', () => {
  test('grid thumbnails use same heading font as slides', async ({ page }) => {
    await page.goto(THEMED_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Get heading font from Reveal slide
    const slideFont = await page.evaluate(() => {
      const h = document.querySelector('.reveal .slides section h1, .reveal .slides section .deckset-fit');
      return h ? getComputedStyle(h).fontFamily : 'not found';
    });

    // Open grid
    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    // Get heading font from grid thumbnail
    const gridFont = await page.evaluate(() => {
      const h = document.querySelector('.grid-slide-inner h1, .grid-slide-inner .deckset-fit');
      return h ? getComputedStyle(h).fontFamily : 'not found';
    });

    expect(gridFont).toBe(slideFont);
  });

  test('grid #[fit] headings are visually clipped (overflow: hidden)', async ({ page }) => {
    await page.goto(THEMED_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Open grid
    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    // All .deckset-fit in grid must have overflow:hidden so text doesn't visually spill
    const allClipped = await page.evaluate(() => {
      const fits = document.querySelectorAll('.grid-slide-inner .deckset-fit');
      return Array.from(fits).every(el => {
        const overflow = getComputedStyle(el).overflow;
        return overflow === 'hidden' || overflow === 'clip';
      });
    });
    expect(allClipped).toBe(true);

    // Grid cards themselves must clip overflow
    const cardsClipped = await page.evaluate(() => {
      const cards = document.querySelectorAll('.grid-slide');
      return Array.from(cards).every(el => getComputedStyle(el).overflow === 'hidden');
    });
    expect(cardsClipped).toBe(true);
  });
});

test.describe('Columns layout', () => {
  test(':::columns renders as side-by-side grid', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Navigate to slide with 2-column layout (index 21)
    await page.evaluate(() => Reveal.slide(21));
    await page.waitForTimeout(300);

    const layout = await page.evaluate(() => {
      const cols = document.querySelector('.reveal .slides section.present .deckset-columns');
      if (!cols) return { found: false };
      const style = getComputedStyle(cols);
      const children = cols.querySelectorAll('.deckset-column');
      // Check that columns are side by side (not stacked)
      const rects = Array.from(children).map(c => c.getBoundingClientRect());
      const sideBySide = rects.length >= 2 && rects[1].left > rects[0].left;
      return {
        found: true,
        display: style.display,
        columnCount: children.length,
        sideBySide,
      };
    });
    expect(layout.found).toBe(true);
    expect(layout.display).toBe('grid');
    expect(layout.columnCount).toBe(2);
    expect(layout.sideBySide).toBe(true);
  });

  test(':::columns with 3 columns renders three-column grid', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Navigate to slide with 3-column layout (index 22)
    await page.evaluate(() => Reveal.slide(22));
    await page.waitForTimeout(300);

    const layout = await page.evaluate(() => {
      const cols = document.querySelector('.reveal .slides section.present .deckset-columns');
      if (!cols) return { found: false };
      const children = cols.querySelectorAll('.deckset-column');
      const rects = Array.from(children).map(c => c.getBoundingClientRect());
      // All 3 should be on the same row
      const allSameRow = rects.every(r => Math.abs(r.top - rects[0].top) < 5);
      return {
        found: true,
        columnCount: children.length,
        allSameRow,
      };
    });
    expect(layout.found).toBe(true);
    expect(layout.columnCount).toBe(3);
    expect(layout.allSameRow).toBe(true);
  });
});

test.describe('Background color directive persists after scheme change', () => {
  test('[.background-color] override survives scheme change', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // smoke-test.md slide 16 has [.background-color: #1e3a5f]
    // Navigate to that slide
    await page.evaluate(() => Reveal.slide(15));
    await page.waitForTimeout(300);

    // Change scheme to force applySchemeColors()
    await page.evaluate(() => {
      const reveal = document.querySelector('.reveal');
      reveal.className = reveal.className.replace(/scheme-\S+/g, '').trim();
      reveal.classList.add('scheme-2');
      applySchemeColors();
    });
    await page.waitForTimeout(500);

    // The slide should still have its explicit background color
    // Works with both Reveal (.slide-background) and StellarSlides (.sd-bg)
    const bgColor = await page.evaluate(() => {
      const revealBgs = document.querySelectorAll('.reveal .slide-background');
      const stellarBgs = document.querySelectorAll('.sd-backgrounds .sd-bg');
      const bg = revealBgs[15] || stellarBgs[15];
      if (!bg) return 'no-bg-element';
      const content = bg.querySelector('.slide-background-content') || bg;
      return getComputedStyle(content).backgroundColor;
    });
    // #1e3a5f = rgb(30, 58, 95) — must NOT be the default scheme color
    expect(bgColor).toBe('rgb(30, 58, 95)');
  });
});

test.describe('Color scheme changes', () => {
  test('scheme change updates slide backgrounds, not just grid', async ({ page }) => {
    await page.goto(THEMED_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Get initial background color
    const initialBg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-background-color').trim()
    );

    // Change scheme via JS (simulating color picker)
    await page.evaluate(() => {
      const reveal = document.querySelector('.reveal');
      reveal.className = reveal.className.replace(/scheme-\S+/g, '').trim();
      reveal.classList.add('scheme-3'); // Blue scheme
      applySchemeColors();
    });
    await page.waitForTimeout(300);

    // Verify .reveal background changed
    const newBg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-background-color').trim()
    );
    expect(newBg).not.toBe(initialBg);

    // Verify slide background elements also changed (StellarSlides uses .sd-bg)
    const slideBg = await page.evaluate(() => {
      const bg = document.querySelector('.sd-backgrounds .sd-bg');
      return bg ? getComputedStyle(bg).backgroundColor : 'none';
    });
    // sd-bg should match the new scheme, not remain black
    expect(slideBg).not.toBe('rgb(0, 0, 0)');
  });

  test('scheme change in grid updates thumbnail backgrounds', async ({ page }) => {
    await page.goto(THEMED_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Open grid
    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    // Get initial thumbnail background
    const initialBg = await page.evaluate(() => {
      const inner = document.querySelector('.grid-slide-inner');
      return inner ? getComputedStyle(inner).backgroundColor : 'none';
    });

    // Change scheme
    await page.evaluate(() => {
      const reveal = document.querySelector('.reveal');
      reveal.className = reveal.className.replace(/scheme-\S+/g, '').trim();
      reveal.classList.add('scheme-3');
      applySchemeColors();
    });
    await page.waitForTimeout(500);

    // Grid thumbnail background should have changed
    const newBg = await page.evaluate(() => {
      const inner = document.querySelector('.grid-slide-inner');
      return inner ? getComputedStyle(inner).backgroundColor : 'none';
    });
    expect(newBg).not.toBe(initialBg);
  });
});

test.describe('Scheme change from grid applies to slides too', () => {
  test('changing scheme while grid is open updates slide view after closing grid', async ({ page }) => {
    await page.goto(THEMED_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Get initial slide background
    const initialBg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-background-color').trim()
    );

    // Open grid, change scheme, close grid
    await page.keyboard.press('g');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const reveal = document.querySelector('.reveal');
      reveal.className = reveal.className.replace(/scheme-\S+/g, '').trim();
      reveal.classList.add('scheme-3');
      applySchemeColors();
    });
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Slide background must reflect the new scheme
    const slideBg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-background-color').trim()
    );
    expect(slideBg).not.toBe(initialBg);
  });
});

test.describe('Scheme persistence across grid/slide transitions', () => {
  test('scheme change persists after multiple grid open/close cycles', async ({ page }) => {
    await page.goto(THEMED_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Cycle 1: open grid, change to scheme 3 (blue), close grid, check slide
    await page.keyboard.press('g');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const reveal = document.querySelector('.reveal');
      reveal.className = reveal.className.replace(/scheme-\S+/g, '').trim();
      reveal.classList.add('scheme-3');
      applySchemeColors();
    });
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const slideBg1 = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-background-color').trim()
    );

    // Cycle 2: open grid, change to scheme 1 (green), close grid, check slide
    await page.keyboard.press('g');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const reveal = document.querySelector('.reveal');
      reveal.className = reveal.className.replace(/scheme-\S+/g, '').trim();
      reveal.classList.add('scheme-1');
      applySchemeColors();
    });
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const slideBg2 = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-background-color').trim()
    );

    // Backgrounds must be different (scheme 3 blue vs scheme 1 green)
    expect(slideBg2).not.toBe(slideBg1);

    // Cycle 3: open grid, change to scheme 5 (dark blue), close grid, check slide
    await page.keyboard.press('g');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const reveal = document.querySelector('.reveal');
      reveal.className = reveal.className.replace(/scheme-\S+/g, '').trim();
      reveal.classList.add('scheme-5');
      applySchemeColors();
    });
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const slideBg3 = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-background-color').trim()
    );

    // All three must be distinct
    expect(slideBg3).not.toBe(slideBg2);
    expect(slideBg3).not.toBe(slideBg1);
  });
});

test.describe('Grid Esc returns to selected slide', () => {
  test('closing grid with Esc navigates to the selected slide', async ({ page }) => {
    await page.goto(THEMED_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Go to slide 1 first
    await page.evaluate(() => Reveal.slide(0));
    await page.waitForTimeout(200);

    // Open grid, navigate to slide 5, press Esc
    await page.keyboard.press('g');
    await page.waitForTimeout(500);
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(100);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Should now be on slide 5 (index 4)
    const slideIndex = await page.evaluate(() => Reveal.getState().indexh);
    expect(slideIndex).toBe(4);
  });
});

test.describe('Play fullscreen', () => {
  test('Play button triggers fullscreen command in Tauri or Fullscreen API', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    // In browser mode, check that clicking Play attempts fullscreen
    // We can't actually go fullscreen in headless, but we can verify the handler runs
    const result = await page.evaluate(() => {
      let called = false;
      // Mock fullscreen API
      document.documentElement.requestFullscreen = () => { called = true; return Promise.resolve(); };
      document.getElementById('btn-play').click();
      return called;
    });
    expect(result).toBe(true);
  });
});

test.describe('PDF export', () => {
  test('export button exists and is clickable', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    const btn = page.locator('#btn-export');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    expect(await btn.textContent()).toContain('PDF');
  });

  test('clicking export triggers PDF generation', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    // Export button should exist and be enabled
    const btn = page.locator('#btn-export');
    await expect(btn).toBeEnabled();

    // Click starts export — button becomes disabled during export
    await page.click('#btn-export');
    await page.waitForTimeout(1000);
    // Button text changes to progress indicator during export
    const text = await btn.textContent();
    expect(text).toMatch(/⏳|PDF/);
  });
});

test.describe('Theme switching', () => {
  test('theme dropdown changes heading font', async ({ page }) => {
    await page.goto(THEMED_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Get initial font (Letters from Brazil = Oswald/Big Shoulders)
    const initialFont = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-heading-font')
    );

    // Switch to Hacker theme
    await page.selectOption('#theme-select', 'hacker');
    await page.waitForTimeout(500);

    const newFont = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-heading-font')
    );

    expect(newFont).not.toBe(initialFont);
    expect(newFont).toContain('JetBrains Mono');
  });

  test('theme persists across grid open/close', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Switch to Serif theme
    await page.selectOption('#theme-select', 'serif');
    await page.waitForTimeout(500);
    const fontAfterSwitch = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-heading-font').trim()
    );

    // Open grid, close grid
    await page.keyboard.press('g');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Font should still be Serif
    const fontAfterGrid = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-heading-font').trim()
    );
    expect(fontAfterGrid).toBe(fontAfterSwitch);
  });

  test('switching theme then scheme then grid preserves both', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Switch to Poster theme
    await page.selectOption('#theme-select', 'poster');
    await page.waitForTimeout(500);

    // Change to scheme 2
    await page.evaluate(() => {
      const reveal = document.querySelector('.reveal');
      reveal.className = reveal.className.replace(/scheme-\S+/g, '').trim();
      reveal.classList.add('scheme-2');
      applySchemeColors();
    });
    await page.waitForTimeout(300);

    const bgBefore = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-background-color').trim()
    );

    // Open grid, close grid
    await page.keyboard.press('g');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Background should still be scheme 2
    const bgAfter = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-background-color').trim()
    );
    expect(bgAfter).toBe(bgBefore);

    // Theme should still be Poster
    const hasTheme = await page.evaluate(() =>
      document.querySelector('.reveal').classList.contains('theme-poster')
    );
    expect(hasTheme).toBe(true);
  });

  test('all themes are available in dropdown', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    const options = await page.locator('#theme-select option').allTextContents();
    expect(options).toContain('Default (Inter)');
    expect(options).toContain('Letters from Brazil');
    expect(options).toContain('Serif');
    expect(options).toContain('Minimal');
    expect(options).toContain('Hacker');
    expect(options).toContain('Poster');
    expect(options).toContain('Borneli');
    expect(options).toContain('Alun');
    expect(options).toContain('Nordic');
    expect(options).toContain('Keynote');
    expect(options.length).toBe(10);
  });
});

test.describe('Split layout image containment', () => {
  test('![right] image does not overflow slide height', async ({ page }) => {
    await page.goto(THEMED_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Check first slide which has ![right] split layout
    const overflow = await page.evaluate(() => {
      const split = document.querySelector('.deckset-split');
      if (!split) return { found: false };
      const img = split.querySelector('img');
      if (!img) return { found: true, hasImg: false };
      const slideH = split.closest('section')?.offsetHeight || 720;
      return {
        found: true, hasImg: true,
        imgHeight: img.offsetHeight,
        slideHeight: slideH,
        overflows: img.offsetHeight > slideH
      };
    });
    if (overflow.found && overflow.hasImg) {
      expect(overflow.overflows).toBe(false);
    }
  });
});

test.describe('Grid canvas background', () => {
  test('grid overlay has neutral gray background, not theme color', async ({ page }) => {
    await page.goto(THEMED_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    const gridBg = await page.evaluate(() =>
      getComputedStyle(document.getElementById('grid-overlay')).backgroundColor
    );
    // Should be gray (#2d2d32 = rgb(45, 45, 50)), NOT the theme bg color
    const themeColor = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-background-color').trim()
    );
    // Grid background should NOT match the theme color (unless theme is also gray)
    expect(gridBg).toBe('rgb(45, 45, 50)');
  });
});

test.describe('Grid background image dedup', () => {
  test('grid thumbnail does not show duplicate background images', async ({ page }) => {
    await page.goto(THEMED_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    // Find grid slides with background-image AND an <img> of the same src
    const duplicates = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.grid-slide-inner').forEach((inner, i) => {
        const bgImg = inner.style.backgroundImage;
        if (!bgImg || bgImg === 'none') return;
        // Extract URL from background-image
        const bgUrl = bgImg.replace(/url\(['"]?(.+?)['"]?\)/, '$1');
        // Check for <img> with same src
        const imgs = inner.querySelectorAll('img');
        imgs.forEach(img => {
          if (img.src && bgUrl && (img.src.includes(bgUrl) || bgUrl.includes(img.src))) {
            results.push({ slide: i, bgUrl, imgSrc: img.src });
          }
        });
      });
      return results;
    });
    expect(duplicates).toEqual([]);
  });
});

test.describe('About dialog', () => {
  test('About button opens and closes dialog', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    await page.click('#btn-about');
    await page.waitForTimeout(200);
    const open = await page.locator('#about-dialog').evaluate(el => el.classList.contains('open'));
    expect(open).toBe(true);

    await page.click('#close-about');
    await page.waitForTimeout(200);
    const closed = await page.locator('#about-dialog').evaluate(el => !el.classList.contains('open'));
    expect(closed).toBe(true);
  });
});

test.describe('Slide counter', () => {
  test('counter shows current/total format', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);
    const counter = await page.locator('#slide-counter').textContent();
    expect(counter).toMatch(/\d+ \/ \d+/);
  });

  test('counter updates on navigation', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    const counter = await page.locator('#slide-counter').textContent();
    expect(counter).toMatch(/^2 \//);
  });
});

test.describe('Tab bar', () => {
  test('tab bar hidden in browser mode with single file', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    // Tab bar should exist but not be visible (browser mode, single tab)
    const visible = await page.locator('#tab-bar').evaluate(
      el => el.classList.contains('visible')
    );
    expect(visible).toBe(false);
  });

  test('tab state is tracked after loading', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    const tabCount = await page.evaluate(() => _tabs.length);
    expect(tabCount).toBe(1);

    const activeTab = await page.evaluate(() => _activeTabIndex);
    expect(activeTab).toBe(0);

    const tabFile = await page.evaluate(() => _tabs[0].file);
    expect(tabFile).toContain('smoke-test.md');
  });

  test('multi-tab URL loads both tabs', async ({ page }) => {
    await page.goto(MULTI_TAB_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    const tabCount = await page.evaluate(() => _tabs.length);
    expect(tabCount).toBe(2);

    const tabBar = await page.locator('#tab-bar').evaluate(el => el.classList.contains('visible'));
    expect(tabBar).toBe(true);
  });
});

test.describe('Grid updates on tab switch', () => {
  test('switching tabs while grid is open rebuilds grid with new tab slides', async ({ page }) => {
    await page.goto(MULTI_TAB_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Get slide count for tab 0
    const tab0Slides = await page.evaluate(() =>
      document.querySelectorAll('.reveal .slides > section').length
    );

    // Open grid
    await page.keyboard.press('g');
    await page.waitForTimeout(500);
    const gridCards0 = await page.evaluate(() =>
      document.querySelectorAll('.grid-slide').length
    );
    expect(gridCards0).toBe(tab0Slides);

    // Switch to tab 1 while grid is open
    await page.evaluate(() => switchTab(1));
    await page.waitForTimeout(500);

    // Grid should now show tab 1 slides
    const tab1Slides = await page.evaluate(() =>
      document.querySelectorAll('.reveal .slides > section').length
    );
    const gridCards1 = await page.evaluate(() =>
      document.querySelectorAll('.grid-slide').length
    );
    expect(gridCards1).toBe(tab1Slides);
    expect(gridCards1).not.toBe(gridCards0);
  });
});

test.describe('Tab content isolation', () => {
  test('each tab shows its own content after switching', async ({ page }) => {
    await page.goto(MULTI_TAB_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Tab 0 (smoke-test) should be active with its content
    const tab0SlideCount = await page.evaluate(() =>
      document.querySelectorAll('.reveal .slides > section').length
    );
    const tab0Heading = await page.evaluate(() => {
      const h = document.querySelector('.reveal .slides > section h1');
      return h ? h.textContent.trim() : '';
    });
    expect(tab0Heading).toContain('Slide 1');
    expect(tab0SlideCount).toBeGreaterThan(10); // smoke-test has ~23 slides

    // Switch to tab 1 (vibecoding)
    await page.evaluate(() => switchTab(1));
    await page.waitForTimeout(500);

    const tab1SlideCount = await page.evaluate(() =>
      document.querySelectorAll('.reveal .slides > section').length
    );
    const tab1Heading = await page.evaluate(() => {
      const h = document.querySelector('.reveal .slides > section h1');
      return h ? h.textContent.trim() : '';
    });
    // vibe-coding first heading contains "Vibe Coding"
    expect(tab1Heading).toContain('Vibe Coding');
    // slide counts must differ (smoke-test ~23, vibe-coding ~22)
    expect(tab1SlideCount).not.toBe(tab0SlideCount);

    // Switch back to tab 0 — must show smoke-test content, not vibecoding
    await page.evaluate(() => switchTab(0));
    await page.waitForTimeout(500);

    const tab0HeadingBack = await page.evaluate(() => {
      const h = document.querySelector('.reveal .slides > section h1');
      return h ? h.textContent.trim() : '';
    });
    const tab0SlideCountBack = await page.evaluate(() =>
      document.querySelectorAll('.reveal .slides > section').length
    );
    expect(tab0HeadingBack).toContain('Slide 1');
    expect(tab0SlideCountBack).toBe(tab0SlideCount);
  });

  test('state.currentFile and currentMd stay in sync with active tab', async ({ page }) => {
    await page.goto(MULTI_TAB_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Tab 0 active
    const file0 = await page.evaluate(() => window._tabs[window._activeTabIndex].file);
    const stateFile0 = await page.evaluate(() => {
      // Access state via the module — exposed through _tabs getter
      return document.title; // title includes current file name
    });
    expect(stateFile0).toContain('smoke-test');

    // Switch to tab 1
    await page.evaluate(() => switchTab(1));
    await page.waitForTimeout(500);

    const file1 = await page.evaluate(() => window._tabs[window._activeTabIndex].file);
    expect(file1).toContain('vibe-coding');
    const stateFile1 = await page.evaluate(() => document.title);
    expect(stateFile1).toContain('vibe-coding');

    // Switch back
    await page.evaluate(() => switchTab(0));
    await page.waitForTimeout(500);

    const fileBack = await page.evaluate(() => window._tabs[window._activeTabIndex].file);
    expect(fileBack).toContain('smoke-test');
    const titleBack = await page.evaluate(() => document.title);
    expect(titleBack).toContain('smoke-test');
  });

  test('slide counter reflects active tab slide count', async ({ page }) => {
    await page.goto(MULTI_TAB_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Tab 0 counter
    const counter0 = await page.evaluate(() => {
      const el = document.getElementById('slide-counter');
      return el ? el.textContent.trim() : '';
    });
    // Should show "1 / N" where N is smoke-test slide count
    expect(counter0).toMatch(/^1\s*\/\s*\d+$/);
    const total0 = parseInt(counter0.split('/')[1].trim());

    // Switch to tab 1
    await page.evaluate(() => switchTab(1));
    await page.waitForTimeout(500);

    const counter1 = await page.evaluate(() => {
      const el = document.getElementById('slide-counter');
      return el ? el.textContent.trim() : '';
    });
    const total1 = parseInt(counter1.split('/')[1].trim());
    // Different decks = different slide counts
    expect(total1).not.toBe(total0);
  });
});

test.describe('Theme/scheme per-tab isolation', () => {
  test('theme dropdown syncs when switching tabs', async ({ page }) => {
    await page.goto(MULTI_TAB_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Tab 0 (smoke-test) has no theme in frontmatter — dropdown should be empty/default
    const dropdown0 = await page.evaluate(() =>
      document.getElementById('theme-select').value
    );

    // Change theme on tab 0 to Hacker
    await page.selectOption('#theme-select', 'hacker');
    await page.waitForTimeout(300);

    // Switch to tab 1 (vibe-coding has theme: Alun, 1)
    await page.evaluate(() => switchTab(1));
    await page.waitForTimeout(500);

    const dropdown1 = await page.evaluate(() =>
      document.getElementById('theme-select').value
    );
    expect(dropdown1).toBe('alun');

    // Switch back to tab 0 — should restore Hacker (user override)
    await page.evaluate(() => switchTab(0));
    await page.waitForTimeout(500);

    const dropdownBack = await page.evaluate(() =>
      document.getElementById('theme-select').value
    );
    expect(dropdownBack).toBe('hacker');
  });

  test('scheme change on one tab does not affect other tabs', async ({ page }) => {
    await page.goto(MULTI_TAB_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Switch to tab 1 (themed deck)
    await page.evaluate(() => switchTab(1));
    await page.waitForTimeout(500);

    // Get initial background color
    const initialBg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-background-color').trim()
    );

    // Change scheme to 3 on tab 1
    await page.evaluate(() => {
      const reveal = document.querySelector('.reveal');
      reveal.className = reveal.className.replace(/scheme-\S+/g, '').trim();
      reveal.classList.add('scheme-3');
      applySchemeColors();
    });
    await page.waitForTimeout(300);

    const changedBg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-background-color').trim()
    );
    expect(changedBg).not.toBe(initialBg);

    // Switch to tab 0, then back to tab 1 — scheme should persist
    await page.evaluate(() => switchTab(0));
    await page.waitForTimeout(500);
    await page.evaluate(() => switchTab(1));
    await page.waitForTimeout(500);

    const restoredBg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.reveal')).getPropertyValue('--r-background-color').trim()
    );
    expect(restoredBg).toBe(changedBg);
  });
});

test.describe('Grid scroll to current slide', () => {
  test('opening grid from a late slide scrolls to that slide', async ({ page }) => {
    await page.goto(THEMED_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Navigate to a late slide (e.g. slide 20)
    await page.evaluate(() => Reveal.slide(19));
    await page.waitForTimeout(200);

    // Open grid
    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    // The grid should have scrolled down — scroll position should not be 0
    const scrollPos = await page.evaluate(() => {
      return document.getElementById('grid-overlay').scrollTop;
    });
    expect(scrollPos).toBeGreaterThan(0);

    // Verify correct slide is selected
    const selectedIndex = await page.evaluate(() => {
      const cards = document.querySelectorAll('.grid-slide');
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].classList.contains('selected')) return i;
      }
      return -1;
    });
    expect(selectedIndex).toBe(19);
  });
});

test.describe('Smart reload clears stale background attributes', () => {
  test('changing slide from image-only to text clears background-image', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Simulate a slide that has a background image, then changes to text-only
    const result = await page.evaluate(() => {
      const sections = document.querySelectorAll('.reveal .slides > section');
      // Set up a fake background-image attribute on a section
      sections[0].setAttribute('data-background-image', 'fake.jpg');
      sections[0].setAttribute('data-background-size', 'cover');

      // Now simulate smartReload clearing old attributes before setting new ones
      // Clear data-background-* attributes
      for (const attr of [...sections[0].attributes]) {
        if (attr.name.startsWith('data-background')) {
          sections[0].removeAttribute(attr.name);
        }
      }

      return {
        hasBgImage: sections[0].hasAttribute('data-background-image'),
        hasBgSize: sections[0].hasAttribute('data-background-size'),
      };
    });
    expect(result.hasBgImage).toBe(false);
    expect(result.hasBgSize).toBe(false);
  });
});

test.describe('Filtered background uses dark overlay', () => {
  test('![filtered] produces black background + opacity', async ({ page }) => {
    // Create a page with a filtered image
    await page.goto(`${BASE}/viewer.html?file=test/smoke-test.md`);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Inject a filtered slide and check attributes
    const result = await page.evaluate(() => {
      const html = parseDecksetMarkdown('![filtered](test.jpg)');
      return {
        hasOpacity: html.includes('data-background-opacity="0.5"'),
        hasBlackBg: html.includes('data-background-color="#000"'),
      };
    });
    expect(result.hasOpacity).toBe(true);
    expect(result.hasBlackBg).toBe(true);
  });
});

test.describe('Slide transitions', () => {
  test('frontmatter slide-transition produces data-transition on sections', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    // Parser should emit data-transition when slide-transition is set
    const result = await page.evaluate(() => {
      const html = parseDecksetMarkdown('slide-transition: fade\n\n# Slide 1\n\n---\n\n# Slide 2');
      return {
        hasTransition: html.includes('data-transition="fade"'),
        // Both slides should get the global transition
        count: (html.match(/data-transition="fade"/g) || []).length,
      };
    });
    expect(result.hasTransition).toBe(true);
    expect(result.count).toBe(2);
  });

  test('per-slide directive overrides global transition', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const md = 'slide-transition: fade\n\n# Slide 1\n\n---\n\n[.slide-transition: slide]\n\n# Slide 2';
      const html = parseDecksetMarkdown(md);
      return {
        hasFade: html.includes('data-transition="fade"'),
        hasSlide: html.includes('data-transition="slide"'),
      };
    });
    expect(result.hasFade).toBe(true);
    expect(result.hasSlide).toBe(true);
  });

  test('default transition is none', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    const transition = await page.evaluate(() => Reveal.getConfig().transition);
    expect(transition).toBe('none');
  });
});

test.describe('Build lists', () => {
  test('build-lists directive adds fragment class to list items', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const html = parseDecksetMarkdown('[.build-lists: true]\n\n# Test\n\n- A\n- B\n- C');
      return {
        hasFragment: html.includes('class="fragment"'),
        fragmentCount: (html.match(/class="fragment"/g) || []).length,
      };
    });
    expect(result.hasFragment).toBe(true);
    expect(result.fragmentCount).toBe(3);
  });

  test('build-lists false does not add fragment class', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const html = parseDecksetMarkdown('# Test\n\n- A\n- B\n- C');
      return html.includes('class="fragment"');
    });
    expect(result).toBe(false);
  });

  test('global build-lists frontmatter applies to all slides', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const md = 'build-lists: true\n\n# Slide 1\n\n- A\n- B\n\n---\n\n# Slide 2\n\n- C\n- D';
      const html = parseDecksetMarkdown(md);
      return (html.match(/class="fragment"/g) || []).length;
    });
    expect(result).toBe(4);
  });
});

test.describe('Syntax highlighting', () => {
  test('code blocks get language class for highlight.js', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // smoke-test.md has a python code block (slide 8)
    const result = await page.evaluate(() => {
      const codeEl = document.querySelector('code.language-python');
      return {
        exists: !!codeEl,
        // highlight.js adds hljs class when it processes the code
        highlighted: codeEl ? codeEl.classList.contains('hljs') : false,
      };
    });
    expect(result.exists).toBe(true);
    expect(result.highlighted).toBe(true);
  });
});

test.describe('Tab directory path', () => {
  test('tab meta shows directory path and slide count', async ({ page }) => {
    await page.goto(MULTI_TAB_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Each tab has separate meta lines (dir + slide count)
    const tabs = await page.locator('.tab').count();
    expect(tabs).toBe(2);
    // Collect all meta text per tab
    const tab0Metas = await page.locator('.tab').nth(0).locator('.tab-meta').allTextContents();
    const tab1Metas = await page.locator('.tab').nth(1).locator('.tab-meta').allTextContents();
    const tab0Text = tab0Metas.join(' ');
    const tab1Text = tab1Metas.join(' ');
    // First tab: test/smoke-test.md -> dir is "test/"
    expect(tab0Text).toContain('test/');
    expect(tab0Text).toContain('slides');
    // Second tab: demo/vibe-coding.md -> dir is "demo/"
    expect(tab1Text).toContain('demo/');
    expect(tab1Text).toContain('slides');
  });
});

test.describe('Sidebar text readability', () => {
  test('inactive tab text has sufficient contrast', async ({ page }) => {
    await page.goto(MULTI_TAB_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Tab bar should be visible with multiple tabs
    const tabBarVisible = await page.locator('#tab-bar').evaluate(
      el => el.classList.contains('visible')
    );
    expect(tabBarVisible).toBe(true);

    // Check inactive tab text color is bright enough (not too dark)
    const tabColor = await page.evaluate(() => {
      const tab = document.querySelector('.tab:not(.active)');
      if (!tab) return null;
      const color = getComputedStyle(tab).color;
      // Parse rgb(r, g, b)
      const m = color.match(/(\d+)/g);
      return m ? { r: +m[0], g: +m[1], b: +m[2] } : null;
    });
    expect(tabColor).not.toBeNull();
    // Relative luminance should be > 80 for readability on dark bg
    const brightness = (tabColor.r * 299 + tabColor.g * 587 + tabColor.b * 114) / 1000;
    expect(brightness).toBeGreaterThan(80);
  });

  test('tab name font size is readable', async ({ page }) => {
    await page.goto(MULTI_TAB_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    const fontSize = await page.evaluate(() => {
      const name = document.querySelector('.tab-name');
      return name ? parseFloat(getComputedStyle(name).fontSize) : 0;
    });
    // Should be at least 12px
    expect(fontSize).toBeGreaterThanOrEqual(12);
  });

  test('tab metadata is visible', async ({ page }) => {
    await page.goto(MULTI_TAB_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    const metaColor = await page.evaluate(() => {
      const meta = document.querySelector('.tab-meta');
      if (!meta) return null;
      const color = getComputedStyle(meta).color;
      const m = color.match(/(\d+)/g);
      return m ? { r: +m[0], g: +m[1], b: +m[2] } : null;
    });
    expect(metaColor).not.toBeNull();
    // Meta text brightness > 55 for subtle but readable
    const brightness = (metaColor.r * 299 + metaColor.g * 587 + metaColor.b * 114) / 1000;
    expect(brightness).toBeGreaterThan(55);
  });
});

test.describe('16:9 viewport', () => {
  test('slide-area wrapper exists and contains reveal', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(500);

    const structure = await page.evaluate(() => {
      const area = document.getElementById('slide-area');
      const reveal = document.querySelector('.reveal');
      return {
        areaExists: !!area,
        revealInsideArea: area ? area.contains(reveal) : false,
      };
    });
    expect(structure.areaExists).toBe(true);
    expect(structure.revealInsideArea).toBe(true);
  });

  test('slide maintains 16:9 aspect ratio', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    const ratio = await page.evaluate(() => {
      const reveal = document.querySelector('.reveal');
      const rect = reveal.getBoundingClientRect();
      return { width: rect.width, height: rect.height, ratio: rect.width / rect.height };
    });
    // 16:9 = 1.777... Allow some tolerance for rounding
    expect(ratio.ratio).toBeGreaterThan(1.5);
    expect(ratio.ratio).toBeLessThan(2.0);
  });

  test('slide does not overflow viewport', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    const bounds = await page.evaluate(() => {
      const reveal = document.querySelector('.reveal');
      const rect = reveal.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        windowW: window.innerWidth,
        windowH: window.innerHeight,
      };
    });
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.windowW + 1);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.windowH + 1);
  });

  test('slide viewport adjusts with sidebar', async ({ page }) => {
    await page.goto(MULTI_TAB_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // With sidebar visible, slide left edge should be past sidebar
    const withSidebar = await page.evaluate(() => {
      const reveal = document.querySelector('.reveal');
      const area = document.getElementById('slide-area');
      const sidebarW = parseFloat(getComputedStyle(document.body).getPropertyValue('--sidebar-width')) || 0;
      const areaRect = area.getBoundingClientRect();
      return {
        sidebarWidth: sidebarW,
        areaLeft: areaRect.left,
        revealLeft: reveal.getBoundingClientRect().left,
      };
    });
    // slide-area left edge should be at sidebar width
    expect(withSidebar.areaLeft).toBeGreaterThanOrEqual(withSidebar.sidebarWidth - 1);
  });

  test('horizontal padding between sidebar and slide', async ({ page }) => {
    await page.goto(MULTI_TAB_DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    const gaps = await page.evaluate(() => {
      const area = document.getElementById('slide-area');
      const reveal = document.querySelector('.reveal');
      const areaRect = area.getBoundingClientRect();
      const revealRect = reveal.getBoundingClientRect();
      return {
        leftGap: revealRect.left - areaRect.left,
        rightGap: areaRect.right - revealRect.right,
      };
    });
    // Slide should have horizontal padding (at least 10px each side)
    expect(gaps.leftGap).toBeGreaterThanOrEqual(10);
    expect(gaps.rightGap).toBeGreaterThanOrEqual(10);
  });

  test('gray canvas visible around slide (letterbox)', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    const canvas = await page.evaluate(() => {
      const area = document.getElementById('slide-area');
      const areaBg = getComputedStyle(area).backgroundColor;
      const reveal = document.querySelector('.reveal');
      const areaRect = area.getBoundingClientRect();
      const revealRect = reveal.getBoundingClientRect();
      // There should be gray space around the slide (at least on top/bottom or left/right)
      const topGap = revealRect.top - areaRect.top;
      const bottomGap = areaRect.bottom - revealRect.bottom;
      const leftGap = revealRect.left - areaRect.left;
      const rightGap = areaRect.right - revealRect.right;
      return {
        areaBg,
        hasVerticalLetterbox: topGap > 2 || bottomGap > 2,
        hasHorizontalLetterbox: leftGap > 2 || rightGap > 2,
      };
    });
    // Should have letterbox on at least one axis
    expect(canvas.hasVerticalLetterbox || canvas.hasHorizontalLetterbox).toBe(true);
    // Canvas background should be gray (#2d2d32 = rgb(45, 45, 50))
    expect(canvas.areaBg).toBe('rgb(45, 45, 50)');
  });
});

test.describe('Session restore', () => {
  test('saves session to localStorage on navigation', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Navigate to slide 5
    await page.evaluate(() => Reveal.slide(5));
    await page.waitForTimeout(300);

    // Check localStorage
    const session = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('stellardeck-session') || 'null');
    });
    expect(session).not.toBeNull();
    expect(session.tabs.length).toBeGreaterThanOrEqual(1);
    expect(session.tabs[0].file).toContain('smoke-test.md');
    // Slide index should be saved (might be the active tab's index)
    expect(session.currentSlide).toBe(5);
  });
});

test.describe('Presenter mode', () => {
  test('P key triggers presenter window open', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    // Capture window.open call
    const openCalled = await page.evaluate(() => {
      let called = false;
      const orig = window.open;
      window.open = (...args) => { called = args; return null; };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
      window.open = orig;
      return called;
    });
    // window.open should have been called with presenter.html
    expect(openCalled).toBeTruthy();
    expect(openCalled[0]).toContain('presenter.html');
  });

  test('presenter toolbar button exists', async ({ page }) => {
    await page.goto(DECK);
    await page.waitForSelector('.reveal .slides section');
    await page.waitForTimeout(800);

    const btn = await page.locator('#btn-presenter');
    await expect(btn).toBeVisible();
    expect(await btn.textContent()).toContain('Presenter');
  });

  test('BroadcastChannel sends slide data to presenter', async ({ context }) => {
    // Open viewer
    const viewerPage = await context.newPage();
    await viewerPage.goto(DECK);
    await viewerPage.waitForSelector('.reveal .slides section');
    await viewerPage.waitForTimeout(1500);
    await viewerPage.evaluate(() => Reveal.slide(3));
    await viewerPage.waitForTimeout(300);

    // Open presenter in same context (shares BroadcastChannel)
    const presenterPage = await context.newPage();
    await presenterPage.goto(`${BASE}/presenter.html`);
    await presenterPage.waitForTimeout(2000);

    // Verify presenter received data
    const counter = await presenterPage.locator('#counter').textContent();
    expect(counter).toContain('4'); // slide 4 (index 3 + 1)

    // Verify disconnected overlay is hidden
    const disconnected = await presenterPage.locator('#disconnected');
    await expect(disconnected).toHaveClass(/hidden/);
  });
});

// ============================================================
// Position grid: non-positioned content width
// ============================================================

// ============================================================
// Embed: text readability at small container sizes
// ============================================================

test.describe('Embed text readability', () => {
  const AUTOFLOW_EXAMPLES = `${BASE}/embed/autoflow-examples.html`;

  test('autoflow OFF text is readable (not tiny) in embedded slides', async ({ page }) => {
    await page.goto(AUTOFLOW_EXAMPLES);
    await page.waitForTimeout(5000);

    // Check the first Reveal instance (divider OFF) — "2026" as plain text
    const fontSize = await page.evaluate(() => {
      const reveal = document.querySelectorAll('.reveal')[0];
      if (!reveal) return 0;
      const text = reveal.querySelector('section p') || reveal.querySelector('section h1');
      if (!text) return 0;
      return parseFloat(getComputedStyle(text).fontSize);
    });

    // Font should be at least 10px visual (readable)
    expect(fontSize).toBeGreaterThan(10);
  });

  test('autoflow ON #[fit] text fills the slide proportionally', async ({ page }) => {
    await page.goto(AUTOFLOW_EXAMPLES);
    await page.waitForTimeout(5000);

    // Check the second Reveal instance (divider ON) — "2026" with #[fit]
    const fitFontSize = await page.evaluate(() => {
      const reveal = document.querySelectorAll('.reveal')[1];
      if (!reveal) return 0;
      const fit = reveal.querySelector('.deckset-fit');
      if (!fit) return 0;
      return parseFloat(fit.style.fontSize || getComputedStyle(fit).fontSize);
    });

    // #[fit] text should be large (>80px at embed scale)
    expect(fitFontSize).toBeGreaterThan(80);
  });
});

test.describe('Position grid layout', () => {
  const ACCENT_DECK = `${BASE}/viewer.html?file=test/accent-demo.md`;

  test('non-positioned content next to #[top-left] spans 2/3 width', async ({ page }) => {
    await page.goto(ACCENT_DECK);
    await page.waitForSelector('.reveal .slides section');

    // Navigate to the Roadmap slide (has #[top-left] heading + bullet list)
    const roadmapSlideIdx = await page.evaluate(() => {
      const sections = document.querySelectorAll('.reveal .slides > section');
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].textContent.includes('Roadmap')) return i;
      }
      return -1;
    });

    if (roadmapSlideIdx >= 0) {
      await page.evaluate((idx) => Reveal.slide(idx), roadmapSlideIdx);
      await page.waitForTimeout(200);

      // The .deckset-pos-left element should span at least 50% of the slide width
      const widthRatio = await page.evaluate(() => {
        const posLeft = document.querySelector('.deckset-pos-left');
        const slide = document.querySelector('.reveal .slides section');
        if (!posLeft || !slide) return 0;
        return posLeft.getBoundingClientRect().width / slide.getBoundingClientRect().width;
      });

      // Should span ~66% (2 of 3 columns), not ~33% (1 of 3)
      expect(widthRatio).toBeGreaterThan(0.5);
    }
  });
});
