/**
 * deckset-parser.js — Deckset Markdown → StellarSlides HTML converter
 *
 * Converts Deckset-flavored markdown into <section> HTML rendered by
 * StellarSlides (format also compatible with Reveal.js).
 * Handles image modifiers, [fit] headings, speaker notes, directives,
 * split layouts, background images, video embeds, and more.
 *
 * Usage:
 *   import { parseDecksetMarkdown } from './deckset-parser.js';
 *   const html = parseDecksetMarkdown(markdownString);
 *   document.getElementById('slides').innerHTML = html;
 *
 * Reference: Deckset docs, kevinlin/Deckset-presentations parser,
 *            OleVik/grav-plugin-presentation-deckset
 */

// ============================================================
// JSDoc Type Definitions
// ============================================================

/**
 * @typedef {Object} MediaRef
 * @property {string[]} modifiers - Deckset modifiers (left, right, inline, fit, filtered, etc.)
 * @property {string} src - Source path or URL
 * @property {string} full - Original markdown text (e.g. '![right](photo.jpg)')
 * @property {string} rawMods - Raw modifier string before splitting
 */

/**
 * @typedef {Object} SlideDirectives
 * @property {Object<string, string|boolean>} directives - Parsed directive key-value pairs
 * @property {string[]} contentLines - Lines that are not directives
 */

/**
 * @typedef {Object} NotesResult
 * @property {string[]} notes - Speaker note lines (without ^ prefix)
 * @property {string[]} content - Non-note lines
 */

/**
 * @typedef {Object} ListState
 * @property {boolean} inList - Whether we are inside a list
 * @property {string} listType - 'ul' or 'ol'
 */

/**
 * @typedef {Object} BlockResult
 * @property {string} html - Generated HTML
 * @property {number} endIndex - Index of the last line consumed (inclusive)
 */

// ============================================================
// Constants
// ============================================================

const VIDEO_EXTS = ['.mp4', '.mov', '.m4v', '.webm', '.ogg'];
const AUDIO_EXTS = ['.mp3', '.m4a', '.ogg', '.wav', '.aac'];

const FRONTMATTER_KEYS = /^(footer|slidenumbers|theme|scheme|autoscale|autoflow|build-lists|slide-transition|slidecount):/i;

const DIRECTIVE_RE = /^\[\.([a-z-]+)(?::\s*([^\]]*))?\]$/i;

// Global reference links ([ref]: url) — set per-parse, used by markdownToHtml
let _refLinks = {};

// ============================================================
// Image parsing
// ============================================================

/**
 * Parse all Deckset image/media references in a line.
 *
 * Modifiers can include: left, right, inline, fit, fill, original,
 * filtered, autoplay, loop, mute, hide, and percentages like "50%"
 *
 * @param {string} line - A markdown line
 * @returns {MediaRef[]} Array of parsed media references
 */
function findMedia(line) {
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const results = [];
  let match;
  while ((match = re.exec(line)) !== null) {
    const rawMods = match[1];
    let mods = rawMods.split(/[\s,]+/).filter(Boolean).map(s => s.toLowerCase());
    const src = match[2].trim();
    // Marp compatibility: ![bg] → background, ![bg right] → right, ![bg fit] → fit
    if (mods.includes('bg')) {
      mods = mods.filter(m => m !== 'bg');
      // Strip Marp-specific modifiers we don't support (opacity, blur:Npx, vertical)
      mods = mods.filter(m => !m.startsWith('blur') && m !== 'opacity' && m !== 'vertical');
      // ![bg] alone (media-only slide) → parser already treats as background
      // ![bg right/left] → split layout (already handled)
      // ![bg] with text → becomes inline (acceptable — Marp bg behavior is complex)
    }
    // Marp size modifiers: w:Npx, h:Npx (or w:Nem, h:N%) — extract and remove from mods
    let width = null, height = null;
    const addUnit = (v) => /^\d+$/.test(v) ? v + 'px' : v; // bare numbers → px
    mods = mods.filter(m => {
      const wm = m.match(/^w:(.+)/);
      if (wm) { width = addUnit(wm[1]); return false; }
      const hm = m.match(/^h:(.+)/);
      if (hm) { height = addUnit(hm[1]); return false; }
      return true;
    });
    results.push({ modifiers: mods, src, full: match[0], rawMods, width, height });
  }
  return results;
}

/**
 * Check if a line contains ONLY image/media references (no other text).
 * @param {string} line
 * @returns {boolean}
 */
function isMediaOnly(line) {
  return /^(\s*!\[[^\]]*\]\([^)]+\)\s*)+$/.test(line.trim());
}

/**
 * Check if a source path has one of the given file extensions.
 * @param {string} src - Source path or URL
 * @param {string[]} exts - Array of extensions to match (e.g. ['.mp4', '.mov'])
 * @returns {boolean}
 */
function hasExtension(src, exts) {
  const lower = src.toLowerCase();
  return exts.some(ext => lower.endsWith(ext));
}

/**
 * Detect if a source path is a video based on extension.
 * @param {string} src
 * @returns {boolean}
 */
function isVideo(src) {
  return hasExtension(src, VIDEO_EXTS);
}

/**
 * Detect if a source path is audio.
 * @param {string} src
 * @returns {boolean}
 */
function isAudio(src) {
  return hasExtension(src, AUDIO_EXTS);
}

/**
 * Detect if a source is a YouTube URL and extract the video ID.
 * @param {string} src
 * @returns {string|null} YouTube video ID or null
 */
