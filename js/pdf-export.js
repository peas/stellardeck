/**
 * pdf-export.js — In-browser PDF export for StellarDeck.
 *
 * Captures each slide using html2canvas and composes into PDF via pdf-lib.
 * During export, shows a progress overlay (like Keynote/Deckset).
 * The export takes ~10-15 seconds for a typical deck.
 *
 * Dependencies (loaded from CDN on first use):
 *   - html2canvas
 *   - pdf-lib
 */

// CDN URLs + slide dimensions come from constants.js (plain script loaded
// before this ES module via viewer.html — guaranteed by defer semantics).
const HTML2CANVAS_CDN = window.StellarConstants.CDN.HTML2CANVAS;
const PDFLIB_CDN = window.StellarConstants.CDN.PDFLIB;
const SLIDE_W = window.StellarConstants.SLIDE.WIDTH;
const SLIDE_H = window.StellarConstants.SLIDE.HEIGHT;

async function loadScript(url) {
  if (document.querySelector(`script[src="${url}"]`)) return;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(s);
  });
}

function tick(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function showOverlay() {
  let el = document.getElementById('pdf-export-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pdf-export-overlay';
    el.innerHTML = `
      <div class="pdf-export-card">
        <div class="pdf-export-label">Exporting PDF</div>
        <div class="pdf-export-progress"><div class="pdf-export-bar"></div></div>
        <div class="pdf-export-status">Preparing...</div>
      </div>`;
    const style = document.createElement('style');
    style.textContent = `
      #pdf-export-overlay {
        position:fixed;
        top: var(--chrome-height, 44px);
        left: var(--sidebar-width, 0px);
        right:0; bottom:26px;
        z-index:9999;
        display:flex;align-items:center;justify-content:center;
        background:rgba(15,15,18,0.92);
      }
      .pdf-export-card {
        text-align:center;color:#e2e8f0;
        font-family:var(--r-main-font,Inter,sans-serif);
      }
      .pdf-export-label { font-size:0.95rem;font-weight:600;margin-bottom:14px; }
      .pdf-export-progress {
        width:180px;height:3px;background:rgba(255,255,255,0.1);
        border-radius:2px;overflow:hidden;margin:0 auto;
      }
      .pdf-export-bar {
        height:100%;width:0%;background:#0ea5e9;
        border-radius:2px;transition:width 0.15s;
      }
      .pdf-export-status { font-size:0.7rem;color:#64748b;margin-top:8px; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(el);
  }
  el.style.display = 'flex';
  return {
    update(i, total) {
      el.querySelector('.pdf-export-bar').style.width = Math.round(((i + 1) / total) * 100) + '%';
      el.querySelector('.pdf-export-status').textContent = `Slide ${i + 1} of ${total}`;
    },
    hide() { el.style.display = 'none'; },
  };
}

// Thin wrapper around the shared print-mode module (print-mode.js loaded by viewer.html)
// App mode: overlay covers slide-area, toolbar/sidebar stay visible.
function enterPrintMode() {
  return window.StellarPrintMode.enter({ width: SLIDE_W, height: SLIDE_H, full: false });
}

/**
 * Export current presentation to PDF.
 */
export async function exportPDF(options = {}) {
  const { scale = 2, onProgress } = options;

  if (typeof html2canvas === 'undefined') await loadScript(HTML2CANVAS_CDN);
  if (typeof PDFLib === 'undefined') await loadScript(PDFLIB_CDN);

  const { PDFDocument } = PDFLib;
  const savedIndex = Reveal.getState().indexh;
  const overlay = showOverlay();
  await tick(100);
  const cleanup = enterPrintMode();
  await tick(500);

  const totalSlides = Reveal.getTotalSlides();
  const pdfDoc = await PDFDocument.create();

  try {
    for (let i = 0; i < totalSlides; i++) {
      overlay.update(i, totalSlides);
      if (onProgress) onProgress(i, totalSlides);
      Reveal.slide(i);
      await tick(400);
      const reveal = document.querySelector('.reveal');
      const canvas = await html2canvas(reveal, {
        width: SLIDE_W, height: SLIDE_H, scale,
        useCORS: true, backgroundColor: null, logging: false,
      });
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const img = await pdfDoc.embedPng(bytes);
      const page = pdfDoc.addPage([SLIDE_W, SLIDE_H]);
      page.drawImage(img, { x: 0, y: 0, width: SLIDE_W, height: SLIDE_H });
    }
    if (onProgress) onProgress(totalSlides, totalSlides);
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  } finally {
    cleanup();
    Reveal.slide(savedIndex);
    overlay.hide();
  }
}

export async function exportAndDownload(filename, options = {}) {
  const blob = await exportPDF(options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'slides.pdf';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return blob;
}

export async function exportToFile(filePath, options = {}) {
  const blob = await exportPDF(options);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (window.__TAURI_INTERNALS__) {
    await window.__TAURI_INTERNALS__.invoke('write_binary_file', { path: filePath, contents: Array.from(bytes) });
  }
  return filePath;
}
