#!/usr/bin/env node
/**
 * Audit theme/scheme color combinations for low contrast.
 *
 * Reads `css/themes.css` and reports any combo whose:
 *   - heading↔bg ratio is below 3.0  (heading text barely readable)
 *   - main↔bg ratio is below 4.5     (WCAG AA for body text)
 *   - heading↔main ratio is below 1.5 (title and subtitle indistinguishable)
 *   - accent↔bg ratio is below 2.5    (progress bar / strong barely visible)
 *
 * Use this before adding/changing a scheme to catch regressions.
 *
 *   node scripts/audit-themes.js          # full report
 *   node scripts/audit-themes.js --strict # exit 1 if any issue found
 */
const fs = require('node:fs');
const path = require('node:path');

function lum(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const f = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const file = path.resolve(__dirname, '..', 'css/themes.css');
const css = fs.readFileSync(file, 'utf8');
const re = /\.theme-([\w-]+)\.scheme-([\w-]+)\s*\{\s*--r-background-color:\s*(#[0-9a-fA-F]+);\s*--r-heading-color:\s*(#[0-9a-fA-F]+);\s*--r-main-color:\s*(#[0-9a-fA-F]+);\s*--accent:\s*(#[0-9a-fA-F]+);/g;

const THRESHOLDS = {
  headingBg:    3.0,
  mainBg:       4.5,
  headingMain:  1.5,
  accentBg:     2.5,
};

const issues = [];
let m;
while ((m = re.exec(css)) !== null) {
  const [, theme, scheme, bg, h, main, accent] = m;
  const r = {
    headingBg:   ratio(h, bg),
    mainBg:      ratio(main, bg),
    headingMain: ratio(h, main),
    accentBg:    ratio(accent, bg),
  };
  const flags = [];
  if (r.headingBg   < THRESHOLDS.headingBg)   flags.push(`heading↔bg=${r.headingBg.toFixed(2)}`);
  if (r.mainBg      < THRESHOLDS.mainBg)      flags.push(`main↔bg=${r.mainBg.toFixed(2)}`);
  if (r.headingMain < THRESHOLDS.headingMain) flags.push(`heading↔main=${r.headingMain.toFixed(2)}`);
  if (r.accentBg    < THRESHOLDS.accentBg)    flags.push(`accent↔bg=${r.accentBg.toFixed(2)}`);
  if (flags.length) issues.push({ key: `${theme}.${scheme}`, ratios: r, flags });
}

if (issues.length === 0) {
  console.log('✓ No contrast issues found.');
  process.exit(0);
}

console.log(`Found ${issues.length} schemes with contrast issues:\n`);
const sorted = [...issues].sort((a, b) => a.ratios.headingMain - b.ratios.headingMain);
for (const it of sorted) {
  console.log(`  ${it.key.padEnd(30)} ${it.flags.join(', ')}`);
}

if (process.argv.includes('--strict')) process.exit(1);
