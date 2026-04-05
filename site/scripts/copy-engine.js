#!/usr/bin/env node
/**
 * Copies StellarDeck engine files into site/public/engine/
 * so the embed components can load them at runtime.
 *
 * Run: node site/scripts/copy-engine.js (or via npm run prebuild)
 */
import { cpSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const dest = join(__dirname, '..', 'public', 'engine');

mkdirSync(dest, { recursive: true });

const files = [
  ['slides2.js', 'slides2.js'],
  ['slides2.css', 'slides2.css'],
  ['deckset-parser.js', 'deckset-parser.js'],
  ['autoflow.js', 'autoflow.js'],
  ['embed/stellar-embed.js', 'stellar-embed.js'],
  ['css/themes.css', 'themes.css'],
  ['css/layout.css', 'layout.css'],
  ['vendor/highlight/highlight.min.js', 'highlight.min.js'],
  ['vendor/highlight/monokai.css', 'monokai.css'],
];

for (const [src, destName] of files) {
  cpSync(join(root, src), join(dest, destName));
}

console.log(`Copied ${files.length} engine files to site/public/engine/`);

// Copy demo images to each example path where they'll be accessed.
// Markdown uses relative paths like "images/coaches/..." which resolve
// against the page URL "/examples/hand-balancing/images/coaches/...".
import { readdirSync, existsSync, statSync } from 'fs';

const demoImages = join(root, 'demo', 'images');
const examplePaths = [
  'examples/bean-to-bar',
  'examples/hand-balancing',
  'examples/vibe-coding',
  'guide/getting-started',
  'guide/images-layouts',
  'guide/code-math-diagrams',
  'guide/autoflow',
  'guide/themes-colors',
];

if (existsSync(demoImages)) {
  for (const exPath of examplePaths) {
    const target = join(__dirname, '..', 'public', exPath, 'images');
    cpSync(demoImages, target, { recursive: true });
  }
  // Also copy to /demo/images/ for the deck viewer at root level
  cpSync(demoImages, join(__dirname, '..', 'public', 'demo', 'images'), { recursive: true });
  console.log(`Copied demo images to ${examplePaths.length + 1} paths`);
}

// Copy brand assets (used by kitchen-sink demo)
const brandSrc = join(root, 'assets', 'brand');
if (existsSync(brandSrc)) {
  const brandDest = join(__dirname, '..', 'public', 'assets', 'brand');
  cpSync(brandSrc, brandDest, { recursive: true });
  console.log('Copied brand assets');
}

// Copy test images (used by smoke-test references in kitchen-sink)
const assetFiles = ['20101_2c3b59.webp', '20101_9669ce.webp'];
for (const f of assetFiles) {
  const src = join(root, 'assets', f);
  if (existsSync(src)) {
    for (const exPath of examplePaths) {
      const assetsDest = join(__dirname, '..', 'public', exPath, '..', 'assets');
      mkdirSync(assetsDest, { recursive: true });
      cpSync(src, join(assetsDest, f));
    }
  }
}