function parseYouTube(src) {
  const m = src.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * Extract percentage from modifiers (e.g., "50%" → 50).
 * @param {string[]} mods
 * @returns {number|null}
 */
function extractPercent(mods) {
  for (const m of mods) {
    const p = m.match(/^(\d+)%$/);
    if (p) return parseInt(p[1], 10);
  }
  return null;
}

// ============================================================
// Minimal Markdown → HTML
// ============================================================

/**
 * Convert inline Markdown formatting to HTML.
 * Handles bold, italic, strikethrough, inline code, links, and bare URLs.
 * Does NOT handle block-level elements (headings, lists, etc.).
 * @param {string} md - Inline markdown text
 * @returns {string} HTML string
 */
function markdownToHtml(md) {
  let html = md;

  // === Phase 1: Extract protected content (math, code) before text transforms ===
  // These contain underscores/asterisks that must NOT be treated as formatting.
  const placeholders = [];
  function protect(match) {
    const idx = placeholders.length;
    placeholders.push(match);
    return `\x00PH${idx}\x00`;
  }

  // Inline code `text` (protect first — code may contain $, _, *)
  html = html.replace(/`([^`]+)`/g, (_, code) => protect(`<code>${code}</code>`));
  // Block math $$...$$ (must come before inline $)
  html = html.replace(/\$\$([^$]+)\$\$/g, (_, latex) => {
    const escaped = latex.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return protect(`<div class="deckset-math" data-math-src="${escaped}"></div>`);
  });
  // Inline math $...$
  html = html.replace(/(?<!\$)\$(?!\$)([^$]+?)(?<!\$)\$(?!\$)/g, (_, latex) => {
    const escaped = latex.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return protect(`<span class="deckset-math-inline" data-math-src="${escaped}"></span>`);
  });

  // === Phase 2: Text formatting (safe — math/code are placeholders) ===
  // Protect links BEFORE italic/bold (URLs contain underscores that must not become <em>)
  html = html.replace(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => protect(`<a href="${url}">${text}</a>`));
  // Reference links [text][ref]
  html = html.replace(/(?<!!)\[([^\]]+)\]\[([^\]]*)\]/g, (_, text, ref) => {
    const key = (ref || text).toLowerCase();
    const url = _refLinks[key];
    return url ? protect(`<a href="${url}">${text}</a>`) : text;
  });
  // Bare URLs
  html = html.replace(/(?<!")(https?:\/\/[^\s<]+)/g, (_, url) => protect(`<a href="${url}">${url}</a>`));

  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Bold __text__
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic *text* (not preceded/followed by *)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Italic _text_ (not preceded/followed by _)
  html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');
  // Strikethrough ~~text~~
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Escape raw HTML tags that would break slide structure
  // (section, style, script — but NOT already-generated tags like <strong>, <a>, etc.)
  html = html.replace(/<(\/?)section([\s>])/gi, '&lt;$1section$2');
  html = html.replace(/<(\/?)script([\s>])/gi, '&lt;$1script$2');

  // === Phase 3: Restore protected content ===
  html = html.replace(/\x00PH(\d+)\x00/g, (_, idx) => placeholders[+idx]);

  return html;
}

// ============================================================
// Media rendering
// ============================================================

/**
 * Render a media reference to HTML (img, video, audio, or YouTube iframe).
 * @param {MediaRef} media
 * @returns {string} HTML string
 */
function renderMedia(media) {
  const { modifiers: mods, src, width, height } = media;
  const ytId = parseYouTube(src);
  const pct = extractPercent(mods);
  const pctStyle = pct ? `max-width:${pct}%;` : '';
  // Marp w:/h: size modifiers → inline style
  const sizeStyle = (width ? `max-width:${width};` : '') + (height ? `max-height:${height};` : '');

  if (ytId) {
    const autoplay = mods.includes('autoplay') ? '&autoplay=1&mute=1' : '';
    return `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${ytId}?${autoplay}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius:12px;${pctStyle}"></iframe>`;
  }

  if (isVideo(src)) {
    const attrs = [];
    if (mods.includes('autoplay')) attrs.push('autoplay');
    if (mods.includes('loop')) attrs.push('loop');
    if (mods.includes('mute')) attrs.push('muted');
    attrs.push('playsinline');
    return `<video ${attrs.join(' ')} style="max-width:100%;max-height:80%;border-radius:12px;${pctStyle}"><source src="${src}"></video>`;
  }

  if (isAudio(src)) {
    return `<audio controls src="${src}" style="width:100%"></audio>`;
  }

  // QR code — src is the URL to encode
  if (mods.includes('qr')) {
    return `<div class="deckset-qr" data-qr-url="${src}"></div>`;
  }

  // Regular image
  return `<img src="${src}" style="${pctStyle}${sizeStyle}" />`;
}

// ============================================================
// Slide-level directive parsing
// ============================================================

/**
 * Parse [.directive: value] lines from a slide.
 * @param {string[]} lines
 * @returns {SlideDirectives}
 */
function extractDirectives(lines) {
  const directives = {};
  const contentLines = [];

  for (const line of lines) {
    const m = line.match(DIRECTIVE_RE);
    if (m) {
      const key = m[1].toLowerCase();
      const val = m[2] !== undefined ? m[2].trim() : true;
      directives[key] = val;
    } else {
      contentLines.push(line);
    }
  }

  return { directives, contentLines };
}

/**
 * Build <section> attributes from directives.
 * @param {Object<string, string|boolean>} directives
 * @returns {string} HTML attributes string (with leading space if non-empty)
 */
function sectionAttrsFromDirectives(directives) {
  let attrs = ' class="sd-slide"';
  if (directives['background-color']) {
    attrs += ` data-background-color="${directives['background-color']}"`;
  }
  if (directives['background-image']) {
    attrs += ` data-background-image="${directives['background-image']}"`;
  }
  if (directives['slide-transition']) {
    attrs += ` data-transition="${directives['slide-transition']}"`;
  }

  // Color directives → CSS custom properties on section style
  const styles = [];
  if (directives['header'] || directives['header-strong']) {
    const color = directives['header'] || directives['header-strong'];
    styles.push(`--r-heading-color: ${color}`);
  }
  if (directives['text']) {
    styles.push(`--r-main-color: ${directives['text']}`);
  }
  // [.accent-bold: false] disables accent coloring for bold text on this slide
  if (directives['accent-bold'] === 'false') {
    styles.push('--sd-accent-bold-color: inherit');
    styles.push('--sd-accent-bullets-color: inherit');
  }
  // [.autoscale: true] — reduce font size for text-heavy slides
  // [.autoscale-lines: N] — content line count → tier for progressive sizing
  if (directives['autoscale'] === 'true' || directives['autoscale'] === true) {
    const lineCount = parseInt(directives['autoscale-lines'], 10) || 0;
    const tier = lineCount >= 19 ? 'dense' : lineCount >= 13 ? 'moderate' : 'light';
    attrs += ' data-autoscale="true"';
    if (lineCount > 0) {
      attrs += ` data-autoscale-lines="${lineCount}" data-autoscale-tier="${tier}"`;
    }
  }
  // [.heading-align: center|left|right] — override heading text alignment
  if (directives['heading-align']) {
    styles.push(`--sd-heading-align: ${directives['heading-align']}`);
  }
  // [.bullets-layout: cards|pills|staggered|alternating] — variant layouts for
  // headline + 2-3 bullet slides. Used by the phrase-bullets autoflow rule.
  if (directives['bullets-layout']) {
    attrs += ` data-bullets-layout="${directives['bullets-layout']}"`;
  }
  if (styles.length > 0) {
    attrs += ` style="${styles.join('; ')}"`;
  }

  return attrs;
}

