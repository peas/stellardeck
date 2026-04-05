import { state } from './state.js';

// ============================================================
// Grid overview (custom, with keyboard nav + fade transition)
// ============================================================

export function buildGrid() {
  const container = document.getElementById('grid-container');
  const sections = document.querySelectorAll('.reveal .slides > section');
  container.innerHTML = '';

  sections.forEach((section, i) => {
    const card = document.createElement('div');
    card.className = 'grid-slide' + (i === state.gridSelected ? ' selected' : '');
    card.dataset.index = i;

    const inner = document.createElement('div');
    inner.className = 'grid-slide-inner sd-slide';

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

    card.addEventListener('click', () => openSlideFromGrid(i));
    container.appendChild(card);

    requestAnimationFrame(() => {
      const scale = card.clientWidth / Reveal.getConfig().width;
      inner.style.transform = `scale(${scale})`;
    });
  });

  state.gridBuilt = true;
}

export function openSlideFromGrid(index) {
  const overlay = document.getElementById('grid-overlay');
  overlay.classList.remove('active');
  Reveal.slide(index);
  // Force-close Reveal overview in case it got triggered
  if (Reveal.isOverview && Reveal.isOverview()) Reveal.toggleOverview(false);
}

export function selectGridSlide(index) {
  const cards = document.querySelectorAll('.grid-slide');
  if (!cards.length) return;
  state.gridSelected = Math.max(0, Math.min(index, cards.length - 1));
  cards.forEach((c, i) => c.classList.toggle('selected', i === state.gridSelected));
  cards[state.gridSelected].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function toggleGrid() {
  const overlay = document.getElementById('grid-overlay');
  if (overlay.classList.contains('active')) {
    overlay.classList.remove('active');
    // Navigate to the selected slide when closing grid
    Reveal.slide(state.gridSelected);
  } else {
    state.gridSelected = Reveal.getState().indexh || 0;
    buildGrid();
    overlay.classList.add('active');
    // Scroll to current slide after grid is visible and laid out
    requestAnimationFrame(() => selectGridSlide(state.gridSelected));
  }
  const btn = document.getElementById('btn-grid');
  if (btn) btn.classList.toggle('active', overlay.classList.contains('active'));
}

export function isGridOpen() {
  return document.getElementById('grid-overlay').classList.contains('active');
}

export function getGridColumns() {
  const container = document.getElementById('grid-container');
  if (!container.children.length) return 3;
  const containerWidth = container.clientWidth;
  const cardWidth = container.children[0].clientWidth;
  const gap = 16;
  return Math.max(1, Math.round(containerWidth / (cardWidth + gap)));
}
