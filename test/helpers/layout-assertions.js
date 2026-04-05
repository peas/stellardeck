/**
 * Reusable Playwright layout assertion helpers for StellarDeck.
 *
 * All helpers use page.evaluate() + getBoundingClientRect() to test
 * CSS layout correctness: positions, overlap, containment, sizing.
 */

const { expect } = require('@playwright/test');

// ─── Navigation ───

async function navigateToSlide(page, index) {
  await page.evaluate((idx) => Reveal.slide(idx), index);
  await page.waitForTimeout(400);
}

async function waitForSlides(page) {
  await page.waitForSelector('.reveal .slides section', { timeout: 15000 });
  await page.waitForFunction(() => typeof Reveal !== 'undefined' && Reveal.isReady?.(), { timeout: 15000 });
  await page.waitForTimeout(600);
}

// ─── Position ───

/**
 * Verify element center falls within the expected region of its parent.
 * Divides parent into a 3×3 grid matching .deckset-pos-group areas.
 * @param {'top-left'|'top'|'top-right'|'left'|'center'|'right'|'bottom-left'|'bottom'|'bottom-right'} region
 */
async function assertPosition(page, selector, region, parentSelector = '.reveal .slides section.present') {
  const result = await page.evaluate(({ sel, parentSel }) => {
    const el = document.querySelector(sel);
    const parent = document.querySelector(parentSel);
    if (!el || !parent) return { found: false, sel, parentSel };
    const er = el.getBoundingClientRect();
    const pr = parent.getBoundingClientRect();
    // Element center relative to parent
    const cx = (er.left + er.right) / 2 - pr.left;
    const cy = (er.top + er.bottom) / 2 - pr.top;
    const pw = pr.width;
    const ph = pr.height;
    // Which third (40% boundary for edge regions to handle elements near borders)
    const col = cx < pw * 0.4 ? 'left' : cx > pw * 0.6 ? 'right' : 'center';
    const row = cy < ph * 0.4 ? 'top' : cy > ph * 0.6 ? 'bottom' : 'middle';
    const actual = row === 'middle' && col === 'center' ? 'center'
      : row === 'middle' ? col
      : col === 'center' ? row
      : `${row}-${col}`;
    return { found: true, actual, cx: Math.round(cx), cy: Math.round(cy), pw: Math.round(pw), ph: Math.round(ph) };
  }, { sel: selector, parentSel: parentSelector });

  expect(result.found, `Element "${selector}" not found (parent: "${result.parentSel || parentSelector}")`).toBe(true);
  expect(result.actual, `Position: expected "${region}", got "${result.actual}" (center at ${result.cx},${result.cy} in ${result.pw}×${result.ph})`).toBe(region);
}

// ─── Overlap ───

/**
 * Verify no two elements from the selector list overlap (AABB intersection).
 */
async function assertNoOverlap(page, selectors) {
  const rects = await page.evaluate((sels) => {
    return sels.map(s => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { selector: s, top: r.top, left: r.left, right: r.right, bottom: r.bottom };
    }).filter(Boolean);
  }, selectors);

  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const overlaps = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      expect(overlaps, `Overlap detected: "${a.selector}" and "${b.selector}"`).toBe(false);
    }
  }
}

// ─── Containment ───

/**
 * Verify child bounding box is fully within parent (with tolerance).
 */
async function assertContainedIn(page, childSelector, parentSelector, tolerance = 2) {
  const result = await page.evaluate(({ child, parent }) => {
    const c = document.querySelector(child);
    const p = document.querySelector(parent);
    if (!c || !p) return { found: false, child, parent };
    const cr = c.getBoundingClientRect();
    const pr = p.getBoundingClientRect();
    return {
      found: true,
      child: { top: cr.top, left: cr.left, right: cr.right, bottom: cr.bottom },
      parent: { top: pr.top, left: pr.left, right: pr.right, bottom: pr.bottom },
    };
  }, { child: childSelector, parent: parentSelector });

  expect(result.found, `Element not found: child="${childSelector}" parent="${parentSelector}"`).toBe(true);
  const c = result.child, p = result.parent;
  const contained = c.top >= p.top - tolerance && c.left >= p.left - tolerance &&
                    c.right <= p.right + tolerance && c.bottom <= p.bottom + tolerance;
  expect(contained, `"${childSelector}" overflows "${parentSelector}" — child: [${Math.round(c.top)},${Math.round(c.left)},${Math.round(c.right)},${Math.round(c.bottom)}] parent: [${Math.round(p.top)},${Math.round(p.left)},${Math.round(p.right)},${Math.round(p.bottom)}]`).toBe(true);
}

