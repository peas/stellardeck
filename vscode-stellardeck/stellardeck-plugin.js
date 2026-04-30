// markdown-it plugin for StellarDeck
// Detects StellarDeck frontmatter and replaces the rendering with our parser output.
// Non-StellarDeck markdown files pass through unchanged.
// Injects --sd-char-count on .deckset-fit headings for CSS-only fitText.

const { parseDecksetMarkdown } = require('./lib/deckset-parser');

const STELLARDECK_KEYS = ['theme:', 'autoflow:', 'slidenumbers:', 'footer:', 'slide-transition:'];

function hasStellarDeckFrontmatter(src) {
  const lines = src.split('\n').slice(0, 20);
  return lines.some(line => {
    const trimmed = line.trimStart().toLowerCase();
    return STELLARDECK_KEYS.some(key => trimmed.startsWith(key));
  });
}

// Strip HTML tags to count visible characters
function visibleLength(html) {
  return html.replace(/<[^>]+>/g, '').trim().length || 1;
}

// Wrap each .deckset-fit heading in SVG foreignObject for auto-scaling.
// viewBox width is estimated from character count so SVG scales proportionally.
function wrapFitInSVG(html) {
  const FONT_SIZE = 72;
  const CHAR_W = 48; // generous avg char width at 72px bold sans (~0.67 ratio)
  const LINE_H = 84;

  return html.replace(
    /<([a-z0-9]+)\s+class="deckset-fit"([^>]*)>([\s\S]*?)<\/\1>/gi,
    function(m, tag, rest, inner) {
      const chars = visibleLength(inner);
      const vbW = Math.ceil(chars * CHAR_W * 1.1); // 10% margin to prevent overflow

      return '<div class="sd-fit-wrapper">' +
        '<svg viewBox="0 0 ' + vbW + ' ' + LINE_H + '" preserveAspectRatio="xMinYMid meet" class="sd-fit-svg">' +
        '<foreignObject width="' + vbW + '" height="' + LINE_H + '">' +
        '<' + tag + ' xmlns="http://www.w3.org/1999/xhtml" class="deckset-fit sd-fit-inner"' + rest + '>' +
        inner +
        '</' + tag + '>' +
        '</foreignObject>' +
        '</svg></div>';
    }
  );
}

function stellardeckPlugin(md) {
  md.core.ruler.push('stellardeck', function(state) {
    if (!hasStellarDeckFrontmatter(state.src)) return;

    const autoflowMatch = state.src.match(/^autoflow:\s*(true|false)/m);
    const autoflow = autoflowMatch ? autoflowMatch[1] === 'true' : false;

    let html = parseDecksetMarkdown(state.src, { autoflow });

    // Wrap #[fit] headings in SVG for auto-scaling (Marp-style)
    html = wrapFitInSVG(html);

    const wrapped = '<div class="stellardeck-preview">' + html + '</div>';

    const token = new state.Token('html_block', '', 0);
    token.content = wrapped;
    state.tokens = [token];
  });
}

module.exports = stellardeckPlugin;
