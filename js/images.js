import { state } from './state.js';
import { IS_TAURI } from './tauri.js';
import { convertFileSrc, resolveRelativePath } from './path-utils.js';

export { convertFileSrc, resolveRelativePath };

// Resolve relative image srcs against the deck's directory.
// In Tauri mode the resolved path is wrapped in convertFileSrc (localfile://).
// In browser mode the resolved path is set as-is so the dev-server serves it.
// Without this, relative paths like `./assets/x.png` get interpreted by the
// browser relative to viewer.html (the wrong dir).
function isExternal(s) {
  return !s
    || s.startsWith('http')
    || s.startsWith('data:')
    || s.startsWith('localfile:')
    || s.startsWith('blob:')
    || s.startsWith('/');
}

export function resolveImageSrcs() {
  if (!state.fileDir) return;

  document.querySelectorAll('.reveal img').forEach(img => {
    // Capture the ORIGINAL src once per element. After resolveImageSrcs
    // sets img.src to a resolved path, subsequent reads of getAttribute('src')
    // return the resolved path (not the original `../assets/...`). Re-running
    // resolveImageSrcs would then re-resolve against state.fileDir and prepend
    // the dir AGAIN (e.g. `assets/x.webp` → `test/assets/x.webp`). To avoid
    // that, we stash the original on first read and always resolve from it.
    if (!img.dataset.originalSrc) {
      img.dataset.originalSrc = img.getAttribute('src') || '';
    }
    const src = img.dataset.originalSrc;
    if (!src || isExternal(src)) return;
    const resolved = resolveRelativePath(state.fileDir, src);
    img.src = IS_TAURI ? convertFileSrc(resolved) : resolved;
  });

  document.querySelectorAll('section[data-background-image]').forEach(sec => {
    if (!sec.dataset.originalBg) {
      sec.dataset.originalBg = sec.getAttribute('data-background-image') || '';
    }
    const bg = sec.dataset.originalBg;
    if (!bg || isExternal(bg)) return;
    const resolved = resolveRelativePath(state.fileDir, bg);
    sec.setAttribute('data-background-image', IS_TAURI ? convertFileSrc(resolved) : resolved);
  });
}

export function setupBrokenImageHandlers() {
  document.querySelectorAll('.reveal img').forEach(img => {
    if (img._errorHandled) return;
    img._errorHandled = true;
    img.addEventListener('error', () => {
      const placeholder = document.createElement('div');
      placeholder.className = 'broken-image';
      placeholder.textContent = '⚠ Image not found:\n' + img.getAttribute('src');
      img.replaceWith(placeholder);
    });
  });
  document.querySelectorAll('section[data-background-image]').forEach(sec => {
    if (sec._bgChecked) return;
    sec._bgChecked = true;
    const url = sec.getAttribute('data-background-image');
    const test = new Image();
    test.onerror = () => sec.setAttribute('data-bg-broken', '⚠ ' + url);
    test.src = url;
  });
}
