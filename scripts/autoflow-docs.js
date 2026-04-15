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

const { RULES, SKIP_CHECKS, AUTOFLOW_DEFAULTS } = require('../autoflow.js');

const sorted = [...RULES].sort((a, b) => a.priority - b.priority);

const lines = [];
lines.push('# Autoflow Rules Reference');
lines.push('');
lines.push('> Auto-generated from `autoflow.js` rule metadata.');
lines.push('> Run `node scripts/autoflow-docs.js` to regenerate.');
lines.push('');
lines.push('Autoflow is convention-over-configuration layout inference. Write plain');
lines.push('markdown, and autoflow infers the best layout based on content structure.');
lines.push('Rules are evaluated in priority order — first match wins.');
lines.push('');
lines.push('## How to enable');
lines.push('');
lines.push('Add `autoflow: true` to the frontmatter:');
lines.push('');
lines.push('```markdown');
lines.push('autoflow: true');
lines.push('theme: Alun, 1');
lines.push('```');
lines.push('');
lines.push('Or toggle in the toolbar (desktop app), or pass `--autoflow` to the CLI.');
lines.push('');
lines.push('## Pre-processing');
lines.push('');
lines.push('Before rules run, autoflow applies one pre-processing step:');
lines.push('');
lines.push('- **Bare image + text → filtered background**: When a slide has one bare');
lines.push('  image (`![](src)`) alongside text, the image becomes `![filtered](src)`');
lines.push('  (dark overlay background). Text rules then apply normally on top.');
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
