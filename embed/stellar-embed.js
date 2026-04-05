/**
 * stellar-embed.js — Embeddable StellarDeck viewer
 *
 * Renders StellarDeck slides in any page. Two modes:
 *   - Single slide: StellarSlides with no controls
 *   - Deck: StellarSlides with embedded: true, navigation arrows
 *
 * Plus a playground mode: textarea editor + live preview side by side.
 *
 * Dependencies (load before this script):
 *   - autoflow.js (browser global: window.applyAutoflow)
 *   - deckset-parser.js (browser global: window.parseDecksetMarkdown)
 *   - slides2.js (browser global: window.StellarSlides)
 *   - css/themes.css + css/layout.css + slides2.css
 */

const StellarEmbed = (() => {
  // Same canvas as the main app. Same CSS, same fitText, same proportions.
  // Embeds are visually smaller (scaled by container), but proportionally identical.
  // Defaults match constants.js; read from window.StellarConstants if loaded,
  // else fall back to literals (embed ships standalone without constants.js).
  const _C = window.StellarConstants && window.StellarConstants.SLIDE;
  const DEFAULT_W = (_C && _C.WIDTH) || 1280;
  const DEFAULT_H = (_C && _C.HEIGHT) || 720;
  const SLIDE_PAD = 64;

  // ============================================================
  // Markdown syntax highlighting (overlay approach)
  // ============================================================

  let _highlightStyleInjected = false;

  function injectHighlightStyles() {
    if (_highlightStyleInjected) return;
    _highlightStyleInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      .stellar-highlight-wrap {
        position: relative;
      }
      .stellar-highlight-wrap .stellar-textarea {
        position: relative;
        z-index: 2;
        color: transparent !important;
        caret-color: #58a6ff;
        background: transparent !important;
      }
      .stellar-highlight-wrap .stellar-highlight-pre {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 1;
        margin: 0;
        overflow: hidden;
        pointer-events: none;
        background: #000000;
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px;
        color: #6e7681;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      .stellar-highlight-pre .sh-heading { color: #e6edf3; font-weight: bold; }
      .stellar-highlight-pre .sh-bold { color: #38bdf8; }
      .stellar-highlight-pre .sh-image { color: #3fb950; }
      .stellar-highlight-pre .sh-separator { color: #484f58; text-decoration: underline; text-decoration-style: dashed; }
      .stellar-highlight-pre .sh-code-fence { color: #d2a8ff; }
      .stellar-highlight-pre .sh-directive { color: #d2a8ff; }
      .stellar-highlight-pre .sh-note { color: #484f58; }
      .stellar-highlight-pre .sh-text { color: #c9d1d9; }
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightMarkdown(text) {
    // Process line by line, with special handling for code fences
    const lines = text.split('\n');
    const result = [];
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const escaped = escapeHtml(raw);

      // Code fence toggle
      if (raw.trimStart().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        result.push(`<span class="sh-code-fence">${escaped}</span>`);
        continue;
      }

      // Inside code block — dim text
      if (inCodeBlock) {
        result.push(`<span class="sh-code-fence">${escaped}</span>`);
        continue;
      }

      // Slide separator: line is exactly ---
      if (/^-{3,}\s*$/.test(raw)) {
        result.push(`<span class="sh-separator">${escaped}</span>`);
        continue;
      }

      // Speaker notes: starts with ^
      if (/^\^/.test(raw)) {
        result.push(`<span class="sh-note">${escaped}</span>`);
        continue;
      }

      // Headings: starts with #
      if (/^#{1,6}\s/.test(raw) || /^#{1,6}\[fit\]/.test(raw)) {
        result.push(`<span class="sh-heading">${escaped}</span>`);
        continue;
      }

      // Directive: [.something: value]
      if (/^\[\.[\w-]+:.*\]\s*$/.test(raw)) {
        result.push(`<span class="sh-directive">${escaped}</span>`);
        continue;
      }

      // For regular text lines, apply inline patterns
      let line = escaped;
      // Images: ![...](...) — do this before bold to avoid conflicts
      line = line.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '<span class="sh-image">![$1]($2)</span>');
      // Bold: **...**
      line = line.replace(/\*\*([^*]+)\*\*/g, '<span class="sh-bold">**$1**</span>');

      // Wrap remaining unhighlighted text in sh-text
      // If line has no spans at all, wrap the whole thing
      if (!line.includes('<span')) {
        if (line.trim() === '') {
          result.push(line);
        } else {
          result.push(`<span class="sh-text">${line}</span>`);
        }
      } else {
        result.push(line);
      }
    }
    return result.join('\n');
  }

  function setupHighlighting(textarea) {
    injectHighlightStyles();

    // Wrap textarea in a container
    const wrap = document.createElement('div');
    wrap.className = 'stellar-highlight-wrap';
    wrap.style.cssText = 'position:relative;flex:1;display:flex;flex-direction:column;';
    textarea.parentNode.insertBefore(wrap, textarea);
    wrap.appendChild(textarea);

    // Create the pre overlay
    const pre = document.createElement('pre');
    pre.className = 'stellar-highlight-pre';

    // Copy font/padding from textarea's inline style
    const cs = getComputedStyle(textarea);
    pre.style.fontFamily = cs.fontFamily;
    pre.style.fontSize = cs.fontSize;
    pre.style.lineHeight = cs.lineHeight;
    pre.style.padding = cs.padding;
    pre.style.tabSize = cs.tabSize || '2';

    wrap.insertBefore(pre, textarea);

    // Initial highlight
    const update = () => {
      pre.innerHTML = highlightMarkdown(textarea.value) + '\n';
    };
    update();

    // Sync on input
    textarea.addEventListener('input', update);

    // Sync scroll
    textarea.addEventListener('scroll', () => {
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
    });

    return { update };
  }

  // ============================================================
  // FitText (standalone, no state.js dependency)
  // ============================================================

  let _measurer = null;

  function getMeasurer() {
    if (_measurer) return _measurer;
    _measurer = document.createElement('div');
    _measurer.style.cssText = `
      position: fixed; top: -9999px; left: -9999px;
      visibility: hidden; white-space: nowrap; line-height: 1.1;
    `;
    document.body.appendChild(_measurer);
    return _measurer;
  }

  function syncMeasurerFont(container) {
    const m = getMeasurer();
    const ref = container.querySelector('h1') || container;
    const cs = getComputedStyle(ref);
    m.style.fontFamily = cs.getPropertyValue('--r-heading-font') || cs.fontFamily;
    m.style.letterSpacing = cs.getPropertyValue('--r-heading-letter-spacing') || '-0.03em';
  }

  function fitTextIn(container, slideW, slideH) {
    const w = slideW || DEFAULT_W;
    const h = slideH || DEFAULT_H;
    const m = getMeasurer();
    const fullWidth = w - SLIDE_PAD;
    const fullHeight = h - SLIDE_PAD;

    // Group fit headings by their parent section (same approach as main app's fitText)
    const slideMap = new Map();
    container.querySelectorAll('.deckset-fit').forEach(el => {
      const slide = el.closest('section');
      if (!slide) return;
      if (!slideMap.has(slide)) slideMap.set(slide, []);
      slideMap.get(slide).push(el);
    });

    slideMap.forEach((headings, slide) => {
      const nonFitChildren = Array.from(slide.children)
        .filter(c => !c.classList.contains('deckset-fit') && c.tagName !== 'ASIDE'
          && !c.classList.contains('deckset-split'));
      const siblingHeight = nonFitChildren.reduce((h, c) => h + (c.offsetHeight || 40), 0);

      headings.forEach(el => {
        const splitCol = el.closest('.deckset-split > div');
        const maxWidth = splitCol ? (w - SLIDE_PAD) / 2 - 16 : fullWidth;

        const parentHeadings = headings.filter(h =>
          (h.closest('.deckset-split > div') || slide) === (splitCol || slide)
        );
        const availableHeight = fullHeight - siblingHeight;
        const heightPerHeading = Math.max(availableHeight / parentHeadings.length, 40);

      const styles = getComputedStyle(el);
      const fontWeight = styles.fontWeight || '900';
      m.style.textTransform = styles.textTransform || 'none';
      const text = el.textContent;
      const lh = parseFloat(getComputedStyle(container).getPropertyValue('--r-heading-line-height')) || 1.1;

      el.style.display = 'block';
      el.style.margin = '0';

      let lo = 16, hi = 500;
      while (hi - lo > 2) {
        const mid = Math.floor((lo + hi) / 2);
        m.style.fontSize = mid + 'px';
        m.style.fontWeight = fontWeight;
        m.textContent = text;
        const fits = m.scrollWidth <= maxWidth && mid * lh <= heightPerHeading;
        if (fits) lo = mid; else hi = mid;
      }
      el.style.fontSize = lo + 'px';
      el.style.whiteSpace = 'nowrap';
    });
    }); // end slideMap.forEach
  }

  // ============================================================
  // renderSlide — single slide using StellarSlides embedded
  // ============================================================

  function renderSlide(container, markdown, options = {}) {
    // Single slide = a 1-slide deck with no controls
    // slideIndexOffset: 1 prevents title rule from firing (single slides aren't title slides)
    return renderDeck(container, markdown, { ...options, showControls: false, slideIndexOffset: 1 });
  }

  // ============================================================
  // renderDeck — full deck with StellarSlides (embedded mode)
  // ============================================================

  let _embedStyleInjected = false;
  function injectEmbedStyles() {
    if (_embedStyleInjected) return;
    _embedStyleInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      /* No font-size overrides — embed uses same CSS cascade as the main app.
         Readability ensured by larger canvas (640x360 → scale ~0.7). */
    `;
    document.head.appendChild(style);
  }

  function renderDeck(container, markdown, options = {}) {
    injectEmbedStyles();
    const { theme = 'nordic', scheme = '1', autoflow = false, showControls = true, slideIndexOffset = 0, width = DEFAULT_W, height = DEFAULT_H, onDiagnostics = null } = options;

    container.innerHTML = `
      <div class="reveal theme-${theme} scheme-${scheme}" style="width:100%;height:100%;border-radius:8px;overflow:hidden;">
        <div class="slides" id="stellar-deck-slides"></div>
      </div>
    `;

    const reveal = container.querySelector('.reveal');
    const slidesEl = reveal.querySelector('.slides');
    slidesEl.innerHTML = parseDecksetMarkdown(markdown, { autoflow, slideIndexOffset });

    const isSingle = !showControls;
    const deckConfig = {
      embedded: true,
      width: width,
      height: height,
      margin: 0.04,
      transition: 'none',
      controls: showControls,
      progress: !isSingle,
      slideNumber: isSingle ? false : 'c/t',
      keyboard: !isSingle,
      overview: false,
      center: true,
      hash: false,
    };
    const deck = new window.StellarSlides(reveal, deckConfig);

    const runFitText = () => {
      syncMeasurerFont(reveal);
      fitTextIn(reveal, width, height);
    };

    deck.initialize().then(() => {
      // Load the ACTUAL theme fonts (not hardcoded) before measuring
      const cs = getComputedStyle(reveal);
      const headingFont = (cs.getPropertyValue('--r-heading-font') || 'Inter').split(',')[0].trim();
      const bodyFont = (cs.getPropertyValue('--r-main-font') || 'Inter').split(',')[0].trim();
      Promise.all([
        document.fonts.load(`900 48px ${headingFont}`),
        document.fonts.load(`400 16px ${bodyFont}`),
        document.fonts.ready,
      ]).then(() => requestAnimationFrame(runFitText));
    });

    deck.on('slidechanged', () => requestAnimationFrame(runFitText));

    // Diagnostics: if diagnostics.js is loaded, collect warnings progressively.
    // Host page passes `onDiagnostics: (warnings) => { ... }` to receive updates.
    let _diagnostics = [];
    const emitDiagnostics = () => {
      if (!window.StellarDiagnostics) return;
      // Use Reveal alias (deck) for diagnoseCurrent's internal Reveal lookup
      if (!window.Reveal) window.Reveal = deck;
      window.StellarDiagnostics.merge(_diagnostics, window.StellarDiagnostics.diagnoseDeck({ theme }));
      window.StellarDiagnostics.merge(_diagnostics, window.StellarDiagnostics.diagnoseCurrent({ theme }));
      if (typeof onDiagnostics === 'function') onDiagnostics([..._diagnostics]);
    };
    deck.initialize().then(() => setTimeout(emitDiagnostics, 800));
    deck.on('slidechanged', () => setTimeout(emitDiagnostics, 100));

    return {
      deck,
      diagnostics: () => [..._diagnostics],
      update: (md) => {
        const currentIdx = deck.getState()?.indexh || 0;
        slidesEl.innerHTML = parseDecksetMarkdown(md, { autoflow: options.autoflow, slideIndexOffset });
        deck.sync();
        deck.slide(Math.min(currentIdx, deck.getTotalSlides() - 1));
        requestAnimationFrame(runFitText);
        _diagnostics = [];
        setTimeout(emitDiagnostics, 400);
      },
    };
  }

  // ============================================================
  // playground — textarea editor + live preview
  // ============================================================

  function playground(container, markdown, options = {}) {
    const { mode = 'single', theme = 'nordic', scheme = '1', autoflow = false, label = '' } = options;

    const editorTitle = label || 'slide.md';
    container.innerHTML = `
      <div class="stellar-playground" style="display:flex;gap:16px;align-items:stretch;">
        <div class="stellar-editor" style="flex:1;display:flex;flex-direction:column;">
          <div style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:#1a1a1f;border:1px solid rgba(255,255,255,0.15);border-bottom:none;border-radius:8px 8px 0 0;">
            <span style="width:10px;height:10px;border-radius:50%;background:#ff5f57;"></span>
            <span style="width:10px;height:10px;border-radius:50%;background:#febc2e;"></span>
            <span style="width:10px;height:10px;border-radius:50%;background:#28c840;"></span>
            <span style="color:#64748b;font-size:0.7rem;margin-left:8px;font-family:'SF Mono',Menlo,monospace;">${editorTitle}</span>
          </div>
          <textarea class="stellar-textarea" spellcheck="false" style="
            flex:1;min-height:180px;padding:14px;border-radius:0 0 8px 8px;
            border:1px solid rgba(255,255,255,0.15);border-top:none;
            background:#0a0a0a;color:#c9d1d9;font-family:'SF Mono',Menlo,'Fira Code',monospace;
            font-size:0.85rem;line-height:1.6;resize:none;outline:none;
            tab-size:2;caret-color:#58a6ff;
          ">${markdown.trim()}</textarea>
        </div>
        <div class="stellar-preview" style="flex:1;"></div>
      </div>
    `;

    const textarea = container.querySelector('.stellar-textarea');
    const preview = container.querySelector('.stellar-preview');
    const opts = { theme, scheme, autoflow };

    // Syntax highlighting overlay
    setupHighlighting(textarea);

    // Both modes use StellarSlides and need aspect-ratio
    preview.style.aspectRatio = '16/9';
    let instance;
    if (mode === 'single') {
      instance = renderSlide(preview, markdown, opts);
    } else {
      instance = renderDeck(preview, markdown, opts);
    }

    // Debounced live update — use update() to avoid DOM recreation
    let timer;
    textarea.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        instance.update(textarea.value);
      }, 200);
    });

    return {
      getMarkdown: () => textarea.value,
      setAutoflow: (enabled) => {
        opts.autoflow = enabled;
        const md = textarea.value;
        if (mode === 'single') {
          instance = renderSlide(preview, md, opts);
        } else {
          instance.update(md);
        }
      },
    };
  }

  return { renderSlide, renderDeck, playground, setupHighlighting };
})();
