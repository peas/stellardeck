#!/usr/bin/env node
/**
 * Generates slide screenshot thumbnails for the bento grid on the landing page.
 * Uses Playwright to render each slide via StellarEmbed and capture a PNG.
 *
 * Run: node site/scripts/generate-bento.js
 * Requires: npm run serve (dev server on port 3031) + npx playwright install chromium
 * Output: site/public/bento/*.webp
 */
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const outDir = join(__dirname, '..', 'public', 'bento');
mkdirSync(outDir, { recursive: true });

// 12 slides: ~half with images, good variety
const slides = [
  { deck: 'vibe-coding', slide: 0, name: 'vibe-title', label: 'Vibe Coding' },
  { deck: 'bean-to-bar-chocolate', slide: 0, name: 'chocolate-cover', label: 'Bean to Bar' },
  { deck: 'hand-balancing', slide: 7, name: 'coach-portrait', label: 'Hand Balancing' },
  { deck: 'kitchen-sink', slide: 4, name: 'code-block', label: 'Kitchen Sink' },
  { deck: 'getting-started', slide: 5, name: 'split-layout', label: 'Getting Started' },
  { deck: 'kitchen-sink', slide: 7, name: 'columns', label: 'Kitchen Sink' },
  { deck: 'autoflow', slide: 1, name: 'diagonal', label: 'Autoflow', autoflow: true },
  { deck: 'vibe-coding', slide: 12, name: 'vibe-book', label: 'Vibe Coding' },
  { deck: 'bean-to-bar-chocolate', slide: 3, name: 'chocolate-dark', label: 'Bean to Bar' },
  { deck: 'hand-balancing', slide: 16, name: 'training-diagram', label: 'Hand Balancing' },
  { deck: 'kitchen-sink', slide: 15, name: 'flowchart', label: 'Kitchen Sink' },
  { deck: 'kitchen-sink', slide: 6, name: 'custom-color', label: 'Kitchen Sink' },
];

// Map deck names to example slugs for linking
const deckToSlug = {
  'getting-started': 'getting-started',
  'kitchen-sink': 'kitchen-sink',
  'autoflow': 'autoflow',
  'bean-to-bar-chocolate': 'bean-to-bar',
  'hand-balancing': 'hand-balancing',
  'vibe-coding': 'vibe-coding',
};

async function main() {
  const browser = await chromium.launch();
  const PORT = 3031;

  // Check if dev server is running
  try {
    await fetch(`http://localhost:${PORT}/`);
  } catch {
    console.error(`Dev server not running on port ${PORT}. Run: npm run serve`);
    process.exit(1);
  }

  const results = [];

  for (const entry of slides) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    const mdPath = join(root, 'demo', `${entry.deck}.md`);
    const md = readFileSync(mdPath, 'utf8');

    // Create a minimal HTML page that renders a single slide
    const autoflow = entry.autoflow ? 'true' : 'false';
    await page.goto(`http://localhost:${PORT}/viewer.html?file=demo/${entry.deck}.md`, {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(2000);

    // Hide toolbar/chrome, show only slides
    await page.evaluate(() => {
      document.getElementById('toolbar')?.style.setProperty('display', 'none');
      document.getElementById('tab-bar')?.style.setProperty('display', 'none');
      document.getElementById('status-bar')?.style.setProperty('display', 'none');
    });
    await page.waitForTimeout(500);

    // Jump directly to slide (avoids fragment stepping)
    await page.evaluate((idx) => Reveal.slide(idx), entry.slide);
    await page.waitForTimeout(2000); // wait for extras (QR, diagrams, math)

    // Screenshot the full page (slide fills viewport without chrome)
    const outPath = join(outDir, `${entry.name}.png`);
    await page.screenshot({ path: outPath });
    results.push({
      name: entry.name,
      slug: deckToSlug[entry.deck],
      label: entry.label,
      file: `${entry.name}.png`,
    });
    console.log(`  ${results.length}/${slides.length} ${entry.name}`);

    await page.close();
  }

  await browser.close();

  // Write manifest for the bento component
  const manifestPath = join(outDir, 'manifest.json');
  const { writeFileSync } = await import('fs');
  writeFileSync(manifestPath, JSON.stringify(results, null, 2));
  console.log(`\nGenerated ${results.length} screenshots → site/public/bento/`);
}

main().catch(e => { console.error(e); process.exit(1); });
