# @stellardeck/core

Engine for [StellarDeck](https://stellardeck.dev) — a markdown
presentation tool. This package contains the parser, autoflow layout
inference, deck health diagnostics, and shared constants. **Pure JS,
no DOM, no Node-only modules**: runs in Node 20+, browsers, and Web
Workers.

> Currently private. The package will be published once the surface
> stabilises and the VS Code extension consuming it ships.

## Status

- API stability: **internal**, expected to change before 1.0.
- Test coverage: 511 unit tests across host shell + 33 contract /
  drift / pure-rule tests local to the package.
- Render parity: validated by the StellarDeck app (Electron),
  browser viewer, embed playground, and CLI exporter — all four
  consume this package.

## Layout

```
src/
  index.js              CJS public API barrel
  index.mjs             ESM barrel (re-exports index.js named keys)
  types.d.ts            Hand-written type definitions
  autoflow.js           Layout inference rules (declarative)
  deckset-parser.js     Deckset markdown → <section> HTML
  diagnostics.js        DOM-bound deck health checks
  diagnose-rules.js     Pure rules (snapshot → warnings, no DOM)
  constants.js          THEMES registry, slide dims, CDN URLs
  print-mode.js         Browser-only: enter/exit print/export mode
  browser-globals.js    Bundle entry — registers window.* globals
dist/
  browser-globals.global.js   Built IIFE (loaded via <script>)
```

## Public API

```js
const {
  // Autoflow
  applyAutoflow, createAutoflowContext, AUTOFLOW_DEFAULTS,
  RULES, SKIP_CHECKS, LAYOUT_MODIFIERS, POSITIONS,

  // Parser
  parseDecksetMarkdown, parseSlide,
  findMedia, isMediaOnly, isVideo, isAudio, parseYouTube,
  extractDirectives, extractNotes,
  DIRECTIVE_REGISTRY, FRONTMATTER_NAMES, isFrontmatterLine,
  sectionAttrsFromDirectives,

  // Diagnostics
  mergeDiagnostics, groupDiagnostics,

  // Constants
  CDN, SLIDE, THEMES,
} = require('@stellardeck/core');
```

ESM consumers use the same names:

```js
import { parseDecksetMarkdown, applyAutoflow, THEMES } from '@stellardeck/core';
```

### Subpath imports

When you only need one slice of the engine, import the module directly
to keep the surface narrow:

| Subpath                              | What it exports                                    |
| ------------------------------------ | -------------------------------------------------- |
| `@stellardeck/core/autoflow`         | `applyAutoflow`, `createContext`, RULES, …          |
| `@stellardeck/core/parser`           | `parseDecksetMarkdown`, `parseSlide`, media helpers |
| `@stellardeck/core/diagnostics`      | DOM-bound `diagnoseSlide` + `merge` / `groupWarnings` |
| `@stellardeck/core/diagnose-rules`   | Pure rules: `runPureRules`, `statementDegradedRule`, … |
| `@stellardeck/core/constants`        | `CDN`, `SLIDE`, `THEMES`                            |
| `@stellardeck/core/print-mode`       | Browser print/export mode (enter / exit)            |

## Browser usage (script tag)

For HTML pages without a bundler:

```html
<script src="@stellardeck/core/dist/browser-globals.global.js"></script>
<script>
  const html = window.parseDecksetMarkdown(myMarkdown);
  // window.applyAutoflow, window.StellarConstants.THEMES, etc.
</script>
```

The bundle registers six globals: `applyAutoflow`,
`createAutoflowContext`, `parseDecksetMarkdown`, `StellarConstants`,
`StellarDiagnostics`, `StellarPrintMode`. It is built via
`npm run build` (tsup → IIFE).

## Web compat

Pure-JS path (parser, autoflow, diagnose-rules, constants) avoids:

- `document`, `window`, `getComputedStyle`, `getBoundingClientRect`
- `fs`, `path`, `child_process`, `os`, native modules

DOM-bound modules (`diagnostics.js`, `print-mode.js`) only run when a
browser context exists; in Node they are still requireable but their
DOM-touching functions will throw if invoked.

## Building

```bash
npm install            # workspaces hoist tsup, dist is built via prepare hook
npm run build          # tsup → dist/browser-globals.global.js
```

The CJS / ESM source under `src/` is consumed directly without a
build step — only the IIFE bundle needs tsup.

## License

MIT — same as the parent StellarDeck repo.
