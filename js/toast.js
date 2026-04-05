// ============================================================
// Toast notification
// ============================================================
export function showToast(msg, persistent = false) {
  const toast = document.getElementById('toast');
  toast.innerHTML = persistent
    ? `<span>${msg}</span><span class="toast-close">&times;</span>`
    : msg;
  toast.classList.add('show');
  toast.style.cursor = persistent ? 'default' : '';
  toast.onclick = null;
  clearTimeout(toast._timer);
  if (persistent) {
    // Dismiss on X click
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) closeBtn.onclick = () => toast.classList.remove('show');
  } else {
    toast._timer = setTimeout(() => toast.classList.remove('show'), 15000);
  }
}
