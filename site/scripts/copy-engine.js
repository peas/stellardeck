#!/usr/bin/env node
/**
 * Copies StellarDeck engine files into site/public/engine/
 * so the embed components can load them at runtime.
 *
 * Run: node site/scripts/copy-engine.js (or via npm run prebuild)
 */
import { cpSync, mkdirSync, existsSync as fileExists } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const dest = join(__dirname, '..', 'public', 'engine');

mkdirSync(dest, { recursive: true });

// Rename public-facing files to have a "stellar-" prefix so they don't
// collide with users' own themes.css / layout.css / autoflow.js when
// self-hosting. Source files keep their original names for internal
// consistency; the rename happens at copy time.
const files = [
  ['slides2.js', 'stellar-slides.js'],
  ['slides2.css', 'stellar-slides.css'],
  ['packages/core/src/deckset-parser.js', 'stellar-parser.js'],
  // autoflow is a directory of modules — ship the tsup bundle (built by
  // `npm install` / `npm run build -w @stellardeck/core` at the repo root)
  ['packages/core/dist/autoflow.global.js', 'stellar-autoflow.js'],
  ['embed/stellar-embed.js', 'stellar-embed.js'],
  ['css/themes.css', 'stellar-themes.css'],
  ['css/layout.css', 'stellar-layout.css'],
  ['vendor/highlight/highlight.min.js', 'highlight.min.js'],
  ['vendor/highlight/monokai.css', 'stellar-monokai.css'],
];

const missing = files.map(([src]) => src).filter(src => !fileExists(join(root, src)));
if (missing.length) {
  console.error(`copy-engine: missing ${missing.join(', ')} — run \`npm install\` (or \`npm run build -w @stellardeck/core\`) at the repo root first.`);
  process.exit(1);
}

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
  'examples/getting-started',
  'examples/kitchen-sink',
  'examples/autoflow',
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
  cpSync(brandSrc, join(__dirname, '..', 'public', 'assets', 'brand'), { recursive: true });
  // Decks reference it as ../assets/brand/… relative to their page
  for (const top of ['examples', 'guide']) {
    cpSync(brandSrc, join(__dirname, '..', 'public', top, 'assets', 'brand'), { recursive: true });
  }
  console.log('Copied brand assets');
}

// Copy test images (used by smoke-test references in kitchen-sink)
const assetFiles = [
  '20101_2c3b59.webp', '20101_9669ce.webp',
  'paulo-chocolate-collection-1.webp', 'paulo-chocolate-collection-2.webp',
  'paulo-chocolate-collection-3.webp', 'paulo-chocolate-collection-4.webp',
  'paulo-handstand.webp',
];
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
