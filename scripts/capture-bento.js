#!/usr/bin/env node
/**
 * Capture bento grid screenshots from demo decks.
 *
 * Usage: node scripts/capture-bento.js [--port 3031]
 * Requires: dev server running (npm run serve)
 *
 * Outputs PNGs to site/public/bento/
 */

const { chromium } = require('playwright-core');
const path = require('path');

const PORT = process.argv.includes('--port')
  ? parseInt(process.argv[process.argv.indexOf('--port') + 1])
  : 3031;

const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join(__dirname, '..', 'site', 'public', 'bento');

// Each entry: { name, deck, slide }
const SHOTS = [
  { name: 'vibe-title',      deck: 'demo/vibe-coding.md',             slide: 0 },
  { name: 'flowchart',       deck: 'demo/kitchen-sink.md',            slide: 15 },
  { name: 'chocolate-dark',  deck: 'demo/bean-to-bar-chocolate.md',   slide: 3 },
  { name: 'diagonal',        deck: 'demo/autoflow.md',                slide: 1 },
  { name: 'coach-portrait',  deck: 'demo/hand-balancing.md',          slide: 5 },
  { name: 'code-block',      deck: 'demo/kitchen-sink.md',            slide: 4 },
  { name: 'training-diagram',deck: 'demo/hand-balancing.md',          slide: 3 },
  { name: 'custom-color',    deck: 'demo/kitchen-sink.md',            slide: 6 },
  { name: 'vibe-book',       deck: 'demo/vibe-coding.md',             slide: 13 },
  { name: 'split-layout',    deck: 'demo/getting-started.md',         slide: 5 },
  { name: 'columns',         deck: 'demo/kitchen-sink.md',            slide: 7 },
  { name: 'chocolate-cover', deck: 'demo/bean-to-bar-chocolate.md',   slide: 0 },
];

async function capture() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  let lastDeck = null;
  let page = null;

  for (const shot of SHOTS) {
    const url = `${BASE}/viewer.html?file=${shot.deck}`;
    if (shot.deck !== lastDeck) {
      if (page) await page.close();
      page = await context.newPage();
      await page.goto(url);
      await page.waitForSelector('.reveal .slides section');
      await page.waitForTimeout(1000);
      lastDeck = shot.deck;
    }

    await page.evaluate(n => Reveal.slide(n), shot.slide);
    await page.waitForTimeout(500);

    // Hide chrome (toolbar, tabs, sidebar, footer) for clean screenshot
    await page.evaluate(() => {
      for (const sel of ['#toolbar', '#tab-bar', '#sidebar', '.reveal .slide-number', '.reveal .footer-text']) {
        const el = document.querySelector(sel);
        if (el) el.style.display = 'none';
      }
    });

    // Capture just the slide area
    const slideArea = await page.$('.slide-area') || await page.$('.reveal');
    const outPath = path.join(OUT, `${shot.name}.png`);
    await slideArea.screenshot({ path: outPath });

    console.log(`  ✓ ${shot.name} (${shot.deck}#${shot.slide})`);

    // Restore chrome
    await page.evaluate(() => {
      for (const sel of ['#toolbar', '#tab-bar', '#sidebar', '.reveal .slide-number', '.reveal .footer-text']) {
        const el = document.querySelector(sel);
        if (el) el.style.display = '';
      }
    });
  }

  if (page) await page.close();
  await browser.close();
  console.log(`\n✓ ${SHOTS.length} screenshots saved to ${OUT}`);
}

capture().catch(err => { console.error(err); process.exit(1); });
