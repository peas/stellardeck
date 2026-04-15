#!/usr/bin/env node
/**
 * Analyze Paulo's presentation style across all Deckset markdown decks.
 * Usage: node scripts/analyze-style.js [--help]
 */

const fs = require('fs');
const path = require('path');

if (process.argv.includes('--help')) {
  console.log(`
Usage: node scripts/analyze-style.js

Analyzes all .md presentation files in presentation directories,
computes statistical patterns, and prints a structured report.

Excludes: test/, docs/, demo/, site/, old/, node_modules/, .claude/
`);
  process.exit(0);
}

const ROOT = path.resolve(__dirname, '..');

// Presentation directories only
const INCLUDE_DIRS = [
  '1bi-dev', 'alura-interno-estrategia', 'aluraverso-bolhadev',
  'ascensao-e-declinio-do-webmaster', 'career', 'carreiras-hipsters',
  'empreendedorismo', 'grupo_alura', 'ia', 'k12', 'lideranca-tecnologia',
  'lives', 'onboarding2023', 'podcast', 'startups', 'teams',
  'transforamcao_digital_agilidade', 'vibe-coding', 'vibe'
];

// Collect all .md files recursively
function collectMdFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full));
    } else if (entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

// Stats helper
function stats(arr) {
  if (!arr.length) return { min: 0, max: 0, median: 0, p25: 0, p75: 0, mean: 0, count: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const n = sorted.length;
  const percentile = (p) => {
    const idx = (p / 100) * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    max: sorted[n - 1],
    median: percentile(50),
    p25: percentile(25),
    p75: percentile(75),
    mean: sum / n,
    count: n
  };
}

function fmt(n) { return typeof n === 'number' ? Math.round(n * 100) / 100 : n; }

function fmtStats(s, unit = '') {
  return `min=${fmt(s.min)}${unit}  p25=${fmt(s.p25)}${unit}  median=${fmt(s.median)}${unit}  p75=${fmt(s.p75)}${unit}  max=${fmt(s.max)}${unit}  mean=${fmt(s.mean)}${unit}  (n=${s.count})`;
}

// Parse frontmatter: returns { frontmatter: {}, bodyStartIndex }
function parseFrontmatter(raw) {
  const lines = raw.split('\n');
  const fm = {};
  // Frontmatter must start at line 0 with key: value (Deckset style, no --- fences for FM)
  // Deckset frontmatter: lines at top matching /^[a-z-]+:/ before any blank line or ---
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^([a-z][a-z0-9_-]*)\s*:\s*(.*)/i);
    if (m) {
      fm[m[1].toLowerCase()] = m[2].trim();
      i++;
    } else {
      break;
    }
  }
  return { frontmatter: fm, bodyStart: i };
}

// Split deck into slides (skip frontmatter)
function splitSlides(raw) {
  const { frontmatter, bodyStart } = parseFrontmatter(raw);
  const body = raw.split('\n').slice(bodyStart).join('\n');
  // Deckset uses --- on its own line as separator
  const slides = body.split(/\n---\n/).map(s => s.trim()).filter(s => s.length > 0);
  return { frontmatter, slides };
}

