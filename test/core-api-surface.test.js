/**
 * core-api-surface.test.js — contract test for @stellardeck/core public API.
 *
 * Ensures that every consumer surface stays wired to the same set of
 * named exports as the source modules expose:
 *
 *   1. CJS  : require('@stellardeck/core/src/index.js')
 *   2. ESM  : import * as core from '@stellardeck/core/src/index.mjs'
 *   3. IIFE : dist/browser-globals.global.js (registers window.*)
 *
 * Catches regressions like the dual-export `else if (typeof window)`
 * branch that silenced window globals once the modules were bundled
 * (fixed 2026-05-04 during core extraction step 3).
 *
 * The IIFE check is skipped when the bundle hasn't been built yet —
 * `npm run -w @stellardeck/core build` produces it.
 */

const fs = require('node:fs');
const path = require('node:path');
const { test, summary } = require('./helpers/harness.js');

const CORE_ROOT = path.join(__dirname, '..', 'packages', 'core');
const CJS_ENTRY = path.join(CORE_ROOT, 'src', 'index.js');
const ESM_ENTRY = path.join(CORE_ROOT, 'src', 'index.mjs');
const IIFE_BUNDLE = path.join(CORE_ROOT, 'dist', 'browser-globals.global.js');

const EXPECTED_NAMED = [
  // Autoflow
  'applyAutoflow', 'createAutoflowContext', 'AUTOFLOW_DEFAULTS',
  'RULES', 'SKIP_CHECKS', 'LAYOUT_MODIFIERS', 'POSITIONS',
  // Parser
  'parseDecksetMarkdown', 'parseSlide', 'findMedia', 'isMediaOnly',
  'isVideo', 'isAudio', 'parseYouTube', 'extractDirectives',
  'extractNotes', 'DIRECTIVE_REGISTRY', 'FRONTMATTER_NAMES',
  'isFrontmatterLine', 'sectionAttrsFromDirectives',
  // Diagnostics (pure parts only at this layer)
  'mergeDiagnostics', 'groupDiagnostics',
  // Constants
  'CDN', 'SLIDE', 'THEMES',
];

const EXPECTED_GLOBALS = [
  'applyAutoflow',
  'createAutoflowContext',
  'parseDecksetMarkdown',
  'StellarConstants',
  'StellarDiagnostics',
  'StellarPrintMode',
];

console.log('\n── core API surface (CJS) ──');

const cjs = require(CJS_ENTRY);

for (const key of EXPECTED_NAMED) {
  test(`CJS exports ${key}`, () => {
    if (cjs[key] === undefined) {
      throw new Error(`missing CJS export: ${key}`);
    }
  });
}

test('CJS THEMES has the keynote preset', () => {
  if (!cjs.THEMES.keynote) throw new Error('THEMES.keynote missing');
});

test('CJS applyAutoflow returns rule + lines for a divider slide', () => {
  const ctx = cjs.createAutoflowContext({});
  const result = cjs.applyAutoflow(['Hello world'], 1, {}, [], ctx);
  if (!result || typeof result.lines === 'undefined') {
    throw new Error('applyAutoflow did not return a usable result');
  }
});

test('CJS parseDecksetMarkdown produces <section> HTML', () => {
  const html = cjs.parseDecksetMarkdown('# Hi\n\n---\n\n# Bye');
  if (!html.includes('<section') || (html.match(/<section/g) || []).length < 2) {
    throw new Error('expected at least 2 <section> elements');
  }
});

console.log('\n── core API surface (ESM) ──');

(async () => {
  const esm = await import(ESM_ENTRY);
  for (const key of EXPECTED_NAMED) {
    test(`ESM named export ${key}`, () => {
      if (esm[key] === undefined) {
        throw new Error(`missing ESM named export: ${key}`);
      }
    });
  }

  test('ESM default export has THEMES', () => {
    if (!esm.default || !esm.default.THEMES) {
      throw new Error('default export missing THEMES');
    }
  });

  console.log('\n── browser-globals IIFE bundle ──');

  if (!fs.existsSync(IIFE_BUNDLE)) {
    test('IIFE bundle present', () => {
      throw new Error(
        `dist/browser-globals.global.js not found.\n    ` +
        `Run: npm run -w @stellardeck/core build`,
      );
    });
    summary();
    return;
  }

  const code = fs.readFileSync(IIFE_BUNDLE, 'utf8');
  const fakeWindow = {};
  // The bundle expects window/self/globalThis to all map to the same target.
  new Function('window', 'self', 'globalThis', code)(fakeWindow, fakeWindow, fakeWindow);

  for (const g of EXPECTED_GLOBALS) {
    test(`IIFE registers window.${g}`, () => {
      if (fakeWindow[g] === undefined) {
        throw new Error(`window.${g} not set by browser-globals bundle`);
      }
    });
  }

  test('IIFE THEMES.keynote reachable via window.StellarConstants', () => {
    if (!fakeWindow.StellarConstants?.THEMES?.keynote) {
      throw new Error('StellarConstants.THEMES.keynote not registered');
    }
  });

  console.log('\n── types.d.ts ↔ runtime drift ──');

  const dtsPath = path.join(CORE_ROOT, 'src', 'types.d.ts');
  const dts = fs.readFileSync(dtsPath, 'utf8');

  // Pull every `export const NAME` and `export function NAME` from the .d.ts.
  // (Interfaces, types, and namespaces are ignored — they're compile-time only.)
  const valueExports = new Set();
  const constRe = /^export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  const fnRe = /^export\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  let m;
  while ((m = constRe.exec(dts)) !== null) valueExports.add(m[1]);
  while ((m = fnRe.exec(dts)) !== null) valueExports.add(m[1]);

  test('types.d.ts declares at least 25 value exports (sanity floor)', () => {
    if (valueExports.size < 25) {
      throw new Error(`only found ${valueExports.size} exports — regex broken or surface shrunk`);
    }
  });

  for (const name of valueExports) {
    test(`types.d.ts export '${name}' has a runtime counterpart in CJS`, () => {
      if (cjs[name] === undefined) {
        throw new Error(
          `types.d.ts declares '${name}' but require('@stellardeck/core')['${name}'] is undefined.\n` +
          `    Either add it to src/index.js or remove from types.d.ts.`,
        );
      }
    });
  }

  // Reverse direction — every CJS named export should be declared in types.d.ts.
  // Skip a small allowlist of internal-but-exposed helpers we don't surface yet.
  const TYPED_ALLOW_MISSING = new Set([
    // none today; add names here only with a justification comment
  ]);
  for (const key of Object.keys(cjs)) {
    if (TYPED_ALLOW_MISSING.has(key)) continue;
    test(`CJS export '${key}' is declared in types.d.ts`, () => {
      if (!valueExports.has(key)) {
        throw new Error(
          `CJS export '${key}' missing from types.d.ts — add it or whitelist it.`,
        );
      }
    });
  }

  summary();
})();
