#!/usr/bin/env node
/**
 * autoflow-snapshot.js — record what autoflow does to every slide of a set of
 * decks, through the real parser path (frontmatter, `---` splitting, shared
 * cross-slide context). Two uses:
 *
 *   - test/autoflow-golden.test.js compares the repo's decks against a
 *     committed snapshot, so an engine refactor must be output-identical and
 *     an intentional behavior change shows up as a reviewable JSON diff.
 *   - Before/after runs over a private deck corpus (e.g. ~/presentations-paulo)
 *     to measure how many real slides a rule change touches.
 *
 * Run with --help for usage.
 */

const fs = require('fs');
const path = require('path');

const HELP = `
  autoflow-snapshot — record autoflow's decision for every slide of some decks

  Usage:
    node scripts/autoflow-snapshot.js <file.md|dir>... [--out snap.json]
    node scripts/autoflow-snapshot.js --diff before.json after.json

  Snapshot mode:
    Walks the given files/dirs (recursively, *.md), parses each deck with
    autoflow forced ON and writes { "<path>": [ {slide, rule, detail, tier?,
    lines?} ] } as JSON. "lines" is present only when autoflow rewrote the
    slide. Paths are relative to the current directory. Default output: stdout.

  Diff mode:
    Compares two snapshots: counts rule transitions (old → new), lists every
    changed slide (deck, slide number, old/new rule), and exits 1 if anything
    changed. Decks present in only one snapshot are reported separately.

  Examples:
    node scripts/autoflow-snapshot.js ~/decks --out /tmp/before.json
    # ...change the engine...
    node scripts/autoflow-snapshot.js ~/decks --out /tmp/after.json
    node scripts/autoflow-snapshot.js --diff /tmp/before.json /tmp/after.json
`.trimStart();

const autoflow = require('../packages/core/src/autoflow.js');
const { parseDecksetMarkdown } = require('../packages/core/src/deckset-parser.js');

/**
 * Run a deck through parseDecksetMarkdown with autoflow ON and capture each
 * applyAutoflow result. The parser picks up applyAutoflow from the global
 * scope (that's how it's wired in the browser), so we install a recording
 * wrapper there for the duration of the call.
 */
function snapshotDeck(md) {
  const slides = [];
  const saved = { apply: globalThis.applyAutoflow, ctx: globalThis.createAutoflowContext };
  globalThis.createAutoflowContext = autoflow.createContext;
  globalThis.applyAutoflow = (lines, index, options, prevRules, ctx) => {
    const r = autoflow.applyAutoflow(lines, index, options, prevRules, ctx);
    const same = r.lines.length === lines.length && r.lines.every((l, k) => l === lines[k]);
    const entry = { slide: index + 1, rule: r.rule, detail: r.detail || '' };
    if (r.tier != null) entry.tier = r.tier;
    if (!same) entry.lines = r.lines;
    slides.push(entry);
    return r;
  };
  try {
    parseDecksetMarkdown(md, { autoflow: true });
  } finally {
    globalThis.applyAutoflow = saved.apply;
    globalThis.createAutoflowContext = saved.ctx;
  }
  return slides;
}

function walkMarkdown(target) {
  const st = fs.statSync(target);
  if (st.isFile()) return target.endsWith('.md') ? [target] : [];
  return fs.readdirSync(target, { withFileTypes: true })
    .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(e => walkMarkdown(path.join(target, e.name)));
}

function snapshotPaths(targets, cwd = process.cwd()) {
  const out = {};
  for (const file of targets.flatMap(walkMarkdown)) {
    out[path.relative(cwd, file)] = snapshotDeck(fs.readFileSync(file, 'utf8'));
  }
  return out;
}

function diffSnapshots(before, after) {
  const transitions = {};
  const changed = [];
  const onlyIn = { before: [], after: [] };
  for (const deck of Object.keys(before)) if (!(deck in after)) onlyIn.before.push(deck);
  for (const deck of Object.keys(after)) {
    if (!(deck in before)) { onlyIn.after.push(deck); continue; }
    const a = before[deck], b = after[deck];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (JSON.stringify(a[i]) === JSON.stringify(b[i])) continue;
      const from = a[i] ? a[i].rule : '(none)';
      const to = b[i] ? b[i].rule : '(none)';
      const key = `${from} → ${to}`;
      transitions[key] = (transitions[key] || 0) + 1;
      changed.push({ deck, slide: i + 1, from, to });
    }
  }
  return { transitions, changed, onlyIn };
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    process.stdout.write(HELP);
    return 0;
  }
  if (args[0] === '--diff') {
    const [a, b] = args.slice(1).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
    const { transitions, changed, onlyIn } = diffSnapshots(a, b);
    const total = Object.values(a).reduce((s, d) => s + d.length, 0);
    console.log(`${changed.length} of ${total} slides changed across ${Object.keys(b).length} decks`);
    for (const [k, n] of Object.entries(transitions).sort((x, y) => y[1] - x[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);
    for (const c of changed) console.log(`  ${c.deck} #${c.slide}: ${c.from} → ${c.to}`);
    if (onlyIn.before.length) console.log(`only in before: ${onlyIn.before.join(', ')}`);
    if (onlyIn.after.length) console.log(`only in after: ${onlyIn.after.join(', ')}`);
    return changed.length ? 1 : 0;
  }
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : null;
  const targets = args.filter((a, i) => outIdx < 0 || (i !== outIdx && i !== outIdx + 1));
  const json = JSON.stringify(snapshotPaths(targets), null, 1) + '\n';
  if (out) fs.writeFileSync(out, json); else process.stdout.write(json);
  return 0;
}

if (require.main === module) process.exit(main(process.argv));

module.exports = { snapshotDeck, snapshotPaths, diffSnapshots, walkMarkdown };
