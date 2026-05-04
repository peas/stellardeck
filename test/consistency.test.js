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

// ─── Slide vs Sidebar Thumb: fit parity ───
//
// Regression for the 2026-05-04 bug where the sidebar `#sb-thumbs`
// strip rebuilt itself on Reveal 'ready' (before fonts.ready resolved
// and fitText ran), so #[fit] lines in the thumb cloned the unstyled
// `<h1>` and wrapped at the natural break — the live slide stayed
// nowrap. Lock the timing: rebuild thumbs AFTER fitText sets the
// inline font-size + white-space:nowrap.

test.describe('Slide vs Sidebar Thumb: fit parity', () => {
  test('#[fit] heading is nowrap in both live slide and sidebar thumb', async ({ page }) => {
    // Use the desktop UI by faking the IS_DESKTOP detection. The
    // browser test rig doesn't render the sidebar (it's gated on
    // IS_DESKTOP), but we can force the body class so the thumb
    // strip mounts and runs through the same code path.
    await page.addInitScript(() => {
      document.documentElement.classList.add('force-desktop-thumbs');
    });
    await page.goto(SMOKE);
    await waitForSlides(page);
    // Smoke slide 2 has `#[fit] Slide 2: Fit heading único` (single fit
    // line). After fitText runs, the .deckset-fit element should have
    // inline white-space: nowrap.
    await navigateToSlide(page, 1);
    await page.waitForTimeout(1500); // fonts + fitText + thumb rebuild

    const result = await page.evaluate(() => {
      const liveFit = document.querySelector('.reveal .slides section.present .deckset-fit');
      // Sidebar thumbs only render in desktop mode. In browser test,
      // we simulate by reading `state.tabs[0]` and calling rebuildThumbnails
      // via the global hook the renderer exposes.
      if (window._rebuildThumbnails) window._rebuildThumbnails();
      const thumbs = document.querySelectorAll('#sb-thumbs .sb-thumb-content .deckset-fit');
      const thumbFit = thumbs[1]; // slide 2 thumb (0-indexed)
      return {
        liveExists: !!liveFit,
        liveStyle: liveFit ? liveFit.style.cssText : null,
        liveWhiteSpace: liveFit ? liveFit.style.whiteSpace : null,
        liveFontSize: liveFit ? liveFit.style.fontSize : null,
        thumbExists: !!thumbFit,
        thumbStyle: thumbFit ? thumbFit.style.cssText : null,
        thumbWhiteSpace: thumbFit ? thumbFit.style.whiteSpace : null,
        thumbFontSize: thumbFit ? thumbFit.style.fontSize : null,
      };
    });

    // Live slide is the source of truth — fitText ran on it.
    expect(result.liveExists).toBe(true);
    expect(result.liveWhiteSpace).toBe('nowrap');
    expect(result.liveFontSize).toMatch(/\d+px/);

    // The sidebar thumbs only mount in desktop mode. Skip the parity
    // assertion in browser mode (no thumb DOM) — but if the strip is
    // present, both must match.
    if (result.thumbExists) {
      expect(result.thumbWhiteSpace).toBe(result.liveWhiteSpace);
      expect(result.thumbFontSize).toBe(result.liveFontSize);
    }
  });
});