// Classify a slide
function classifySlide(text) {
  const lines = text.split('\n').filter(l => l.trim() && !l.trim().startsWith('^'));
  const nonEmpty = lines.filter(l => !l.match(/^\[\./) && !l.match(/^!\[/));
  const hasImage = /!\[/.test(text);
  const hasCode = /```/.test(text);
  const hasBullets = lines.some(l => /^\s*[-*]\s/.test(l));
  const isSplit = /!\[(right|left)/.test(text);
  const textLines = lines.filter(l => !l.match(/^!\[/) && !l.match(/^\[\./) && !l.match(/^```/) && !l.match(/^#/));

  if (hasCode) return 'code';
  if (isSplit) return 'split';
  if (hasImage && nonEmpty.filter(l => !l.match(/^!\[/)).length === 0) return 'image-only';
  if (hasBullets) return 'bullets';

  // Title: 1-2 short lines (heading or plain)
  const contentLines = lines.filter(l => !l.match(/^\[\./) && !l.match(/^!\[/));
  if (contentLines.length <= 2) {
    const totalWords = contentLines.join(' ').split(/\s+/).filter(w => w).length;
    if (totalWords <= 15) return 'title';
  }

  // Statement: 1-4 lines, no bullets, no images
  if (contentLines.length <= 4 && !hasImage && !hasBullets) return 'statement';

  return 'other';
}

// ========== MAIN ==========
const allFiles = [];
for (const dir of INCLUDE_DIRS) {
  allFiles.push(...collectMdFiles(path.join(ROOT, dir)));
}

console.log(`\n${'='.repeat(80)}`);
console.log(`  PRESENTATION STYLE ANALYSIS — Paulo Silveira`);
console.log(`${'='.repeat(80)}\n`);
console.log(`Files found: ${allFiles.length} .md files across ${INCLUDE_DIRS.length} directories\n`);

// Per-deck stats
const deckSlideCounts = [];
const deckNames = [];
const allSlides = []; // { text, deckFile }
const deckFrontmatters = [];

for (const file of allFiles) {
  const raw = fs.readFileSync(file, 'utf-8');
  const { frontmatter, slides } = splitSlides(raw);
  if (slides.length === 0) continue;
  deckSlideCounts.push(slides.length);
  deckNames.push(path.relative(ROOT, file));
  deckFrontmatters.push({ file: path.relative(ROOT, file), ...frontmatter });
  for (const s of slides) {
    allSlides.push({ text: s, deck: path.relative(ROOT, file) });
  }
}

// ─── 1. Slides per deck ───
console.log('─'.repeat(80));
console.log('1. SLIDES PER DECK');
console.log('─'.repeat(80));
const slideStats = stats(deckSlideCounts);
console.log(fmtStats(slideStats));

// Find examples
const sorted = deckSlideCounts.map((c, i) => ({ count: c, name: deckNames[i] })).sort((a, b) => a.count - b.count);
console.log(`\nSmallest decks:`);
sorted.slice(0, 5).forEach(d => console.log(`  ${d.count} slides — ${d.name}`));
console.log(`Largest decks:`);
sorted.slice(-5).forEach(d => console.log(`  ${d.count} slides — ${d.name}`));

// ─── 2. Words per slide ───
console.log(`\n${'─'.repeat(80)}`);
console.log('2. WORDS PER SLIDE');
console.log('─'.repeat(80));
const wordsPerSlide = allSlides.map(s => {
  // Strip speaker notes, directives, image refs for word count
  const lines = s.text.split('\n')
    .filter(l => !l.trim().startsWith('^'))
    .filter(l => !l.match(/^\[\./) )
    .map(l => l.replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim())
    .filter(l => l);
  return lines.join(' ').split(/\s+/).filter(w => w.length > 0).length;
});
const wordStats = stats(wordsPerSlide);
console.log(fmtStats(wordStats, ' words'));

// Most wordy slides
const wordySorted = wordsPerSlide.map((w, i) => ({ words: w, deck: allSlides[i].deck, text: allSlides[i].text.slice(0, 80) })).sort((a, b) => b.words - a.words);
console.log(`\nMost wordy slides:`);
wordySorted.slice(0, 5).forEach(s => console.log(`  ${s.words} words — ${s.deck} — "${s.text}..."`));

// ─── 3. Lines per slide ───
console.log(`\n${'─'.repeat(80)}`);
console.log('3. LINES PER SLIDE (non-empty)');
console.log('─'.repeat(80));
const linesPerSlide = allSlides.map(s => s.text.split('\n').filter(l => l.trim()).length);
const lineStats = stats(linesPerSlide);
console.log(fmtStats(lineStats, ' lines'));

// ─── 4. Image density ───
console.log(`\n${'─'.repeat(80)}`);
console.log('4. IMAGE DENSITY');
console.log('─'.repeat(80));
const slidesWithImage = allSlides.filter(s => /!\[/.test(s.text)).length;
console.log(`Slides with images: ${slidesWithImage} / ${allSlides.length} (${fmt(100 * slidesWithImage / allSlides.length)}%)`);

// ─── 5. Image modifier breakdown ───
console.log(`\n${'─'.repeat(80)}`);
console.log('5. IMAGE MODIFIER BREAKDOWN');
console.log('─'.repeat(80));
const imgModifiers = { right: 0, left: 0, fit: 0, filtered: 0, inline: 0, fill: 0, bare: 0 };
let totalImageRefs = 0;
for (const s of allSlides) {
  const matches = s.text.match(/!\[([^\]]*)\]/g) || [];
  for (const m of matches) {
    totalImageRefs++;
    const inner = m.slice(2, -1).toLowerCase();
    if (/\bright\b/.test(inner)) imgModifiers.right++;
    else if (/\bleft\b/.test(inner)) imgModifiers.left++;
    else if (/\bfit\b/.test(inner)) imgModifiers.fit++;
    else if (/\bfiltered\b/.test(inner)) imgModifiers.filtered++;
    else if (/\binline\b/.test(inner)) imgModifiers.inline++;
    else if (/\bfill\b/.test(inner)) imgModifiers.fill++;
    else imgModifiers.bare++;
  }
}
console.log(`Total image references: ${totalImageRefs}`);
for (const [mod, count] of Object.entries(imgModifiers).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${mod.padEnd(12)} ${count.toString().padStart(5)}  (${fmt(100 * count / totalImageRefs)}%)`);
}

// ─── 6. Split layout ratio ───
console.log(`\n${'─'.repeat(80)}`);
console.log('6. SPLIT LAYOUT RATIO');
console.log('─'.repeat(80));
const splitSlideCount = allSlides.filter(s => /!\[(right|left)/.test(s.text)).length;
console.log(`Split slides (![right] or ![left]): ${splitSlideCount} / ${allSlides.length} (${fmt(100 * splitSlideCount / allSlides.length)}%)`);

// ─── 7. #[fit] usage ───
console.log(`\n${'─'.repeat(80)}`);
console.log('7. #[fit] USAGE');
console.log('─'.repeat(80));
const fitSlides = allSlides.filter(s => /#\[fit\]/i.test(s.text)).length;
console.log(`Slides with #[fit]: ${fitSlides} / ${allSlides.length} (${fmt(100 * fitSlides / allSlides.length)}%)`);
// Count total #[fit] occurrences
const totalFit = allSlides.reduce((sum, s) => sum + (s.text.match(/#\[fit\]/gi) || []).length, 0);
console.log(`Total #[fit] occurrences: ${totalFit}`);

// ─── 8. Directive usage ───
console.log(`\n${'─'.repeat(80)}`);
console.log('8. DIRECTIVE USAGE');
console.log('─'.repeat(80));
const directives = {
  '[.background-color]': /\[\.background-color/,
  '[.build-lists]': /\[\.build-lists/,
  '[.autoscale]': /\[\.autoscale/,
  '[.alternating-colors]': /\[\.alternating-colors/,
  '[.heading-align]': /\[\.heading-align/,
  ':::columns': /:::columns/,
  ':::diagram': /:::diagram/,
  ':::steps': /:::steps/,
  ':::center': /:::center/,
};
for (const [name, re] of Object.entries(directives)) {
  const count = allSlides.filter(s => re.test(s.text)).length;
  if (count > 0) {
    console.log(`  ${name.padEnd(25)} ${count.toString().padStart(5)} slides  (${fmt(100 * count / allSlides.length)}%)`);
  } else {
    console.log(`  ${name.padEnd(25)}     0 slides`);
  }
}

// ─── 9. Speaker notes density ───
console.log(`\n${'─'.repeat(80)}`);
console.log('9. SPEAKER NOTES DENSITY');
console.log('─'.repeat(80));
const notesSlides = allSlides.filter(s => s.text.split('\n').some(l => /^\^/.test(l.trim()))).length;
console.log(`Slides with speaker notes (^): ${notesSlides} / ${allSlides.length} (${fmt(100 * notesSlides / allSlides.length)}%)`);

// ─── 10. Code block density ───
console.log(`\n${'─'.repeat(80)}`);
console.log('10. CODE BLOCK DENSITY');
console.log('─'.repeat(80));
const codeSlides = allSlides.filter(s => /```/.test(s.text)).length;
console.log(`Slides with code blocks: ${codeSlides} / ${allSlides.length} (${fmt(100 * codeSlides / allSlides.length)}%)`);

// ─── 11. Slide content types ───
console.log(`\n${'─'.repeat(80)}`);
console.log('11. SLIDE CONTENT TYPES');
console.log('─'.repeat(80));
const typeCounts = { title: 0, statement: 0, bullets: 0, 'image-only': 0, split: 0, code: 0, other: 0 };
for (const s of allSlides) {
  const t = classifySlide(s.text);
  typeCounts[t]++;
}
for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type.padEnd(12)} ${count.toString().padStart(5)}  (${fmt(100 * count / allSlides.length)}%)`);
}

// ─── 12. Footer/slidenumbers usage ───
console.log(`\n${'─'.repeat(80)}`);
console.log('12. FOOTER & SLIDENUMBERS FRONTMATTER');
console.log('─'.repeat(80));
const footerDecks = deckFrontmatters.filter(fm => fm.footer !== undefined);
const slideNumDecks = deckFrontmatters.filter(fm => fm.slidenumbers !== undefined);
const themeDecks = deckFrontmatters.filter(fm => fm.theme !== undefined);
const autoflowDecks = deckFrontmatters.filter(fm => fm.autoflow !== undefined);

console.log(`Decks with footer:        ${footerDecks.length} / ${deckNames.length} (${fmt(100 * footerDecks.length / deckNames.length)}%)`);
console.log(`Decks with slidenumbers:  ${slideNumDecks.length} / ${deckNames.length} (${fmt(100 * slideNumDecks.length / deckNames.length)}%)`);
console.log(`Decks with theme:         ${themeDecks.length} / ${deckNames.length} (${fmt(100 * themeDecks.length / deckNames.length)}%)`);
console.log(`Decks with autoflow:      ${autoflowDecks.length} / ${deckNames.length} (${fmt(100 * autoflowDecks.length / deckNames.length)}%)`);

// Theme breakdown
if (themeDecks.length > 0) {
  const themeCounts = {};
  themeDecks.forEach(fm => {
    const t = fm.theme || 'unknown';
    themeCounts[t] = (themeCounts[t] || 0) + 1;
  });
  console.log(`\nTheme breakdown:`);
  for (const [theme, count] of Object.entries(themeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${theme.padEnd(25)} ${count}`);
  }
}

// ─── Per-directory summary ───
console.log(`\n${'─'.repeat(80)}`);
console.log('DIRECTORY SUMMARY');
console.log('─'.repeat(80));
const dirStats = {};
for (const file of allFiles) {
  const rel = path.relative(ROOT, file);
  const dir = rel.split('/')[0];
  if (!dirStats[dir]) dirStats[dir] = { files: 0, totalSlides: 0 };
  const raw = fs.readFileSync(file, 'utf-8');
  const { slides } = splitSlides(raw);
  dirStats[dir].files++;
  dirStats[dir].totalSlides += slides.length;
}
console.log(`${'Directory'.padEnd(40)} ${'Files'.padStart(6)} ${'Total slides'.padStart(13)} ${'Avg slides'.padStart(11)}`);
for (const [dir, s] of Object.entries(dirStats).sort((a, b) => b[1].files - a[1].files)) {
  console.log(`  ${dir.padEnd(38)} ${s.files.toString().padStart(6)} ${s.totalSlides.toString().padStart(13)} ${fmt(s.totalSlides / s.files).toString().padStart(11)}`);
}

// ─── Distribution of words per slide (histogram) ───
console.log(`\n${'─'.repeat(80)}`);
console.log('WORDS PER SLIDE — DISTRIBUTION');
console.log('─'.repeat(80));
const buckets = [0, 5, 10, 20, 30, 50, 75, 100, 150, 200, 500];
for (let i = 0; i < buckets.length; i++) {
  const lo = buckets[i];
  const hi = i < buckets.length - 1 ? buckets[i + 1] : Infinity;
  const count = wordsPerSlide.filter(w => w >= lo && w < hi).length;
  const bar = '#'.repeat(Math.round(count / allSlides.length * 100));
  const label = hi === Infinity ? `${lo}+` : `${lo}-${hi - 1}`;
  console.log(`  ${label.padEnd(8)} ${count.toString().padStart(5)} (${fmt(100 * count / allSlides.length).toString().padStart(5)}%) ${bar}`);
}

console.log(`\n${'='.repeat(80)}`);
console.log(`  TOTAL: ${allFiles.length} decks, ${allSlides.length} slides analyzed`);
console.log(`${'='.repeat(80)}\n`);
