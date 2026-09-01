/**
 * qr.js — Lazy QR code rendering for StellarDeck.
 *
 * Finds all .deckset-qr elements, reads data-qr-url, and generates
 * inline SVG QR codes using qrcode-generator from esm.sh CDN.
 * Only loads the library when QR elements are actually present.
 */

let qrLib = null;

/**
 * Build the inline SVG markup for a generated QR code.
 * Pure function (no DOM) so Node tests can verify the output.
 *
 * @param {{getModuleCount: () => number, isDark: (row: number, col: number) => boolean}} qr
 * @param {number} [size] - max rendered size in px
 * @returns {string} SVG markup
 */
export function buildQRSvg(qr, size = 256) {
  // Use integer grid to avoid subpixel rendering artifacts during transitions.
  // 4-module quiet zone per QR spec — also keeps the CSS border-radius off the
  // finder patterns (rounded corners on a zero-margin QR break camera scanning).
  const quietZone = 4;
  const modules = qr.getModuleCount();
  const svgSize = modules + quietZone * 2;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" style="width:100%;height:100%;max-width:${size}px;max-height:${size}px" shape-rendering="crispEdges">`;
  svg += `<rect width="${svgSize}" height="${svgSize}" fill="white"/>`;
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (qr.isDark(row, col)) {
        svg += `<rect x="${col + quietZone}" y="${row + quietZone}" width="1" height="1" fill="#1a1a2e"/>`;
      }
    }
  }
  svg += '</svg>';
  return svg;
}

/**
 * Render all .deckset-qr elements that haven't been rendered yet.
 * Lazy-loads qrcode-generator on first call.
 */
export async function renderQRCodes() {
  const elements = document.querySelectorAll('.deckset-qr');
  if (elements.length === 0) return;

  // Lazy load QR library
  if (!qrLib) {
    try {
      const module = await import('https://esm.sh/qrcode-generator@1.4.4');
      qrLib = module.default;
    } catch (e) {
      console.warn('[StellarDeck] Failed to load QR library:', e);
      return;
    }
  }

  elements.forEach(el => {
    const url = el.dataset.qrUrl;
    if (!url || el.dataset.qrRendered) return;

    const qr = qrLib(0, 'M');
    qr.addData(url);
    qr.make();

    el.innerHTML = buildQRSvg(qr);
    el.dataset.qrRendered = 'true';
  });
}
