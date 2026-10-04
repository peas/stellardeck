/**
 * slides2.js — StellarSlides engine
 *
 * Vanilla CSS/JS slide engine for StellarDeck.
 * Exposes window.StellarSlides class + window.Reveal legacy API alias.
 *
 * Usage (viewer — singleton):
 *   Reveal.initialize({ width: 1280, height: 720, ... });
 *
 * Usage (embed — instance):
 *   const deck = new StellarSlides(containerEl, { width: 800, height: 450 });
 *   deck.initialize();
 */

(function () {
  'use strict';

  // ─── Readable text on slides with their own background ───
  // A slide's own background — [.background-color], or a filtered image (the
  // parser pairs it with data-background-color="#000") — can defeat the
  // theme's text colors: dark text on a navy slide in a light scheme. Once the
  // theme has resolved, measure the real contrast and override only the colors
  // that fail, with the thresholds of scripts/audit-themes.js. Colors the
  // author set on the slide ([.header], [.text]) are never touched.

  // Bold and bullet colors are resolved on :root from --accent, so they're
  // measured (and overridden) on their own.
  const READABLE_MIN = {
    '--r-heading-color': 3, '--r-main-color': 4.5,
    '--accent': 2.5, '--sd-accent-bold-color': 2.5, '--sd-accent-bullets-color': 2.5,
  };
  const ON_DARK = '#ffffff', ON_DARK_BODY = '#e5e7eb', ON_LIGHT = '#111111', ON_LIGHT_BODY = '#374151';
  const READABLE_FALLBACK = {
    dark: { '--r-heading-color': ON_DARK, '--r-main-color': ON_DARK_BODY,
            '--accent': ON_DARK, '--sd-accent-bold-color': ON_DARK, '--sd-accent-bullets-color': ON_DARK },
    light: { '--r-heading-color': ON_LIGHT, '--r-main-color': ON_LIGHT_BODY,
             '--accent': ON_LIGHT, '--sd-accent-bold-color': ON_LIGHT, '--sd-accent-bullets-color': ON_LIGHT },
  };

  function relativeLuminance([r, g, b]) {
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function contrastRatio(a, b) {
    const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Which overrides a slide needs: { prop: color } for every color that fails
  // against `bg`. `colors` maps prop → [r,g,b] (null = unknown, skipped);
  // `authored` lists props the slide sets itself.
  function readableOverrides(bg, colors, authored) {
    const side = relativeLuminance(bg) < 0.18 ? 'dark' : 'light';
    const out = {};
    for (const [prop, min] of Object.entries(READABLE_MIN)) {
      if (authored.includes(prop) || !colors[prop]) continue;
      if (contrastRatio(colors[prop], bg) < min) out[prop] = READABLE_FALLBACK[side][prop];
    }
    return out;
  }

  let _colorCtx = null;
  function toRGB(value) {
    if (!value || typeof document === 'undefined') return null;
    _colorCtx = _colorCtx || document.createElement('canvas').getContext('2d');
    _colorCtx.fillStyle = '#010203';
    _colorCtx.fillStyle = value.trim();
    const v = _colorCtx.fillStyle;
    if (v === '#010203' && value.trim().toLowerCase() !== '#010203') return null; // unparseable
    const hex = v.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (hex) return hex.slice(1).map(h => parseInt(h, 16));
    const rgba = v.match(/rgba?\(([^)]+)\)/);
    return rgba ? rgba[1].split(',').slice(0, 3).map(Number) : null;
  }

  function applyReadableColors(section) {
    const previous = (section.getAttribute('data-sd-readable') || '').split(' ').filter(Boolean);
    previous.forEach(prop => section.style.removeProperty(prop));
    section.removeAttribute('data-sd-readable');

    const bg = toRGB(section.getAttribute('data-background-color'));
    if (!bg) return;
    const authored = Object.keys(READABLE_MIN).filter(p => section.style.getPropertyValue(p));
    const cs = getComputedStyle(section);
    const colors = {};
    for (const prop of Object.keys(READABLE_MIN)) colors[prop] = toRGB(cs.getPropertyValue(prop));
    const fixes = readableOverrides(bg, colors, authored);
    const props = Object.keys(fixes);
    if (!props.length) return;
    props.forEach(prop => section.style.setProperty(prop, fixes[prop]));
    section.setAttribute('data-sd-readable', props.join(' '));
  }

  // ─── StellarSlides class ───

  class StellarSlides {
    constructor(container, config = {}) {
      this._container = container;
      this._slidesEl = container.querySelector('.slides') || container.querySelector('#slides');
      this._config = Object.assign({
        width: 1280,
        height: 720,
        margin: 0.06,
        hash: false,
        center: true,
        embedded: false,
        slideNumber: false,
        progress: false,
        controls: false,
        keyboard: false,
        touch: true,
        transition: 'none',
        backgroundTransition: 'none',
        overview: false,
        help: false,
        preloadIframes: true,
        postMessage: false,
        postMessageEvents: false,
      }, config);

      this._state = {
        indexh: 0,
        totalSlides: 0,
        ready: false,
        // True only after the 'ready' event has been emitted (one tick after
        // initialize() resolves). Drives the sticky-on-late-register path in
        // on(): if a caller registers `on('ready', fn)` BEFORE the emit, the
        // emit itself will run them; AFTER the emit, sticky takes over so
        // they still run once. Without this flag we'd double-fire any
        // handler registered between resolve() and the setTimeout(0) tick.
        readyEmitted: false,
        fragmentIndex: -1,
        fragments: [],
      };

      this._handlers = {};
      this._bgContainer = null;
      this._slideNumberEl = null;
      this._progressEl = null;
      this._resizeObserver = null;
    }

    // ─── Lifecycle ───

    initialize() {
      return new Promise((resolve) => {
        // Build backgrounds layer
        this._buildBackgrounds();

        // Count slides and apply initial classes
        this.sync();

        // Create slide number element
        if (this._config.slideNumber) {
          this._slideNumberEl = document.createElement('div');
          this._slideNumberEl.className = 'sd-slide-number';
          this._container.appendChild(this._slideNumberEl);
        }

        // Create progress bar
        if (this._config.progress) {
          this._progressEl = document.createElement('div');
          this._progressEl.className = 'sd-progress';
          this._progressEl.innerHTML = '<span></span>';
          this._container.appendChild(this._progressEl);
        }

        // Initial layout
        this.layout();

        // Navigate to initial slide (from hash or 0)
        let startIndex = 0;
        if (this._config.hash) {
          const match = window.location.hash.match(/^#\/(\d+)/);
          if (match) startIndex = parseInt(match[1], 10);
        }
        this._navigate(startIndex, true);

        // Listen for hash changes
        if (this._config.hash && !this._config.embedded) {
          window.addEventListener('hashchange', () => {
            const match = window.location.hash.match(/^#\/(\d+)/);
            if (match) {
              const idx = parseInt(match[1], 10);
              if (idx !== this._state.indexh) this._navigate(idx);
            }
          });
        }

        // Resize observer
        this._resizeObserver = new ResizeObserver(() => {
          this.layout();
          this.emit('resize', {});
        });
        this._resizeObserver.observe(this._container);

        // Mark ready and resolve — emit 'ready' after a macro-task so
        // listeners registered in the synchronous code immediately after
        // initialize() (and in the .then() chain of its promise) are
        // captured by the emit.
        this._state.ready = true;
        resolve();
        setTimeout(() => {
          this.emit('ready', {});
          // From this point on, late `on('ready', fn)` registrations rely
          // on the sticky path in on() — see the readyEmitted check there.
          this._state.readyEmitted = true;
        }, 0);
      });
    }

    destroy() {
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }
      if (this._bgContainer) {
        this._bgContainer.remove();
        this._bgContainer = null;
      }
      if (this._slideNumberEl) {
        this._slideNumberEl.remove();
        this._slideNumberEl = null;
      }
      if (this._progressEl) {
        this._progressEl.remove();
        this._progressEl = null;
      }
      this._handlers = {};
    }

    // ─── Navigation ───

    slide(index) {
      this._navigate(index);
    }

    next() {
      // Try advancing fragment first
      if (this._nextFragment()) return;
      if (this._state.indexh < this._state.totalSlides - 1) {
        this._navigate(this._state.indexh + 1);
      }
    }

    prev() {
      // Try hiding fragment first
      if (this._prevFragment()) return;
      if (this._state.indexh > 0) {
        this._navigate(this._state.indexh - 1);
      }
    }

    _navigate(targetIndex, silent = false) {
      targetIndex = Math.max(0, Math.min(targetIndex, this._state.totalSlides - 1));

      const sections = this._getSections();
      const previousSlide = sections[this._state.indexh];
      const currentSlide = sections[targetIndex];

      // Apply visibility classes
      sections.forEach((section, i) => {
        section.classList.remove('present', 'past', 'future');
        if (i < targetIndex) section.classList.add('past');
        else if (i === targetIndex) section.classList.add('present');
        else section.classList.add('future');
      });

      // Show matching background
      if (this._bgContainer) {
        const bgs = this._bgContainer.querySelectorAll('.sd-bg');
        bgs.forEach((bg, i) => {
          bg.classList.toggle('present', i === targetIndex);
        });
      }

      this._state.indexh = targetIndex;

      // Reset fragments for new slide
      this._indexFragments();

      // Update hash
      if (this._config.hash && !this._config.embedded) {
        window.location.hash = '#/' + targetIndex;
      }

      // Update slide number
      this._updateSlideNumber();

      // Update progress
      this._updateProgress();

      // Emit event
      if (!silent) {
        this.emit('slidechanged', {
          indexh: targetIndex,
          indexv: 0,
          previousSlide,
          currentSlide,
        });
      }
    }

    // ─── Fragments ───

    _indexFragments() {
      const section = this._getSections()[this._state.indexh];
      if (!section) {
        this._state.fragments = [];
        this._state.fragmentIndex = -1;
        return;
      }
      this._state.fragments = Array.from(section.querySelectorAll('.fragment'));
      this._state.fragmentIndex = -1;

      // Mark all as not visible
      this._state.fragments.forEach(f => {
        f.classList.remove('visible', 'current-fragment');
      });
    }

    _nextFragment() {
      const frags = this._state.fragments;
      if (this._state.fragmentIndex < frags.length - 1) {
        this._state.fragmentIndex++;
        const frag = frags[this._state.fragmentIndex];
        frag.classList.add('visible', 'current-fragment');
        // Remove current-fragment from previous
        if (this._state.fragmentIndex > 0) {
          frags[this._state.fragmentIndex - 1].classList.remove('current-fragment');
        }
        this.emit('fragmentshown', { fragment: frag, index: this._state.fragmentIndex });
        return true;
      }
      return false;
    }

    _prevFragment() {
      const frags = this._state.fragments;
      if (this._state.fragmentIndex >= 0) {
        const frag = frags[this._state.fragmentIndex];
        frag.classList.remove('visible', 'current-fragment');
        this._state.fragmentIndex--;
        if (this._state.fragmentIndex >= 0) {
          frags[this._state.fragmentIndex].classList.add('current-fragment');
        }
        this.emit('fragmenthidden', { fragment: frag, index: this._state.fragmentIndex + 1 });
        return true;
      }
      return false;
    }

    // ─── Backgrounds ───

    _buildBackgrounds() {
      // Remove existing background container
      const existing = this._container.querySelector('.sd-backgrounds');
      if (existing) existing.remove();

      this._bgContainer = document.createElement('div');
      this._bgContainer.className = 'sd-backgrounds';

      const sections = this._getSections();
      sections.forEach((section, i) => {
        const bg = document.createElement('div');
        bg.className = 'sd-bg';

        // Read data attributes
        const bgImage = section.getAttribute('data-background-image');
        const bgColor = section.getAttribute('data-background-color');
        const bgSize = section.getAttribute('data-background-size') || 'cover';
        const bgOpacity = section.getAttribute('data-background-opacity');
        const bgVideo = section.getAttribute('data-background-video');

        if (bgColor) {
          bg.style.backgroundColor = bgColor;
        }
        applyReadableColors(section);
        if (bgImage) {
          bg.style.backgroundImage = `url("${bgImage}")`;
          bg.style.backgroundSize = bgSize;
        }
        if (bgOpacity) {
          bg.style.opacity = bgOpacity;
          bg.setAttribute('data-filtered', '');
        }
        if (bgVideo) {
          const video = document.createElement('video');
          video.src = bgVideo;
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          bg.appendChild(video);
        }

        // Also apply per-slide CSS vars (--r-heading-color, etc.)
        const sectionStyle = section.getAttribute('style');
        if (sectionStyle) {
          // Copy CSS custom properties from section to background
          const vars = sectionStyle.match(/--[^:]+:\s*[^;]+/g);
          if (vars) {
            vars.forEach(v => {
              const [prop, val] = v.split(':').map(s => s.trim());
              bg.style.setProperty(prop, val);
            });
          }
        }

        this._bgContainer.appendChild(bg);
      });

      // Insert before .slides
      this._container.insertBefore(this._bgContainer, this._slidesEl);
    }

    // ─── Layout / Scaling ───

    layout() {
      if (!this._slidesEl) return;

      const containerW = this._container.clientWidth;
      const containerH = this._container.clientHeight;
      const slideW = this._config.width;
      const slideH = this._config.height;

      // Scale to fit with margin
      const margin = this._config.margin;
      const scale = Math.min(
        (containerW * (1 - margin)) / slideW,
        (containerH * (1 - margin)) / slideH
      );

      this._slidesEl.style.width = slideW + 'px';
      this._slidesEl.style.height = slideH + 'px';
      this._slidesEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }

    // Re-check text contrast on slides with their own background — call
    // after a theme/scheme change (backgrounds are otherwise built in sync()).
    refreshReadableColors() {
      this._getSections().forEach(applyReadableColors);
    }

    // ─── Sync (rebuild after DOM changes) ───

    sync() {
      const sections = this._getSections();
      this._state.totalSlides = sections.length;

      // Rebuild backgrounds
      this._buildBackgrounds();

      // Re-apply visibility
      sections.forEach((section, i) => {
        section.classList.remove('present', 'past', 'future');
        if (i < this._state.indexh) section.classList.add('past');
        else if (i === this._state.indexh) section.classList.add('present');
        else section.classList.add('future');
      });

      // Show matching background
      if (this._bgContainer) {
        const bgs = this._bgContainer.querySelectorAll('.sd-bg');
        bgs.forEach((bg, i) => {
          bg.classList.toggle('present', i === this._state.indexh);
        });
      }

      // Re-index fragments
      this._indexFragments();

      // Update UI
      this._updateSlideNumber();
      this._updateProgress();
    }

    // ─── State Queries ───

    getState() {
      return { indexh: this._state.indexh, indexv: 0 };
    }

    getTotalSlides() {
      return this._state.totalSlides;
    }

    getConfig() {
      return Object.assign({}, this._config);
    }

    isReady() {
      return this._state.ready;
    }

    isOverview() {
      return false;
    }

    toggleOverview() {
      // No-op — StellarDeck uses custom grid
    }

    getPlugin(name) {
      if (name === 'highlight') {
        // Return hljs adapter if highlight.js is loaded (from CDN)
        if (!this._highlightPlugin && typeof hljs !== 'undefined') {
          this._highlightPlugin = { highlightBlock: (el) => hljs.highlightElement(el) };
        }
        return this._highlightPlugin || null;
      }
      return null;
    }

    // ─── Events ───

    on(event, handler) {
      if (!this._handlers[event]) this._handlers[event] = new Set();
      this._handlers[event].add(handler);
      // 'ready' is sticky AFTER it has been emitted: late-registering
      // listeners must still run once. Without this, every
      // Reveal.on('ready', fn) call that happens after the emit tick —
      // including all six handlers in js/main.js (renderExtras,
      // thumbnails, chrome counter, fitText, presenter sync, session save)
      // — silently never fires. We gate on `readyEmitted` (not just
      // `ready`) so handlers registered BEFORE the emit don't fire twice;
      // those still run via emit's normal handler-set walk.
      if (event === 'ready' && this._state.readyEmitted) {
        setTimeout(() => {
          try { handler({}); } catch (e) { console.error('StellarSlides event "ready" error:', e); }
        }, 0);
      }
    }

    off(event, handler) {
      if (this._handlers[event]) this._handlers[event].delete(handler);
    }

    emit(event, data) {
      if (this._handlers[event]) {
        this._handlers[event].forEach(fn => {
          try { fn(data); } catch (e) { console.error(`StellarSlides event "${event}" error:`, e); }
        });
      }
    }

    // ─── Private Helpers ───

    _getSections() {
      return this._slidesEl
        ? Array.from(this._slidesEl.querySelectorAll(':scope > section'))
        : [];
    }

    _updateSlideNumber() {
      if (this._slideNumberEl) {
        const fmt = this._config.slideNumber;
        if (fmt === 'c/t') {
          this._slideNumberEl.textContent = `${this._state.indexh + 1} / ${this._state.totalSlides}`;
        } else if (fmt === 'c') {
          this._slideNumberEl.textContent = `${this._state.indexh + 1}`;
        } else if (fmt) {
          this._slideNumberEl.textContent = `${this._state.indexh + 1} / ${this._state.totalSlides}`;
        }
      }
    }

    _updateProgress() {
      if (this._progressEl) {
        const pct = this._state.totalSlides > 1
          ? (this._state.indexh / (this._state.totalSlides - 1)) * 100
          : 0;
        this._progressEl.querySelector('span').style.width = pct + '%';
      }
    }
  }

  // ─── Legacy API Alias ───
  // Exposes window.Reveal so existing code (Reveal.next(), Reveal.sync(), etc.) works unchanged.

  let _defaultInstance = null;

  const stellarSlides = {
    initialize(config) {
      const container = document.querySelector('.reveal');
      if (!container) {
        console.error('StellarSlides: no .reveal container found');
        return Promise.reject(new Error('No .reveal container'));
      }
      _defaultInstance = new StellarSlides(container, config);
      return _defaultInstance.initialize();
    },

    slide(idx) { if (_defaultInstance) _defaultInstance.slide(idx); },
    next() { if (_defaultInstance) _defaultInstance.next(); },
    prev() { if (_defaultInstance) _defaultInstance.prev(); },
    sync() { if (_defaultInstance) _defaultInstance.sync(); },
    layout() { if (_defaultInstance) _defaultInstance.layout(); },
    refreshReadableColors() { if (_defaultInstance) _defaultInstance.refreshReadableColors(); },

    getState() { return _defaultInstance ? _defaultInstance.getState() : { indexh: 0, indexv: 0 }; },
    getTotalSlides() { return _defaultInstance ? _defaultInstance.getTotalSlides() : 0; },
    getConfig() { return _defaultInstance ? _defaultInstance.getConfig() : {}; },
    isReady() { return _defaultInstance ? _defaultInstance.isReady() : false; },
    isOverview() { return false; },
    toggleOverview() {},

    getPlugin(name) { return _defaultInstance ? _defaultInstance.getPlugin(name) : null; },

    on(event, handler) { if (_defaultInstance) _defaultInstance.on(event, handler); },
    off(event, handler) { if (_defaultInstance) _defaultInstance.off(event, handler); },
  };

  // ─── Exports ───

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { contrastRatio, relativeLuminance, readableOverrides, READABLE_MIN, READABLE_FALLBACK };
  }
  if (typeof window === 'undefined') return;

  window.StellarSlides = StellarSlides;
  window.Reveal = stellarSlides; // Legacy API alias — keeps existing Reveal.xxx() calls working

})();