// ─── Aspect Ratio ───

async function assertAspectRatio(page, selector, expectedRatio = 16 / 9, tolerance = 0.15) {
  const result = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    return { found: true, width: r.width, height: r.height, ratio: r.width / r.height };
  }, selector);

  expect(result.found, `Element "${selector}" not found`).toBe(true);
  expect(result.ratio).toBeGreaterThan(expectedRatio - tolerance);
  expect(result.ratio).toBeLessThan(expectedRatio + tolerance);
}

// ─── Background Color ───

function normalizeColor(c) {
  if (!c) return c;
  if (c.startsWith('#')) {
    const hex = c.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map(h => h + h).join('') : hex;
    const r = parseInt(full.substr(0, 2), 16);
    const g = parseInt(full.substr(2, 2), 16);
    const b = parseInt(full.substr(4, 2), 16);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return c.replace(/\s+/g, ' ').trim();
}

async function assertBackgroundColor(page, selector, expectedColor) {
  const actual = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return getComputedStyle(el).backgroundColor;
  }, selector);

  expect(actual, `Element "${selector}" not found`).not.toBeNull();
  expect(normalizeColor(actual)).toBe(normalizeColor(expectedColor));
}

// ─── Font Size ───

async function assertFontSize(page, selector, min, max) {
  const size = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? parseFloat(getComputedStyle(el).fontSize) : null;
  }, selector);

  expect(size, `Element "${selector}" not found`).not.toBeNull();
  if (min !== undefined) expect(size, `Font size ${size}px < min ${min}px`).toBeGreaterThanOrEqual(min);
  if (max !== undefined) expect(size, `Font size ${size}px > max ${max}px`).toBeLessThanOrEqual(max);
}

// ─── Layout Direction ───

/**
 * Verify two elements are side by side (left element's right edge ≤ right element's left edge).
 */
async function assertSideBySide(page, leftSelector, rightSelector) {
  const result = await page.evaluate(({ left, right }) => {
    const l = document.querySelector(left);
    const r = document.querySelector(right);
    if (!l || !r) return { found: false, left, right };
    const lr = l.getBoundingClientRect();
    const rr = r.getBoundingClientRect();
    return {
      found: true,
      sideBySide: rr.left >= lr.right - 5,
      sameRow: Math.abs(lr.top - rr.top) < Math.max(lr.height, rr.height) * 0.5,
      leftRect: { left: lr.left, right: lr.right, top: lr.top },
      rightRect: { left: rr.left, right: rr.right, top: rr.top },
    };
  }, { left: leftSelector, right: rightSelector });

  expect(result.found, `Element not found: left="${leftSelector}" right="${rightSelector}"`).toBe(true);
  expect(result.sideBySide, `"${rightSelector}" should be right of "${leftSelector}" (left.right=${Math.round(result.leftRect?.right)}, right.left=${Math.round(result.rightRect?.left)})`).toBe(true);
}

/**
 * Verify two elements are vertically stacked (top element's bottom edge ≤ bottom element's top edge).
 */
async function assertStacked(page, topSelector, bottomSelector) {
  const result = await page.evaluate(({ top, bottom }) => {
    const t = document.querySelector(top);
    const b = document.querySelector(bottom);
    if (!t || !b) return { found: false, top, bottom };
    const tr = t.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return {
      found: true,
      stacked: br.top >= tr.bottom - 5,
      topBottom: tr.bottom,
      bottomTop: br.top,
    };
  }, { top: topSelector, bottom: bottomSelector });

  expect(result.found, `Element not found: top="${topSelector}" bottom="${bottomSelector}"`).toBe(true);
  expect(result.stacked, `"${bottomSelector}" should be below "${topSelector}" (top.bottom=${Math.round(result.topBottom)}, bottom.top=${Math.round(result.bottomTop)})`).toBe(true);
}

// ─── Computed Style ───

async function getComputedProp(page, selector, prop) {
  return page.evaluate(({ sel, p }) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).getPropertyValue(p).trim() : null;
  }, { sel: selector, p: prop });
}

module.exports = {
  navigateToSlide,
  waitForSlides,
  assertPosition,
  assertNoOverlap,
  assertContainedIn,
  assertAspectRatio,
  assertBackgroundColor,
  assertFontSize,
  assertSideBySide,
  assertStacked,
  normalizeColor,
  getComputedProp,
};
