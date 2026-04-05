/**
 * stellar-embed.js — Embeddable StellarDeck viewer
 *
 * Renders StellarDeck slides in any page. Two modes:
 *   - Single slide: parser + CSS in a scaled container
 *   - Deck: StellarSlides with navigation arrows
 *
 * Plus a playground mode: textarea editor + live preview side by side.
 *
 * Dependencies (load before this script):
 *   - autoflow.js (browser global: window.applyAutoflow)
 *   - deckset-parser.js (browser global: window.parseDecksetMarkdown)
 *   - slides2.js + slides2.css (StellarSlides engine)
 *   - css/themes.css + css/layout.css
 */

const StellarEmbed = (() => {
  // Same canvas as the main app. Same CSS, same fitText, same proportions.
  // Embeds are visually smaller (scaled by container), but proportionally identical.
  const DEFAULT_W = 1280;
  const DEFAULT_H = 720;
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
  // renderSlide — single slide using Reveal.js embedded (same engine as deck)
  // ============================================================

  function renderSlide(container, markdown, options = {}) {
    // Single slide = a 1-slide deck with no controls
    // slideIndexOffset: 1 prevents title rule from firing (single slides aren't title slides)
    return renderDeck(container, markdown, { ...options, showControls: false, slideIndexOffset: 1 });
  }

  // ============================================================
  // renderDeck — full deck with Reveal.js (embedded mode)
  // ============================================================

  // ============================================================
  // renderExtras — QR codes, math, diagrams, code highlighting
  // Inline versions of js/qr.js, js/math.js, js/diagrams.js
  // Scoped to container (not document) for multi-embed pages
  // ============================================================

  let _qrLib = null, _katexLib = null, _mermaidLoaded = false;

  async function renderExtras(container) {
    await Promise.all([
      renderQR(container),
      renderMathIn(container),
      renderDiagramsIn(container),
      highlightCodeIn(container),
    ]);
    setupBrokenImages(container);
  }

  function setupBrokenImages(container) {
    container.querySelectorAll('img').forEach(img => {
      if (img._errorHandled) return;
      img._errorHandled = true;
      img.addEventListener('error', () => {
        const placeholder = document.createElement('div');
        placeholder.className = 'broken-image';
        placeholder.textContent = '\u26A0 Image not found: ' + img.getAttribute('src');
        img.replaceWith(placeholder);
      });
    });
    container.querySelectorAll('section[data-background-image]').forEach(sec => {
      if (sec._bgChecked) return;
      sec._bgChecked = true;
      const url = sec.getAttribute('data-background-image');
      const test = new Image();
      test.onerror = () => sec.setAttribute('data-bg-broken', '\u26A0 ' + url);
      test.src = url;
    });
  }

  async function renderQR(container) {
    const els = container.querySelectorAll('.deckset-qr:not([data-qr-rendered])');
    if (els.length === 0) return;
    if (!_qrLib) {
      try {
        const mod = await import('https://esm.sh/qrcode-generator@1.4.4');
        _qrLib = mod.default;
      } catch (e) { console.warn('[StellarEmbed] QR library failed:', e); return; }
    }
    els.forEach(el => {
      const url = el.dataset.qrUrl;
      if (!url) return;
      const qr = _qrLib(0, 'M');
      qr.addData(url);
      qr.make();
      const modules = qr.getModuleCount();
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${modules} ${modules}" style="width:100%;height:100%;max-width:256px;max-height:256px" shape-rendering="crispEdges">`;
      svg += `<rect width="${modules}" height="${modules}" fill="white"/>`;
      for (let r = 0; r < modules; r++)
        for (let c = 0; c < modules; c++)
          if (qr.isDark(r, c)) svg += `<rect x="${c}" y="${r}" width="1" height="1" fill="#1a1a2e"/>`;
      svg += '</svg>';
      el.innerHTML = svg;
      el.dataset.qrRendered = 'true';
    });
  }

  async function renderMathIn(container) {
    const els = container.querySelectorAll('.deckset-math:not([data-math-rendered]), .deckset-math-inline:not([data-math-rendered])');
    if (els.length === 0) return;
    if (!_katexLib) {
      try {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://esm.sh/katex@0.16.22/dist/katex.min.css';
        document.head.appendChild(link);
        const mod = await import('https://esm.sh/katex@0.16.22');
        _katexLib = mod.default || mod;
      } catch (e) { console.warn('[StellarEmbed] KaTeX failed:', e); return; }
    }
    els.forEach(el => {
      const src = el.dataset.mathSrc;
      if (!src) return;
      try {
        _katexLib.render(src, el, { displayMode: el.classList.contains('deckset-math'), throwOnError: false });
      } catch (e) { el.textContent = src; el.style.color = '#f87171'; }
      el.dataset.mathRendered = 'true';
    });
  }

  async function renderDiagramsIn(container) {
    const els = container.querySelectorAll('.deckset-diagram .mermaid:not([data-diagram-rendered])');
    if (els.length === 0) return;
    if (!_mermaidLoaded) {
      try {
        const { default: mermaid } = await import('https://esm.sh/mermaid@11/dist/mermaid.esm.min.mjs');
        mermaid.initialize({ startOnLoad: false, theme: 'dark', look: 'handDrawn', fontFamily: 'var(--r-main-font)' });
        window._mermaid = mermaid;
        _mermaidLoaded = true;
      } catch (e) { console.warn('[StellarEmbed] Mermaid failed:', e); return; }
    }
    for (const el of els) {
      try {
        const id = 'diagram-' + Math.random().toString(36).slice(2);
        const { svg } = await window._mermaid.render(id, el.textContent);
        el.innerHTML = svg;
        el.dataset.diagramRendered = 'true';
      } catch (e) { console.warn('[StellarEmbed] Diagram render failed:', e); }
    }
  }

  function highlightCodeIn(container) {
    if (typeof hljs === 'undefined') return;
    container.querySelectorAll('pre code:not(.hljs)').forEach(el => hljs.highlightElement(el));
  }

  // ============================================================
  // Embed navigation controls (StellarSlides doesn't create them)
  // ============================================================

  let _navStyleInjected = false;
  function injectEmbedStyles() {
    if (_navStyleInjected) return;
    _navStyleInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      .sd-embed-nav { position:absolute; top:50%; transform:translateY(-50%); z-index:10;
        width:36px; height:36px; border-radius:50%; border:none; cursor:pointer;
        background:rgba(0,0,0,0.4); color:rgba(255,255,255,0.8); font-size:1.2rem;
        display:flex; align-items:center; justify-content:center;
        opacity:0; transition:opacity 0.2s; }
      .reveal:hover .sd-embed-nav { opacity:1; }
      .sd-embed-nav:hover { background:rgba(0,0,0,0.7); color:white; }
      .sd-embed-prev { left:8px; }
      .sd-embed-next { right:8px; }
    `;
    document.head.appendChild(style);
  }

  function renderDeck(container, markdown, options = {}) {
    injectEmbedStyles();
    const { theme = 'nordic', scheme = '1', autoflow = false, showControls = true, slideIndexOffset = 0, width = DEFAULT_W, height = DEFAULT_H } = options;

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
    // Use StellarSlides if available, otherwise fall back to Reveal.js
    const DeckEngine = window.StellarSlides || Reveal;
    const deck = new DeckEngine(reveal, DeckEngine === Reveal ? { ...deckConfig, view: null } : deckConfig);

    const runFitText = () => {
      syncMeasurerFont(reveal);
      fitTextIn(reveal, width, height);
    };

    // Add navigation controls for multi-slide decks
    if (showControls) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'sd-embed-nav sd-embed-prev';
      prevBtn.innerHTML = '&#8249;';
      prevBtn.setAttribute('aria-label', 'Previous slide');
      prevBtn.onclick = (e) => { e.stopPropagation(); deck.prev(); };

      const nextBtn = document.createElement('button');
      nextBtn.className = 'sd-embed-nav sd-embed-next';
      nextBtn.innerHTML = '&#8250;';
      nextBtn.setAttribute('aria-label', 'Next slide');
      nextBtn.onclick = (e) => { e.stopPropagation(); deck.next(); };

      reveal.appendChild(prevBtn);
      reveal.appendChild(nextBtn);
    }

    deck.initialize().then(() => {
      // Load the ACTUAL theme fonts (not hardcoded) before measuring
      const cs = getComputedStyle(reveal);
      const headingFont = (cs.getPropertyValue('--r-heading-font') || 'Inter').split(',')[0].trim();
      const bodyFont = (cs.getPropertyValue('--r-main-font') || 'Inter').split(',')[0].trim();
      Promise.all([
        document.fonts.load(`900 48px ${headingFont}`),
        document.fonts.load(`400 16px ${bodyFont}`),
        document.fonts.ready,
      ]).then(() => {
        requestAnimationFrame(runFitText);
        renderExtras(container);
      });
    });

    deck.on('slidechanged', () => requestAnimationFrame(runFitText));

    return {
      deck,
      update: (md) => {
        const currentIdx = deck.getState()?.indexh || 0;
        slidesEl.innerHTML = parseDecksetMarkdown(md, { autoflow: options.autoflow, slideIndexOffset });
        deck.sync();
        deck.slide(Math.min(currentIdx, deck.getTotalSlides() - 1));
        requestAnimationFrame(runFitText);
        renderExtras(container);
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

    // Both modes use Reveal.js and need aspect-ratio
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

// Expose on window for cross-script access (const doesn't set window properties)
if (typeof window !== 'undefined') window.StellarEmbed = StellarEmbed;
