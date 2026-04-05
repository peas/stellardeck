import { state } from './state.js';
import { IS_TAURI } from './tauri.js';
import { convertFileSrc, resolveRelativePath } from './path-utils.js';

export { convertFileSrc, resolveRelativePath };

// In Tauri mode, convert all relative image srcs to localfile:// URLs
export function resolveImageSrcs() {
  if (!IS_TAURI || !state.fileDir) return;

  document.querySelectorAll('.reveal img').forEach(img => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('localfile:') && !src.startsWith('blob:')) {
      img.src = convertFileSrc(resolveRelativePath(state.fileDir, src));
    }
  });

  document.querySelectorAll('section[data-background-image]').forEach(sec => {
    const bg = sec.getAttribute('data-background-image');
    if (bg && !bg.startsWith('http') && !bg.startsWith('data:') && !bg.startsWith('localfile:') && !bg.startsWith('blob:')) {
      sec.setAttribute('data-background-image', convertFileSrc(resolveRelativePath(state.fileDir, bg)));
    }
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
