// ============================================================
// Custom HTML context menu (cross-platform consistent)
//
// Shown on right-click of items that opt in (deck rows, slide thumbs).
// Stays HTML — not Electron's native Menu — so the browser/embed mode
// can use the same UX, and styling matches the rest of the chrome.
//
// Usage:
//   import { showContextMenu } from './context-menu.js';
//   element.addEventListener('contextmenu', e => {
//     e.preventDefault();
//     showContextMenu(e.clientX, e.clientY, [
//       { label: 'Reveal in Finder', onClick: () => ... },
//       { type: 'separator' },
//       { label: 'Open Assets Folder', submenu: [
//         { label: 'demo/assets',    onClick: () => ... },
//         { label: '../shared',      onClick: () => ... },
//       ]},
//       ...
//     ]);
//   });
// ============================================================

let openMenu = null;

function close() {
  if (openMenu) {
    openMenu.remove();
    openMenu = null;
  }
  document.removeEventListener('mousedown', onOutside, true);
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('blur', close);
}

function onOutside(e) {
  if (openMenu && !openMenu.contains(e.target)) close();
}

function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); close(); }
}

export function showContextMenu(x, y, items) {
  close(); // any prior menu

  const menu = buildMenu(items);
  document.body.appendChild(menu);
  position(menu, x, y);

  openMenu = menu;
  // Defer listener attach so the click that opened us doesn't immediately close
  setTimeout(() => {
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', close);
  }, 0);
}

function buildMenu(items) {
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.setAttribute('role', 'menu');

  for (const item of items) {
    if (item.type === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'ctx-sep';
      menu.appendChild(sep);
      continue;
    }
    const row = document.createElement('div');
    row.className = 'ctx-item' + (item.disabled ? ' disabled' : '');
    row.setAttribute('role', 'menuitem');

    const label = document.createElement('span');
    label.className = 'ctx-label';
    label.textContent = item.label;
    row.appendChild(label);

    if (item.shortcut) {
      const sc = document.createElement('span');
      sc.className = 'ctx-shortcut';
      sc.textContent = item.shortcut;
      row.appendChild(sc);
    }

    if (item.submenu && item.submenu.length) {
      const arrow = document.createElement('span');
      arrow.className = 'ctx-arrow';
      arrow.textContent = '▸';
      row.appendChild(arrow);
      // Hover opens the submenu inline (positioned to the right)
      let submenuEl = null;
      row.addEventListener('mouseenter', () => {
        if (submenuEl) return;
        submenuEl = buildMenu(item.submenu);
        submenuEl.classList.add('ctx-submenu');
        menu.appendChild(submenuEl);
        const r = row.getBoundingClientRect();
        const mr = menu.getBoundingClientRect();
        submenuEl.style.left = `${r.right - mr.left}px`;
        submenuEl.style.top  = `${r.top   - mr.top}px`;
      });
      row.addEventListener('mouseleave', (e) => {
        // Only collapse if cursor isn't over the submenu
        if (submenuEl && !submenuEl.contains(e.relatedTarget)) {
          submenuEl.remove();
          submenuEl = null;
        }
      });
    } else if (!item.disabled) {
      row.addEventListener('click', () => {
        try { item.onClick && item.onClick(); } finally { close(); }
      });
    }

    menu.appendChild(row);
  }

  return menu;
}

function position(menu, x, y) {
  // Place at (x, y); flip if it'd overflow viewport
  menu.style.visibility = 'hidden';
  menu.style.left = '0px';
  menu.style.top = '0px';
  const r = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = (x + r.width  > vw - 8) ? Math.max(8, vw - r.width - 8) : x;
  const top  = (y + r.height > vh - 8) ? Math.max(8, vh - r.height - 8) : y;
  menu.style.left = `${left}px`;
  menu.style.top  = `${top}px`;
  menu.style.visibility = '';
}

export function isContextMenuOpen() {
  return !!openMenu;
}
