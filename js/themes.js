import { state } from './state.js';
import { syncMeasurer, fitText } from './fittext.js';

// Theme registry comes from constants.js (dual-exported: window.StellarConstants
// in the browser, require('../constants.js') in Node CLI).
export const THEMES = window.StellarConstants.THEMES;

// Backward compat
export const SCHEMES = Object.fromEntries(
  Object.entries(THEMES).map(([k, v]) => [k, v.schemes])
);

export const THEME_VARS = [
  '--r-heading-font', '--r-heading-font-weight', '--r-heading-letter-spacing',
  '--r-heading-line-height', '--r-heading-text-transform', '--r-background-color',
  '--r-main-color', '--r-heading-color', '--r-main-font', '--r-main-font-size', '--accent',
  '--sd-heading-align', '--sd-image-radius', '--sd-fit-scale', '--sd-code-radius',
];

// Copy CSS variables from .reveal to :root so grid overlay and other siblings can access them.
// Must clear :root first to break circular inheritance (.reveal inherits from :root when no theme class).
export function propagateThemeVars() {
  const root = document.documentElement;
  THEME_VARS.forEach(prop => root.style.removeProperty(prop));
  // Force style recalc so .reveal reads from its own CSS rules, not stale :root values
  const cs = getComputedStyle(document.querySelector('.reveal'));
  THEME_VARS.forEach(prop => {
    root.style.setProperty(prop, cs.getPropertyValue(prop).trim());
  });
}

export function applyTheme(md) {
  const reveal = document.querySelector('.reveal');
  reveal.className = reveal.className.replace(/theme-\S+|scheme-\S+/g, '').trim();
  if (!reveal.classList.contains('reveal')) reveal.classList.add('reveal');
  // URL params override frontmatter (used by PDF export to match toolbar selection)
  const urlParams = new URLSearchParams(window.location.search);
  const _urlTheme = urlParams.get('theme');
  const _urlScheme = urlParams.get('scheme');
  if (_urlTheme) {
    reveal.classList.add('theme-' + _urlTheme);
    if (_urlScheme) reveal.classList.add('scheme-' + _urlScheme);
  } else {
    const themeMatch = md.match(/^theme:\s*(.+)$/im);
    if (themeMatch) {
      const parts = themeMatch[1].split(',').map(s => s.trim());
      reveal.classList.add('theme-' + parts[0].toLowerCase().replace(/\s+/g, '-'));
      if (parts[1]) reveal.classList.add('scheme-' + parts[1]);
    }
  }
  propagateThemeVars();
  syncThemeDropdown();
}

// Force all color-dependent elements to pick up new CSS variable values
export function applySchemeColors() {
  propagateThemeVars(); // sync CSS vars to :root for grid and other siblings

  // Clear inline background colors to let CSS variables cascade cleanly,
  // then re-apply explicit data-background-color overrides from sections.
  const reveal = document.querySelector('.reveal');
  reveal.style.removeProperty('background-color');

  // Clear and re-apply backgrounds (StellarSlides: .sd-bg divs inside .sd-backgrounds)
  const sdBgs = document.querySelectorAll('.sd-backgrounds .sd-bg');
  sdBgs.forEach(bg => bg.style.removeProperty('background-color'));

  const sections = document.querySelectorAll('.reveal .slides > section');
  sections.forEach((section, i) => {
    const explicitBg = section.getAttribute('data-background-color');
    if (explicitBg && sdBgs[i]) {
      sdBgs[i].style.backgroundColor = explicitBg;
    }
  });

  // Apply scheme bg color to container
  requestAnimationFrame(() => {
    const bgColor = getComputedStyle(reveal).getPropertyValue('--r-background-color').trim();
    reveal.style.backgroundColor = bgColor;
    const sdContainer = document.querySelector('.sd-backgrounds');
    if (sdContainer) sdContainer.style.backgroundColor = bgColor;
  });

  // Force layout recalculation
  if (Reveal.isReady?.()) Reveal.layout();

  // Grid overlay uses CSS var, but set explicitly too for reliability
  document.getElementById('grid-overlay').style.removeProperty('background-color');

  // Rebuild grid (thumbnails inherit --r-background-color via CSS)
  state.gridBuilt = false;
  if (isGridOpen()) buildGrid();

  syncMeasurer();
  requestAnimationFrame(() => fitText());
}