// ============================================================
// Speaker notes
// ============================================================

/**
 * Separate speaker notes (lines starting with ^ or HTML comments) from content.
 * HTML comments that look like directives (e.g. <!-- _class: -->) are NOT treated as notes.
 * @param {string[]} lines
 * @returns {NotesResult}
 */
function extractNotes(lines) {
  const notes = [];
  const content = [];
  let inCommentNote = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Existing: ^ prefix notes
    if (line.startsWith('^')) {
      notes.push(line.slice(1).trim());
      continue;
    }

    // Multi-line HTML comment tracking
    if (inCommentNote) {
      if (line.includes('-->')) {
        // End of multi-line comment
        const before = line.replace(/-->.*/, '').trim();
        if (before) notes.push(before);
        inCommentNote = false;
      } else {
        notes.push(line);
      }
      continue;
    }

    // Single-line HTML comment: <!-- text -->
    const singleComment = line.match(/^\s*<!--\s*(.*?)\s*-->\s*$/);
    if (singleComment) {
      const text = singleComment[1];
      // Marp directives in HTML comments → convert to Deckset equivalents
      const directiveMatch = text.match(/^_?(\w+)\s*:\s*(.+)$/);
      if (directiveMatch) {
        const [, key, val] = directiveMatch;
        const k = key.toLowerCase();
        // Convert known Marp directives to Deckset-style bracket directives
        if (k === 'paginate' && val.trim() === 'true') {
          // paginate → handled at global level, skip from content
        } else if (k === 'backgroundcolor' || k === 'bgcolor') {
          content.push(`[.background-color: ${val.trim()}]`);
        } else if (k === 'color') {
          content.push(`[.text: ${val.trim()}]`);
        } else {
          // Unknown directive — keep as content (will be ignored)
          content.push(line);
        }
        continue;
      }
      // Regular HTML comment → speaker note
      notes.push(text);
      continue;
    }

    // Multi-line HTML comment start: <!-- text... (no closing -->)
    const multiStart = line.match(/^\s*<!--\s*(.*)/);
    if (multiStart && !line.includes('-->')) {
      const text = multiStart[1].trim();
      // Skip directive-like comments
      if (text.match(/^_\w+:/)) {
        content.push(line);
      } else {
        if (text) notes.push(text);
        inCommentNote = true;
      }
      continue;
    }

    content.push(line);
  }
  return { notes, content };
}

/**
 * Render speaker notes as an <aside> element.
 * @param {string[]} notes
 * @returns {string} HTML string (empty string if no notes)
 */
function notesHtml(notes) {
  if (!notes.length) return '';
  return `<aside class="notes">${notes.join('<br>')}</aside>`;
}

// ============================================================
// Content line processing — helpers
// ============================================================

/**
 * Close an open list if one is active, returning the closing tag HTML.
 * Mutates the state to mark the list as closed.
 * @param {ListState} state
 * @returns {string} Closing tag HTML (e.g. '</ul>') or empty string
 */
function closeList(state) {
  if (state.inList) {
    const tag = `</${state.listType}>`;
    state.inList = false;
    state.listType = '';
    return tag;
  }
  return '';
}

/**
 * Process a fenced code block starting at `startIndex`.
 * The line at startIndex must be the opening ``` fence.
 * Supports line highlight syntax: ```lang {2,4} or ```lang {1-3}
 * @param {string[]} lines
 * @param {number} startIndex - Index of the opening ``` line
 * @returns {BlockResult}
 */
function processCodeBlock(lines, startIndex) {
  const fence = lines[startIndex].trim().slice(3).trim();
  // Parse language and optional line highlights: "python {2,4}" or "js {1-3}"
  const fenceMatch = fence.match(/^(\S*)\s*\{([^}]+)\}\s*$/);
  let codeLanguage, lineHighlights;
  if (fenceMatch) {
    codeLanguage = fenceMatch[1];
    lineHighlights = fenceMatch[2].trim();
  } else {
    codeLanguage = fence;
    lineHighlights = null;
  }

  const codeLines = [];
  let i = startIndex + 1;

  while (i < lines.length && !lines[i].trim().startsWith('```')) {
    codeLines.push(lines[i]);
    i++;
  }

  const escaped = codeLines.join('\n')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lineAttr = lineHighlights ? ` data-line-numbers="${lineHighlights}"` : '';
  const html = `<pre><code class="language-${codeLanguage}"${lineAttr}>${escaped}</code></pre>`;

  // i is now at the closing ``` (or past end if unclosed)
  return { html, endIndex: i };
}

/**
 * Valid position modifiers for headings: #[top-left] Text
 */
const POSITION_MODS = ['top-left', 'top-right', 'top', 'bottom-left', 'bottom-right', 'bottom', 'left', 'right', 'center'];

/**
 * Process a regular heading line (not [fit]).
 * Supports position modifiers: #[top-left] Text, #[bottom-right] Text
 * @param {string} line
 * @returns {string|null} HTML string or null if not a heading
 */
