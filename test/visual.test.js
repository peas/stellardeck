/**
 * Visual regression tests — Playwright toHaveScreenshot() baselines.
 *
 * Captures key slides as baseline PNGs and detects regressions.
 * Baselines stored in test/visual.test.js-snapshots/.
 *
 * Usage:
 *   npm run test:visual            # compare against baselines
 *   npm run test:visual:update     # regenerate baselines
 */

const { test, expect } = require('@playwright/test');
const { navigateToSlide, waitForSlides } = require('./helpers/layout-assertions');

const BASE = 'http://127.0.0.1:3031';
const SMOKE = `${BASE}/viewer.html?file=test/smoke-test.md`;
const ACCENT = `${BASE}/viewer.html?file=test/accent-demo.md`;

// Slide area selector — captures just the slide, not toolbar/chrome
const SLIDE_AREA = '#slide-area';

// ─── Helper: capture slide area screenshot ───

async function screenshotSlide(page, name) {
  await page.waitForTimeout(300); // settle animations
  await expect(page.locator(SLIDE_AREA)).toHaveScreenshot(name, {
    maxDiffPixelRatio: 0.02,
    threshold: 0.3,
    animations: 'disabled',
  });
}

// ─── Default Theme (Dark) ───

test.describe('Visual: default-dark', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
  });

  test('slide 1: heading hierarchy', async ({ page }) => {
    await navigateToSlide(page, 0);
    await screenshotSlide(page, 'default-dark-01-headings.png');
  });

  test('slide 2: fit single', async ({ page }) => {
    await navigateToSlide(page, 1);
    await page.waitForTimeout(500); // fitText needs time
    await screenshotSlide(page, 'default-dark-02-fit-single.png');
  });

  test('slide 7: blockquote', async ({ page }) => {
    await navigateToSlide(page, 6);
    await screenshotSlide(page, 'default-dark-07-blockquote.png');
  });

  test('slide 8: code block', async ({ page }) => {
    await navigateToSlide(page, 7);
    await screenshotSlide(page, 'default-dark-08-code.png');
  });

  test('slide 9: split right', async ({ page }) => {
    await navigateToSlide(page, 8);
    await screenshotSlide(page, 'default-dark-09-split-right.png');
  });

  test('slide 10: split left', async ({ page }) => {
    await navigateToSlide(page, 9);
    await screenshotSlide(page, 'default-dark-10-split-left.png');
  });

  test('slide 16: background color', async ({ page }) => {
    await navigateToSlide(page, 15);
    await screenshotSlide(page, 'default-dark-16-bg-color.png');
  });

  test('slide 21: columns 2', async ({ page }) => {
    await navigateToSlide(page, 20);
    await screenshotSlide(page, 'default-dark-21-columns-2.png');
  });

  test('slide 22: columns 3', async ({ page }) => {
    await navigateToSlide(page, 21);
    await screenshotSlide(page, 'default-dark-22-columns-3.png');
  });
});

// ─── Default Theme (Light) ───

test.describe('Visual: default-light', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    // Switch to scheme 2 (light)
    await page.evaluate(() => {
      const reveal = document.querySelector('.reveal');
      reveal.className = reveal.className.replace(/scheme-\S+/g, '').trim();
      reveal.classList.add('scheme-2');
      applySchemeColors();
    });
    await page.waitForTimeout(500);
  });

  test('slide 1: headings light', async ({ page }) => {
    await navigateToSlide(page, 0);
    await screenshotSlide(page, 'default-light-01-headings.png');
  });

  test('slide 9: split right light', async ({ page }) => {
    await navigateToSlide(page, 8);
    await screenshotSlide(page, 'default-light-09-split-right.png');
  });

  test('slide 16: bg color light', async ({ page }) => {
    await navigateToSlide(page, 15);
    await screenshotSlide(page, 'default-light-16-bg-color.png');
  });
});

// ─── Accent Demo (Nordic theme) ───

test.describe('Visual: accent-nordic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ACCENT);
    await waitForSlides(page);
  });

  test('slide 2: diagonal position', async ({ page }) => {
    await navigateToSlide(page, 1);
    await screenshotSlide(page, 'accent-nordic-02-diagonal.png');
  });

  test('slide 4: alternating colors', async ({ page }) => {
    await navigateToSlide(page, 3);
    await screenshotSlide(page, 'accent-nordic-04-alternating.png');
  });

  test('slide 6: bg-color + fit', async ({ page }) => {
    await navigateToSlide(page, 5);
    await page.waitForTimeout(500); // fitText
    await screenshotSlide(page, 'accent-nordic-06-bg-fit.png');
  });

  test('slide 7: top + bottom', async ({ page }) => {
    await navigateToSlide(page, 6);
    await screenshotSlide(page, 'accent-nordic-07-top-bottom.png');
  });

  test('slide 9: fit multi', async ({ page }) => {
    await navigateToSlide(page, 8);
    await page.waitForTimeout(500);
    await screenshotSlide(page, 'accent-nordic-09-fit-multi.png');
  });
});

// ─── Grid Overview ───

test.describe('Visual: grid overview', () => {
  test('smoke test grid', async ({ page }) => {
    await page.goto(SMOKE);
    await waitForSlides(page);
    await page.keyboard.press('g');
    await page.waitForTimeout(800);
    await expect(page.locator('#grid-overlay')).toHaveScreenshot('grid-smoke.png', {
      maxDiffPixelRatio: 0.03,
      threshold: 0.3,
      animations: 'disabled',
    });
  });
});
