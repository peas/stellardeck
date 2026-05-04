/**
 * Diagnostics E2E — verify cumulative-overflow / too-small / too-dense fire.
 *
 * Run: npx playwright test test/diagnostics.test.js
 * Requires: HTTP server on port 3031 (npm run serve)
 */

const { test, expect } = require('@playwright/test');
const { waitForSlides, navigateToSlide } = require('./helpers/layout-assertions');

const BASE = 'http://127.0.0.1:3031';
const FIXTURE = `${BASE}/viewer.html?file=test/autoflow-fixtures/cumulative-overflow.md`;

async function diagnose(page, slideIdx) {
  await navigateToSlide(page, slideIdx);
  await page.waitForTimeout(400); // let fitText + diagnostics rAF settle
  return page.evaluate(() => {
    const sec = document.querySelector('.reveal .slides section.present');
    const idx = Reveal.getState().indexh + 1;
    return window.StellarDiagnostics.diagnoseSlide(sec, idx);
  });
}

test.describe('Diagnostics: text-cumulative-overflow', () => {
  test('PROGRAMADOR-style stack fires text-cumulative-overflow', async ({ page }) => {
    await page.goto(FIXTURE);
    await waitForSlides(page);
    const warnings = await diagnose(page, 1); // slide 2 (Profissão Novo Dev?)
    const cumulative = warnings.find(w => w.type === 'text-cumulative-overflow');
    expect(cumulative, `expected text-cumulative-overflow, got: ${JSON.stringify(warnings)}`).toBeTruthy();
    expect(cumulative.severity).toBe('warn');
    expect(cumulative.overflow).toBeGreaterThan(4);
  });

  test('normal slide does NOT fire text-cumulative-overflow', async ({ page }) => {
    await page.goto(FIXTURE);
    await waitForSlides(page);
    const warnings = await diagnose(page, 0); // slide 1 (title)
    const cumulative = warnings.find(w => w.type === 'text-cumulative-overflow');
    expect(cumulative).toBeFalsy();
  });
});

test.describe('Diagnostics: text-too-small', () => {
  test('does not fire on normal slides', async ({ page }) => {
    await page.goto(FIXTURE);
    await waitForSlides(page);
    const warnings = await diagnose(page, 0);
    expect(warnings.find(w => w.type === 'text-too-small')).toBeFalsy();
  });

  test('fires when an element is forced below 14px', async ({ page }) => {
    await page.goto(FIXTURE);
    await waitForSlides(page);
    await navigateToSlide(page, 0);
    await page.waitForTimeout(200);
    const warnings = await page.evaluate(() => {
      const sec = document.querySelector('.reveal .slides section.present');
      const h1 = sec.querySelector('h1');
      h1.style.fontSize = '10px';
      return window.StellarDiagnostics.diagnoseSlide(sec, 1);
    });
    const tooSmall = warnings.find(w => w.type === 'text-too-small');
    expect(tooSmall).toBeTruthy();
    expect(tooSmall.fontSize).toBeLessThan(14);
  });
});

test.describe('Diagnostics: statement-degraded', () => {
  test('fires (info severity) on a tier-3 statement slide', async ({ page }) => {
    // Build a slide whose statement rule lands in tier 3 (9-15 words/line).
    await page.goto(FIXTURE);
    await waitForSlides(page);
    await navigateToSlide(page, 0);
    await page.waitForTimeout(300);
    const result = await page.evaluate(() => {
      const sec = document.querySelector('.reveal .slides section.present');
      // Force a tier-3 marker so we don't depend on the fixture content.
      sec.setAttribute('data-autoflow-tier', '3');
      sec.setAttribute('data-autoflow-detail', '2 lines, max 11 words, dense (autoscale)');
      return window.StellarDiagnostics.diagnoseSlide(sec, 1);
    });
    const w = result.find(x => x.type === 'statement-degraded');
    expect(w).toBeTruthy();
    expect(w.severity).toBe('info');
    expect(w.detail).toContain('11 words');
  });

  test('does NOT fire on tier-1 / tier-2 statements', async ({ page }) => {
    await page.goto(FIXTURE);
    await waitForSlides(page);
    await navigateToSlide(page, 0);
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => {
      const sec = document.querySelector('.reveal .slides section.present');
      sec.setAttribute('data-autoflow-tier', '2');
      return window.StellarDiagnostics.diagnoseSlide(sec, 1);
    });
    expect(result.find(x => x.type === 'statement-degraded')).toBeFalsy();
  });
});

test.describe('Diagnostics: slide-too-dense', () => {
  test('does not fire on light slides', async ({ page }) => {
    await page.goto(FIXTURE);
    await waitForSlides(page);
    const warnings = await diagnose(page, 0);
    expect(warnings.find(w => w.type === 'slide-too-dense')).toBeFalsy();
  });

  test('fires when more than 120 words are visible', async ({ page }) => {
    await page.goto(FIXTURE);
    await waitForSlides(page);
    await navigateToSlide(page, 0);
    await page.waitForTimeout(200);
    const warnings = await page.evaluate(() => {
      const sec = document.querySelector('.reveal .slides section.present');
      const p = document.createElement('p');
      p.textContent = Array(125).fill('word').join(' ');
      sec.appendChild(p);
      return window.StellarDiagnostics.diagnoseSlide(sec, 1);
    });
    const dense = warnings.find(w => w.type === 'slide-too-dense');
    expect(dense).toBeTruthy();
    expect(dense.wordCount).toBeGreaterThan(120);
  });
});