function processHeading(line) {
  const headMatch = line.match(/^(#{1,6})\s*(.*)/);
  if (headMatch && headMatch[2].trim()) {
    const level = headMatch[1].length;
    let rawText = headMatch[2];
    // Check for position modifier: #[top-left] Text
    const posMatch = rawText.match(/^\[([\w-]+)\]\s*(.*)/);
    if (posMatch && POSITION_MODS.includes(posMatch[1])) {
      const pos = posMatch[1];
      const text = markdownToHtml(posMatch[2]);
      return `<h${level} class="deckset-pos deckset-pos-${pos}">${text}</h${level}>`;
    }
    const text = markdownToHtml(rawText);
    return `<h${level}>${text}</h${level}>`;
  }
  return null;
}

/**
 * Process consecutive #[fit] heading lines starting at `startIndex`.
 * Consecutive [fit] lines share inline markdown context (e.g. **bold** spanning lines).
 * @param {string[]} lines
 * @param {number} startIndex - Index of the first #[fit] line
 * @returns {BlockResult}
 */
function processFitHeading(lines, startIndex) {
  const firstMatch = lines[startIndex].match(/^(#{1,6})\s*\[fit\]\s*(.*)/);
  const level = firstMatch[1].length;

  // Collect consecutive #[fit] lines
  const fitTexts = [firstMatch[2]];
  let i = startIndex;
  while (i + 1 < lines.length) {
    const nextFit = lines[i + 1].match(/^(#{1,6})\s*\[fit\]\s*(.*)/);
    if (nextFit) {
      fitTexts.push(nextFit[2]);
      i++;
    } else {
      break;
    }
  }

  // Process all text together for cross-line bold/italic, then split back
  // Use sentinel that won't appear in text (markdownToHtml's . doesn't match \n)
  const SPLIT = '\x00';
  const joined = fitTexts.join(SPLIT);
  const processed = markdownToHtml(joined);
  const htmlLines = processed.split(SPLIT);

  let html = '';
  htmlLines.forEach(t => {
    html += `<h${level} class="deckset-fit">${t}</h${level}>`;
  });

  return { html, endIndex: i };
}

/**
 * Parse alignment from a table separator cell (e.g. :---, :---:, ---:).
 * @param {string} cell - A single separator cell (trimmed)
 * @returns {string|null} 'left', 'center', 'right', or null
 */
function parseTableAlignment(cell) {
  const s = cell.trim();
  if (s.startsWith(':') && s.endsWith(':')) return 'center';
  if (s.endsWith(':')) return 'right';
  if (s.startsWith(':')) return 'left';
  return null;
}

/**
 * Parse table cells from a row line like "| a | b | c |".
 * @param {string} line
 * @returns {string[]} Array of cell contents (trimmed)
 */
function parseTableRow(line) {
  // Strip leading/trailing pipes, then split by |
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map(c => c.trim());
}

/**
 * Check if a line looks like a table separator (e.g. |---|:---:|---:|).
 * @param {string} line
 * @returns {boolean}
 */
function isTableSeparator(line) {
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line.trim());
}

/**
 * Process a GFM-style table starting at `startIndex`.
 * Expects: header row, separator row, then zero or more data rows.
 * @param {string[]} lines
 * @param {number} startIndex - Index of the header row
 * @returns {BlockResult}
 */
function processTable(lines, startIndex) {
  const headerCells = parseTableRow(lines[startIndex]);
  const sepCells = parseTableRow(lines[startIndex + 1]);
  const alignments = sepCells.map(parseTableAlignment);

  const styleAttr = (idx) => {
    const a = alignments[idx];
    return a ? ` style="text-align: ${a}"` : '';
  };

  let html = '<table><thead><tr>';
  headerCells.forEach((cell, idx) => {
    html += `<th${styleAttr(idx)}>${markdownToHtml(cell)}</th>`;
  });
  html += '</tr></thead><tbody>';

  let i = startIndex + 2;
  while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
    const cells = parseTableRow(lines[i]);
    html += '<tr>';
    cells.forEach((cell, idx) => {
      html += `<td${styleAttr(idx)}>${markdownToHtml(cell)}</td>`;
    });
    html += '</tr>';
    i++;
  }
  html += '</tbody></table>';

  return { html, endIndex: i - 1 };
}

/**
 * Process a blockquote starting at `startIndex`.
 * Consumes consecutive lines starting with >.
 * @param {string[]} lines
 * @param {number} startIndex
 * @returns {BlockResult}
 */
function processBlockquote(lines, startIndex) {
  const quoteLines = [lines[startIndex].replace(/^>\s*/, '')];
  let i = startIndex;
  while (i + 1 < lines.length && lines[i + 1].startsWith('>')) {
    i++;
    quoteLines.push(lines[i].replace(/^>\s*/, ''));
  }
  const html = `<blockquote>${markdownToHtml(quoteLines.join(' '))}</blockquote>`;
  return { html, endIndex: i };
}

/**
 * Process a list item line (ordered or unordered).
 * Opens or switches list type as needed.
 * @param {string} line
 * @param {ListState} state - Mutated in place
 * @returns {string} HTML string (may include list open/close tags + li)
 */
function processListItem(line, state) {
  let html = '';

  // Unordered list
  const ulMatch = line.match(/^[\*\-]\s+(.*)/);
  if (ulMatch) {
    if (!state.inList || state.listType !== 'ul') {
      html += closeList(state);
      html += '<ul>';
      state.inList = true;
      state.listType = 'ul';
    }
    html += `<li>${markdownToHtml(ulMatch[1])}</li>`;
    return html;
  }

  // Ordered list
  const olMatch = line.match(/^\d+\.\s+(.*)/);
  if (olMatch) {
    if (!state.inList || state.listType !== 'ol') {
      html += closeList(state);
      html += '<ol>';
      state.inList = true;
      state.listType = 'ol';
    }
    html += `<li>${markdownToHtml(olMatch[1])}</li>`;
    return html;
  }

  return null;
}

/**
 * Collect lines from startIndex+1 until a closing `:::` line.
 * Returns the collected lines and the index of the closing `:::`.
 * @param {string[]} lines
 * @param {number} startIndex - Index of the opening directive line (e.g. :::columns)
 * @returns {{ innerLines: string[], endIndex: number }}
 */
function collectBlockDirective(lines, startIndex) {
  const innerLines = [];
  let i = startIndex + 1;
  let depth = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith(':::') && trimmed.length > 3) {
      // Nested block directive opening — track depth
      depth++;
      innerLines.push(lines[i]);
    } else if (trimmed === ':::') {
      if (depth > 0) {
        depth--;
        innerLines.push(lines[i]);
      } else {
        // This is our closing :::
        break;
      }
    } else {
      innerLines.push(lines[i]);
    }
    i++;
  }
  return { innerLines, endIndex: i };
}

/**
 * Process a :::columns block directive.
 * Collects all lines from startIndex+1, splitting into columns at each :::.
 * The final ::: closes the block (and also ends the last column).
 * @param {string[]} lines
 * @param {number} startIndex - Index of the :::columns line
 * @returns {BlockResult}
 */
function processColumnsBlock(lines, startIndex) {
  const columns = [];
  let current = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === ':::') {
      columns.push(current);
      current = [];
      // Check if this ::: is the closing one (next line is not column content
      // or we're at end). The closing ::: is the one where the next non-empty
      // line is NOT part of our block. Simpler: peek ahead — if the next
      // non-empty line starts with ::: (a new block) or there are no more
      // lines, this is the end. Otherwise, check if there's more column content.
      // Actually, the simplest heuristic: if the next line also starts with :::
      // or there's no content before the next :::, we're done.
      // Best approach: look ahead for more content before next :::
      let hasMoreColumns = false;
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j].trim();
        if (t === ':::') {
          // Found another ::: — there IS more column content
          hasMoreColumns = true;
          break;
        }
        if (t.startsWith(':::')) {
          // Another block directive — we're done
          break;
        }
      }
      if (!hasMoreColumns) break;
    } else {
      current.push(lines[i]);
    }
    i++;
  }

  // Filter empty columns
  const nonEmpty = columns.filter(c => c.some(l => l.trim() !== ''));
  const n = nonEmpty.length;

  let html = `<div class="deckset-columns" style="grid-template-columns: repeat(${n}, 1fr)">`;
  for (const col of nonEmpty) {
    html += `<div class="deckset-column">${processContentLines(col)}</div>`;
  }
  html += '</div>';

  return { html, endIndex: i };
}

