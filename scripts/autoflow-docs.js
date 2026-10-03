#!/usr/bin/env node
/**
 * autoflow-docs.js — Generate autoflow rules documentation from source.
 *
 * Reads rule metadata (name, description, example, priority) directly from
 * autoflow.js and outputs Markdown. Always in sync with the code.
 *
 * Usage:
 *   node scripts/autoflow-docs.js              # print to stdout
 *   node scripts/autoflow-docs.js --help       # show help
 *   node scripts/autoflow-docs.js > docs/autoflow-rules.md
 */

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
  autoflow-docs — Generate autoflow rules documentation from source code.

  Usage:
    node scripts/autoflow-docs.js              # print Markdown to stdout
    node scripts/autoflow-docs.js > file.md    # write to file

  The output is auto-generated from rule metadata in autoflow.js.
  Each rule has: name, priority, description, and example.
`.trimStart());
  process.exit(0);
}

const { RULES, SKIP_CHECKS, PREPROCESSORS, AUTOFLOW_DEFAULTS } = require('@stellardeck/core/autoflow');

const sorted = [...RULES].sort((a, b) => a.priority - b.priority);

const lines = [];
lines.push('# Autoflow Rules Reference');
lines.push('');
lines.push('> Auto-generated from rule metadata in `packages/core/src/autoflow/`.');
lines.push('> Run `node scripts/autoflow-docs.js > docs/autoflow-rules.md` to regenerate.');
lines.push('');
lines.push('Autoflow is convention-over-configuration layout inference. Write plain');
lines.push('markdown, and autoflow infers the best layout based on content structure.');
lines.push('Rules are evaluated in priority order — first match wins.');
lines.push('');
lines.push('## On by default');
lines.push('');
lines.push('Autoflow runs unless the deck opts out with `autoflow: false` in the');
lines.push('frontmatter. The toolbar toggle (desktop app) and the CLI flags');
lines.push('`--autoflow` / `--no-autoflow` override the deck.');
lines.push('');
lines.push('## Pipeline');
lines.push('');
lines.push('observers → skip checks → empty → preprocessors → rules (priority order) → default');
lines.push('');
lines.push('## Pre-processing');
lines.push('');
lines.push('After the skip checks and before the rules, preprocessors rewrite the slide');
lines.push('and let the pipeline continue:');
lines.push('');
for (const pre of PREPROCESSORS) {
  lines.push(`- **${pre.name}**: ${pre.description}`);
}
lines.push('');
lines.push('## When autoflow does NOT touch a slide');
lines.push('');
lines.push('Even with autoflow enabled, these slides are left exactly as written:');
lines.push('');
for (const skip of SKIP_CHECKS) {
  lines.push(`### Skip: ${skip.name}`);
  lines.push('');
  lines.push(skip.description || skip.detail);
  lines.push('');
}
lines.push('');
lines.push(`## Rules (${sorted.length})`);
lines.push('');
lines.push('| # | Rule | Priority | Detection |');
lines.push('|---|------|----------|-----------|');

for (const [i, rule] of sorted.entries()) {
  const desc = (rule.description || '').split('.')[0]; // first sentence
  lines.push(`| ${i + 1} | **${rule.name}** | ${rule.priority} | ${desc} |`);
}

lines.push('');

for (const rule of sorted) {
  lines.push(`### ${rule.name}`);
  lines.push('');
  lines.push(`**Priority:** ${rule.priority}${rule.guard ? ' (guarded)' : ''}`);
  if (rule.vary) lines.push('  \n**Anti-monotony:** yes (varies across consecutive uses)');
  if (rule.observe) lines.push('  \n**Cross-slide:** observes every slide (state carries across the deck)');
  if (rule.skipIfDirective) lines.push(`  \n**Sits out on:** ${rule.skipIfDirective.map(d => `\`${d}\``).join(', ')} slides`);
  lines.push('');
  lines.push(rule.description || '*No description.*');
  lines.push('');
  if (rule.example) {
    lines.push('**Example input:**');
    lines.push('');
    lines.push('```markdown');
    lines.push(rule.example);
    lines.push('```');
    lines.push('');
  }
  lines.push('---');
  lines.push('');
}

lines.push('## Defaults');
lines.push('');
lines.push('| Setting | Value |');
lines.push('|---------|-------|');
for (const [k, v] of Object.entries(AUTOFLOW_DEFAULTS)) {
  lines.push(`| \`${k}\` | ${v} |`);
}
lines.push('');

console.log(lines.join('\n'));
