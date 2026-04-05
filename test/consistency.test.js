/**
 * Cross-context consistency tests — verify same rendering across
 * viewer, grid thumbnails, and presenter.
 *
 * Only tests that DON'T overlap with e2e.test.js or layout.test.js.
 * e2e.test.js already covers: heading font-family, neutral gray grid bg
 * layout.test.js already covers: background-color in grid
 */

const { test, expect } = require('@playwright/test');
const { navigateToSlide, waitForSlides } = require('./helpers/layout-assertions');

const BASE = 'http://127.0.0.1:3031';
const SMOKE = `${BASE}/viewer.html?file=test/smoke-test.md`;
const ACCENT = `${BASE}/viewer.html?file=test/accent-demo.md`;

// ─── Slide vs Grid: Style Properties ───

test.describe('Slide vs Grid: style parity', () => {
  test('heading font-weight matches', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);

    const slideWeight = await page.evaluate(() => {
      const h = document.querySelector('.reveal .slides section h1');
      return h ? getComputedStyle(h).fontWeight : null;
    });

    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    const gridWeight = await page.evaluate(() => {
      const h = document.querySelector('.grid-slide-inner h1');
      return h ? getComputedStyle(h).fontWeight : null;
    });

    expect(slideWeight).not.toBeNull();
    expect(gridWeight).toBe(slideWeight);
  });

  test('heading color matches', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);

    const slideColor = await page.evaluate(() => {
      const h = document.querySelector('.reveal .slides section h1');
      return h ? getComputedStyle(h).color : null;
    });

    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    const gridColor = await page.evaluate(() => {
      const h = document.querySelector('.grid-slide-inner h1');
      return h ? getComputedStyle(h).color : null;
    });

    expect(slideColor).not.toBeNull();
    expect(gridColor).toBe(slideColor);
  });

  test('heading text-align matches', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);

    const slideAlign = await page.evaluate(() => {
      const h = document.querySelector('.reveal .slides section h1');
      return h ? getComputedStyle(h).textAlign : null;
    });

    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    const gridAlign = await page.evaluate(() => {
      const h = document.querySelector('.grid-slide-inner h1');
      return h ? getComputedStyle(h).textAlign : null;
    });

    expect(slideAlign).not.toBeNull();
    expect(gridAlign).toBe(slideAlign);
  });

  test('bold accent color matches', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);

    const slideBold = await page.evaluate(() => {
      const b = document.querySelector('.reveal .slides section strong');
      return b ? getComputedStyle(b).color : null;
    });

    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    const gridBold = await page.evaluate(() => {
      const b = document.querySelector('.grid-slide-inner strong');
      return b ? getComputedStyle(b).color : null;
    });

    if (slideBold && gridBold) {
      expect(gridBold).toBe(slideBold);
    }
  });
});

// ─── Slide vs Grid: Structure Preservation ───

test.describe('Slide vs Grid: structure', () => {
  test('split layout preserved in grid thumbnail (smoke slide 9)', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);

    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    const gridHasSplit = await page.evaluate(() => {
      const cards = document.querySelectorAll('.grid-slide-inner');
      return cards[8] ? !!cards[8].querySelector('.deckset-split') : false;
    });
    expect(gridHasSplit).toBe(true);
  });

  test('position classes preserved in grid thumbnail (accent slide 2)', async ({ page }) => {
    await page.goto(ACCENT);
    await waitForSlides(page);

    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const cards = document.querySelectorAll('.grid-slide-inner');
      if (!cards[1]) return null;
      return {
        hasGroup: !!cards[1].querySelector('.deckset-pos-group'),
        hasTopLeft: !!cards[1].querySelector('.deckset-pos-top-left'),
        hasBottomRight: !!cards[1].querySelector('.deckset-pos-bottom-right'),
      };
    });
    expect(result).not.toBeNull();
    expect(result.hasGroup).toBe(true);
    expect(result.hasTopLeft).toBe(true);
    expect(result.hasBottomRight).toBe(true);
  });
});

// ─── Theme Change: Cross-Context Persistence ───

test.describe('Theme change consistency', () => {
  test('after theme change, slide and grid fonts still match', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);

    await page.selectOption('#theme-select', 'serif');
    await page.waitForTimeout(500);

    const slideFont = await page.evaluate(() => {
      const h = document.querySelector('.reveal .slides section h1');
      return h ? getComputedStyle(h).fontFamily : null;
    });

    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    const gridFont = await page.evaluate(() => {
      const h = document.querySelector('.grid-slide-inner h1');
      return h ? getComputedStyle(h).fontFamily : null;
    });

    expect(slideFont).not.toBeNull();
    expect(gridFont).toBe(slideFont);
  });

  test('blockquote border color matches between contexts', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);

    await navigateToSlide(page, 6);

    const slideBorder = await page.evaluate(() => {
      const bq = document.querySelector('.reveal .slides section.present blockquote');
      return bq ? getComputedStyle(bq).borderLeftColor : null;
    });

    await page.keyboard.press('g');
    await page.waitForTimeout(500);

    const gridBorder = await page.evaluate(() => {
      const cards = document.querySelectorAll('.grid-slide-inner');
      const bq = cards[6]?.querySelector('blockquote');
      return bq ? getComputedStyle(bq).borderLeftColor : null;
    });

    if (slideBorder && gridBorder) {
      expect(gridBorder).toBe(slideBorder);
    }
  });
});