/**
 * Process a :::steps block directive.
 * Splits content by blank lines into paragraphs, each gets class="fragment".
 * @param {string[]} lines
 * @param {number} startIndex - Index of the :::steps line
 * @returns {BlockResult}
 */
function processStepsBlock(lines, startIndex) {
  const { innerLines, endIndex } = collectBlockDirective(lines, startIndex);

  // Split by blank lines into paragraph groups
  const paragraphs = [];
  let current = [];
  for (const line of innerLines) {
    if (line.trim() === '') {
      if (current.length > 0) {
        paragraphs.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) paragraphs.push(current);

  let html = '';
  for (const para of paragraphs) {
    const inner = processContentLines(para);
    // Wrap block-level output with fragment class
    // If processContentLines returned a <p>, add fragment class to it
    // Otherwise wrap in a fragment div
    const withFragment = inner.replace(/<p>/g, '<p class="fragment">');
    // If no <p> was found, the content is something else (heading, list, etc.) — wrap it
    if (withFragment === inner && inner.trim()) {
      html += `<div class="fragment">${inner}</div>`;
    } else {
      html += withFragment;
    }
  }

  return { html, endIndex };
}

/**
 * Process a :::center block directive.
 * Wraps content in a centered flex container.
 * @param {string[]} lines
 * @param {number} startIndex - Index of the :::center line
 * @returns {BlockResult}
 */
function processCenterBlock(lines, startIndex) {
  const { innerLines, endIndex } = collectBlockDirective(lines, startIndex);
  const content = processContentLines(innerLines);
  const html = `<div style="text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%">${content}</div>`;
  return { html, endIndex };
}

/**
 * Process a :::math block directive.
 * Wraps LaTeX source in a div for client-side KaTeX rendering.
 * @param {string[]} lines
 * @param {number} startIndex - Index of the :::math line
 * @returns {BlockResult}
 */
function processMathBlock(lines, startIndex) {
  const { innerLines, endIndex } = collectBlockDirective(lines, startIndex);
  const latex = innerLines.join('\n').trim();
  const escaped = latex.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const html = `<div class="deckset-math" data-math-src="${escaped}"></div>`;
  return { html, endIndex };
}

/**
 * Process a :::diagram block directive.
 * Wraps Mermaid source in a pre.mermaid for client-side rendering.
 * @param {string[]} lines
 * @param {number} startIndex - Index of the :::diagram line
 * @returns {BlockResult}
 */
function processDiagramBlock(lines, startIndex) {
  const { innerLines, endIndex } = collectBlockDirective(lines, startIndex);
  const code = innerLines.join('\n').trim();
  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<div class="deckset-diagram"><pre class="mermaid">${escaped}</pre></div>`;
  return { html, endIndex };
}

/**
 * Process a line that contains inline media references.
 * Handles media-only lines (single or row) and mixed text+image lines.
 * @param {string} line
 * @returns {string|null} HTML string or null if line has no media
 */
function processInlineMediaLine(line) {
  const inlineMedia = findMedia(line);
  if (inlineMedia.length === 0) return null;

  if (isMediaOnly(line)) {
    if (inlineMedia.length >= 2) {
      return `<div class="deckset-inline-row">${inlineMedia.map(renderMedia).join('')}</div>`;
    }
    return `<div class="deckset-inline-single">${renderMedia(inlineMedia[0])}</div>`;
  }

  // Mixed: text with inline images
  let processed = markdownToHtml(line);
  for (const m of inlineMedia) {
    const mh = m.height || '200px';
    const mw = m.width ? `max-width:${m.width};` : '';
    processed = processed.replace(m.full,
      `<img src="${m.src}" style="max-height:${mh};${mw}vertical-align:middle" />`);
  }
  return `<p>${processed}</p>`;
}

// ============================================================
// Content line processing — main dispatcher
// ============================================================

/**
 * Process an array of content lines into HTML.
 * Dispatches each line to the appropriate helper based on its type
 * (code block, heading, [fit] heading, blockquote, list, inline media, or paragraph).
 * @param {string[]} lines
 * @returns {string} HTML string
 */
function processContentLines(lines) {
  // Sanitize: remove raw <style> blocks and escape dangerous HTML tags outside code blocks
  let inStyle = false;
  const sanitized = [];
  for (const line of lines) {
    if (line.trim().match(/^<style[\s>]/i)) { inStyle = true; continue; }
    if (inStyle) { if (line.trim().match(/^<\/style>/i)) inStyle = false; continue; }
    sanitized.push(line);
  }
  lines = sanitized;

  let html = '';
  /** @type {ListState} */
  const listState = { inList: false, listType: '' };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks (fenced ```lang)
    if (line.trim().startsWith('```')) {
      html += closeList(listState);
      const result = processCodeBlock(lines, i);
      html += result.html;
      i = result.endIndex;
      continue;
    }

    // Block directives: :::columns, :::steps, :::center, :::math, :::diagram
    const blockMatch = line.trim().match(/^:::(columns|steps|center|math|diagram)\s*$/);
    if (blockMatch) {
      html += closeList(listState);
      const kind = blockMatch[1];
      let result;
      if (kind === 'columns') result = processColumnsBlock(lines, i);
      else if (kind === 'steps') result = processStepsBlock(lines, i);
      else if (kind === 'math') result = processMathBlock(lines, i);
      else if (kind === 'diagram') result = processDiagramBlock(lines, i);
      else result = processCenterBlock(lines, i);
      html += result.html;
      i = result.endIndex;
      continue;
    }

    // GFM tables: line starts with | and next line is a separator
    if (line.includes('|') && line.trim().startsWith('|') &&
        i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      html += closeList(listState);
      const result = processTable(lines, i);
      html += result.html;
      i = result.endIndex;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      html += closeList(listState);
      continue;
    }

    // Horizontal rule (--- or *** within slide content)
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
      html += closeList(listState);
      html += '<hr>';
      continue;
    }

    // #[fit] headings — must check before regular headings
    const fitMatch = line.match(/^(#{1,6})\s*\[fit\]\s*(.*)/);
    if (fitMatch) {
      html += closeList(listState);
      const result = processFitHeading(lines, i);
      html += result.html;
      i = result.endIndex;
      continue;
    }

    // Setext headings: text followed by === (h1) or --- (h2) on next line
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (nextLine.match(/^={3,}$/)) {
        html += closeList(listState);
        html += `<h1>${markdownToHtml(line.trim())}</h1>`;
        i++; // skip the === line
        continue;
      }
    }

    // Regular headings (# to ######) — space after # is optional in Deckset
    const headingHtml = processHeading(line);
    if (headingHtml !== null) {
      html += closeList(listState);
      html += headingHtml;
      continue;
    }

    // Blockquote (can span multiple lines)
    if (line.startsWith('>')) {
      html += closeList(listState);
      const result = processBlockquote(lines, i);
      html += result.html;
      i = result.endIndex;
      continue;
    }

    // List items (ordered and unordered)
    const listHtml = processListItem(line, listState);
    if (listHtml !== null) {
      html += listHtml;
      continue;
    }

    // Inline images/media within content
    const mediaHtml = processInlineMediaLine(line);
    if (mediaHtml !== null) {
      html += closeList(listState);
      html += mediaHtml;
      continue;
    }

    // Plain text paragraph
    html += closeList(listState);
    html += `<p>${markdownToHtml(line)}</p>`;
  }

  // Close any trailing open list
  html += closeList(listState);

  // Handle unclosed code block (shouldn't happen, but be safe)
  // Note: processCodeBlock handles the block fully, including unclosed ones
  // (it stops at end of lines array), so no trailing code block state here.

  return html;
}

