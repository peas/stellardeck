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
  const CURRENT_SLIDE_SELECTOR = '.reveal .slides section.present';

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
    // Identify the offender so the warning is actionable: tag name + class
    // hint + truncated text + which side it overflowed on, with px amount.
    const frame = section.getBoundingClientRect();
    if (frame.width > 0 && frame.height > 0) {
      for (const el of section.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Skip ancestors of other elements we'd flag — focus on leaves
        if (el.children.length > 0 && Array.from(el.children).some(c => {
          const cr = c.getBoundingClientRect();
          return cr.width > 0 && cr.height > 0;
        })) continue;
        const overshoots = [];
        if (r.right > frame.right + OVERFLOW_TOLERANCE) overshoots.push(`right by ${Math.round(r.right - frame.right)}px`);
        if (r.bottom > frame.bottom + OVERFLOW_TOLERANCE) overshoots.push(`bottom by ${Math.round(r.bottom - frame.bottom)}px`);
        if (r.left < frame.left - OVERFLOW_TOLERANCE) overshoots.push(`left by ${Math.round(frame.left - r.left)}px`);
        if (r.top < frame.top - OVERFLOW_TOLERANCE) overshoots.push(`top by ${Math.round(frame.top - r.top)}px`);
        if (overshoots.length === 0) continue;

        const tag = el.tagName.toLowerCase();
        const isImg = tag === 'img';
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
