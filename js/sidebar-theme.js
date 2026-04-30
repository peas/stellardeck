// ============================================================
// Sidebar mode "theme" — theme + color scheme picker
//
// Replaces the toolbar's theme dropdown + Colors popover. Applied
// changes persist via the existing sidecar mechanism (sidecar.js).
// ============================================================

import { state } from './state.js';
import { THEMES, applySchemeColors, propagateThemeVars, syncThemeDropdown } from './themes.js';
import { persistThemeToSidecar } from './sidecar.js';
import { syncMeasurer, fitText } from './fittext.js';
import { showToast } from './toast.js';

export function renderThemeSidebar() {
  const bar = document.getElementById('tab-bar');
  if (!bar) return;
  bar.innerHTML = '';
  bar.classList.add('visible');

  // ── Header ─────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'sb-section-header';
  header.textContent = 'THEME';
  bar.appendChild(header);

  // ── Theme list ─────────────────────────────────────────────────────
  const reveal = document.querySelector('.reveal');
  const currentTheme = reveal && (reveal.className.match(/theme-([\w-]+)/)?.[1] || '');
  const currentScheme = reveal && (reveal.className.match(/scheme-([\w-]+)/)?.[1] || '');

  const themeList = document.createElement('div');
  themeList.className = 'sb-theme-list';
  Object.entries(THEMES).forEach(([key, theme]) => {
    const item = document.createElement('div');
    item.className = 'sb-theme-item' + (key === currentTheme ? ' active' : '');
    item.dataset.theme = key;
    item.innerHTML = `
      <span class="sb-theme-name">${theme.label}</span>
      <span class="sb-theme-meta">${theme.schemes?.length || 0} schemes</span>
    `;
    item.addEventListener('click', () => applyThemeFromSidebar(key));
    themeList.appendChild(item);
  });
  bar.appendChild(themeList);

  // ── Scheme swatches for the active theme ───────────────────────────
  const schemes = THEMES[currentTheme]?.schemes || [];
  if (schemes.length > 0) {
    const schemeHeader = document.createElement('div');
    schemeHeader.className = 'sb-section-header';
    schemeHeader.textContent = 'COLOR SCHEME';
    bar.appendChild(schemeHeader);

    const grid = document.createElement('div');
    grid.className = 'sb-scheme-grid';
    schemes.forEach(s => {
      const sw = document.createElement('div');
      sw.className = 'sb-scheme-swatch' + (currentScheme === s.id ? ' active' : '');
      sw.style.background = s.bg;
      sw.style.boxShadow = `inset 0 0 0 4px ${s.bg}, inset 0 -10px 0 ${s.fg}`;
      sw.title = `Scheme ${s.id}`;
      sw.addEventListener('click', () => applySchemeFromSidebar(s.id));
      grid.appendChild(sw);
    });
    bar.appendChild(grid);
  }
}

function applyThemeFromSidebar(themeKey) {
  const reveal = document.querySelector('.reveal');
  reveal.className = reveal.className.replace(/theme-\S+|scheme-\S+/g, '').trim();
  if (!reveal.classList.contains('reveal')) reveal.classList.add('reveal');
  if (themeKey) reveal.classList.add('theme-' + themeKey);
  // First scheme of the new theme
  const schemes = THEMES[themeKey]?.schemes;
  if (schemes?.length) reveal.classList.add('scheme-' + schemes[0].id);
  propagateThemeVars();
  applySchemeColors();
  syncMeasurer();
  syncThemeDropdown();
  document.fonts.ready.then(() => requestAnimationFrame(() => fitText()));
  persistThemeToSidecar();
  showToast(THEMES[themeKey]?.label || 'Default');
  renderThemeSidebar(); // re-render to update active states + scheme list
}

function applySchemeFromSidebar(schemeId) {
  const reveal = document.querySelector('.reveal');
  reveal.className = reveal.className.replace(/scheme-\S+/g, '').trim();
  reveal.classList.add('scheme-' + schemeId);
  applySchemeColors();
  persistThemeToSidecar();
  showToast(`Scheme ${schemeId}`);
  renderThemeSidebar(); // re-render to update active scheme highlight
}