// ============================================================
// Slide parsing — layout renderers
// ============================================================

/**
 * Render a split layout slide (![left] or ![right] image with text).
 * @param {MediaRef} splitMedia - The media reference with left/right modifier
 * @param {string[]} contentLines - All content lines (including the media line)
 * @param {string} sectionAttrs - Pre-built section attribute string
 * @param {string[]} notes - Speaker notes
 * @param {boolean} buildLists - Whether to add fragment class to list items
 * @returns {string} Full <section> HTML
 */
function renderSplitLayout(splitMedia, contentLines, sectionAttrs, notes, buildLists) {
  const isRight = splitMedia.modifiers.includes('right');
  const textLines = contentLines
    .filter(l => !l.includes(splitMedia.full))
    .filter(l => l.trim());
  let textHtml = processContentLines(textLines);

  if (buildLists) {
    textHtml = textHtml.replace(/<li>/g, '<li class="fragment">');
  }

  if (!textHtml.trim()) {
    // Image alone → fill that half as background
    const imgHalf = `<div class="img-half" style="background-image:url('${splitMedia.src}')"></div>`;
    const emptyHalf = `<div class="empty-half"></div>`;
    const [left, right] = isRight
      ? [emptyHalf, imgHalf]
      : [imgHalf, emptyHalf];
    return `<section${sectionAttrs} style="padding:0"><div class="deckset-split-bg">${left}${right}</div>${notesHtml(notes)}</section>`;
  }

  // Image + text → grid split
  const mediaHtml = renderMedia(splitMedia);
  const [left, right] = isRight
    ? [`<div>${textHtml}</div>`, `<div style="text-align:center">${mediaHtml}</div>`]
    : [`<div style="text-align:center">${mediaHtml}</div>`, `<div>${textHtml}</div>`];

  return `<section${sectionAttrs}><div class="deckset-split">${left}${right}</div>${notesHtml(notes)}</section>`;
}

/**
 * Render a media-only slide (no text content).
 * Handles single background image, video background, YouTube embed,
 * and multiple inline images.
 * @param {string[]} contentLines - Lines that are all media-only
 * @param {string} sectionAttrs - Pre-built section attribute string
 * @param {string[]} notes - Speaker notes
 * @returns {string|null} Full <section> HTML, or null if not a media-only slide
 */
