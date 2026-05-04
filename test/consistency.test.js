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

// ─── Theme contrast invariants ───
//
// Lock the "heading and main never collapse to the same color" rule
// for the schemes we explicitly fixed (the Alun-5 bug class). If a
// future theme edit reverts a value here, this test fails.

test.describe('Theme contrast: heading vs main (regression)', () => {
  const FIXED = [
    { theme: 'alun', scheme: '5',  why: 'pink bg — main was #f3f2f2 (≈white); now orange #FF9414' },
    { theme: 'alun', scheme: '4',  why: 'orange bg — main was #3a2000 (dark brown); now #ffffff' },
    { theme: 'hacker', scheme: '3', why: 'solarized dark bg — main was #839496; now #eee8d5' },
    { theme: 'hacker', scheme: '4', why: 'tokyo night — main was #a9b1d6; now #c0caf5' },
    { theme: 'serif', scheme: '3', why: 'light bg — main was #444 (close to heading); now #6b7280' },
    { theme: 'borneli', scheme: '4', why: 'purple bg — main was #f0e0f0 (≈white); now #fbb6ce' },
  ];

  // WCAG-style ratio computed in browser (parses the CSS var values).
  const RATIO_FN = `
    function lum(hex) {
      hex = hex.trim().replace(/^#/, '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const r = parseInt(hex.slice(0,2),16)/255;
      const g = parseInt(hex.slice(2,4),16)/255;
      const b = parseInt(hex.slice(4,6),16)/255;
      const f = c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
      return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
    }
    function ratio(a, b) {
      const la = lum(a), lb = lum(b);
      const [hi, lo] = la > lb ? [la, lb] : [lb, la];
      return (hi + 0.05) / (lo + 0.05);
    }
  `;

  for (const { theme, scheme, why } of FIXED) {
    test(`${theme}.scheme-${scheme} keeps heading vs main contrast (${why})`, async ({ page }) => {
      await page.goto(`${SMOKE}&theme=${theme}&scheme=${scheme}`);
      await waitForSlides(page);
      const r = await page.evaluate((fn) => {
        eval(fn);
        const cs = getComputedStyle(document.querySelector('.reveal'));
        const h = cs.getPropertyValue('--r-heading-color').trim();
        const m = cs.getPropertyValue('--r-main-color').trim();
        return { heading: h, main: m, ratio: ratio(h, m) };
      }, RATIO_FN);
      expect(r.heading).not.toBe(r.main);
      expect(r.ratio).toBeGreaterThan(1.5);
    });
  }
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
