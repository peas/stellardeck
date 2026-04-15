#!/usr/bin/env node
/**
 * export-pptx.js — Deckset Markdown → PPTX export (native elements)
 *
 * Usage: node scripts/export-pptx.js <input.md> [output.pptx]
 *        node scripts/export-pptx.js --help
 *
 * Creates a PPTX with native PowerPoint elements (editable text, images,
 * backgrounds) from Deckset-flavored markdown. Uses PptxGenJS.
 */

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const sharp = require('sharp');

// ── CLI ──────────────────────────────────────────────────────

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
  export-pptx.js — Deckset Markdown → PPTX export

  Usage:
    node scripts/export-pptx.js <input.md> [output.pptx]

  Arguments:
    input.md     Path to Deckset markdown file
    output.pptx  Output path (default: same name as input with .pptx)

  Examples:
    node scripts/export-pptx.js test/smoke-test.md
    node scripts/export-pptx.js demo/vibe-coding.md ~/Desktop/vibe.pptx
  `);
  process.exit(0);
}

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: node scripts/export-pptx.js <input.md> [output.pptx]');
  process.exit(1);
}

const outputFile = process.argv[3] || inputFile.replace(/\.md$/, '.pptx');

// ── Parser (minimal AST from Deckset markdown) ──────────────

const FRONTMATTER_RE = /^(footer|slidenumbers|theme|autoscale|build-lists|slide-transition):/i;
const DIRECTIVE_RE = /^\[\.([a-z-]+)(?::\s*([^\]]*))?\]$/i;
const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const HEADING_RE = /^(#{1,6})\s*(?:\[fit\]\s*)?(.+)$/;
const BULLET_RE = /^[-*]\s+(.+)$/;
const ORDERED_RE = /^\d+\.\s+(.+)$/;
const BLOCKQUOTE_RE = /^>\s*(.*)$/;
const CODE_FENCE_RE = /^```(\w*)?$/;
const NOTE_RE = /^\^(.+)$/;

function parseDecksetToAST(raw) {
  const allLines = raw.split('\n');
  let startIdx = 0;
  const frontmatter = {};

  // Parse frontmatter
  for (let i = 0; i < allLines.length; i++) {
    if (FRONTMATTER_RE.test(allLines[i])) {
      const [key, ...rest] = allLines[i].split(':');
      frontmatter[key.trim().toLowerCase()] = rest.join(':').trim();
      startIdx = i + 1;
    } else if (allLines[i].trim() === '' && startIdx === i) {
      startIdx = i + 1;
    } else {
      break;
    }
  }

  const content = allLines.slice(startIdx).join('\n');
  const rawSlides = content.split(/\n---[ \t]*\n/);

  return {
    frontmatter,
    slides: rawSlides
      .map(s => s.split('\n'))
      .filter(lines => lines.some(l => l.trim() !== ''))
      .map(lines => parseSlideAST(lines)),
  };
}

