// ============================================================
// Quick Open (Cmd+P) — fuzzy finder over recent decks
//
// Distinct from the Command Palette (Cmd+K) so file picking and command
// running stay separate (VS Code convention). Reuses .cp-* CSS classes
// for visual parity. Works whether or not a deck is currently open —
// the same shortcut takes the user to any of their recents.
// ============================================================

import { IS_DESKTOP, desktopInvoke } from './desktop.js';

let qoEl = null;
let inputEl = null;
let listEl = null;
let activeIdx = 0;
let recents = [];
let visible = [];

function score(query, label) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  if (l === q) return 1000;
  if (l.startsWith(q)) return 500 + l.length - q.length;
  if (l.includes('/' + q)) return 400 + l.length - q.length;
  let qi = 0, lastHit = -1, gaps = 0;
  for (let li = 0; li < l.length && qi < q.length; li++) {
    if (l[li] === q[qi]) {
      if (lastHit >= 0) gaps += li - lastHit - 1;
      lastHit = li;
      qi++;
    }
  }
  if (qi < q.length) return 0;
  return Math.max(1, 100 - gaps);
}

function ensureDOM() {
  if (qoEl) return;
  qoEl = document.createElement('div');
  qoEl.id = 'quick-open';
  qoEl.className = 'cp-overlay';
  qoEl.hidden = true;
  qoEl.innerHTML = `
    <div class="cp-backdrop"></div>
    <div class="cp-modal" role="dialog" aria-label="Quick open">
      <input type="text" class="cp-input" placeholder="Search recent decks…" aria-label="File query" />
      <ul class="cp-list" role="listbox"></ul>
      <div class="cp-hint">↑↓ navigate · ↵ open · esc close</div>
    </div>
  `;
  document.body.appendChild(qoEl);
  inputEl = qoEl.querySelector('.cp-input');
  listEl = qoEl.querySelector('.cp-list');
  inputEl.addEventListener('input', () => render(inputEl.value));
  inputEl.addEventListener('keydown', onKey);
  qoEl.querySelector('.cp-backdrop').addEventListener('click', close);
}

function render(query) {
  const ranked = recents
    .map(p => ({ p, s: score(query, p) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.p);
  visible = ranked.slice(0, 50);
  activeIdx = 0;
  if (visible.length === 0) {
    listEl.innerHTML = `<li class="cp-empty">${recents.length === 0 ? 'No recent decks yet' : 'No matches'}</li>`;
    return;
  }
  listEl.innerHTML = '';
  visible.forEach((filePath, i) => {
    const name = filePath.split('/').pop();
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    const shortDir = dir.replace(/^\/Users\/[^/]+/, '~');
    const li = document.createElement('li');
    li.className = 'cp-item' + (i === 0 ? ' active' : '');
    li.dataset.idx = i;
    li.innerHTML = `
      <span class="cp-label">${esc(name)}</span>
      <span class="cp-shortcut">${esc(shortDir)}</span>
    `;
    li.addEventListener('mouseenter', () => setActive(i));
    li.addEventListener('click', () => fire(i));
    listEl.appendChild(li);
  });
}

function setActive(i) {
  if (i < 0 || i >= visible.length) return;
  activeIdx = i;
  listEl.querySelectorAll('.cp-item').forEach((el, idx) => {
    el.classList.toggle('active', idx === i);
  });
  const a = listEl.querySelector('.cp-item.active');
  if (a) a.scrollIntoView({ block: 'nearest' });
}

function fire(i) {
  const filePath = visible[i];
  if (!filePath) return;
  close();
  if (window._loadFileFromMenu) window._loadFileFromMenu(filePath);
}

function onKey(e) {
  if (e.key === 'Escape')    { e.preventDefault(); close(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIdx + 1, visible.length - 1)); return; }
  if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); return; }
  if (e.key === 'Enter')     { e.preventDefault(); fire(activeIdx); return; }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[c]);
}

export async function open() {
  ensureDOM();
  if (IS_DESKTOP) {
    try { recents = await desktopInvoke('get_recent_files'); }
    catch { recents = []; }
  }
  qoEl.hidden = false;
  inputEl.value = '';
  render('');
  requestAnimationFrame(() => inputEl.focus());
}

export function close() {
  if (qoEl) qoEl.hidden = true;
}

export function isOpen() {
  return qoEl && !qoEl.hidden;
}

export function setupQuickOpenShortcut() {
  document.addEventListener('keydown', (e) => {
    // Cmd+P (mac) / Ctrl+P (win/linux). Avoid clashing with Cmd+Shift+P
    // which is VS Code's command palette — that one is bound to Cmd+K here.
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'p') {
      e.preventDefault();
      e.stopPropagation();
      if (isOpen()) close(); else open();
    }
  }, true);
}
