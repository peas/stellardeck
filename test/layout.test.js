/**
 * Layout E2E tests — verify CSS layout correctness via Playwright.
 *
 * Tests positioning, overlap, containment, aspect ratio, backgrounds,
 * font sizing, and layout direction for all major slide types.
 *
 * Uses test/helpers/layout-assertions.js for reusable helpers.
 */

const { test, expect } = require('@playwright/test');
const {
  navigateToSlide, waitForSlides,
  assertPosition, assertNoOverlap, assertContainedIn,
  assertAspectRatio, assertBackgroundColor, assertFontSize,
  assertSideBySide, assertStacked, getComputedProp,
} = require('./helpers/layout-assertions');

const BASE = 'http://127.0.0.1:3031';
const SMOKE = `${BASE}/viewer.html?file=test/smoke-test.md`;
const ACCENT = `${BASE}/viewer.html?file=test/accent-demo.md`;

// Note: 16:9 aspect ratio tests are in e2e.test.js (slide viewport section)

// ─── Split Layout ───

test.describe('Split layout', () => {
  test('![right] image and text are side by side (slide 9)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 8); // slide 9: ![right]
    await assertSideBySide(page,
      '.reveal .slides section.present .deckset-split > div:first-child',
      '.reveal .slides section.present .deckset-split > div:last-child'
    );
  });

  test('![left] image and text are side by side (slide 10)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 9); // slide 10: ![left]
    await assertSideBySide(page,
      '.reveal .slides section.present .deckset-split > div:first-child',
      '.reveal .slides section.present .deckset-split > div:last-child'
    );
  });

  test('split layout contained within slide (slide 9)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 8);
    await assertContainedIn(page,
      '.reveal .slides section.present .deckset-split',
      '.reveal .slides section.present'
    );
  });

  test('split + fit layout works (slide 17)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 16); // slide 17: split + fit
    const hasSplit = await page.evaluate(() =>
      !!document.querySelector('.reveal .slides section.present .deckset-split')
    );
    const hasFit = await page.evaluate(() =>
      !!document.querySelector('.reveal .slides section.present .deckset-fit')
    );
    expect(hasSplit).toBe(true);
    expect(hasFit).toBe(true);
  });
});

// ─── Position Grid ───

test.describe('Position grid', () => {
  test('diagonal headings do not overlap (accent slide 2)', async ({ page }) => {
    await page.goto(ACCENT);
    await waitForSlides(page);
    await navigateToSlide(page, 1); // slide 2: TL + BR
    await assertNoOverlap(page, [
      '.reveal .slides section.present .deckset-pos-top-left',
      '.reveal .slides section.present .deckset-pos-bottom-right'
    ]);
  });

  test('top-left heading is in top-left region (accent slide 2)', async ({ page }) => {
    await page.goto(ACCENT);
    await waitForSlides(page);
    await navigateToSlide(page, 1);
    await assertPosition(page,
      '.reveal .slides section.present .deckset-pos-top-left',
      'top-left',
      '.reveal .slides section.present .deckset-pos-group'
    );
  });

  test('bottom-right heading is in bottom-right region (accent slide 2)', async ({ page }) => {
    await page.goto(ACCENT);
    await waitForSlides(page);
    await navigateToSlide(page, 1);
    await assertPosition(page,
      '.reveal .slides section.present .deckset-pos-bottom-right',
      'bottom-right',
      '.reveal .slides section.present .deckset-pos-group'
    );
  });

  test('top + bottom positions do not overlap (accent slide 7)', async ({ page }) => {
    await page.goto(ACCENT);
    await waitForSlides(page);
    await navigateToSlide(page, 6); // slide 7: #[top] + #[bottom]
    await assertNoOverlap(page, [
      '.reveal .slides section.present .deckset-pos-top',
      '.reveal .slides section.present .deckset-pos-bottom'
    ]);
  });

  test('position group contained within slide', async ({ page }) => {
    await page.goto(ACCENT);
    await waitForSlides(page);
    await navigateToSlide(page, 1);
    await assertContainedIn(page,
      '.reveal .slides section.present .deckset-pos-group',
      '.reveal .slides section.present'
    );
  });
});

// ─── Columns Layout ───

// Note: 2-col and 3-col side-by-side tests are in e2e.test.js (Columns layout section)

