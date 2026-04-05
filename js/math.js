/**
 * math.js — Lazy KaTeX rendering for StellarDeck.
 *
 * Finds all .deckset-math and .deckset-math-inline elements,
 * reads data-math-src, and renders LaTeX using KaTeX from esm.sh CDN.
 * Only loads KaTeX when math elements are actually present.
 */

let katexLib = null;

/**
 * Render all math elements that haven't been rendered yet.
 * Lazy-loads KaTeX CSS and JS on first call.
 */
export async function renderMath() {
  const elements = document.querySelectorAll('.deckset-math, .deckset-math-inline');
  if (elements.length === 0) return;

  if (!katexLib) {
    try {
      // Load KaTeX CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://esm.sh/katex@0.16.22/dist/katex.min.css';
      document.head.appendChild(link);

      // Load KaTeX JS — ESM returns module, use .default
      const mod = await import('https://esm.sh/katex@0.16.22');
      katexLib = mod.default || mod;
    } catch (e) {
      console.warn('[StellarDeck] Failed to load KaTeX:', e);
      return;
    }
  }

  elements.forEach(el => {
    if (el.dataset.mathRendered) return;
    const src = el.dataset.mathSrc;
    if (!src) return;

    const isBlock = el.classList.contains('deckset-math');
    try {
      katexLib.render(src, el, { displayMode: isBlock, throwOnError: false });
      el.dataset.mathRendered = 'true';
    } catch (e) {
      el.textContent = src;
      el.style.color = '#f87171';
      el.dataset.mathRendered = 'true';
    }
  });
}