function renderMediaOnlySlide(contentLines, sectionAttrs, notes) {
  const nonEmptyContent = contentLines.filter(l => l.trim());
  const allMediaOnly = nonEmptyContent.length > 0 &&
    nonEmptyContent.every(l => isMediaOnly(l));

  if (!allMediaOnly) return null;

  const allMedia = contentLines.flatMap(l => findMedia(l));

  if (allMedia.length === 1 && !allMedia[0].modifiers.includes('inline')) {
    const m = allMedia[0];

    // QR code — centered on slide, not a background
    if (m.modifiers.includes('qr')) {
      return `<section${sectionAttrs}><div class="deckset-qr deckset-qr-bg" data-qr-url="${m.src}"></div>${notesHtml(notes)}</section>`;
    }

    // Video background
    if (isVideo(m.src)) {
      return `<section${sectionAttrs} data-background-video="${m.src}" data-background-video-loop data-background-video-muted>${notesHtml(notes)}</section>`;
    }

    // YouTube background
    const ytId = parseYouTube(m.src);
    if (ytId) {
      return `<section${sectionAttrs}><iframe width="100%" height="100%" src="https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1" frameborder="0" allow="autoplay" allowfullscreen style="position:absolute;top:0;left:0;border:0"></iframe>${notesHtml(notes)}</section>`;
    }

    // Single image → background
    const size = m.modifiers.includes('fit') || m.modifiers.includes('contain')
      ? 'contain' : 'cover';
    const filtered = m.modifiers.includes('filtered')
      ? ' data-background-opacity="0.5" data-background-color="#000"' : '';
    return `<section data-background-image="${m.src}" data-background-size="${size}"${filtered}${sectionAttrs}>${notesHtml(notes)}</section>`;
  }

  if (allMedia.length >= 2 || (allMedia.length === 1 && allMedia[0].modifiers.includes('inline'))) {
    const mediaHtml = allMedia.map(renderMedia).join('\n');
    const cls = allMedia.length >= 2 ? 'deckset-inline-row' : 'deckset-inline-single';
    return `<section${sectionAttrs}><div class="${cls}">${mediaHtml}</div>${notesHtml(notes)}</section>`;
  }

  return null;
}

/**
 * Render a mixed content slide (text, inline media, headings, etc.).
 * @param {string[]} contentLines
 * @param {string} sectionAttrs - Pre-built section attribute string
 * @param {string[]} notes - Speaker notes
 * @param {boolean} buildLists - Whether to add fragment class to list items
 * @returns {string} Full <section> HTML
 */
function renderMixedContent(contentLines, sectionAttrs, notes, buildLists, alternatingColors) {
  let html = processContentLines(contentLines);

  // Apply build-lists: wrap <li> in fragments
  if (buildLists) {
    html = html.replace(/<li>/g, '<li class="fragment">');
  }

  // Wrap in alternating-colors container
  if (alternatingColors) {
    html = `<div class="deckset-alternating">${html}</div>`;
  }

  // Wrap ALL positioned headings in a grid container, grouping same-position headings in divs
  if (html.includes('deckset-pos')) {
    const posRegex = /<h([1-6]) class="deckset-pos deckset-pos-([\w-]+)">([\s\S]*?)<\/h\1>/g;
    const groups = {}; // position → [html strings]
    let nonPosContent = html;
    let match;
    while ((match = posRegex.exec(html)) !== null) {
      const [full, level, pos, content] = match;
      if (!groups[pos]) groups[pos] = [];
      groups[pos].push(`<h${level}>${content}</h${level}>`);
      nonPosContent = nonPosContent.replace(full, '');
    }
    if (Object.keys(groups).length > 0) {
      let gridHtml = '<div class="deckset-pos-group">';
      for (const [pos, headings] of Object.entries(groups)) {
        gridHtml += `<div class="deckset-pos-${pos}">${headings.join('')}</div>`;
      }
      // Put non-positioned content in the center/left area of the grid
      const remaining = nonPosContent.trim();
      if (remaining) {
        // Use 'l' (left-center) if top-left is taken, otherwise 'c' (center)
        const area = groups['top-left'] ? 'l' : 'c';
        gridHtml += `<div class="deckset-pos-${area === 'l' ? 'left' : 'center'}">${remaining}</div>`;
      }
      gridHtml += '</div>';
      html = gridHtml;
    }
  }

  return `<section${sectionAttrs}>${html}${notesHtml(notes)}</section>`;
}

// ============================================================
// Slide parsing — main dispatcher
// ============================================================

/**
 * Parse a single slide's raw lines into a <section> HTML element.
 * Detects the slide layout (split, media-only, or mixed) and delegates
 * to the appropriate renderer.
 * @param {string[]} rawLines - Raw markdown lines for one slide
 * @param {Object<string, string>} globalDirectives - Document-level frontmatter directives
 * @returns {string} HTML <section> element
 */
function parseSlide(rawLines, globalDirectives) {
  // 1. Extract speaker notes
  const { notes, content: linesNoNotes } = extractNotes(rawLines);

  // 2. Extract slide-level directives
  const { directives, contentLines } = extractDirectives(linesNoNotes);

  // Merge global directives (slide-level overrides global)
  const allDirectives = { ...globalDirectives, ...directives };
  const sectionAttrs = sectionAttrsFromDirectives(allDirectives);
  const buildLists = allDirectives['build-lists'] === 'true' || allDirectives['build-lists'] === true;
  const alternatingColors = allDirectives['alternating-colors'] === 'true';

  // 3. Find left/right media ANYWHERE in the slide (not just first line)
  // Deckset treats ![left] and ![right] as layout directives regardless of position
  let splitMedia = null;
  for (const line of contentLines) {
    const media = findMedia(line);
    if (media.length === 1 &&
        (media[0].modifiers.includes('right') || media[0].modifiers.includes('left'))) {
      splitMedia = media[0];
      break;
    }
  }

  // ── CASE 1: ![right](img) or ![left](img) — split layout ──
  if (splitMedia) {
    return renderSplitLayout(splitMedia, contentLines, sectionAttrs, notes, buildLists);
  }

  // ── CASE 2: Media-only slide (no text) — background or grid ──
  const mediaOnlyHtml = renderMediaOnlySlide(contentLines, sectionAttrs, notes);
  if (mediaOnlyHtml !== null) {
    return mediaOnlyHtml;
  }

  // ── CASE 2.5: Background image + text overlay ──
  // Deckset behavior: a bare ![](src) on its own line at the start of a
  // slide with other content below becomes the slide background, with the
  // remaining content rendered on top. Without this, decks like
  //   ![](closing.jpg)
  //   #[fit] Obrigado
  //   #### contact
  // collapse into a vertical inline column that overflows the slide.
  const firstNonEmptyIdx = contentLines.findIndex(l => l.trim() !== '');
  if (firstNonEmptyIdx !== -1) {
    const firstLine = contentLines[firstNonEmptyIdx];
    if (isMediaOnly(firstLine)) {
      const firstLineMedia = findMedia(firstLine);
      if (firstLineMedia.length === 1) {
        const m = firstLineMedia[0];
        const isLayoutModifier = m.modifiers.includes('right') ||
          m.modifiers.includes('left') ||
          m.modifiers.includes('inline') ||
          m.modifiers.includes('qr');
        if (!isLayoutModifier && !isVideo(m.src) && !parseYouTube(m.src)) {
          const rest = contentLines.slice(firstNonEmptyIdx + 1);
          const restHasNonMedia = rest.some(l => l.trim() && !isMediaOnly(l));
          if (restHasNonMedia) {
            const size = m.modifiers.includes('fit') || m.modifiers.includes('contain')
              ? 'contain' : 'cover';
            const filtered = m.modifiers.includes('filtered')
              ? ' data-background-opacity="0.5" data-background-color="#000"' : '';
            const bgAttrs = `${sectionAttrs} data-background-image="${m.src}" data-background-size="${size}"${filtered}`;
            return renderMixedContent(rest, bgAttrs, notes, buildLists, alternatingColors);
          }
        }
      }
    }
  }

  // ── CASE 3: Mixed content (text + inline media) ──
  return renderMixedContent(contentLines, sectionAttrs, notes, buildLists, alternatingColors);
}

