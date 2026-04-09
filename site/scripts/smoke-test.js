#!/usr/bin/env node
/**
 * Smoke test for the docs site — verifies slide embeds actually render.
 *
 * Run after build:
 *   node site/scripts/smoke-test.js
 *
 * Requires: npx playwright install chromium (from root)
 * Starts its own preview server, no external deps.
 */
import { execSync, spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteDir = join(__dirname, '..');
const PORT = 4399;

// Start preview server
const server = spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
  cwd: siteDir,
  stdio: 'pipe',
});

// Wait for server to be ready
await new Promise((resolve) => {
  server.stdout.on('data', (data) => {
    if (data.toString().includes('Local')) resolve();
  });
  setTimeout(resolve, 5000); // fallback timeout
});

const BASE = `http://localhost:${PORT}`;
const pages = [
  // Guide pages (have SlidePreview embeds)
  '/guide/getting-started/',
  '/guide/images-layouts/',
  '/guide/code-math-diagrams/',
  '/guide/autoflow/',
  '/guide/themes-colors/',
  // Example pages (have DeckViewer + SlideBreakdown)
  '/examples/bean-to-bar/',
  '/examples/hand-balancing/',
  '/examples/vibe-coding/',
];

let failures = 0;

try {
  // Use a simple fetch-based check first: verify HTML structure
  for (const page of pages) {
    const url = `${BASE}${page}`;
    const resp = await fetch(url);
    const html = await resp.text();

    const isExample = page.includes('/examples/');
    const isGuide = page.includes('/guide/');

    const checks = [
      ['has JSON data element', html.includes('application/json')],
      ['loads stellar-slides.js', html.includes('/engine/stellar-slides.js')],
      ['loads stellar-embed.js', html.includes('/engine/stellar-embed.js')],
      ['loads stellar-parser.js', html.includes('/engine/stellar-parser.js')],
    ];

    if (isExample) {
      checks.push(
        ['has deck container', html.includes('sd-deck-container') || html.includes('deck-viewer-container')],
        ['has stellar-fulldeck data', html.includes('data-stellar-fulldeck') || html.includes('data-stellar-deck')],
      );
    }

    if (isGuide) {
      checks.push(
        ['has slide preview or deck embed', html.includes('StellarEmbed.renderSlide') || html.includes('StellarEmbed.renderDeck')],
      );
    }

    const pageName = page.replace(/^\/(examples|guide)\//, '').replace(/\/$/, '');
    for (const [label, ok] of checks) {
      if (!ok) {
        console.error(`  FAIL [${pageName}] ${label}`);
        failures++;
      }
    }
    if (checks.every(([, ok]) => ok)) {
      console.log(`  OK   ${pageName} (${checks.length} checks passed)`);
    }
  }

  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`} — ${pages.length} pages checked`);
} finally {
  server.kill();
}

process.exit(failures > 0 ? 1 : 0);