function parseSlideAST(lines) {
  const slide = {
    elements: [],     // { type, content, level, src, modifiers, items, lang }
    directives: {},
    notes: '',
    images: [],       // { modifiers[], src }
  };

  let inCode = false;
  let codeLang = '';
  let codeLines = [];

  for (const line of lines) {
    // Directives
    const dm = line.match(DIRECTIVE_RE);
    if (dm && !inCode) {
      slide.directives[dm[1].toLowerCase()] = dm[2] !== undefined ? dm[2].trim() : true;
      continue;
    }

    // Speaker notes
    const nm = line.match(NOTE_RE);
    if (nm && !inCode) {
      slide.notes += (slide.notes ? '\n' : '') + nm[1].trim();
      continue;
    }

    // Code fences
    const cm = line.match(CODE_FENCE_RE);
    if (cm !== null) {
      if (!inCode) {
        inCode = true;
        codeLang = cm[1] || '';
        codeLines = [];
      } else {
        slide.elements.push({ type: 'code', lang: codeLang, content: codeLines.join('\n') });
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Images (standalone line)
    const imgMatches = [...line.matchAll(IMAGE_RE)];
    if (imgMatches.length > 0 && line.replace(IMAGE_RE, '').trim() === '') {
      for (const m of imgMatches) {
        const mods = m[1].split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const img = { modifiers: mods, src: m[2] };
        slide.images.push(img);
        if (mods.includes('inline')) {
          slide.elements.push({ type: 'inline-image', src: m[2], modifiers: mods });
        }
      }
      continue;
    }

    // Headings
    const hm = line.match(HEADING_RE);
    if (hm) {
      const isFit = line.includes('[fit]');
      slide.elements.push({ type: 'heading', level: hm[1].length, content: hm[2].trim(), fit: isFit });
      continue;
    }

    // Blockquote
    const bm = line.match(BLOCKQUOTE_RE);
    if (bm) {
      slide.elements.push({ type: 'blockquote', content: bm[1] });
      continue;
    }

    // Bullet list
    const blm = line.match(BULLET_RE);
    if (blm) {
      slide.elements.push({ type: 'bullet', content: blm[1] });
      continue;
    }

    // Ordered list
    const olm = line.match(ORDERED_RE);
    if (olm) {
      slide.elements.push({ type: 'ordered', content: olm[1] });
      continue;
    }

    // Regular text (non-empty)
    if (line.trim()) {
      slide.elements.push({ type: 'text', content: line.trim() });
    }
  }

  // Classify slide type based on images
  const bgImages = slide.images.filter(i =>
    !i.modifiers.includes('inline') && !i.modifiers.includes('left') && !i.modifiers.includes('right')
  );
  const splitImages = slide.images.filter(i =>
    i.modifiers.includes('left') || i.modifiers.includes('right')
  );

  if (splitImages.length > 0) slide.layout = 'split';
  else if (bgImages.length > 0 && slide.elements.length === 0) slide.layout = 'image-only';
  else if (bgImages.length > 0) slide.layout = 'image-bg';
  else slide.layout = 'text';

  slide.splitSide = splitImages[0]?.modifiers.includes('right') ? 'right' : 'left';
  slide.bgImage = bgImages[0] || null;
  slide.splitImage = splitImages[0] || null;
  slide.isFiltered = slide.images.some(i => i.modifiers.includes('filtered'));

  return slide;
}

// ── Markdown text → PptxGenJS text runs ─────────────────────

function textToRuns(text, baseOpts = {}) {
  const runs = [];
  // Simple bold/italic parser
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~|([^*`~]+))/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[2]) runs.push({ text: m[2], options: { ...baseOpts, bold: true } });
    else if (m[3]) runs.push({ text: m[3], options: { ...baseOpts, italic: true } });
    else if (m[4]) runs.push({ text: m[4], options: { ...baseOpts, fontFace: 'Courier New', fontSize: (baseOpts.fontSize || 18) * 0.85 } });
    else if (m[5]) runs.push({ text: m[5], options: { ...baseOpts, strike: true } });
    else if (m[6]) runs.push({ text: m[6], options: { ...baseOpts } });
  }
  return runs.length > 0 ? runs : [{ text, options: baseOpts }];
}

// ── Resolve image and convert to PPTX-compatible format ─────
// OOXML only supports PNG, JPG, GIF, BMP, TIFF, EMF, WMF.
// WebP must be converted to PNG for compatibility with
// PowerPoint, Google Slides, and other PPTX readers.

const _imageCache = new Map(); // abs path → { data: 'image/png;base64,...' }

async function resolveImage(src, inputDir) {
  if (src.startsWith('http://') || src.startsWith('https://')) return null;
  const abs = path.resolve(inputDir, src);
  if (!fs.existsSync(abs)) {
    console.warn(`  ⚠ Image not found: ${src}`);
    return null;
  }

  if (_imageCache.has(abs)) return _imageCache.get(abs);

  const ext = path.extname(abs).toLowerCase();
  let result;

  if (ext === '.webp' || ext === '.avif' || ext === '.heic') {
    // Convert to PNG via sharp
    const pngBuf = await sharp(abs).png().toBuffer();
    result = { data: 'image/png;base64,' + pngBuf.toString('base64') };
  } else {
    // PNG, JPG, GIF — pass path directly (PptxGenJS handles natively)
    result = { path: abs };
  }

  _imageCache.set(abs, result);
  return result;
}

// ── Generate PPTX ───────────────────────────────────────────

async function generatePptx(ast, inputDir) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33" x 7.5" (16:9)
  pptx.author = 'StellarDeck';
  pptx.subject = ast.frontmatter.footer || '';

  const W = 13.33;
  const H = 7.5;
  const PAD = 0.6;
  const CONTENT_W = W - PAD * 2;

  const COLORS = {
    bg: '0A0A0A',
    heading: 'F8FAFC',
    text: 'E2E8F0',
    accent: '0EA5E9',
    muted: '94A3B8',
    codeBg: '1E293B',
  };

  for (let i = 0; i < ast.slides.length; i++) {
    const s = ast.slides[i];
    const slide = pptx.addSlide();

    // Background color
    const bgColor = s.directives['background-color']?.replace('#', '') || COLORS.bg;
    slide.background = { color: bgColor };

    // Background image
    if (s.bgImage && !s.isFiltered) {
      const img = await resolveImage(s.bgImage.src, inputDir);
      if (img) {
        slide.background = img; // { path } or { data }
      }
    } else if (s.bgImage && s.isFiltered) {
      const img = await resolveImage(s.bgImage.src, inputDir);
      if (img) {
        slide.background = img;
        // Dark overlay
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: W, h: H,
          fill: { color: '000000', transparency: 50 },
        });
      }
    }

    // Speaker notes
    if (s.notes) slide.addNotes(s.notes);

    // ── Layout: split ──
    if (s.layout === 'split') {
      const imgSide = s.splitSide;
      const textX = imgSide === 'right' ? PAD : W / 2 + 0.2;
      const textW = W / 2 - PAD - 0.2;
      const imgX = imgSide === 'right' ? W / 2 : 0;

      // Image half
      const img = await resolveImage(s.splitImage.src, inputDir);
      if (img) {
        slide.addImage({ ...img, x: imgX, y: 0, w: W / 2, h: H, sizing: { type: 'cover', w: W / 2, h: H } });
      }

      // Text half
      let curY = 0.8;
      for (const el of s.elements) {
        if (el.type === 'heading') {
          const fontSize = el.fit ? 36 : (el.level === 1 ? 32 : el.level === 2 ? 26 : 22);
          slide.addText(textToRuns(el.content, { fontSize, color: COLORS.heading, fontFace: 'Inter', bold: true }), {
            x: textX, y: curY, w: textW, h: 0.6, valign: 'top', shrinkText: el.fit,
          });
          curY += fontSize / 36 * 0.7;
        } else if (el.type === 'bullet' || el.type === 'ordered') {
          slide.addText(textToRuns(el.content, { fontSize: 18, color: COLORS.text, fontFace: 'Inter' }), {
            x: textX + 0.2, y: curY, w: textW - 0.2, h: 0.4, bullet: el.type === 'ordered' ? { type: 'number' } : true,
          });
          curY += 0.4;
        } else if (el.type === 'text') {
          slide.addText(textToRuns(el.content, { fontSize: 18, color: COLORS.text, fontFace: 'Inter' }), {
            x: textX, y: curY, w: textW, h: 0.4,
          });
          curY += 0.4;
        }
      }
      continue;
    }

    // ── Layout: image-only ──
    if (s.layout === 'image-only') {
      // Already set as background above
      continue;
    }

    // ── Layout: text (or image-bg with content) ──
    let curY = 0.6;
    for (const el of s.elements) {
      switch (el.type) {
        case 'heading': {
          const fontSize = el.fit ? 48 : (el.level === 1 ? 36 : el.level === 2 ? 28 : 24);
          slide.addText(textToRuns(el.content, {
            fontSize, color: COLORS.heading, fontFace: 'Inter', bold: true,
          }), {
            x: PAD, y: curY, w: CONTENT_W, h: el.fit ? 1.0 : 0.7,
            valign: 'top', shrinkText: el.fit,
          });
          curY += el.fit ? 1.1 : 0.8;
          break;
        }

        case 'text': {
          slide.addText(textToRuns(el.content, {
            fontSize: 20, color: COLORS.text, fontFace: 'Inter',
          }), {
            x: PAD, y: curY, w: CONTENT_W, h: 0.45,
          });
          curY += 0.5;
          break;
        }

        case 'bullet':
        case 'ordered': {
          slide.addText(textToRuns(el.content, {
            fontSize: 20, color: COLORS.text, fontFace: 'Inter',
          }), {
            x: PAD + 0.3, y: curY, w: CONTENT_W - 0.3, h: 0.42,
            bullet: el.type === 'ordered' ? { type: 'number' } : true,
          });
          curY += 0.45;
          break;
        }

        case 'blockquote': {
          slide.addShape(pptx.ShapeType.rect, {
            x: PAD, y: curY, w: 0.06, h: 0.8, fill: { color: COLORS.accent },
          });
          slide.addText(textToRuns(el.content, {
            fontSize: 24, color: COLORS.heading, fontFace: 'Inter', italic: true,
          }), {
            x: PAD + 0.3, y: curY, w: CONTENT_W - 0.3, h: 0.8,
            valign: 'middle',
          });
          curY += 1.0;
          break;
        }

        case 'code': {
          // Monospace code block with dark background
          slide.addShape(pptx.ShapeType.rect, {
            x: PAD, y: curY, w: CONTENT_W, h: Math.max(1.0, el.content.split('\n').length * 0.32),
            fill: { color: COLORS.codeBg }, rectRadius: 0.08,
          });
          slide.addText(el.content, {
            x: PAD + 0.2, y: curY + 0.15,
            w: CONTENT_W - 0.4, h: Math.max(0.7, el.content.split('\n').length * 0.32),
            fontFace: 'Courier New', fontSize: 14, color: COLORS.text,
            valign: 'top', paraSpaceBefore: 2, lineSpacingMultiple: 1.2,
          });
          curY += Math.max(1.2, el.content.split('\n').length * 0.32 + 0.3);
          break;
        }

        case 'inline-image': {
          const img = await resolveImage(el.src, inputDir);
          if (img) {
            const maxH = 3.5;
            const maxW = CONTENT_W;
            slide.addImage({
              ...img, x: PAD, y: curY, w: maxW, h: maxH,
              sizing: { type: 'contain', w: maxW, h: maxH },
            });
            curY += maxH + 0.2;
          }
          break;
        }
      }
    }

    // Footer
    if (ast.frontmatter.footer) {
      slide.addText(ast.frontmatter.footer, {
        x: PAD, y: H - 0.4, w: CONTENT_W / 2, h: 0.3,
        fontSize: 9, color: COLORS.muted, fontFace: 'Inter',
      });
    }
    if (ast.frontmatter.slidenumbers === 'true') {
      slide.addText(`${i + 1}`, {
        x: W - PAD - 0.5, y: H - 0.4, w: 0.5, h: 0.3,
        fontSize: 9, color: COLORS.muted, fontFace: 'Inter', align: 'right',
      });
    }
  }

  return pptx;
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  const md = fs.readFileSync(inputFile, 'utf-8');
  const inputDir = path.dirname(path.resolve(inputFile));

  console.log(`Parsing ${inputFile}...`);
  const ast = parseDecksetToAST(md);
  console.log(`  ${ast.slides.length} slides, frontmatter: ${JSON.stringify(ast.frontmatter)}`);

  console.log(`Generating PPTX...`);
  const pptx = await generatePptx(ast, inputDir);

  const outPath = path.resolve(outputFile);
  await pptx.writeFile({ fileName: outPath });
  console.log(`✓ Exported to ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
