// ============================================================
// Command palette — Cmd+K everything
//
// A keyboard-driven action launcher (Linear / Raycast / Notion style).
// Replaces the floating toolbar buttons in Phase 3: every action that
// was a toolbar button OR a hidden keyboard shortcut becomes a palette
// command. Power users learn `Cmd+K` once and never reach for the
// toolbar again.
//
// Commands register at boot via `registerCommand({ id, label, group?,
// shortcut?, when?, run })`. Modules add their own (toolbar, sidebar,
// theme, etc) so the registry stays decentralized.
//
// Fuzzy matching: subsequence + case-insensitive scoring (no fuse.js).
// "exp" matches "Export PDF" with score weighted toward prefix hits.
// ============================================================

const commands = []; // {id, label, group, shortcut, when, run}
let paletteEl = null;
let inputEl = null;
let listEl = null;
let activeIdx = 0;
let visibleResults = [];

export function registerCommand(cmd) {
  if (!cmd || !cmd.id || !cmd.label || typeof cmd.run !== 'function') return;
  // Replace any existing command with the same id
  const idx = commands.findIndex(c => c.id === cmd.id);
  if (idx >= 0) commands[idx] = cmd;
  else commands.push(cmd);
}

export function unregisterCommand(id) {
  const idx = commands.findIndex(c => c.id === id);
  if (idx >= 0) commands.splice(idx, 1);
}

export function getCommands() { return [...commands]; }

// ── Fuzzy match ────────────────────────────────────────────────────
function score(query, label) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  if (!q.length) return 1;
  if (l === q) return 1000;
  if (l.startsWith(q)) return 500 + l.length - q.length;
  if (l.includes(' ' + q)) return 400 + l.length - q.length;
  // subsequence
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

function rank(query) {
  const eligible = commands.filter(c => !c.when || c.when());
  const scored = eligible.map(c => ({ c, s: score(query, c.label) }));
  return scored.filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.c);
}

// ── DOM ────────────────────────────────────────────────────────────
function ensureDOM() {
  if (paletteEl) return;
  paletteEl = document.createElement('div');
  paletteEl.id = 'command-palette';
  paletteEl.hidden = true;
  paletteEl.innerHTML = `
    <div class="cp-backdrop"></div>
    <div class="cp-modal" role="dialog" aria-label="Command palette">
      <input type="text" class="cp-input" placeholder="Type a command…" aria-label="Command query" />
      <ul class="cp-list" role="listbox"></ul>
      <div class="cp-hint">↑↓ navigate · ↵ run · esc close</div>
    </div>
  `;
  document.body.appendChild(paletteEl);
  inputEl = paletteEl.querySelector('.cp-input');
  listEl  = paletteEl.querySelector('.cp-list');

  inputEl.addEventListener('input', () => render(inputEl.value));
  inputEl.addEventListener('keydown', onKey);
  paletteEl.querySelector('.cp-backdrop').addEventListener('click', close);
}

function render(query) {
  visibleResults = rank(query || '');
  activeIdx = 0;
  if (visibleResults.length === 0) {
    listEl.innerHTML = `<li class="cp-empty">No matching commands</li>`;
    return;
  }
  listEl.innerHTML = '';
  for (let i = 0; i < Math.min(visibleResults.length, 50); i++) {
    const c = visibleResults[i];
    const li = document.createElement('li');
    li.className = 'cp-item' + (i === 0 ? ' active' : '');
    li.dataset.idx = i;
    li.innerHTML = `
      ${c.group ? `<span class="cp-group">${escapeHtml(c.group)}</span>` : ''}
      <span class="cp-label">${escapeHtml(c.label)}</span>
      ${c.shortcut ? `<span class="cp-shortcut">${escapeHtml(c.shortcut)}</span>` : ''}
    `;
    li.addEventListener('mouseenter', () => setActive(i));
    li.addEventListener('click', () => fire(i));
    listEl.appendChild(li);
  }
}

function setActive(i) {
  if (i < 0 || i >= visibleResults.length) return;
  activeIdx = i;
  listEl.querySelectorAll('.cp-item').forEach((el, idx) => {
    el.classList.toggle('active', idx === i);
  });
  const active = listEl.querySelector('.cp-item.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function fire(i) {
  const cmd = visibleResults[i];
  if (!cmd) return;
  close();
  try { cmd.run(); }
  catch (e) { console.error('command failed', cmd.id, e); }
}

function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); close(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIdx + 1, visibleResults.length - 1)); return; }
  if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); return; }
  if (e.key === 'Enter')     { e.preventDefault(); fire(activeIdx); return; }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[c]);
}

// ── Public API ─────────────────────────────────────────────────────
export function open() {
  ensureDOM();
  paletteEl.hidden = false;
  inputEl.value = '';
  render('');
  // requestAnimationFrame so transition (if any) catches and the input is focusable
  requestAnimationFrame(() => inputEl.focus());
}

export function close() {
  if (paletteEl) paletteEl.hidden = true;
}

export function isOpen() {
  return paletteEl && !paletteEl.hidden;
}

export function setupCommandPaletteShortcut() {
  document.addEventListener('keydown', (e) => {
    // Cmd+K (mac) / Ctrl+K (win/linux)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      e.stopPropagation();
      if (isOpen()) close(); else open();
    }
  }, true);
}