test.describe('Columns layout', () => {
  test('columns container uses CSS grid', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 21);
    const display = await getComputedProp(page,
      '.reveal .slides section.present .deckset-columns', 'display');
    expect(display).toBe('grid');
  });

  test('columns do not overflow slide horizontally (smoke slide 21)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 21);
    // Check horizontal containment (most important for columns)
    const result = await page.evaluate(() => {
      const cols = document.querySelector('.reveal .slides section.present .deckset-columns');
      const section = document.querySelector('.reveal .slides section.present');
      if (!cols || !section) return null;
      const cr = cols.getBoundingClientRect();
      const sr = section.getBoundingClientRect();
      return { colRight: cr.right, sectionRight: sr.right, colLeft: cr.left, sectionLeft: sr.left };
    });
    expect(result).not.toBeNull();
    expect(result.colLeft).toBeGreaterThanOrEqual(result.sectionLeft - 2);
    expect(result.colRight).toBeLessThanOrEqual(result.sectionRight + 2);
  });
});

// ─── #[fit] Heading Sizing ───

test.describe('#[fit] heading sizing', () => {
  test('fit heading has large font size (smoke slide 2)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 1); // slide 2: single #[fit]
    // Wait for fitText to run
    await page.waitForTimeout(500);
    await assertFontSize(page, '.reveal .slides section.present .deckset-fit', 40, undefined);
  });

  test('fit heading contained within slide (smoke slide 2)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 1);
    await page.waitForTimeout(500);
    await assertContainedIn(page,
      '.reveal .slides section.present .deckset-fit',
      '.reveal .slides section.present'
    );
  });

  test('multiple fit headings all contained (smoke slide 3)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 2); // slide 3: two fit headings
    await page.waitForTimeout(500);
    const allContained = await page.evaluate(() => {
      const section = document.querySelector('.reveal .slides section.present');
      const fits = section.querySelectorAll('.deckset-fit');
      const sr = section.getBoundingClientRect();
      return Array.from(fits).every(f => {
        const fr = f.getBoundingClientRect();
        return fr.right <= sr.right + 2 && fr.left >= sr.left - 2;
      });
    });
    expect(allContained).toBe(true);
  });
});

// ─── Background Color Directive ───

test.describe('Background color directive', () => {
  test('[.background-color: #1e3a5f] applied (smoke slide 16)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 15); // slide 16: background-color
    // Force applySchemeColors to apply explicit overrides
    await page.evaluate(() => applySchemeColors());
    await page.waitForTimeout(500);
    // Works with both Reveal (.slide-background) and StellarSlides (.sd-bg)
    const bgColor = await page.evaluate(() => {
      const revealBg = document.querySelectorAll('.reveal .slide-background')[15];
      const stellarBg = document.querySelectorAll('.sd-backgrounds .sd-bg')[15];
      const bg = revealBg || stellarBg;
      if (!bg) return null;
      const content = bg.querySelector('.slide-background-content') || bg;
      return getComputedStyle(content).backgroundColor;
    });
    expect(bgColor).toBe('rgb(30, 58, 95)');
  });

  test('background-color survives theme change (smoke slide 16)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 15);
    // Change theme
    await page.selectOption('#theme-select', 'serif');
    await page.waitForTimeout(500);
    const bgColor = await page.evaluate(() => {
      const revealBg = document.querySelectorAll('.reveal .slide-background')[15];
      const stellarBg = document.querySelectorAll('.sd-backgrounds .sd-bg')[15];
      const bg = revealBg || stellarBg;
      if (!bg) return null;
      const content = bg.querySelector('.slide-background-content') || bg;
      return getComputedStyle(content).backgroundColor;
    });
    expect(bgColor).toBe('rgb(30, 58, 95)');
  });
});

// ─── Content Overflow ───

test.describe('Content overflow', () => {
  test('long text slide content within bounds (smoke slide 20)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 19); // slide 20: long text
    // Check last visible element doesn't overflow section
    const overflow = await page.evaluate(() => {
      const section = document.querySelector('.reveal .slides section.present');
      const sr = section.getBoundingClientRect();
      const children = section.querySelectorAll('p, ul, ol, h1, h2, h3');
      const last = children[children.length - 1];
      if (!last) return false;
      const lr = last.getBoundingClientRect();
      return lr.bottom > sr.bottom + 5;
    });
    expect(overflow, 'Content overflows slide bottom').toBe(false);
  });

  test('blockquote contained within slide (smoke slide 7)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 6); // slide 7: blockquote
    await assertContainedIn(page,
      '.reveal .slides section.present blockquote',
      '.reveal .slides section.present'
    );
  });
});

