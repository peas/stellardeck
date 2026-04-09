# stellardeck

A markdown presentation tool: write Deckset-flavored markdown, get a polished slideshow with auto-inferred layouts, no build step, render parity across desktop (Tauri), browser, embed, and CLI export.

## What StellarDeck is

Built on four ideas:

1. **Storytelling.** Slides are moments. Markdown's constraints keep focus on what you're saying.
2. **Autoflow.** Convention over configuration. Write content, get layouts. 8+ rules, anti-monotony.
3. **Agent-native.** CLI with JSON output, stdin, batch mode, structured diagnostics. Agents create decks from source text, export, validate, iterate.
4. **Simple.** No build step, no bundler. The `.md` file is the artifact. Render parity across Tauri, browser, embed, CLI.

Design principle: **"Can an LLM generate this?"** If yes, it belongs. If no, it doesn't.

## Working with your own decks

StellarDeck doesn't bundle decks — they live wherever you keep them. Most users have a directory of `.md` files separate from this repo.

**To tell Claude Code (or any agent) where your decks live**, create a `CLAUDE.local.md` at the repo root (it's gitignored). For example:

```markdown
## My deck directory

My personal decks live in `~/my-decks/`. When working on engine features, smoke
test against decks in that directory before committing.

When I say "open my deck X" or "validate my decks", look there first.
```

This pattern keeps personal paths out of the public repo while still giving agents enough context to navigate.

## Commands

```bash
npm install                # install deps (sharp, pdf-lib)
npm run serve              # python3 dev-server.py 3031 (no-cache headers)
npm test                   # 318 unit tests (~3s): parser, helpers, autoflow, structure, CLI, diagnostics
npm run test:e2e           # 70 Playwright E2E tests (chromium)
npm run test:layout        # 32 layout + consistency tests
npm run test:export        # 40 CLI integration tests (PDF, PNG, grid, batch, warnings)
npm run test:export:unit   # export unit tests only (no browser)
npm run test:visual        # 18 visual regression tests
npm run test:all           # all of the above
npm run export -- deck.md  # export (--pdf default, --png, --grid, --json, --help)
npm run pdf -- deck.md     # alias for --pdf
npm run tauri              # cargo tauri dev (HTTP server + desktop app)
```

## Project structure

```
.
├── viewer.html               # App shell
├── autoflow.js               # Autoflow layout inference (browser global + CommonJS)
├── slides2.js / slides2.css  # StellarSlides engine (sole engine)
├── deckset-parser.js         # Markdown → slide HTML
├── diagnostics.js            # Deck health checks: overflow, missing-image, empty-slide, code-no-lang
├── print-mode.js             # Shared enter/exit print mode (used by CLI + in-browser export)
├── constants.js              # CDN URLs + slide dimensions
├── css/                      # themes.css, layout.css, chrome.css, presenter.css
├── js/                       # Main app modules (ES modules)
├── embed/                    # Embeddable API (stellar-embed.js, playground)
├── scripts/                  # CLI export, dev-server, helpers
├── test/                     # Unit + integration tests
├── docs/                     # format-spec.yaml, autoflow plan, roadmap
├── src-tauri/                # Tauri 2.0 desktop app
├── samples/                  # Sample decks
└── .claude/skills/stellardeck/ # Claude Code skill: source text → slides
```

## Architecture (1-paragraph version)

A `.md` file is parsed by `deckset-parser.js` into a list of `<section>` HTML, optionally pre-processed by `autoflow.js` (which infers layouts from content shape), then rendered by `slides2.js` (the StellarSlides engine — vanilla JS, ~380 lines). The same pipeline runs in 4 environments: Tauri (WKWebView), browser (`viewer.html`), embed (`stellar-embed.js`), and CLI (`scripts/export.js` via Playwright). `stellar-embed.js` is the shared rendering layer for embed; the other three reuse the engine modules directly. **Render parity is a hard rule** — never add a feature in one environment without the others.

## Module system gotcha

Plain scripts (`autoflow.js`, `deckset-parser.js`, `slides2.js`, `diagnostics.js`, `print-mode.js`, `constants.js`) expose **both** browser globals AND `module.exports` for Node tests. ES modules (`js/*.js`) import from each other and access globals via `window`. Why: WKWebView + ES modules fail silently on 404. Don't convert these to ES modules.

## Format

Deckset markdown: `---` = separator, `![right]()` / `![left]()` = split, `![filtered]()` = dark overlay background, `![inline]()` = inline image, `![fit]()` = contain background, `#[fit]` = auto-fit heading, `#[top-left]` = positioned, `^` = speaker note, `[.background-color: #hex]` = per-slide. Full spec: `docs/format-spec.yaml` (66 features).

## Autoflow

Convention-over-configuration layout inference. Adding a rule = 1 function + 1 entry in the `RULES` array.

| Rule | Detection | Transform |
|------|-----------|-----------|
| title | First slide, 2+ paragraphs, short title | `#[fit]` centered + subtitle |
| divider | 1-2 word slide | `#[fit]` heading |
| diagonal | 2 paragraphs, ≥1 ends "?" | `#[top-left]` + `#[bottom-right]` |
| z-pattern | 4 short paragraphs | 4-corner grid |
| alternating | 3+ short paragraphs | `[.alternating-colors: true]` |
| statement | 1-4 short lines (≤8 words) | `#[fit]`, varied alignment |
| split | 1 bare image + text | `![right]`/`![left]` alternating |
| autoscale | >8 lines OR >80 words | `[.autoscale: true]` |

Anti-monotony: statements vary alignment, diagonals mirror corners. Skip checks: explicit directives, code fences, custom blocks.

## CLI (`scripts/export.js`)

Multi-format export built on a shared `captureSlides()` → `exportByFormat()` pipeline.

- Formats: `--pdf` (default), `--png` (one per slide), `--grid` (composite via sharp)
- Filters: `--slides 1-5,7` (range/list), `--theme`, `--scheme`, `--autoflow`, `--scale`
- Batch: `--input-dir dir --output dir` (shared browser session across files)
- Validation: `--validate` (no export, just diagnostics), `--list-themes`, `--list-schemes <theme>`
- Agent: `--json` (typed output), stdin (`-`), structured warnings
- Throws `CLIError` / `HelpRequested` (testable, no `process.exit` in `parseArgs`)

## Diagnostics

Structured warnings (`{type, severity, slide, message}`) consumed by:

- **CLI**: per-slide checks during capture + network-level image detection
- **App**: toolbar badge + floating panel, incremental on navigation
- **Embed**: `onDiagnostics` callback in `renderDeck()` options

Types: `overflow`, `missing-image`, `empty-slide`, `code-no-lang`, `theme-mismatch`, `slide-out-of-range`.

## Working Conventions

- All scripts have `--help`
- CSS/layout changes require `npm run test:visual` before committing
- `test/smoke-test.md` is the reference for all supported features
- PDFs are gitignored (regenerable)
- StellarDeck NEVER edits the `.md` file — config lives in `.stellar.json` sidecars
- **Adding a dependency**: update `package.json` AND run `npm install` to refresh `package-lock.json`. CI runs `npm ci` and will fail with `EUSAGE` if the lockfile drifts.

## Roadmap

### Immediate (0.9)
- GitHub Actions CI: green
- Tag v0.9.0 + release
- Skill `stellardeck`: source text → slides with scoring (in `.claude/skills/stellardeck/`)

### Post-0.9
- VSCode extension (live preview, IntelliSense, diagnostics)
- Config file `.stellarrc` (workspace defaults)
- Server mode `stellardeck serve` (`?pdf`, `?pptx` endpoints)
- `@stellardeck/core` npm package
- `headingDivider` directive (auto-split at H1/H2)
- Custom slide sizes (4:3, 16:10)
- `--html` self-contained export
- `--parallel N` for batch
- Runtime theme registration
- **Autoflow rule: lone-URL → QR.** If a slide has only one URL line (and optionally a short label), autoflow renders it as a QR code via the existing `![qr]()` machinery. Open question: collide with slides that just want a clickable link? Prototype behind a flag first.

### 1.0
- Windows build + CI
- Polish from early adopter feedback
- MCP server (when interactive use cases emerge)
- ASCII art directive (`:::ascii` block, `figlet.js`)

### 2.0+
- PPTX/Google Slides importer → markdown + autoflow
- Web platform: GitHub OAuth + static editor

## Tauri Dev Gotchas

- WKWebView caches aggressively: `_cb=N` cache-buster URLs in dev
- JS errors are silent: use `log::info!()` in Rust + dynamic `import()` to debug
- `cargo tauri dev` only hot-reloads Rust: HTML/JS need Cmd+R
- cwd is `src-tauri/`: use `get_project_root` to resolve paths
- Tauri errors are strings: `err?.message || String(err)`
- `[.background-color: #hex]` overrides scheme (correct Deckset behavior)

## Repo origin

This repo is a sync target from `peas/presentations-paulo`, where the engine was originally developed alongside Paulo Silveira's personal decks. As of 2026-04, work is shifting to `peas/stellardeck` as the primary development base. The sync script in the source repo skips `assets/`, `demo/`, `site/`, `LICENSE`, `README.md`, and `.github/` so they remain stable here.