// ============================================================
// Full document parsing
// ============================================================

/**
 * Parse a complete Deckset markdown document into slide HTML.
 * Handles frontmatter extraction, slide splitting on ---, and per-slide parsing.
 * @param {string} raw - Full markdown document
 * @param {Object} [options] - Options: { autoflow: boolean, slideIndexOffset: number }
 * @returns {string} Concatenated <section> elements
 */
function parseDecksetMarkdown(raw, options) {
  // 1. Parse global frontmatter
  // Supports two formats:
  //   a) Deckset: key: value lines at the top (no --- delimiters)
  //   b) YAML: --- delimited block at the top (Marp, Slidev, etc.)
  const allLines = raw.split('\n');
  let startIdx = 0;
  const globalDirectives = {};

  // Check for YAML frontmatter (--- delimited)
  if (allLines[0]?.trim() === '---') {
    for (let i = 1; i < allLines.length; i++) {
      if (allLines[i].trim() === '---') {
        startIdx = i + 1;
        break;
      }
      const colonIdx = allLines[i].indexOf(':');
      if (colonIdx > 0) {
        const key = allLines[i].substring(0, colonIdx).trim().toLowerCase();
        const val = allLines[i].substring(colonIdx + 1).trim();
        globalDirectives[key] = val;
      }
    }
  } else {
    // Deckset-style: key: value lines at the top (no delimiters)
    for (let i = 0; i < allLines.length; i++) {
      const fm = allLines[i].match(FRONTMATTER_KEYS);
      if (fm) {
        const [key, ...rest] = allLines[i].split(':');
        globalDirectives[key.trim().toLowerCase()] = rest.join(':').trim();
        startIdx = i + 1;
      } else if (allLines[i].trim() === '' && startIdx === i) {
        startIdx = i + 1;
      } else {
        break;
      }
    }
  }

  // Marp aliases: paginate → slidenumbers, backgroundColor → not global
  if (globalDirectives['paginate'] === 'true') globalDirectives['slidenumbers'] = 'true';

  const content = allLines.slice(startIdx).join('\n');

  // 2. Extract global reference links ([ref]: url) — resolve across all slides
  _refLinks = {};
  const refLinkPattern = /^\[([^\]]+)\]:\s*(.+)$/;
  content.split('\n').forEach(line => {
    const m = line.match(refLinkPattern);
    if (m) _refLinks[m[1].toLowerCase()] = m[2].trim();
  });

  // 3. Split on --- slide separators (must be on own line, NOT inside fenced code blocks)
  const rawSlides = [];
  let currentSlide = [];
  let inCodeBlock = false;
  for (const line of content.split('\n')) {
    if (line.trim().startsWith('```')) inCodeBlock = !inCodeBlock;
    if (!inCodeBlock && /^---[ \t]*$/.test(line)) {
      rawSlides.push(currentSlide.join('\n'));
      currentSlide = [];
    } else {
      currentSlide.push(line);
    }
  }
  if (currentSlide.length) rawSlides.push(currentSlide.join('\n'));

  // 4. Determine if autoflow is enabled
  // Options take precedence over frontmatter (toolbar toggle must be able to override)
  const autoflowEnabled = (options && options.autoflow !== undefined)
    ? options.autoflow === true
    : globalDirectives.autoflow === 'true';
  const autoflowFn = (typeof applyAutoflow === 'function') ? applyAutoflow : null;
  const createAutoflowCtx = (typeof createAutoflowContext === 'function')
    ? createAutoflowContext
    : (typeof require !== 'undefined' ? require('./autoflow.js').createContext : null);
  const slideIndexOffset = (options && options.slideIndexOffset) || 0;

  // 5. Parse each slide (with optional autoflow pre-processing)
  // The autoflow ctx persists across slides so rules can use cross-slide
  // state (e.g. bare-image-rotate's center→left→right rotation history).
  const prevRules = []; // legacy: list of rule names for vary() functions
  const autoflowCtx = (autoflowEnabled && createAutoflowCtx) ? createAutoflowCtx(options) : null;
  return rawSlides
    .map(s => s.split('\n'))
    .map(lines => lines.filter(l => !refLinkPattern.test(l)))
    .filter(lines => lines.some(l => l.trim() !== ''))
    .map((lines, index) => {
      let autoflowInfo = null;
      if (autoflowEnabled && autoflowFn) {
        const result = autoflowFn(lines, slideIndexOffset + index, undefined, prevRules, autoflowCtx);
        prevRules.push(result.rule);
        lines = result.lines;
        autoflowInfo = { rule: result.rule, detail: result.detail || '' };
      }
      let html = parseSlide(lines, globalDirectives);
      if (autoflowInfo) {
        html = html.replace('<section', `<section data-autoflow="${autoflowInfo.rule}" data-autoflow-detail="${autoflowInfo.detail}"`);
      }
      return html;
    })
    .join('\n');
}

// ============================================================
// Exports (works as ES module and as global)
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  // Node.js / CommonJS (for tests)
  module.exports = {
    parseDecksetMarkdown,
    parseSlide,
    findMedia,
    isMediaOnly,
    isVideo,
    isAudio,
    parseYouTube,
    extractPercent,
    markdownToHtml,
    processContentLines,
    extractDirectives,
    extractNotes,
  };
} else if (typeof window !== 'undefined') {
  // Browser global
  window.parseDecksetMarkdown = parseDecksetMarkdown;
}