// ─── Inline Images ───

test.describe('Inline images', () => {
  test('two inline images are side by side (smoke slide 15)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 14); // slide 15: two inline
    const sideBySide = await page.evaluate(() => {
      const row = document.querySelector('.reveal .slides section.present .deckset-inline-row');
      if (!row) return null;
      const imgs = row.querySelectorAll('img');
      if (imgs.length < 2) return null;
      const r0 = imgs[0].getBoundingClientRect();
      const r1 = imgs[1].getBoundingClientRect();
      return r1.left >= r0.right - 5;
    });
    expect(sideBySide).toBe(true);
  });

  test('inline row does not overflow slide horizontally (smoke slide 15)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 14);
    const result = await page.evaluate(() => {
      const row = document.querySelector('.reveal .slides section.present .deckset-inline-row');
      const section = document.querySelector('.reveal .slides section.present');
      if (!row || !section) return null;
      const rr = row.getBoundingClientRect();
      const sr = section.getBoundingClientRect();
      return { rowRight: rr.right, sectionRight: sr.right, rowLeft: rr.left, sectionLeft: sr.left };
    });
    expect(result).not.toBeNull();
    expect(result.rowLeft).toBeGreaterThanOrEqual(result.sectionLeft - 2);
    expect(result.rowRight).toBeLessThanOrEqual(result.sectionRight + 2);
  });
});

// ─── Fragment Visibility ───

test.describe('Fragment visibility', () => {
  test('fragments in grid are all visible (accent slide 8)', async ({ page }) => {
    await page.goto(ACCENT);
    await waitForSlides(page);
    // Open grid
    await page.keyboard.press('g');
    await page.waitForTimeout(500);
    const allVisible = await page.evaluate(() => {
      const frags = document.querySelectorAll('.grid-slide-inner .fragment');
      if (frags.length === 0) return null; // no fragments in grid
      return Array.from(frags).every(f => {
        const op = getComputedStyle(f).opacity;
        return op === '1' || op === '';
      });
    });
    // If there are fragments in grid, they should be visible
    if (allVisible !== null) {
      expect(allVisible).toBe(true);
    }
  });
});

// ─── Alternating Colors ───

test.describe('Alternating colors', () => {
  test('alternating-colors slide has deckset-alternating wrapper (accent slide 4)', async ({ page }) => {
    await page.goto(ACCENT);
    await waitForSlides(page);
    await navigateToSlide(page, 3); // slide 4: alternating
    const hasWrapper = await page.evaluate(() =>
      !!document.querySelector('.reveal .slides section.present .deckset-alternating')
    );
    expect(hasWrapper).toBe(true);
  });

  test('even paragraphs have different color than odd (accent slide 4)', async ({ page }) => {
    await page.goto(ACCENT);
    await waitForSlides(page);
    await navigateToSlide(page, 3);
    const colors = await page.evaluate(() => {
      const container = document.querySelector('.reveal .slides section.present .deckset-alternating');
      if (!container) return null;
      const ps = container.querySelectorAll('p');
      return Array.from(ps).map(p => getComputedStyle(p).color);
    });
    expect(colors).not.toBeNull();
    if (colors && colors.length >= 2) {
      // At least one even paragraph should have different color
      const hasVariation = colors.some((c, i) => i > 0 && c !== colors[0]);
      expect(hasVariation, 'Expected color variation in alternating paragraphs').toBe(true);
    }
  });
});

// ─── Code Blocks ───

test.describe('Code blocks', () => {
  test('code block has monospace font (smoke slide 8)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 7); // slide 8: code block
    const font = await getComputedProp(page,
      '.reveal .slides section.present pre code', 'font-family');
    expect(font).toContain('monospace');
  });

  test('code block contained within slide (smoke slide 8)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await navigateToSlide(page, 7);
    await assertContainedIn(page,
      '.reveal .slides section.present pre',
      '.reveal .slides section.present'
    );
  });
});
