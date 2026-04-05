/**
 * presenter.js — Presenter window for StellarDeck.
 *
 * Receives slide data via BroadcastChannel from the main viewer window.
 * Renders current + next slide previews (grid thumbnail pattern),
 * shows speaker notes, elapsed timer, and wall clock.
 * Keyboard navigation sends commands back to the main window.
 */

// Slide dimensions — received from main window via BroadcastChannel, with defaults
let SLIDE_W = 1280;
let SLIDE_H = 720;

const channel = new BroadcastChannel('stellardeck-presenter');

// DOM elements
const currentInner = document.getElementById('current-inner');
const nextInner = document.getElementById('next-inner');
const notesEl = document.getElementById('notes');
const counterEl = document.getElementById('counter');
const elapsedEl = document.getElementById('elapsed');
const clockEl = document.getElementById('clock');
const disconnectedEl = document.getElementById('disconnected');

// ============================================================
// Timer
// ============================================================
const startTime = Date.now();

function updateTimers() {
  const ms = Date.now() - startTime;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  elapsedEl.textContent = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;

  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

setInterval(updateTimers, 1000);
updateTimers();

// ============================================================
// Scale preview to fit container
// ============================================================
function scalePreview(inner) {
  const frame = inner.parentElement;
  if (!frame || !frame.clientWidth) return;
  // Scale to fit both width and height while maintaining 16:9
  const scaleW = frame.clientWidth / SLIDE_W;
  const scaleH = frame.clientHeight / SLIDE_H;
  const scale = Math.min(scaleW, scaleH);
  inner.style.transform = `scale(${scale})`;
  // Center horizontally if height-constrained
  if (scaleH < scaleW) {
    inner.style.left = `${(frame.clientWidth - SLIDE_W * scale) / 2}px`;
    inner.style.top = '0';
  } else {
    inner.style.left = '0';
    inner.style.top = `${(frame.clientHeight - SLIDE_H * scale) / 2}px`;
  }
}

const resizeObserver = new ResizeObserver(() => {
  scalePreview(currentInner);
  scalePreview(nextInner);
});
resizeObserver.observe(document.querySelector('.current-frame'));
resizeObserver.observe(document.querySelector('.next-frame'));

// ============================================================
// Apply slide data from main window
// ============================================================
function applySlideUpdate(data) {
  disconnectedEl.classList.add('hidden');

  // Apply theme CSS vars to :root
  if (data.cssVars) {
    const root = document.documentElement;
    for (const [prop, val] of Object.entries(data.cssVars)) {
      root.style.setProperty(prop, val);
    }
  }

  // Update slide dimensions from main window
  if (data.slideWidth && data.slideHeight) {
    SLIDE_W = data.slideWidth;
    SLIDE_H = data.slideHeight;
    scalePreview(currentInner);
    scalePreview(nextInner);
  }

  // Current slide
  currentInner.innerHTML = data.currentHTML || '';
  currentInner.querySelectorAll('aside.notes').forEach(n => n.remove());
  currentInner.style.backgroundColor = data.currentBg || 'var(--r-background-color, #0a0a0a)';
  currentInner.style.color = 'var(--r-main-color, #e2e8f0)';
  // Apply per-slide CSS vars (e.g. [.header: #hex], [.text: #hex])
  if (data.currentSlideVars) {
    for (const [prop, val] of Object.entries(data.currentSlideVars)) {
      currentInner.style.setProperty(prop, val);
    }
  }
  if (data.currentBgImage) {
    currentInner.style.backgroundImage = `url('${data.currentBgImage}')`;
    currentInner.style.backgroundSize = 'cover';
    currentInner.style.backgroundPosition = 'center';
  } else {
    currentInner.style.backgroundImage = '';
  }

  // Next slide
  if (data.nextHTML) {
    nextInner.innerHTML = data.nextHTML;
    nextInner.querySelectorAll('aside.notes').forEach(n => n.remove());
    nextInner.style.backgroundColor = data.nextBg || 'var(--r-background-color, #0a0a0a)';
    nextInner.style.color = 'var(--r-main-color, #e2e8f0)';
    if (data.nextSlideVars) {
      for (const [prop, val] of Object.entries(data.nextSlideVars)) {
        nextInner.style.setProperty(prop, val);
      }
    }
    if (data.nextBgImage) {
      nextInner.style.backgroundImage = `url('${data.nextBgImage}')`;
      nextInner.style.backgroundSize = 'cover';
      nextInner.style.backgroundPosition = 'center';
    } else {
      nextInner.style.backgroundImage = '';
    }
  } else {
    nextInner.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#475569;font-size:2rem">End</div>';
    nextInner.style.backgroundColor = '#0a0a0a';
    nextInner.style.backgroundImage = '';
  }

  // Notes
  notesEl.innerHTML = data.notes || '';

  // Counter
  counterEl.textContent = `${(data.indexh || 0) + 1} / ${data.total || 0}`;

  // Scale after DOM update
  requestAnimationFrame(() => {
    scalePreview(currentInner);
    scalePreview(nextInner);
  });
}

// ============================================================
// BroadcastChannel messages
// ============================================================
channel.onmessage = (e) => {
  const data = e.data;
  if (data.type === 'slide-update') {
    applySlideUpdate(data);
  } else if (data.type === 'close') {
    disconnectedEl.classList.remove('hidden');
    disconnectedEl.textContent = 'Presentation closed';
  }
};

// Request initial state
channel.postMessage({ type: 'request-state' });

// ============================================================
// Keyboard navigation (bidirectional)
// ============================================================
document.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown':
      e.preventDefault();
      channel.postMessage({ type: 'navigate-relative', direction: 'next' });
      break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
      e.preventDefault();
      channel.postMessage({ type: 'navigate-relative', direction: 'prev' });
      break;
    case 'Home':
      e.preventDefault();
      channel.postMessage({ type: 'navigate', indexh: 0 });
      break;
    case 'End':
      e.preventDefault();
      channel.postMessage({ type: 'navigate', indexh: 99999 });
      break;
  }
});

// Click next slide to advance
document.querySelector('.next-frame').addEventListener('click', () => {
  channel.postMessage({ type: 'navigate-relative', direction: 'next' });
});