// Save toolbar theme/scheme override for current tab (if user changed via dropdown)
export function saveTabThemeOverride(tabIndex) {
  const reveal = document.querySelector('.reveal');
  const themeClass = Array.from(reveal.classList).find(c => c.startsWith('theme-'));
  const schemeClass = Array.from(reveal.classList).find(c => c.startsWith('scheme-'));
  state.tabs[tabIndex].themeOverride = themeClass ? themeClass.replace('theme-', '') : null;
  state.tabs[tabIndex].schemeOverride = schemeClass ? schemeClass.replace('scheme-', '') : null;
}

// Restore theme for a tab: use override if user changed it, else parse from markdown
export function restoreTabTheme(tab) {
  if (tab.themeOverride != null) {
    const reveal = document.querySelector('.reveal');
    reveal.className = reveal.className.replace(/theme-\S+|scheme-\S+/g, '').trim();
    if (!reveal.classList.contains('reveal')) reveal.classList.add('reveal');
    reveal.classList.add('theme-' + tab.themeOverride);
    if (tab.schemeOverride) reveal.classList.add('scheme-' + tab.schemeOverride);
    propagateThemeVars();
    syncThemeDropdown();
  } else {
    applyTheme(tab.md);
  }
  // Only apply scheme colors if Reveal is initialized (called before init on first load)
  if (Reveal.isReady?.()) applySchemeColors();
}

// Keep toolbar dropdown in sync with active theme on .reveal
export function syncThemeDropdown() {
  const themeSelect = document.getElementById('theme-select');
  if (!themeSelect) return;
  const reveal = document.querySelector('.reveal');
  const themeClass = Array.from(reveal.classList).find(c => c.startsWith('theme-'));
  themeSelect.value = themeClass ? themeClass.replace('theme-', '') : '';
}

// Internal helper used by applySchemeColors
function isGridOpen() {
  return document.getElementById('grid-overlay').classList.contains('active');
}

function buildGrid() {
  // Lazy import to avoid circular dependency — grid.js imports themes.js
  // We call the globally-available buildGrid from grid.js via a re-export on window
  // or by directly accessing the grid module. For now, inline the grid rebuild.
  const container = document.getElementById('grid-container');
  const sections = document.querySelectorAll('.reveal .slides > section');
  container.innerHTML = '';

  sections.forEach((section, i) => {
    const card = document.createElement('div');
    card.className = 'grid-slide' + (i === state.gridSelected ? ' selected' : '');
    card.dataset.index = i;

    const inner = document.createElement('div');
    inner.className = 'grid-slide-inner';

    const bgImage = section.getAttribute('data-background-image');
    const bgColor = section.getAttribute('data-background-color');
    const bgOpacity = section.getAttribute('data-background-opacity');
    if (bgImage) {
      inner.style.backgroundImage = `url('${bgImage}')`;
      inner.style.backgroundSize = section.getAttribute('data-background-size') || 'cover';
      inner.style.backgroundPosition = 'center';
      inner.style.backgroundRepeat = 'no-repeat';
      if (bgOpacity) inner.style.opacity = bgOpacity;
    }
    if (bgColor) inner.style.backgroundColor = bgColor;
    // Copy inline CSS vars from section (e.g. --r-heading-color from [.header] directive)
    const sectionStyle = section.getAttribute('style');
    if (sectionStyle) {
      sectionStyle.split(';').forEach(rule => {
        const [prop, val] = rule.split(':').map(s => s.trim());
        if (prop && val && prop.startsWith('--')) inner.style.setProperty(prop, val);
      });
    }
    inner.innerHTML = section.innerHTML;
    inner.querySelectorAll('aside.notes').forEach(n => n.remove());
    card.appendChild(inner);

    const badge = document.createElement('div');
    badge.className = 'grid-slide-number';
    badge.textContent = i + 1;
    card.appendChild(badge);

    card.addEventListener('click', () => {
      const overlay = document.getElementById('grid-overlay');
      overlay.classList.remove('active');
      Reveal.slide(i);
      if (Reveal.isOverview && Reveal.isOverview()) Reveal.toggleOverview(false);
    });
    container.appendChild(card);

    requestAnimationFrame(() => {
      const scale = card.clientWidth / Reveal.getConfig().width;
      inner.style.transform = `scale(${scale})`;
    });
  });

  state.gridBuilt = true;
}
