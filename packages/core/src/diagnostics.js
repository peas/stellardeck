/**
 * diagnostics.js — StellarDeck deck health checks
 *
 * Structured warnings emitted post-render:
 *   { type, severity: 'warn' | 'error' | 'info', slide, message, ...extra }
 *
 * Runs in the browser/WKWebView. Exposes window.StellarDiagnostics.
 * Called by:
 *   - js/render.js after renderDeck() → stores in tab state for UI badge
 *   - stellar-embed.js after renderDeck() → onDiagnostics callback
 *   - scripts/export.js via page.evaluate() inside capture loop
 */
(function () {
  'use strict';

  const OVERFLOW_TOLERANCE = 20; // px — sub-pixel + border tolerance
  // Images crop via object-fit: cover so a few-pixel overshoot of the <img>
  // element is a layout-rounding artifact, NOT a visible problem. Only warn
  // on images that overshoot by more than 10% of the slide dimension. Text
  // elements always warn — text overflow is always visible/ugly.
  const IMG_OVERFLOW_FRAC = 0.10;
  // Cumulative overflow: section.scrollHeight past clientHeight. Catches
  // multi-line text wraps and stacks of fit headings whose individual
  // overshoots fall under OVERFLOW_TOLERANCE but together extend past the
  // slide bottom. 16px ≈ one line of small text, below that = layout noise.
  const CUMULATIVE_OVERFLOW_TOLERANCE = 16;
  const TOO_SMALL_FONT_PX = 14; // back-row legibility floor
  const DENSE_WORD_COUNT = 120; // words on one slide that signal cramming
  const CURRENT_SLIDE_SELECTOR = '.reveal .slides section.present';
  const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'ul', 'ol', 'blockquote', 'pre', 'code', 'span']);

  /** Query the currently-presented slide section. */
  function currentSection(root) {
    return (root || document).querySelector(CURRENT_SLIDE_SELECTOR);
  }

  /**
   * Check a single slide <section> element and return warnings.
   * Pure function: takes DOM node + index, returns array.
   */
  function diagnoseSlide(section, slideIndex) {
    if (!section) return [];
    const warnings = [];

    // Overflow: any visible descendant extends past the slide frame.
    // Threshold is asymmetric by element kind:
    //   - <img>: object-fit: cover makes the visible pixels stay inside even
    //     when the element bounds nudge over by a few px. Only warn when
    //     an image overshoots > 10% of the slide dimension on any side.
    //   - text elements (h1-h6, p, li, …): always warn at OVERFLOW_TOLERANCE,
    //     since clipped text is always visibly ugly.
    //   - everything else (containers): warn at OVERFLOW_TOLERANCE.
    const frame = section.getBoundingClientRect();
    if (frame.width > 0 && frame.height > 0) {
      const imgThreshXpx = Math.max(OVERFLOW_TOLERANCE, frame.width * IMG_OVERFLOW_FRAC);
      const imgThreshYpx = Math.max(OVERFLOW_TOLERANCE, frame.height * IMG_OVERFLOW_FRAC);
      for (const el of section.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Skip containers that have visible children — focus on leaves.
        if (el.children.length > 0 && Array.from(el.children).some(c => {
          const cr = c.getBoundingClientRect();
          return cr.width > 0 && cr.height > 0;
        })) continue;

        const tag = el.tagName.toLowerCase();
        const isImg = tag === 'img';
        const tx = isImg ? imgThreshXpx : OVERFLOW_TOLERANCE;
        const ty = isImg ? imgThreshYpx : OVERFLOW_TOLERANCE;

        const overshoots = [];
        if (r.right > frame.right + tx)  overshoots.push(`right by ${Math.round(r.right - frame.right)}px`);
        if (r.bottom > frame.bottom + ty) overshoots.push(`bottom by ${Math.round(r.bottom - frame.bottom)}px`);
        if (r.left < frame.left - tx)    overshoots.push(`left by ${Math.round(frame.left - r.left)}px`);
        if (r.top < frame.top - ty)      overshoots.push(`top by ${Math.round(frame.top - r.top)}px`);
        if (overshoots.length === 0) continue;

        const desc = isImg
          ? `<img src="${(el.getAttribute('src') || '').split('/').pop()}">`
          : `<${tag}> "${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}${el.textContent && el.textContent.length > 40 ? '…' : ''}"`;

        warnings.push({
          type: 'overflow',
          severity: 'warn',
          slide: slideIndex,
          element: tag,
          overshoot: overshoots.join(', '),
          message: `${desc} overflows ${overshoots.join(', ')}`,
        });
        break; // one overflow warning per slide is plenty
      }
    }

    // Cumulative text overflow: scrollHeight > clientHeight AND at least one
    // text/image leaf actually extends past the frame bottom. The leaf check
    // filters false positives from empty containers sized to grid/column
    // tracks (e.g. `:::columns` cells with min-height equal to slide height).
    if (frame.height > 0) {
      const cumulative = section.scrollHeight - section.clientHeight;
      if (cumulative > CUMULATIVE_OVERFLOW_TOLERANCE) {
        let realOvershoot = 0;
        for (const el of section.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, img, pre, code')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const past = r.bottom - frame.bottom;
          if (past > realOvershoot) realOvershoot = past;
        }
        if (realOvershoot > 4) {
          warnings.push({
            type: 'text-cumulative-overflow',
            severity: 'warn',
            slide: slideIndex,
            overflow: Math.round(realOvershoot),
            message: `content extends ${Math.round(realOvershoot)}px past slide bottom — split or use [.autoscale: true]`,
          });
        }
      }
    }

    // Text too small: any text element rendered below the legibility floor.
    // fitText writes inline font-size, so getComputedStyle is reliable.
    let smallest = Infinity;
    let smallestEl = null;
    for (const el of section.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs > 0 && fs < smallest) { smallest = fs; smallestEl = el; }
    }
    if (smallestEl && smallest < TOO_SMALL_FONT_PX) {
      warnings.push({
        type: 'text-too-small',
        severity: 'warn',
        slide: slideIndex,
        fontSize: Math.round(smallest * 10) / 10,
        message: `text rendered at ${Math.round(smallest)}px (< ${TOO_SMALL_FONT_PX}px floor) — illegible to a back-row audience`,
      });
    }

    // Statement degraded to tier 3: autoflow's statement rule wanted to
    // apply #[fit] but the line crossed the 8-word limit, so it fell
    // back to plain h1 + [.autoscale: true]. Visually fine, but a
    // gentle nudge: this slide could have more impact if you split it.
    const tier = section.getAttribute('data-autoflow-tier');
    if (tier === '3') {
      const detail = section.getAttribute('data-autoflow-detail') || '';
      warnings.push({
        type: 'statement-degraded',
        severity: 'info',
        slide: slideIndex,
        detail,
        message: `slide rendered as a dense statement (${detail}) — split for stronger impact`,
      });
    }

    // Slide too dense: total visible word count above DENSE_WORD_COUNT.
    // Speaker notes (<aside class="notes">) are excluded.
    const visibleText = Array.from(section.children)
      .filter(c => c.tagName !== 'ASIDE')
      .map(c => c.textContent || '')
      .join(' ')
      .trim();
    const wordCount = visibleText ? visibleText.split(/\s+/).length : 0;
    if (wordCount > DENSE_WORD_COUNT) {
      warnings.push({
        type: 'slide-too-dense',
        severity: 'warn',
        slide: slideIndex,
        wordCount,
        message: `slide has ${wordCount} words (> ${DENSE_WORD_COUNT}) — consider splitting`,
      });
    }

    // Empty slide: no text AND no background image AND no inline img
    const text = section.textContent.trim();
    const hasBgAttr = section.hasAttribute('data-background-image') ||
                      section.hasAttribute('data-bg-broken') ||
                      section.hasAttribute('data-background-video') ||
                      section.hasAttribute('data-background-color');
    const hasInlineImg = section.querySelector('img') ||
                        section.querySelector('[style*="background-image"]');
    if (!text && !hasBgAttr && !hasInlineImg) {
      warnings.push({
        type: 'empty-slide',
        severity: 'warn',
        slide: slideIndex,
        message: 'slide has no visible content',
      });
    }

    // Broken <img> elements
    for (const img of section.querySelectorAll('img')) {
      if (img.complete && img.naturalWidth === 0) {
        const url = img.getAttribute('src') || '';
        warnings.push({
          type: 'missing-image',
          severity: 'warn',
          slide: slideIndex,
          url,
          message: `image failed to load: ${url}`,
        });
      }
    }

    // Broken images — the viewer flags them in two ways:
    // 1. `.broken-image` placeholder divs (for inline/split images)
    // 2. `data-bg-broken` attribute on section (for background images)
    for (const placeholder of section.querySelectorAll('.broken-image')) {
      const text = placeholder.textContent || '';
      const m = text.match(/Image not found:\s*(\S+)/);
      const url = m ? m[1] : 'unknown';
      warnings.push({
        type: 'missing-image',
        severity: 'warn',
        slide: slideIndex,
        url,
        message: `image failed to load: ${url}`,
      });
    }
    const bgBroken = section.getAttribute('data-bg-broken');
    if (bgBroken) {
      const url = bgBroken.replace(/^⚠\s*/, '');
      warnings.push({
        type: 'missing-image',
        severity: 'warn',
        slide: slideIndex,
        url,
        message: `background image failed to load: ${url}`,
      });
    }

    // Code blocks without language (not highlighted)
    for (const pre of section.querySelectorAll('pre > code')) {
      const hasLang = Array.from(pre.classList).some(c => c.startsWith('language-'));
      const content = pre.textContent.trim();
      if (!hasLang && content.length > 20) {
        warnings.push({
          type: 'code-no-lang',
          severity: 'info',
          slide: slideIndex,
          message: 'code block has no language — add ```js, ```py, etc. for syntax highlighting',
        });
        break; // one per slide
      }
    }

    return warnings;
  }

  /**
   * Deck-level checks (theme mismatch, etc.).
   */
  function diagnoseDeck(options) {
    const warnings = [];
    const { theme } = options || {};

    if (theme) {
      const reveal = document.querySelector('.reveal');
      const match = reveal && reveal.className.match(/theme-([\w-]+)/);
      const applied = match ? match[1] : null;
      if (applied && applied !== theme) {
        warnings.push({
          type: 'theme-mismatch',
          severity: 'warn',
          slide: null,
          theme,
          applied,
          message: `theme "${theme}" not applied (rendered as "${applied}")`,
        });
      }
    }

    return warnings;
  }

  /**
   * Diagnose the current slide only (sync, cheap).
   */
  function diagnoseCurrent(options) {
    const section = currentSection();
    const slideIdx = (window.Reveal && window.Reveal.getState && window.Reveal.getState().indexh + 1) || null;
    return [
      ...diagnoseDeck(options || {}),
      ...diagnoseSlide(section, slideIdx),
    ];
  }

  /**
   * Diagnose every slide by temporarily navigating through them.
   * Restores the original slide when done. Async: yields briefly per slide for layout.
   */
  async function diagnoseAll(options) {
    const warnings = [...diagnoseDeck(options || {})];
    if (!window.Reveal || !window.Reveal.getTotalSlides) return warnings;

    const total = window.Reveal.getTotalSlides();
    const originalIdx = window.Reveal.getState().indexh;
    for (let i = 0; i < total; i++) {
      window.Reveal.slide(i);
      await new Promise(r => requestAnimationFrame(() => r()));
      warnings.push(...diagnoseSlide(currentSection(), i + 1));
    }
    window.Reveal.slide(originalIdx);
    return warnings;
  }

  /**
   * Merge new warnings into target array, deduping by (type, slide, url).
   * Mutates target in place and returns it.
   */
  function merge(target, incoming) {
    const key = (w) => `${w.type}|${w.slide}|${w.url || ''}`;
    const seen = new Set(target.map(key));
    for (const w of incoming) {
      const k = key(w);
      if (!seen.has(k)) { target.push(w); seen.add(k); }
    }
    return target;
  }

  /**
   * Group warnings by slide and by type for UI display.
   */
  function groupWarnings(warnings) {
    const byType = {};
    const bySlide = {};
    for (const w of warnings) {
      byType[w.type] = (byType[w.type] || 0) + 1;
      const key = w.slide != null ? w.slide : 'deck';
      bySlide[key] = bySlide[key] || [];
      bySlide[key].push(w);
    }
    return { byType, bySlide, count: warnings.length };
  }

  const API = {
    diagnoseSlide,
    diagnoseDeck,
    diagnoseCurrent,
    diagnoseAll,
    merge,
    groupWarnings,
    currentSection,
    CURRENT_SLIDE_SELECTOR,
  };

  if (typeof window !== 'undefined') window.StellarDiagnostics = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
