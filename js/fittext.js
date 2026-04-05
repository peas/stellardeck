import { state } from './state.js';

// ============================================================
// FitText: scale #[fit] headings to fill slide width
// Each heading is scaled independently. The text should fill
// the width without overflowing, and all fit headings together
// should not exceed the slide height.
//
// Dimensions come from Reveal.getConfig() at call time — not constants.
// ============================================================
const SLIDE_PAD = 64; // 2rem * 2 sides

export function measureText(text, fontSize, fontWeight) {
  state.measurer.style.fontSize = fontSize + 'px';
  state.measurer.style.fontWeight = fontWeight;
  state.measurer.textContent = text;
  return state.measurer.scrollWidth;
}

// Sync measurer with theme fonts (called after theme is applied)
export function syncMeasurer() {
  const cs = getComputedStyle(document.querySelector('.reveal h1') || document.querySelector('.reveal'));
  state.measurer.style.fontFamily = cs.getPropertyValue('--r-heading-font') || cs.fontFamily;
  state.measurer.style.letterSpacing = cs.getPropertyValue('--r-heading-letter-spacing') || '-0.03em';
}

export function fitText() {
  const slideMap = new Map();
  document.querySelectorAll('.deckset-fit').forEach(el => {
    const slide = el.closest('section');
    if (!slide) return;
    if (!slideMap.has(slide)) slideMap.set(slide, []);
    slideMap.get(slide).push(el);
  });

  slideMap.forEach((headings, slide) => {
    const { width: slideW, height: slideH } = Reveal.getConfig();
    const fullWidth = slideW - SLIDE_PAD;
    const fullHeight = slideH - SLIDE_PAD;
    const splitColWidth = (slideW - SLIDE_PAD) / 2 - 16;

    // Estimate sibling height: count non-fit, non-notes children
    const nonFitChildren = Array.from(slide.children)
      .filter(c => !c.classList.contains('deckset-fit') && c.tagName !== 'ASIDE'
        && !c.classList.contains('deckset-split'));
    const siblingHeight = nonFitChildren.reduce((h, c) => {
      const measured = c.offsetHeight;
      return h + (measured > 0 ? measured : 40);
    }, 0);

    headings.forEach(el => {
      const container = el.closest('.deckset-split > div');
      const maxWidth = container ? splitColWidth : fullWidth;

      const parentHeadings = headings.filter(h =>
        (h.closest('.deckset-split > div') || slide) ===
        (container || slide));
      const availableHeight = fullHeight - siblingHeight;
      const heightPerHeading = Math.max(availableHeight / parentHeadings.length, 40);

      const styles = getComputedStyle(el);
      const fontWeight = styles.fontWeight || '900';
      const textTransform = styles.textTransform || 'none';
      state.measurer.style.textTransform = textTransform;
      const text = el.textContent;
      // Line-height factor for height budget (1.15 for Letters from Sweden, 1.1 default)
      const lh = parseFloat(
        getComputedStyle(document.querySelector('.reveal'))
          .getPropertyValue('--r-heading-line-height')
      ) || 1.1;

      el.style.display = 'block';
      el.style.margin = '0';

      // Binary search: find largest font where text fits width + height
      let lo = 16, hi = 500;
      while (hi - lo > 2) {
        const mid = Math.floor((lo + hi) / 2);
        const textWidth = measureText(text, mid, fontWeight);
        const fits = textWidth <= maxWidth && mid * lh <= heightPerHeading;
        if (fits) lo = mid; else hi = mid;
      }
      el.style.fontSize = lo + 'px';
      el.style.whiteSpace = 'nowrap';
    });
  });
}
