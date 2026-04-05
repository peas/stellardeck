/**
 * diagrams.js — Lazy Mermaid diagram rendering for StellarDeck.
 *
 * Finds all .deckset-diagram .mermaid elements and renders them
 * using Mermaid.js from esm.sh CDN with handDrawn look.
 * Only loads Mermaid when diagram elements are actually present.
 */

let mermaidLoaded = false;

/**
 * Render all diagram elements that haven't been rendered yet.
 * Lazy-loads Mermaid on first call.
 */
export async function renderDiagrams() {
  const elements = document.querySelectorAll('.deckset-diagram .mermaid');
  if (elements.length === 0) return;

  if (!mermaidLoaded) {
    try {
      const { default: mermaid } = await import('https://esm.sh/mermaid@11/dist/mermaid.esm.min.mjs');
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        look: 'handDrawn',
        fontFamily: 'var(--r-main-font)',
      });
      window._mermaid = mermaid;
      mermaidLoaded = true;
    } catch (e) {
      console.warn('[StellarDeck] Failed to load Mermaid:', e);
      return;
    }
  }

  for (const el of elements) {
    if (el.dataset.diagramRendered) return;
    try {
      const id = 'diagram-' + Math.random().toString(36).slice(2);
      const { svg } = await window._mermaid.render(id, el.textContent);
      el.innerHTML = svg;
      el.dataset.diagramRendered = 'true';
    } catch (e) {
      console.warn('[StellarDeck] Diagram render failed:', e);
    }
  }
}
